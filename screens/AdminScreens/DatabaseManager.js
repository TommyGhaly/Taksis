// DatabaseManagerScreen.js
// Firestore admin tool, redesigned to match the rest of the Taksis design system.
// Gates on superAdmin role. Browse the registered collections, drill into docs,
// edit fields with type-safe parsing, run audited bulk deletes with typed
// confirmation. All mutations write to _admin_audit.

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Animated,
  AppState,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {
  KNOWN_COLLECTIONS,
  AUDIT_COLLECTION,
  BULK_HARD_CEILING,
} from '../../utils/databaseRegistry';

// ---------- helpers ----------

const PAGE_SIZE = 25;

const detectType = (v) => {
  if (v === null || v === undefined) return 'null';
  if (v && typeof v.toDate === 'function') return 'timestamp';
  if (v && v.latitude !== undefined && v.longitude !== undefined) return 'geopoint';
  if (v && v.id && v.path && typeof v.path === 'string') return 'reference';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') return 'map';
  return typeof v;
};

const previewValue = (v) => {
  const t = detectType(v);
  if (t === 'timestamp') return v.toDate().toISOString();
  if (t === 'reference') return v.path;
  if (t === 'geopoint') return `(${v.latitude}, ${v.longitude})`;
  if (t === 'array') return `${v.length} items`;
  if (t === 'map') return `${Object.keys(v).length} fields`;
  if (t === 'null') return 'null';
  if (t === 'boolean') return v ? 'true' : 'false';
  return String(v);
};

const isComplex = (v) => {
  const t = detectType(v);
  return t === 'array' || t === 'map';
};

const TYPE_COLORS = {
  string: '#34c759',
  number: '#ff9f0a',
  boolean: '#bf5af2',
  timestamp: '#5ac8fa',
  reference: '#147efb',
  geopoint: '#30d158',
  array: '#ff9f0a',
  map: '#ff9f0a',
  null: 'rgba(255,255,255,0.4)',
};

// Format a Date as "Jan 5, 2026, 3:42 PM" + relative time below
const formatTimestamp = (date) => {
  const abs = date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const absSec = Math.abs(diffSec);
  let rel;
  if (absSec < 60) rel = diffSec >= 0 ? 'just now' : 'in a moment';
  else if (absSec < 3600) rel = `${Math.round(absSec / 60)}m ${diffSec >= 0 ? 'ago' : 'from now'}`;
  else if (absSec < 86400) rel = `${Math.round(absSec / 3600)}h ${diffSec >= 0 ? 'ago' : 'from now'}`;
  else if (absSec < 2592000) rel = `${Math.round(absSec / 86400)}d ${diffSec >= 0 ? 'ago' : 'from now'}`;
  else if (absSec < 31536000) rel = `${Math.round(absSec / 2592000)}mo ${diffSec >= 0 ? 'ago' : 'from now'}`;
  else rel = `${Math.round(absSec / 31536000)}y ${diffSec >= 0 ? 'ago' : 'from now'}`;
  return { abs, rel };
};

const writeAudit = async (action, path, before, after, meta = {}) => {
  try {
    await firestore().collection(AUDIT_COLLECTION).add({
      ts: firestore.FieldValue.serverTimestamp(),
      uid: auth().currentUser?.uid || null,
      action,
      path,
      before: before ?? null,
      after: after ?? null,
      meta,
    });
  } catch (e) {
    console.warn('audit write failed', e);
  }
};

const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

// Recursively search a value for a substring. Handles strings, numbers,
// booleans, arrays, maps, timestamps, references, geopoints.
const valueContains = (v, q) => {
  if (v == null) return false;
  const t = detectType(v);
  if (t === 'timestamp') return v.toDate().toISOString().toLowerCase().includes(q);
  if (t === 'reference') return v.path.toLowerCase().includes(q);
  if (t === 'geopoint') return `${v.latitude},${v.longitude}`.includes(q);
  if (t === 'array') return v.some((x) => valueContains(x, q));
  if (t === 'map') return Object.values(v).some((x) => valueContains(x, q));
  return String(v).toLowerCase().includes(q);
};

// Render any value to a short string for inline use (used inside arrays/maps
// in InlineValue). Recurses into arrays/maps but caps depth so a deeply
// nested map doesn't expand forever.
const inlineSummary = (v, depth = 0) => {
  if (v == null) return 'null';
  const t = detectType(v);
  if (t === 'timestamp') return formatTimestamp(v.toDate()).rel;
  if (t === 'reference') return `→${v.path}`;
  if (t === 'geopoint') return `(${v.latitude.toFixed(2)},${v.longitude.toFixed(2)})`;
  if (t === 'string') return v.length > 24 ? `"${v.slice(0, 24)}…"` : `"${v}"`;
  if (t === 'boolean') return v ? 'true' : 'false';
  if (t === 'number') return String(v);
  if (depth >= 1) {
    // Avoid runaway nesting in the inline summary
    if (t === 'array') return `[${v.length}]`;
    if (t === 'map') return `{${Object.keys(v).length}}`;
  }
  if (t === 'array') {
    if (v.length === 0) return '[]';
    return `[${v.slice(0, 4).map((x) => inlineSummary(x, depth + 1)).join(', ')}${v.length > 4 ? ', …' : ''}]`;
  }
  if (t === 'map') {
    const keys = Object.keys(v);
    if (keys.length === 0) return '{}';
    const parts = keys.slice(0, 4).map((k) => `${k}: ${inlineSummary(v[k], depth + 1)}`);
    return `{${parts.join(', ')}${keys.length > 4 ? ', …' : ''}}`;
  }
  return String(v);
};

// ---------- value renderers ----------

// Compact one-line value for list rows. Type-aware coloring, but kept tight.
function InlineValue({ value, style }) {
  const t = detectType(value);

  if (t === 'boolean') {
    return (
      <View style={[styles.inlineBoolPill, { backgroundColor: value ? 'rgba(52,199,89,0.15)' : 'rgba(255,69,58,0.15)' }]}>
        <Text style={[styles.inlineBoolText, { color: value ? '#34c759' : '#ff453a' }]}>
          {value ? 'true' : 'false'}
        </Text>
      </View>
    );
  }
  if (t === 'null') {
    return <Text style={[style, styles.inlineNull]} numberOfLines={1}>null</Text>;
  }
  if (t === 'timestamp') {
    return <Text style={[style, { color: '#5ac8fa' }]} numberOfLines={1}>{formatTimestamp(value.toDate()).rel}</Text>;
  }
  if (t === 'reference') {
    return <Text style={[style, styles.inlineRef]} numberOfLines={1}>→ {value.path}</Text>;
  }
  if (t === 'array') {
    if (value.length === 0) {
      return <Text style={[style, styles.inlineMeta]} numberOfLines={1}>[ ]</Text>;
    }
    const summary = value.slice(0, 4).map((x) => inlineSummary(x, 1)).join(', ');
    return (
      <Text style={[style, styles.inlineCollection]} numberOfLines={1}>
        [{summary}{value.length > 4 ? `, … +${value.length - 4}` : ''}]
      </Text>
    );
  }
  if (t === 'map') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return <Text style={[style, styles.inlineMeta]} numberOfLines={1}>{'{ }'}</Text>;
    }
    const parts = keys.slice(0, 3).map((k) => `${k}: ${inlineSummary(value[k], 1)}`);
    return (
      <Text style={[style, styles.inlineCollection]} numberOfLines={1}>
        {`{${parts.join(', ')}${keys.length > 3 ? `, … +${keys.length - 3}` : ''}}`}
      </Text>
    );
  }
  if (t === 'number') {
    return <Text style={[style, styles.inlineNumber]} numberOfLines={1}>{value}</Text>;
  }
  return <Text style={style} numberOfLines={1}>{String(value)}</Text>;
}

// Full type-aware value display for the document detail view. Booleans get
// pills, timestamps show absolute + relative, references show path, arrays
// and maps render as collapsible JSON, long strings collapse.
function FieldValueDisplay({ value }) {
  const t = detectType(value);
  const [expanded, setExpanded] = useState(false);

  if (t === 'null') {
    return (
      <View style={styles.valueRow}>
        <View style={styles.nullPill}><Text style={styles.nullPillText}>null</Text></View>
      </View>
    );
  }

  if (t === 'boolean') {
    return (
      <View style={styles.valueRow}>
        <View style={[
          styles.boolPill,
          { backgroundColor: value ? 'rgba(52,199,89,0.12)' : 'rgba(255,69,58,0.12)',
            borderColor: value ? 'rgba(52,199,89,0.3)' : 'rgba(255,69,58,0.3)' },
        ]}>
          <Ionicons name={value ? 'checkmark-circle' : 'close-circle'} size={14} color={value ? '#34c759' : '#ff453a'} />
          <Text style={[styles.boolPillText, { color: value ? '#34c759' : '#ff453a' }]}>
            {value ? 'true' : 'false'}
          </Text>
        </View>
      </View>
    );
  }

  if (t === 'number') {
    return (
      <View style={styles.valueRow}>
        <Text style={styles.numberValue}>{value}</Text>
      </View>
    );
  }

  if (t === 'timestamp') {
    const { abs, rel } = formatTimestamp(value.toDate());
    return (
      <View style={styles.timestampRow}>
        <Ionicons name="time-outline" size={14} color="#5ac8fa" />
        <View style={{ flex: 1 }}>
          <Text style={styles.timestampAbs}>{abs}</Text>
          <Text style={styles.timestampRel}>{rel}</Text>
        </View>
      </View>
    );
  }

  if (t === 'reference') {
    return (
      <View style={styles.referenceRow}>
        <Ionicons name="link" size={14} color="#147efb" />
        <Text style={styles.referencePath} numberOfLines={2}>{value.path}</Text>
      </View>
    );
  }

  if (t === 'geopoint') {
    return (
      <View style={styles.referenceRow}>
        <Ionicons name="location" size={14} color="#30d158" />
        <Text style={styles.geoPoint}>
          {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
        </Text>
      </View>
    );
  }

  if (t === 'array' || t === 'map') {
    const json = JSON.stringify(value, (_k, v) => {
      // Stringify special types readably
      if (v && typeof v.toDate === 'function') return v.toDate().toISOString();
      if (v && v.path && v.id) return `[ref: ${v.path}]`;
      if (v && v.latitude !== undefined && v.longitude !== undefined) return `[geo: ${v.latitude}, ${v.longitude}]`;
      return v;
    }, 2);
    const isLong = json.split('\n').length > 6;
    return (
      <View style={styles.jsonContainer}>
        <Text
          style={styles.jsonText}
          numberOfLines={!expanded && isLong ? 6 : undefined}
        >
          {json}
        </Text>
        {isLong && (
          <TouchableOpacity onPress={() => setExpanded((e) => !e)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.jsonToggle}>{expanded ? 'Show less' : 'Show all'}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // String
  const str = String(value);
  const isLong = str.length > 140;
  return (
    <View style={styles.valueRow}>
      <Text
        style={styles.stringValue}
        numberOfLines={!expanded && isLong ? 3 : undefined}
      >
        {str || <Text style={styles.emptyString}>(empty string)</Text>}
      </Text>
      {isLong && (
        <TouchableOpacity onPress={() => setExpanded((e) => !e)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.jsonToggle}>{expanded ? 'Show less' : 'Show all'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---------- main screen ----------

// Gate states:
//   checking  - verifying superAdmin role
//   bio_prompt - role verified, biometric prompt is showing or pending retry
//   ok        - both role and biometric passed; screen unlocked
//   denied    - role check failed (no recovery)
//   locked    - was unlocked, app went to background, needs re-auth on return
//   bio_unavailable - device has no biometrics or device passcode set up
const REAUTH_AFTER_BACKGROUND_MS = 30 * 1000; // re-prompt only if backgrounded > 30s

export default function DatabaseManagerScreen() {
  const [view, setView] = useState('root');
  const [stack, setStack] = useState([]);
  const [gateState, setGateState] = useState('checking');
  const [bioError, setBioError] = useState(null);

  const backgroundedAt = useRef(null);
  const appState = useRef(AppState.currentState);

  // Step 1: verify superAdmin role.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const uid = auth().currentUser?.uid;
        if (!uid) {
          if (alive) setGateState('denied');
          return;
        }
        const snap = await firestore().collection('users').doc(uid).get();
        const isSuper = snap.exists ? snap.data()?.superAdmin === true : false;
        if (!alive) return;
        if (!isSuper) {
          setGateState('denied');
        } else {
          setGateState('bio_prompt');
        }
      } catch {
        if (alive) setGateState('denied');
      }
    })();
    return () => { alive = false; };
  }, []);

  // Step 2: biometric prompt. Runs whenever we enter bio_prompt or locked state.
  const runBiometric = useCallback(async () => {
    setBioError(null);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        // No biometrics or passcode set up — fail closed. Better than letting
        // someone with physical access walk into the DB admin tool.
        setGateState('bio_unavailable');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Database Admin',
        // On Android, fallback to device PIN/pattern if biometric fails.
        // On iOS this is the default — the system shows passcode after failed Face ID.
        disableDeviceFallback: false,
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
      });

      if (result.success) {
        setGateState('ok');
        backgroundedAt.current = null;
      } else {
        // result.error: 'user_cancel', 'system_cancel', 'lockout', 'authentication_failed', etc.
        setBioError(
          result.error === 'lockout' || result.error === 'lockout_permanent'
            ? 'Too many attempts. Try again later or use device passcode.'
            : null
        );
        // Stay in bio_prompt so the user can retry without losing the screen.
      }
    } catch (e) {
      setBioError(e.message || 'Authentication error');
    }
  }, []);

  // Auto-fire biometric prompt when entering bio_prompt state.
  useEffect(() => {
    if (gateState === 'bio_prompt') {
      runBiometric();
    }
  }, [gateState, runBiometric]);

  // Re-lock when app goes to background; re-prompt when it comes back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appState.current;
      appState.current = next;

      if (gateState !== 'ok') return;

      if (next === 'background' || next === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (next === 'active' && prev !== 'active') {
        const elapsed = backgroundedAt.current
          ? Date.now() - backgroundedAt.current
          : 0;
        if (elapsed > REAUTH_AFTER_BACKGROUND_MS) {
          setGateState('locked');
        }
      }
    });
    return () => sub.remove();
  }, [gateState]);

  // When locked, fire the biometric prompt again.
  useEffect(() => {
    if (gateState === 'locked') {
      runBiometric();
    }
  }, [gateState, runBiometric]);

  const goCollection = (path, label) => {
    setStack([{ type: 'collection', path, label: label || path }]);
    setView('collection');
  };
  const goDocument = (path, label) => {
    setStack((s) => [...s, { type: 'document', path, label }]);
    setView('document');
  };
  const goSubcollection = (path, label) => {
    setStack((s) => [...s, { type: 'collection', path, label }]);
    setView('collection');
  };
  const goBack = () => {
    setStack((s) => {
      const next = s.slice(0, -1);
      if (next.length === 0) setView('root');
      else setView(next[next.length - 1].type);
      return next;
    });
  };

  // ---------- Gate UI ----------
  if (gateState === 'checking') {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#147efb" size="large" />
        <Text style={styles.loadingText}>Verifying access…</Text>
      </SafeAreaView>
    );
  }
  if (gateState === 'denied') {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.deniedIcon}>
          <Ionicons name="lock-closed" size={36} color="#ff453a" />
        </View>
        <Text style={styles.deniedTitle}>Access denied</Text>
        <Text style={styles.deniedSub}>This area requires superAdmin privileges.</Text>
      </SafeAreaView>
    );
  }
  if (gateState === 'bio_unavailable') {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.deniedIcon}>
          <Ionicons name="finger-print" size={36} color="#ff9f0a" />
        </View>
        <Text style={styles.deniedTitle}>Biometric setup required</Text>
        <Text style={styles.deniedSub}>
          This screen requires Face ID, Touch ID, or a device passcode. Set one up in your device settings to continue.
        </Text>
      </SafeAreaView>
    );
  }
  if (gateState === 'bio_prompt' || gateState === 'locked') {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.bioIcon}>
          <Ionicons
            name={Platform.OS === 'ios' ? 'scan-circle-outline' : 'finger-print'}
            size={48}
            color="#147efb"
          />
        </View>
        <Text style={styles.deniedTitle}>
          {gateState === 'locked' ? 'Locked' : 'Authentication required'}
        </Text>
        <Text style={styles.deniedSub}>
          {gateState === 'locked'
            ? 'Verify your identity to resume.'
            : 'Verify your identity to access the Database Admin tool.'}
        </Text>
        {bioError ? (
          <Text style={styles.bioError}>{bioError}</Text>
        ) : null}
        <TouchableOpacity style={styles.bioRetryBtn} onPress={runBiometric} activeOpacity={0.7}>
          <Ionicons name="lock-open-outline" size={16} color="#fff" />
          <Text style={styles.bioRetryText}>
            {bioError ? 'Try again' : 'Authenticate'}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const current = stack[stack.length - 1];

  return (
    <SafeAreaView style={styles.screen}>
      <Header view={view} stack={stack} onBack={view !== 'root' ? goBack : null} />
      {view === 'root' && <RootList onPick={goCollection} />}
      {view === 'collection' && (
        <CollectionView
          collectionPath={current.path}
          label={current.label}
          onOpenDoc={(docPath, id) => goDocument(docPath, id)}
        />
      )}
      {view === 'document' && (
        <DocumentView
          docPath={current.path}
          label={current.label}
          onOpenSubcollection={goSubcollection}
          onAfterDelete={goBack}
        />
      )}
    </SafeAreaView>
  );
}

// ---------- header / breadcrumb ----------

function Header({ view, stack, onBack }) {
  const title = view === 'root'
    ? 'Database'
    : stack[stack.length - 1]?.label || 'Database';

  const subtitle = view === 'root'
    ? `${KNOWN_COLLECTIONS.length} collections`
    : stack.map((s) => s.label).join(' / ');

  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color="#147efb" />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 32 }} />
      )}
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.headerSub} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={{ width: 32 }} />
    </View>
  );
}

// ---------- root: list of registered collections ----------

function RootList({ onPick }) {
  return (
    <FlatList
      data={KNOWN_COLLECTIONS}
      keyExtractor={(c) => c.path}
      contentContainerStyle={styles.rootList}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.collectionCard}
          onPress={() => onPick(item.path, item.displayName)}
          activeOpacity={0.7}
        >
          <View style={styles.collectionIconWrap}>
            <Ionicons
              name={item.protected ? 'shield-checkmark' : 'folder'}
              size={20}
              color={item.protected ? '#ff9f0a' : '#147efb'}
            />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.collectionTitleRow}>
              <Text style={styles.collectionTitle}>{item.displayName}</Text>
              {item.protected && (
                <View style={styles.protectedBadge}>
                  <Text style={styles.protectedBadgeText}>Protected</Text>
                </View>
              )}
            </View>
            <Text style={styles.collectionPath}>/{item.path}</Text>
            {item.subcollections?.length > 0 && (
              <Text style={styles.collectionMeta}>
                {item.subcollections.length} subcollection{item.subcollections.length === 1 ? '' : 's'}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
        </TouchableOpacity>
      )}
    />
  );
}

// ---------- collection view ----------

function CollectionView({ collectionPath, label, onOpenDoc }) {
  const config = useMemo(
    () => KNOWN_COLLECTIONS.find((c) => c.path === collectionPath) || {
      path: collectionPath,
      displayName: collectionPath,
    },
    [collectionPath]
  );

  const collRef = useMemo(() => {
    const segs = collectionPath.split('/').filter(Boolean);
    let ref = firestore().collection(segs[0]);
    for (let i = 1; i < segs.length; i += 2) {
      ref = ref.doc(segs[i]).collection(segs[i + 1]);
    }
    return ref;
  }, [collectionPath]);

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastCursor, setLastCursor] = useState(null);
  const [done, setDone] = useState(false);
  const [search, setSearch] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [confirmState, setConfirmState] = useState(null);
  const [sortField, setSortField] = useState(null); // resolved at first page load

  const searchInputRef = useRef(null);
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  // Synchronous guards. React state updates are async, so two callers can both
  // pass `if (loading) return` before either's setLoading(true) lands. Refs
  // give us a same-tick mutex. cursorRef avoids stale-closure issues where
  // the same cursor gets used twice for sequential pages.
  const loadingRef = useRef(false);
  const cursorRef = useRef(null);
  const seenIdsRef = useRef(new Set());

  // Lift the floating search bar above the keyboard
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
        useNativeDriver: false,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [keyboardOffset]);

  const loadPage = useCallback(async (reset = false) => {
    // Synchronous mutex — no state-based race conditions.
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      // Resolve sort strategy on first load:
      // 1. config.sortBy if set in registry
      // 2. 'name' if any doc in the first page has a name field
      // 3. fall back to document id
      let activeSort = sortField;
      let probeDocs = null;
      if (reset || !activeSort) {
        if (config.sortBy) {
          activeSort = config.sortBy;
        } else {
          const probe = await collRef
            .orderBy(firestore.FieldPath.documentId())
            .limit(PAGE_SIZE)
            .get();
          probeDocs = probe.docs;
          const hasName = probe.docs.some((d) => typeof d.data()?.name === 'string');
          activeSort = hasName ? 'name' : '__id__';
        }
        setSortField(activeSort);
      }

      const cursor = reset ? null : cursorRef.current;

      let snap;
      if (activeSort === '__id__') {
        if (probeDocs && reset) {
          snap = { docs: probeDocs };
        } else {
          let q = collRef.orderBy(firestore.FieldPath.documentId()).limit(PAGE_SIZE);
          if (cursor) q = q.startAfter(cursor);
          snap = await q.get();
        }
      } else {
        let q = collRef.orderBy(activeSort).limit(PAGE_SIZE);
        if (cursor) q = q.startAfter(cursor);
        snap = await q.get();
      }

      // Dedup against the running set of seen ids so a duplicate fetch (from
      // strict-mode double-invocation, rapid effect re-runs, etc.) can't
      // produce visible duplicates in the list.
      if (reset) seenIdsRef.current = new Set();
      const newDocs = [];
      for (const d of snap.docs) {
        if (seenIdsRef.current.has(d.id)) continue;
        seenIdsRef.current.add(d.id);
        newDocs.push({ id: d.id, data: d.data(), ref: d.ref });
      }

      setDocs((prev) => reset ? newDocs : [...prev, ...newDocs]);
      const lastSnapDoc = snap.docs[snap.docs.length - 1];
      if (lastSnapDoc) cursorRef.current = lastSnapDoc;
      setLastCursor(lastSnapDoc || cursorRef.current);
      setDone(snap.docs.length < PAGE_SIZE);
    } catch (e) {
      Alert.alert('Load error', e.message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [collRef, sortField, config.sortBy]);

  useEffect(() => {
    setDocs([]);
    setLastCursor(null);
    setDone(false);
    setSelected(new Set());
    setSelectMode(false);
    setSortField(null);
    cursorRef.current = null;
    seenIdsRef.current = new Set();
    loadingRef.current = false;
    loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPath]);

  // Universal search: doc id + every field value (recursive)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => {
      if (d.id.toLowerCase().includes(q)) return true;
      const data = d.data || {};
      for (const v of Object.values(data)) {
        if (valueContains(v, q)) return true;
      }
      return false;
    });
  }, [docs, search]);

  // When the user is searching, we want results from the WHOLE collection,
  // not just the page they happen to have loaded. Keep paginating in the
  // background until the collection is exhausted or we hit the scan cap.
  // Cap exists so a 100k-doc collection doesn't blow up Firestore reads.
  const SEARCH_SCAN_CAP = 500;
  useEffect(() => {
    if (!search.trim()) return;
    if (done || loading) return;
    if (docs.length >= SEARCH_SCAN_CAP) return;
    // Trigger one more page; the next render will trigger the next, and so on.
    loadPage(false);
  }, [search, docs.length, done, loading, loadPage]);

  const toggleSelect = (id) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAllVisible = () => {
    setSelected(new Set(filtered.map((d) => d.id)));
  };

  const runBulkDelete = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (ids.length > BULK_HARD_CEILING) {
      Alert.alert('Too many', `Hard cap is ${BULK_HARD_CEILING} per bulk op.`);
      return;
    }

    const confirmPhrase = config.protected
      ? `DELETE-${config.path}`
      : config.path;

    setConfirmState({
      phrase: confirmPhrase,
      title: `Delete ${ids.length} document${ids.length === 1 ? '' : 's'}`,
      message: `From /${config.path}${config.protected ? ' (protected collection)' : ''}.\n\nThis cannot be undone.`,
      sampleIds: ids.slice(0, 5),
      totalCount: ids.length,
      onConfirm: async () => {
        try {
          const groups = chunk(ids, 500);
          for (const g of groups) {
            const batch = firestore().batch();
            for (const id of g) batch.delete(collRef.doc(id));
            await batch.commit();
          }
          await writeAudit('bulkDelete', collectionPath, null, null, { count: ids.length });
          setDocs((prev) => prev.filter((d) => !selected.has(d.id)));
          setSelected(new Set());
          setSelectMode(false);
          setConfirmState(null);
          Alert.alert('Done', `Deleted ${ids.length} documents.`);
        } catch (e) {
          setConfirmState(null);
          Alert.alert('Bulk delete failed', e.message);
        }
      },
    });
  };

  const createNewDoc = async () => {
    try {
      const ref = await collRef.add({
        _createdBy: 'admin',
        _createdAt: firestore.FieldValue.serverTimestamp(),
      });
      await writeAudit('create', `${collectionPath}/${ref.id}`, null, { _createdBy: 'admin' });
      onOpenDoc(`${collectionPath}/${ref.id}`, ref.id);
    } catch (e) {
      Alert.alert('Create failed', e.message);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Action bar with select mode + new doc */}
      <View style={styles.actionBar}>
        <View style={styles.actionBarLeft}>
          <Text style={styles.actionBarLabel}>
            {filtered.length}{search ? ` of ${docs.length}` : ''} {filtered.length === 1 ? 'doc' : 'docs'}
            {!done && !search ? '+' : ''}
          </Text>
          {sortField && sortField !== '__id__' && (
            <View style={styles.sortBadge}>
              <Ionicons name="swap-vertical" size={10} color="#5ac8fa" />
              <Text style={styles.sortBadgeText}>by {sortField}</Text>
            </View>
          )}
          {config.protected && (
            <View style={styles.protectedBadgeSmall}>
              <Ionicons name="shield-checkmark" size={10} color="#ff9f0a" />
              <Text style={styles.protectedBadgeSmallText}>Protected</Text>
            </View>
          )}
        </View>
        <View style={styles.actionBarRight}>
          <TouchableOpacity
            style={[styles.iconBtn, selectMode && styles.iconBtnActive]}
            onPress={() => { setSelectMode((m) => !m); setSelected(new Set()); }}
            activeOpacity={0.7}
          >
            <Ionicons name={selectMode ? 'close' : 'checkbox-outline'} size={18} color={selectMode ? '#fff' : '#147efb'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.newBtn} onPress={createNewDoc} activeOpacity={0.7}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.newBtnText}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bulk action bar (only in select mode) */}
      {selectMode && (
        <View style={styles.bulkBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bulkCount}>{selected.size} selected</Text>
            {filtered.length > selected.size && (
              <TouchableOpacity onPress={selectAllVisible} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.bulkSelectAll}>Select all visible ({filtered.length})</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.bulkDeleteBtn, selected.size === 0 && { opacity: 0.4 }]}
            disabled={selected.size === 0}
            onPress={runBulkDelete}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color="#fff" />
            <Text style={styles.bulkDeleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Document list */}
      <FlatList
        data={filtered}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.docList}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          const data = item.data || {};
          const allKeys = Object.keys(data);
          // If a name field exists, surface it as the heading; everything else
          // (incl. doc id) becomes secondary. Otherwise, the doc id is the heading.
          const hasName = typeof data.name === 'string' && data.name.trim().length > 0;
          const heading = hasName ? data.name : item.id;
          // Pick which fields to show in the preview rows: skip the one we used
          // as the heading, prefer commonly-meaningful keys, cap at 3.
          const previewKeys = allKeys
            .filter((k) => !(hasName && k === 'name'))
            .slice(0, 3);
          return (
            <TouchableOpacity
              style={[styles.docCard, isSelected && styles.docCardSelected]}
              onPress={() => {
                if (selectMode) toggleSelect(item.id);
                else onOpenDoc(`${collectionPath}/${item.id}`, item.id);
              }}
              onLongPress={() => { setSelectMode(true); toggleSelect(item.id); }}
              activeOpacity={0.7}
            >
              {selectMode && (
                <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                  {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.docHeading} numberOfLines={1}>{heading}</Text>
                {hasName ? (
                  <Text style={styles.docIdCaption} numberOfLines={1}>{item.id}</Text>
                ) : null}
                {allKeys.length === 0 ? (
                  <Text style={styles.docEmpty}>Empty document</Text>
                ) : (
                  <View style={styles.docKvList}>
                    {previewKeys.map((k) => (
                      <View key={k} style={styles.docKvRow}>
                        <Text style={styles.docKvKey} numberOfLines={1}>{k}</Text>
                        <InlineValue value={data[k]} style={styles.docKvVal} />
                      </View>
                    ))}
                    {allKeys.length > previewKeys.length + (hasName ? 1 : 0) && (
                      <Text style={styles.docMore}>
                        +{allKeys.length - previewKeys.length - (hasName ? 1 : 0)} more
                      </Text>
                    )}
                  </View>
                )}
              </View>
              {!selectMode && <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" />}
            </TouchableOpacity>
          );
        }}
        onEndReachedThreshold={0.5}
        onEndReached={() => !done && loadPage(false)}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name={search ? 'search' : 'document-outline'} size={40} color="rgba(255,255,255,0.15)" />
              <Text style={styles.emptyText}>
                {search
                  ? (done || docs.length >= SEARCH_SCAN_CAP
                      ? 'No documents match your search'
                      : 'Searching…')
                  : 'No documents yet'}
              </Text>
              {search && !done && docs.length >= SEARCH_SCAN_CAP && (
                <Text style={styles.scanCapNote}>
                  Scanned first {SEARCH_SCAN_CAP} docs. Refine your query.
                </Text>
              )}
            </View>
          ) : null
        }
        ListFooterComponent={
          loading ? (
            <View style={styles.footerStatus}>
              <ActivityIndicator color="#147efb" size="small" />
              <Text style={styles.footerStatusText}>
                {search ? `Searching… ${docs.length} scanned` : 'Loading…'}
              </Text>
            </View>
          ) : done && filtered.length > 0 ? (
            <Text style={styles.endMarker}>End of collection</Text>
          ) : search && docs.length >= SEARCH_SCAN_CAP ? (
            <Text style={styles.endMarker}>Scan limit reached ({SEARCH_SCAN_CAP} docs)</Text>
          ) : null
        }
      />

      {/* Floating bottom search bar with system material */}
      <Animated.View
        style={[
          styles.floatingBarWrapper,
          { transform: [{ translateY: Animated.multiply(keyboardOffset, -1) }] },
        ]}
        pointerEvents="box-none"
      >
        <BlurView tint="systemChromeMaterialDark" intensity={80} style={styles.floatingBlur}>
          <View style={styles.floatingInner}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={16} color="rgba(255,255,255,0.55)" style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchBar}
                placeholder="Search by ID or any field"
                placeholderTextColor="rgba(255,255,255,0.55)"
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
          </View>
        </BlurView>
      </Animated.View>

      {/* Typed confirmation modal */}
      <TypedConfirmModal
        state={confirmState}
        onCancel={() => setConfirmState(null)}
      />
    </View>
  );
}

// ---------- document view ----------

function DocumentView({ docPath, label, onOpenSubcollection, onAfterDelete }) {
  const docRef = useMemo(() => {
    const segs = docPath.split('/').filter(Boolean);
    let ref = firestore().collection(segs[0]).doc(segs[1]);
    for (let i = 2; i < segs.length; i += 2) {
      ref = ref.collection(segs[i]).doc(segs[i + 1]);
    }
    return ref;
  }, [docPath]);

  const parentCollection = docPath.split('/').slice(0, -1).join('/');
  const config = KNOWN_COLLECTIONS.find((c) => c.path === parentCollection);
  const subcollections = config?.subcollections || [];

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState(null);
  const [addingField, setAddingField] = useState(false);
  const [confirmState, setConfirmState] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await docRef.get();
      setData(snap.exists ? snap.data() : null);
    } catch (e) {
      Alert.alert('Load failed', e.message);
    } finally {
      setLoading(false);
    }
  }, [docRef]);

  useEffect(() => { load(); }, [load]);

  const saveField = async (key, newValue) => {
    const before = data ? { ...data } : null;
    try {
      await docRef.update({ [key]: newValue });
      const after = { ...(data || {}), [key]: newValue };
      setData(after);
      await writeAudit('update', docPath, before, after, { field: key });
      setEditingField(null);
      setAddingField(false);
    } catch (e) {
      Alert.alert('Save failed', e.message);
    }
  };

  const deleteField = (key) => {
    Alert.alert(
      'Delete field?',
      `Remove "${key}" from this document?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await docRef.update({ [key]: firestore.FieldValue.delete() });
              const after = { ...(data || {}) };
              delete after[key];
              setData(after);
              await writeAudit('update', docPath, data, after, { fieldDeleted: key });
            } catch (e) {
              Alert.alert('Delete failed', e.message);
            }
          },
        },
      ]
    );
  };

  const deleteDoc = () => {
    const docId = docPath.split('/').pop();
    setConfirmState({
      phrase: docId,
      title: 'Delete document',
      message: `${docPath}\n\nThis cannot be undone. Subcollections (if any) will be orphaned.`,
      sampleIds: [],
      totalCount: 1,
      onConfirm: async () => {
        try {
          await docRef.delete();
          await writeAudit('delete', docPath, data, null);
          setConfirmState(null);
          if (onAfterDelete) onAfterDelete();
          else Alert.alert('Deleted', 'Document removed.');
        } catch (e) {
          setConfirmState(null);
          Alert.alert('Delete failed', e.message);
        }
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#147efb" />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={40} color="rgba(255,255,255,0.3)" />
        <Text style={styles.deniedTitle}>Document not found</Text>
        <Text style={styles.deniedSub}>{docPath}</Text>
      </View>
    );
  }

  const entries = Object.entries(data);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} style={{ flex: 1 }}>
      {/* Doc id banner */}
      <View style={styles.docBanner}>
        <View style={styles.docBannerIcon}>
          <Ionicons name="document-text" size={18} color="#147efb" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docBannerLabel}>Document ID</Text>
          <Text style={styles.docBannerId} numberOfLines={1}>{docPath.split('/').pop()}</Text>
        </View>
      </View>

      {/* Fields section */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Fields</Text>
        <Text style={styles.sectionHeaderCount}>{entries.length}</Text>
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No fields yet</Text>
        </View>
      ) : (
        entries.map(([k, v]) => {
          const t = detectType(v);
          return (
            <View key={k} style={styles.fieldCard}>
              <View style={styles.fieldHeader}>
                <Text style={styles.fieldKey}>{k}</Text>
                <View style={[styles.typeBadge, { backgroundColor: `${TYPE_COLORS[t] || '#888'}22`, borderColor: `${TYPE_COLORS[t] || '#888'}55` }]}>
                  <Text style={[styles.typeBadgeText, { color: TYPE_COLORS[t] || '#888' }]}>{t}</Text>
                </View>
              </View>
              <FieldValueDisplay value={v} />
              <View style={styles.fieldActions}>
                <TouchableOpacity
                  style={styles.fieldEditBtn}
                  onPress={() => setEditingField({ key: k, value: v, type: t, isNew: false })}
                  activeOpacity={0.7}
                >
                  <Ionicons name="pencil" size={14} color="#147efb" />
                  <Text style={styles.fieldEditText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.fieldDeleteBtn}
                  onPress={() => deleteField(k)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={14} color="#ff453a" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      <TouchableOpacity style={styles.addFieldBtn} onPress={() => setAddingField(true)} activeOpacity={0.7}>
        <Ionicons name="add-circle-outline" size={18} color="#147efb" />
        <Text style={styles.addFieldText}>Add field</Text>
      </TouchableOpacity>

      {/* Subcollections */}
      {subcollections.length > 0 && (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>Subcollections</Text>
            <Text style={styles.sectionHeaderCount}>{subcollections.length}</Text>
          </View>
          {subcollections.map((sub) => (
            <TouchableOpacity
              key={sub}
              style={styles.subcollectionCard}
              onPress={() => onOpenSubcollection(`${docPath}/${sub}`, sub)}
              activeOpacity={0.7}
            >
              <View style={styles.subcollectionIcon}>
                <Ionicons name="folder-open-outline" size={18} color="#147efb" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.subcollectionName}>{sub}</Text>
                <Text style={styles.subcollectionPath} numberOfLines={1}>{docPath}/{sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Danger zone */}
      <View style={styles.dangerZone}>
        <Text style={styles.dangerZoneLabel}>Danger Zone</Text>
        <TouchableOpacity style={styles.dangerBtn} onPress={deleteDoc} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={16} color="#ff453a" />
          <Text style={styles.dangerText}>Delete document</Text>
        </TouchableOpacity>
      </View>

      {/* Field editor modal */}
      {editingField && (
        <FieldEditorModal
          field={editingField}
          onCancel={() => setEditingField(null)}
          onSave={(newVal) => saveField(editingField.key, newVal)}
        />
      )}
      {addingField && (
        <FieldEditorModal
          field={{ key: '', value: '', type: 'string', isNew: true }}
          existingKeys={Object.keys(data)}
          onCancel={() => setAddingField(false)}
          onSave={(newVal, key) => {
            if (!key) return;
            saveField(key, newVal);
          }}
        />
      )}

      {/* Typed confirm modal */}
      <TypedConfirmModal
        state={confirmState}
        onCancel={() => setConfirmState(null)}
      />
    </ScrollView>
  );
}

// ---------- field editor modal ----------

function FieldEditorModal({ field, existingKeys = [], onCancel, onSave }) {
  const [key, setKey] = useState(field.key);
  const [type, setType] = useState(field.type === 'null' ? 'string' : field.type);
  const [text, setText] = useState(() => {
    if (isComplex(field.value)) return JSON.stringify(field.value, null, 2);
    if (field.type === 'timestamp') return field.value.toDate().toISOString();
    if (field.type === 'reference') return field.value.path;
    if (field.type === 'geopoint') return `${field.value.latitude},${field.value.longitude}`;
    if (field.value === null || field.value === undefined) return '';
    return String(field.value);
  });
  const [error, setError] = useState(null);

  const types = ['string', 'number', 'boolean', 'timestamp', 'reference', 'geopoint', 'array', 'map', 'null'];

  const keyConflict = field.isNew && key && existingKeys.includes(key);

  const save = () => {
    setError(null);
    if (field.isNew && !key.trim()) {
      setError('Field name is required');
      return;
    }
    if (keyConflict) {
      setError(`A field named "${key}" already exists`);
      return;
    }
    try {
      let parsed;
      switch (type) {
        case 'string': parsed = text; break;
        case 'number': {
          const n = Number(text);
          if (Number.isNaN(n)) throw new Error('Not a number');
          parsed = n;
          break;
        }
        case 'boolean': {
          if (text.toLowerCase() === 'true') parsed = true;
          else if (text.toLowerCase() === 'false') parsed = false;
          else throw new Error('Must be "true" or "false"');
          break;
        }
        case 'timestamp': {
          const d = new Date(text);
          if (Number.isNaN(d.getTime())) throw new Error('Invalid date (use ISO 8601)');
          parsed = firestore.Timestamp.fromDate(d);
          break;
        }
        case 'reference': {
          if (!text.trim()) throw new Error('Reference path required');
          parsed = firestore().doc(text);
          break;
        }
        case 'geopoint': {
          const [lat, lng] = text.split(',').map((s) => Number(s.trim()));
          if (Number.isNaN(lat) || Number.isNaN(lng)) throw new Error('Format: lat,lng');
          parsed = new firestore.GeoPoint(lat, lng);
          break;
        }
        case 'array':
        case 'map': {
          parsed = JSON.parse(text);
          if (type === 'array' && !Array.isArray(parsed)) throw new Error('Must be a JSON array');
          if (type === 'map' && (Array.isArray(parsed) || typeof parsed !== 'object' || parsed === null)) throw new Error('Must be a JSON object');
          break;
        }
        case 'null': parsed = null; break;
        default: parsed = text;
      }
      onSave(parsed, key);
    } catch (e) {
      setError(e.message);
    }
  };

  const placeholder = type === 'timestamp' ? '2026-04-28T12:00:00Z'
    : type === 'reference' ? 'collection/doc/path'
    : type === 'geopoint' ? '40.7128, -74.0060'
    : type === 'boolean' ? 'true or false'
    : (type === 'array' || type === 'map') ? 'Valid JSON'
    : '';

  return (
    <Modal animationType="fade" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {field.isNew ? 'Add field' : `Edit "${field.key}"`}
            </Text>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {field.isNew && (
              <>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabelText}>Field name</Text>
                  <View style={styles.requiredBadge}>
                    <Text style={styles.requiredBadgeText}>Required</Text>
                  </View>
                </View>
                <TextInput
                  style={[styles.input, keyConflict && styles.inputError]}
                  placeholder="e.g. lastSyncedAt"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={key}
                  onChangeText={setKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            )}

            <Text style={[styles.fieldLabelText, { marginTop: field.isNew ? 18 : 0 }]}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typePillsScroll}>
              {types.map((t) => {
                const isSelected = type === t;
                const color = TYPE_COLORS[t] || '#888';
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typePill,
                      isSelected && {
                        backgroundColor: `${color}22`,
                        borderColor: color,
                      },
                    ]}
                    onPress={() => setType(t)}
                    activeOpacity={0.7}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={12} color={color} style={{ marginRight: 4 }} />
                    )}
                    <Text style={[styles.typePillText, isSelected && { color, fontWeight: '700' }]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {type !== 'null' && (
              <>
                <Text style={[styles.fieldLabelText, { marginTop: 18 }]}>Value</Text>
                <TextInput
                  style={[
                    styles.input,
                    (type === 'array' || type === 'map') && styles.inputJson,
                  ]}
                  value={text}
                  onChangeText={setText}
                  multiline={type === 'array' || type === 'map'}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={placeholder}
                  placeholderTextColor="rgba(255,255,255,0.35)"
                />
              </>
            )}

            {type === 'null' && (
              <View style={styles.nullNotice}>
                <Ionicons name="information-circle-outline" size={16} color="rgba(255,255,255,0.5)" />
                <Text style={styles.nullNoticeText}>Field will be set to null</Text>
              </View>
            )}

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={14} color="#ff453a" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSaveBtn} onPress={save} activeOpacity={0.7}>
              <Text style={styles.modalSaveText}>{field.isNew ? 'Add field' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- typed-confirmation modal ----------

function TypedConfirmModal({ state, onCancel }) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (state) setTyped('');
  }, [state]);

  if (!state) return null;

  const matches = typed === state.phrase;

  return (
    <Modal animationType="fade" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.confirmCard}>
          <View style={styles.confirmIconWrap}>
            <Ionicons name="warning" size={28} color="#ff453a" />
          </View>
          <Text style={styles.confirmTitle}>{state.title}</Text>
          <Text style={styles.confirmMessage}>{state.message}</Text>

          {state.sampleIds.length > 0 && (
            <View style={styles.confirmSampleBox}>
              <Text style={styles.confirmSampleLabel}>
                {state.sampleIds.length === state.totalCount
                  ? 'Documents:'
                  : `Sample (${state.sampleIds.length} of ${state.totalCount}):`}
              </Text>
              {state.sampleIds.map((id) => (
                <Text key={id} style={styles.confirmSampleId} numberOfLines={1}>· {id}</Text>
              ))}
            </View>
          )}

          <Text style={styles.confirmPrompt}>
            Type <Text style={styles.confirmPhrase}>{state.phrase}</Text> to confirm
          </Text>
          <TextInput
            style={[styles.input, matches && styles.inputMatch]}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={state.phrase}
            placeholderTextColor="rgba(255,255,255,0.25)"
          />

          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmDeleteBtn, !matches && { opacity: 0.4 }]}
              onPress={() => matches && state.onConfirm()}
              disabled={!matches}
              activeOpacity={0.7}
            >
              <Ionicons name="trash" size={14} color="#fff" />
              <Text style={styles.confirmDeleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- styles ----------

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#121212' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#121212', padding: 40 },

  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 12,
  },
  deniedIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,69,58,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  bioIcon: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(20,126,251,0.1)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1, borderColor: 'rgba(20,126,251,0.2)',
  },
  bioError: {
    color: '#ff9f0a', fontSize: 13, textAlign: 'center',
    marginTop: 12, paddingHorizontal: 32, lineHeight: 18,
  },
  bioRetryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#147efb',
    paddingHorizontal: 22, paddingVertical: 14,
    borderRadius: 12, marginTop: 24,
  },
  bioRetryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  deniedTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 8 },
  deniedSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 6, textAlign: 'center', paddingHorizontal: 24, lineHeight: 20 },

  // ---------- Header ----------
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  headerSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },

  // ---------- Root list ----------
  rootList: { padding: 16, paddingBottom: 40 },
  collectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  collectionIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(20,126,251,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  collectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  collectionTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  collectionPath: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  collectionMeta: { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 },

  protectedBadge: {
    paddingVertical: 2, paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(255,159,10,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,159,10,0.3)',
  },
  protectedBadgeText: { fontSize: 9, color: '#ff9f0a', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  protectedBadgeSmall: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingVertical: 2, paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(255,159,10,0.15)',
    marginLeft: 8,
  },
  protectedBadgeSmallText: { fontSize: 9, color: '#ff9f0a', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ---------- Action bar ----------
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  actionBarLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  actionBarLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500' },
  actionBarRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(20,126,251,0.12)',
    borderWidth: 1, borderColor: 'rgba(20,126,251,0.2)',
  },
  iconBtnActive: { backgroundColor: '#147efb', borderColor: '#147efb' },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, height: 36,
    borderRadius: 10, backgroundColor: '#147efb',
  },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // ---------- Bulk bar ----------
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'rgba(20,126,251,0.08)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(20,126,251,0.15)',
  },
  bulkCount: { color: '#fff', fontSize: 14, fontWeight: '600' },
  bulkSelectAll: { color: '#147efb', fontSize: 12, marginTop: 2, fontWeight: '500' },
  bulkDeleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: 36,
    borderRadius: 10, backgroundColor: '#ff453a',
  },
  bulkDeleteText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // ---------- Doc list ----------
  docList: { padding: 16, paddingBottom: 110 },
  docCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  docCardSelected: {
    backgroundColor: 'rgba(20,126,251,0.12)',
    borderColor: '#147efb',
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: '#147efb', borderColor: '#147efb' },
  docHeading: {
    color: '#fff', fontSize: 15, fontWeight: '600',
  },
  docIdCaption: {
    color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  docId: {
    color: '#fff', fontSize: 14, fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  docEmpty: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  docKvList: { marginTop: 8, gap: 3 },
  docKvRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  docKvKey: {
    color: '#9cf', fontSize: 11, fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minWidth: 70, maxWidth: 110,
  },
  docKvVal: {
    color: 'rgba(255,255,255,0.75)', fontSize: 12, flex: 1,
  },
  docMore: { color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4, fontStyle: 'italic' },

  // sort indicator
  sortBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingVertical: 2, paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: 'rgba(90,200,250,0.12)',
    marginLeft: 8,
  },
  sortBadgeText: {
    fontSize: 10, color: '#5ac8fa', fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // inline value renderer
  inlineNull: { color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' },
  inlineMeta: { color: '#ff9f0a', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  inlineCollection: {
    color: 'rgba(255,255,255,0.75)', fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inlineRef: { color: '#147efb', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  inlineNumber: { color: '#ff9f0a', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  inlineBoolPill: {
    paddingVertical: 1, paddingHorizontal: 6,
    borderRadius: 4, alignSelf: 'flex-start',
  },
  inlineBoolText: {
    fontSize: 11, fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  emptyState: {
    alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40,
  },
  emptyText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 12 },
  endMarker: { color: 'rgba(255,255,255,0.25)', textAlign: 'center', fontSize: 11, paddingVertical: 24, fontStyle: 'italic' },
  scanCapNote: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 6, textAlign: 'center', paddingHorizontal: 20 },
  footerStatus: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 24,
  },
  footerStatusText: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },

  // ---------- Floating search ----------
  floatingBarWrapper: {
    position: 'absolute', left: 12, right: 12,
    bottom: Platform.OS === 'ios' ? 28 : 16,
    borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12,
    elevation: 8,
  },
  floatingBlur: {
    borderRadius: 18, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: Platform.OS === 'android' ? 'rgba(28,28,30,0.92)' : 'transparent',
  },
  floatingInner: { paddingHorizontal: 10, paddingVertical: 10 },
  searchContainer: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10, paddingHorizontal: 10, height: 38,
  },
  searchIcon: { marginRight: 6 },
  searchBar: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 0 },

  // ---------- Document view ----------
  docBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(20,126,251,0.08)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(20,126,251,0.15)',
    padding: 16,
  },
  docBannerIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(20,126,251,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  docBannerLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  docBannerId: {
    color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8,
  },
  sectionHeader: { color: '#4d9cff', fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionHeaderCount: {
    color: 'rgba(255,255,255,0.4)', fontSize: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    overflow: 'hidden',
    minWidth: 24, textAlign: 'center',
  },

  fieldCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 14, marginHorizontal: 16, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  fieldKey: {
    color: '#fff', fontSize: 14, fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  typeBadge: {
    paddingVertical: 2, paddingHorizontal: 8,
    borderRadius: 4, borderWidth: 1,
    marginLeft: 8,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ---------- Field value displays ----------
  valueRow: { marginTop: 2 },
  stringValue: { color: '#fff', fontSize: 14, lineHeight: 20 },
  emptyString: { color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' },
  numberValue: {
    color: '#ff9f0a', fontSize: 16, fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  nullPill: {
    alignSelf: 'flex-start',
    paddingVertical: 3, paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  nullPillText: {
    color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  boolPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: 6, borderWidth: 1,
  },
  boolPillText: { fontSize: 13, fontWeight: '700' },
  timestampRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6,
  },
  timestampAbs: {
    color: '#fff', fontSize: 14, fontWeight: '500',
  },
  timestampRel: { color: '#5ac8fa', fontSize: 12, marginTop: 2 },
  referenceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6,
  },
  referencePath: {
    color: '#147efb', fontSize: 13, flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  geoPoint: {
    color: '#30d158', fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  jsonContainer: {
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  jsonText: {
    color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 17,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  jsonToggle: {
    color: '#147efb', fontSize: 12, fontWeight: '600',
    marginTop: 6,
  },

  fieldActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  fieldEditBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, backgroundColor: 'rgba(20,126,251,0.12)',
  },
  fieldEditText: { color: '#147efb', fontSize: 12, fontWeight: '600' },
  fieldDeleteBtn: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,69,58,0.12)',
  },

  addFieldBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginHorizontal: 16, marginTop: 4,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(20,126,251,0.3)',
    backgroundColor: 'rgba(20,126,251,0.04)',
  },
  addFieldText: { color: '#147efb', fontSize: 14, fontWeight: '600' },

  subcollectionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1a1a1a', borderRadius: 12,
    padding: 14, marginHorizontal: 16, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  subcollectionIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(20,126,251,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  subcollectionName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  subcollectionPath: {
    color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  dangerZone: {
    marginHorizontal: 16, marginTop: 28,
    padding: 14, borderRadius: 12,
    backgroundColor: 'rgba(255,69,58,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,69,58,0.15)',
  },
  dangerZoneLabel: {
    color: '#ff453a', fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
  },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 10,
    backgroundColor: 'rgba(255,69,58,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,69,58,0.3)',
  },
  dangerText: { color: '#ff453a', fontSize: 14, fontWeight: '600' },

  // ---------- Modals ----------
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalCard: {
    width: '100%', maxWidth: 480, maxHeight: '85%',
    backgroundColor: '#1a1a1a', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  modalScroll: { padding: 18 },

  fieldLabelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  fieldLabelText: {
    color: '#fff', fontSize: 13, fontWeight: '600', letterSpacing: 0.2,
    marginBottom: 8,
  },
  requiredBadge: {
    paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999,
    backgroundColor: 'rgba(255,59,48,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,59,48,0.3)',
  },
  requiredBadgeText: {
    fontSize: 10, color: '#ff453a', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#fff', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  inputError: { borderColor: '#ff453a' },
  inputMatch: { borderColor: '#34c759' },
  inputJson: {
    minHeight: 140,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    textAlignVertical: 'top',
  },

  typePillsScroll: { gap: 6, paddingVertical: 2, paddingRight: 4 },
  typePill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  typePillText: { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600' },

  nullNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, marginTop: 18,
  },
  nullNoticeText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: 'rgba(255,69,58,0.1)',
    borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,69,58,0.25)',
  },
  errorText: { color: '#ff453a', fontSize: 13, flex: 1 },

  modalBtnRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 18, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  modalCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  modalCancelText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalSaveBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#147efb',
    alignItems: 'center', justifyContent: 'center',
  },
  modalSaveText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // ---------- Confirm modal ----------
  confirmCard: {
    width: '100%', maxWidth: 420,
    backgroundColor: '#1a1a1a', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,69,58,0.25)',
    overflow: 'hidden',
    paddingTop: 24,
  },
  confirmIconWrap: {
    alignSelf: 'center',
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,69,58,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  confirmTitle: {
    color: '#fff', fontSize: 18, fontWeight: '700',
    textAlign: 'center', marginBottom: 8,
    paddingHorizontal: 24,
  },
  confirmMessage: {
    color: 'rgba(255,255,255,0.6)', fontSize: 13,
    textAlign: 'center', lineHeight: 19,
    paddingHorizontal: 24, marginBottom: 16,
  },
  confirmSampleBox: {
    marginHorizontal: 18, marginBottom: 16,
    padding: 12, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  confirmSampleLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  confirmSampleId: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 2 },

  confirmPrompt: {
    color: 'rgba(255,255,255,0.6)', fontSize: 13,
    textAlign: 'center', marginBottom: 8,
    paddingHorizontal: 18,
  },
  confirmPhrase: {
    color: '#ff453a', fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  confirmDeleteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#ff453a',
  },
  confirmDeleteText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});