// DatabaseManagerScreen.js
// Firestore admin tool. Gates on superAdmin role + biometric. Browses the
// registered collections (now nested to arbitrary depth), drills into docs,
// edits fields with a structured + JSON-hybrid editor for maps/arrays, and
// runs audited bulk deletes with typed confirmation. All mutations write to
// _admin_audit.
//
// Visual language matches the rest of Taksis (EditSchedule etc.):
//   surfaces  #121212 / #1a1a1a
//   accent    #147efb (actions) / #4d9cff (section headers, selection)
//   warning    #ff9500   destructive  #ff3b30
//   text       #fff / rgba(255,255,255,.7 / .5 / .4 / .25)
// Type coloring is intentionally restrained — no neon rainbow.

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
  resolveCollectionNode,
  declaredSubcollectionsForDoc,
} from '../../utils/databaseRegistry';

// ---------- palette ----------
// Single source of truth so the whole screen stays on-brand.
const C = {
  bg: '#121212',
  card: '#1c1c1e',
  cardRaised: '#232325',
  accent: '#147efb',
  accentSoft: '#5a9cf0',
  warn: '#e8973a',
  danger: '#e5544b',
  hair: 'rgba(255,255,255,0.07)',
  t1: 'rgba(255,255,255,0.95)',
  t2: 'rgba(255,255,255,0.68)',
  t3: 'rgba(255,255,255,0.46)',
  t4: 'rgba(255,255,255,0.34)',
  t5: 'rgba(255,255,255,0.22)',
  fill: 'rgba(255,255,255,0.06)',
  fillSoft: 'rgba(255,255,255,0.035)',
  // Calm boolean coloring — accent for true, muted gray for false (no traffic-light).
  boolTrue: '#5a9cf0',
  boolFalse: 'rgba(255,255,255,0.4)',
  // System font everywhere by default; reserve a real mono only for raw paths.
  mono: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  code: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
};

// Restrained type coloring. Most types read as plain text; only the few that
// genuinely benefit from a hint get a muted tint. No saturated rainbow.
const TYPE_TINT = {
  string: C.t3,
  number: C.t3,
  boolean: C.t3,
  timestamp: C.t3,
  reference: C.t3,
  geopoint: C.t3,
  array: C.t4,
  map: C.t4,
  null: C.t4,
};

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

const isComplex = (v) => {
  const t = detectType(v);
  return t === 'array' || t === 'map';
};

// mm-dd-yy -> sortable timestamp. Returns NaN if it doesn't parse.
const mmddyyToTime = (id) => {
  if (typeof id !== 'string') return NaN;
  const parts = id.split('-');
  if (parts.length !== 3) return NaN;
  const [m, d, y] = parts.map((p) => parseInt(p, 10));
  if (Number.isNaN(m) || Number.isNaN(d) || Number.isNaN(y)) return NaN;
  const full = y < 100 ? 2000 + y : y;
  return new Date(full, m - 1, d).getTime();
};

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

// Convert a Firestore value to a JSON-editable plain value (and back). Used by
// the structured map/array editor so special types survive a round-trip.
const SPECIAL_HINT = '__fs__';
const toEditable = (v) => {
  const t = detectType(v);
  if (t === 'timestamp') return { [SPECIAL_HINT]: 'timestamp', value: v.toDate().toISOString() };
  if (t === 'reference') return { [SPECIAL_HINT]: 'reference', value: v.path };
  if (t === 'geopoint') return { [SPECIAL_HINT]: 'geopoint', lat: v.latitude, lng: v.longitude };
  if (t === 'array') return v.map(toEditable);
  if (t === 'map') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = toEditable(v[k]);
    return o;
  }
  return v;
};
const fromEditable = (v) => {
  if (v == null) return v;
  if (Array.isArray(v)) return v.map(fromEditable);
  if (typeof v === 'object') {
    if (v[SPECIAL_HINT] === 'timestamp') {
      const d = new Date(v.value);
      if (Number.isNaN(d.getTime())) throw new Error(`Bad timestamp: ${v.value}`);
      return firestore.Timestamp.fromDate(d);
    }
    if (v[SPECIAL_HINT] === 'reference') {
      if (!v.value) throw new Error('Reference path required');
      return firestore().doc(v.value);
    }
    if (v[SPECIAL_HINT] === 'geopoint') {
      const lat = Number(v.lat), lng = Number(v.lng);
      if (Number.isNaN(lat) || Number.isNaN(lng)) throw new Error('Bad geopoint');
      return new firestore.GeoPoint(lat, lng);
    }
    const o = {};
    for (const k of Object.keys(v)) o[k] = fromEditable(v[k]);
    return o;
  }
  return v;
};

// ---------- value renderers ----------

function InlineValue({ value, style }) {
  const t = detectType(value);

  if (t === 'boolean') {
    return (
      <View style={[styles.inlineBoolPill, { backgroundColor: value ? 'rgba(90,156,240,0.12)' : C.fill }]}>
        <Text style={[styles.inlineBoolText, { color: value ? C.boolTrue : C.boolFalse }]}>
          {value ? 'true' : 'false'}
        </Text>
      </View>
    );
  }
  if (t === 'null') {
    return <Text style={[style, styles.inlineNull]} numberOfLines={1}>null</Text>;
  }
  if (t === 'timestamp') {
    return <Text style={[style, { color: C.accentSoft }]} numberOfLines={1}>{formatTimestamp(value.toDate()).rel}</Text>;
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
          { backgroundColor: value ? 'rgba(90,156,240,0.1)' : C.fill,
            borderColor: value ? 'rgba(90,156,240,0.25)' : C.hair },
        ]}>
          <Ionicons name={value ? 'checkmark-circle' : 'close-circle'} size={14} color={value ? C.boolTrue : C.boolFalse} />
          <Text style={[styles.boolPillText, { color: value ? C.boolTrue : C.boolFalse }]}>
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
        <Ionicons name="time-outline" size={14} color={C.accentSoft} />
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
        <Ionicons name="link" size={14} color={C.accent} />
        <Text style={styles.referencePath} numberOfLines={2}>{value.path}</Text>
      </View>
    );
  }

  if (t === 'geopoint') {
    return (
      <View style={styles.referenceRow}>
        <Ionicons name="location" size={14} color={C.accentSoft} />
        <Text style={styles.geoPoint}>
          {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
        </Text>
      </View>
    );
  }

  if (t === 'array' || t === 'map') {
    // Read-only structured tree preview (no raw JSON blob in the detail view).
    return <StructuredPreview value={value} expanded={expanded} setExpanded={setExpanded} />;
  }

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

// Read-only structured renderer for maps/arrays in the doc view. Shows the
// shape as indented key/value rows rather than a raw JSON blob, so it reads
// cleanly and matches the rest of the UI.
function StructuredPreview({ value, expanded, setExpanded }) {
  const t = detectType(value);
  const entries = t === 'array'
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value);

  if (entries.length === 0) {
    return (
      <View style={styles.structEmpty}>
        <Text style={styles.structEmptyText}>{t === 'array' ? 'Empty array' : 'Empty map'}</Text>
      </View>
    );
  }

  const LIMIT = 8;
  const shown = expanded ? entries : entries.slice(0, LIMIT);
  const hidden = entries.length - shown.length;

  return (
    <View style={styles.structContainer}>
      {shown.map(([k, v]) => {
        const vt = detectType(v);
        return (
          <View key={k} style={styles.structRow}>
            <Text style={[styles.structKey, t === 'array' && styles.structIndex]} numberOfLines={1}>
              {t === 'array' ? `${k}` : k}
            </Text>
            <View style={styles.structVal}>
              {isComplex(v) ? (
                <Text style={styles.structNested} numberOfLines={1}>
                  {vt === 'array' ? `[${v.length} items]` : `{${Object.keys(v).length} fields}`}
                </Text>
              ) : (
                <InlineValue value={v} style={styles.structValText} />
              )}
            </View>
          </View>
        );
      })}
      {hidden > 0 && (
        <TouchableOpacity onPress={() => setExpanded(true)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={styles.jsonToggle}>Show {hidden} more</Text>
        </TouchableOpacity>
      )}
      {expanded && entries.length > LIMIT && (
        <TouchableOpacity onPress={() => setExpanded(false)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={styles.jsonToggle}>Show less</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---------- main screen ----------

const REAUTH_AFTER_BACKGROUND_MS = 30 * 1000;

export default function DatabaseManagerScreen() {
  const [view, setView] = useState('root');
  const [stack, setStack] = useState([]);
  const [gateState, setGateState] = useState('checking');
  const [bioError, setBioError] = useState(null);

  const backgroundedAt = useRef(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const uid = auth().currentUser?.uid;
        if (!uid) { if (alive) setGateState('denied'); return; }
        const snap = await firestore().collection('users').doc(uid).get();
        const isSuper = snap.exists ? snap.data()?.superAdmin === true : false;
        if (!alive) return;
        setGateState(isSuper ? 'bio_prompt' : 'denied');
      } catch {
        if (alive) setGateState('denied');
      }
    })();
    return () => { alive = false; };
  }, []);

  const runBiometric = useCallback(async () => {
    setBioError(null);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) { setGateState('bio_unavailable'); return; }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Database Admin',
        disableDeviceFallback: false,
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
      });
      if (result.success) {
        setGateState('ok');
        backgroundedAt.current = null;
      } else {
        setBioError(
          result.error === 'lockout' || result.error === 'lockout_permanent'
            ? 'Too many attempts. Try again later or use device passcode.'
            : null
        );
      }
    } catch (e) {
      setBioError(e.message || 'Authentication error');
    }
  }, []);

  useEffect(() => { if (gateState === 'bio_prompt') runBiometric(); }, [gateState, runBiometric]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appState.current;
      appState.current = next;
      if (gateState !== 'ok') return;
      if (next === 'background' || next === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (next === 'active' && prev !== 'active') {
        const elapsed = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        if (elapsed > REAUTH_AFTER_BACKGROUND_MS) setGateState('locked');
      }
    });
    return () => sub.remove();
  }, [gateState]);

  useEffect(() => { if (gateState === 'locked') runBiometric(); }, [gateState, runBiometric]);

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

  if (gateState === 'checking') {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={C.accent} size="large" />
        <Text style={styles.loadingText}>Verifying access…</Text>
      </SafeAreaView>
    );
  }
  if (gateState === 'denied') {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.deniedIcon}><Ionicons name="lock-closed" size={36} color={C.danger} /></View>
        <Text style={styles.deniedTitle}>Access denied</Text>
        <Text style={styles.deniedSub}>This area requires superAdmin privileges.</Text>
      </SafeAreaView>
    );
  }
  if (gateState === 'bio_unavailable') {
    return (
      <SafeAreaView style={styles.center}>
        <View style={[styles.deniedIcon, { backgroundColor: 'rgba(232,151,58,0.1)' }]}>
          <Ionicons name="finger-print" size={36} color={C.warn} />
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
          <Ionicons name={Platform.OS === 'ios' ? 'scan-circle-outline' : 'finger-print'} size={48} color={C.accent} />
        </View>
        <Text style={styles.deniedTitle}>{gateState === 'locked' ? 'Locked' : 'Authentication required'}</Text>
        <Text style={styles.deniedSub}>
          {gateState === 'locked' ? 'Verify your identity to resume.' : 'Verify your identity to access the Database Admin tool.'}
        </Text>
        {bioError ? <Text style={styles.bioError}>{bioError}</Text> : null}
        <TouchableOpacity style={styles.bioRetryBtn} onPress={runBiometric} activeOpacity={0.8}>
          <Ionicons name="lock-open-outline" size={16} color="#fff" />
          <Text style={styles.bioRetryText}>{bioError ? 'Try again' : 'Authenticate'}</Text>
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
          key={current.path}
          collectionPath={current.path}
          label={current.label}
          onOpenDoc={(docPath, id) => goDocument(docPath, id)}
        />
      )}
      {view === 'document' && (
        <DocumentView
          key={current.path}
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
  const title = view === 'root' ? 'Database' : stack[stack.length - 1]?.label || 'Database';
  const subtitle = view === 'root'
    ? `${KNOWN_COLLECTIONS.length} collections`
    : stack.map((s) => s.label).join('  ›  ');
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={C.accent} />
        </TouchableOpacity>
      ) : <View style={{ width: 32 }} />}
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
  const countSubs = (item) => {
    const subs = item.subcollections ? Object.keys(item.subcollections).length : 0;
    return subs;
  };
  return (
    <FlatList
      data={KNOWN_COLLECTIONS}
      keyExtractor={(c) => c.path}
      contentContainerStyle={styles.rootList}
      renderItem={({ item }) => {
        const subCount = countSubs(item);
        return (
          <TouchableOpacity style={styles.collectionCard} onPress={() => onPick(item.path, item.displayName)} activeOpacity={0.8}>
            <View style={styles.collectionIconWrap}>
              <Ionicons name={item.protected ? 'shield-checkmark' : 'folder'} size={20} color={item.protected ? C.warn : C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.collectionTitleRow}>
                <Text style={styles.collectionTitle}>{item.displayName}</Text>
                {item.protected && (
                  <View style={styles.protectedBadge}><Text style={styles.protectedBadgeText}>Protected</Text></View>
                )}
              </View>
              <Text style={styles.collectionPath}>/{item.path}</Text>
              {subCount > 0 && (
                <Text style={styles.collectionMeta}>{subCount} subcollection{subCount === 1 ? '' : 's'}</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.t5} />
          </TouchableOpacity>
        );
      }}
    />
  );
}

// ---------- collection view ----------

function CollectionView({ collectionPath, label, onOpenDoc }) {
  const { node: config } = useMemo(() => resolveCollectionNode(collectionPath), [collectionPath]);
  const effectiveConfig = config || { path: collectionPath };
  const protectedColl = !!effectiveConfig.protected;

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
  const [done, setDone] = useState(false);
  const [search, setSearch] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [confirmState, setConfirmState] = useState(null);
  const [sortField, setSortField] = useState(null);

  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const loadingRef = useRef(false);
  const cursorRef = useRef(null);
  const seenIdsRef = useRef(new Set());

  // Whether this collection uses client-side date sort (mm-dd-yy ids). When it
  // does, we can't use Firestore orderBy on the id meaningfully, so we page by
  // document id and sort the accumulated list in-memory for display.
  const dateSorted = effectiveConfig.sortBy === '__date_mmddyy__';

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
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      let activeSort = sortField;
      let probeDocs = null;

      if (reset || !activeSort) {
        if (dateSorted) {
          activeSort = '__id__'; // page by id, sort dates client-side
        } else if (effectiveConfig.sortBy) {
          activeSort = effectiveConfig.sortBy;
        } else {
          const probe = await collRef.orderBy(firestore.FieldPath.documentId()).limit(PAGE_SIZE).get();
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

      if (reset) seenIdsRef.current = new Set();
      const newDocs = [];
      for (const d of snap.docs) {
        if (seenIdsRef.current.has(d.id)) continue;
        seenIdsRef.current.add(d.id);
        newDocs.push({ id: d.id, data: d.data(), ref: d.ref });
      }

      setDocs((prev) => (reset ? newDocs : [...prev, ...newDocs]));
      const lastSnapDoc = snap.docs[snap.docs.length - 1];
      if (lastSnapDoc) cursorRef.current = lastSnapDoc;
      setDone(snap.docs.length < PAGE_SIZE);
    } catch (e) {
      Alert.alert('Load error', e.message);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [collRef, sortField, effectiveConfig.sortBy, dateSorted]);

  useEffect(() => {
    setDocs([]);
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

  // Apply client-side date sort (desc: newest week first) when configured.
  const orderedDocs = useMemo(() => {
    if (!dateSorted) return docs;
    return [...docs].sort((a, b) => {
      const ta = mmddyyToTime(a.id), tb = mmddyyToTime(b.id);
      if (Number.isNaN(ta) && Number.isNaN(tb)) return a.id.localeCompare(b.id);
      if (Number.isNaN(ta)) return 1;
      if (Number.isNaN(tb)) return -1;
      return tb - ta;
    });
  }, [docs, dateSorted]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orderedDocs;
    return orderedDocs.filter((d) => {
      if (d.id.toLowerCase().includes(q)) return true;
      const data = d.data || {};
      for (const v of Object.values(data)) if (valueContains(v, q)) return true;
      return false;
    });
  }, [orderedDocs, search]);

  const SEARCH_SCAN_CAP = 500;
  useEffect(() => {
    if (!search.trim()) return;
    if (done || loading) return;
    if (docs.length >= SEARCH_SCAN_CAP) return;
    loadPage(false);
  }, [search, docs.length, done, loading, loadPage]);

  const toggleSelect = (id) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const selectAllVisible = () => setSelected(new Set(filtered.map((d) => d.id)));

  const runBulkDelete = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (ids.length > BULK_HARD_CEILING) {
      Alert.alert('Too many', `Hard cap is ${BULK_HARD_CEILING} per bulk op.`);
      return;
    }
    const confirmPhrase = protectedColl ? `DELETE-${effectiveConfig.path}` : effectiveConfig.path;
    setConfirmState({
      phrase: confirmPhrase,
      title: `Delete ${ids.length} document${ids.length === 1 ? '' : 's'}`,
      message: `From /${effectiveConfig.path}${protectedColl ? ' (protected collection)' : ''}.\n\nThis cannot be undone.`,
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
      <View style={styles.actionBar}>
        <View style={styles.actionBarLeft}>
          <Text style={styles.actionBarLabel}>
            {filtered.length}{search ? ` of ${docs.length}` : ''} {filtered.length === 1 ? 'doc' : 'docs'}
            {!done && !search ? '+' : ''}
          </Text>
          {dateSorted && (
            <View style={styles.sortBadge}>
              <Ionicons name="calendar-outline" size={10} color={C.accentSoft} />
              <Text style={styles.sortBadgeText}>by week</Text>
            </View>
          )}
          {!dateSorted && sortField && sortField !== '__id__' && (
            <View style={styles.sortBadge}>
              <Ionicons name="swap-vertical" size={10} color={C.accentSoft} />
              <Text style={styles.sortBadgeText}>by {sortField}</Text>
            </View>
          )}
          {protectedColl && (
            <View style={styles.protectedBadgeSmall}>
              <Ionicons name="shield-checkmark" size={10} color={C.warn} />
              <Text style={styles.protectedBadgeSmallText}>Protected</Text>
            </View>
          )}
        </View>
        <View style={styles.actionBarRight}>
          <TouchableOpacity
            style={[styles.iconBtn, selectMode && styles.iconBtnActive]}
            onPress={() => { setSelectMode((m) => !m); setSelected(new Set()); }}
            activeOpacity={0.8}
          >
            <Ionicons name={selectMode ? 'close' : 'checkbox-outline'} size={18} color={selectMode ? '#fff' : C.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.newBtn} onPress={createNewDoc} activeOpacity={0.8}>
            <Ionicons name="add" size={16} color="#fff" />
            <Text style={styles.newBtnText}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

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
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={16} color="#fff" />
            <Text style={styles.bulkDeleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

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
          const hasName = typeof data.name === 'string' && data.name.trim().length > 0;
          const heading = hasName ? data.name : item.id;
          const previewKeys = allKeys.filter((k) => !(hasName && k === 'name')).slice(0, 3);
          return (
            <TouchableOpacity
              style={[styles.docCard, isSelected && styles.docCardSelected]}
              onPress={() => {
                if (selectMode) toggleSelect(item.id);
                else onOpenDoc(`${collectionPath}/${item.id}`, item.id);
              }}
              onLongPress={() => { setSelectMode(true); toggleSelect(item.id); }}
              activeOpacity={0.8}
            >
              {selectMode && (
                <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                  {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.docHeading} numberOfLines={1}>{heading}</Text>
                {hasName ? <Text style={styles.docIdCaption} numberOfLines={1}>{item.id}</Text> : null}
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
              {!selectMode && <Ionicons name="chevron-forward" size={16} color={C.t5} />}
            </TouchableOpacity>
          );
        }}
        onEndReachedThreshold={0.5}
        onEndReached={() => !done && loadPage(false)}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name={search ? 'search' : 'document-outline'} size={40} color="rgba(255,255,255,0.12)" />
              <Text style={styles.emptyText}>
                {search
                  ? (done || docs.length >= SEARCH_SCAN_CAP ? 'No documents match your search' : 'Searching…')
                  : 'No documents yet'}
              </Text>
              {search && !done && docs.length >= SEARCH_SCAN_CAP && (
                <Text style={styles.scanCapNote}>Scanned first {SEARCH_SCAN_CAP} docs. Refine your query.</Text>
              )}
            </View>
          ) : null
        }
        ListFooterComponent={
          loading ? (
            <View style={styles.footerStatus}>
              <ActivityIndicator color={C.accent} size="small" />
              <Text style={styles.footerStatusText}>{search ? `Searching… ${docs.length} scanned` : 'Loading…'}</Text>
            </View>
          ) : done && filtered.length > 0 ? (
            <Text style={styles.endMarker}>End of collection</Text>
          ) : search && docs.length >= SEARCH_SCAN_CAP ? (
            <Text style={styles.endMarker}>Scan limit reached ({SEARCH_SCAN_CAP} docs)</Text>
          ) : null
        }
      />

      <Animated.View
        style={[styles.floatingBarWrapper, { transform: [{ translateY: Animated.multiply(keyboardOffset, -1) }] }]}
        pointerEvents="box-none"
      >
        <BlurView tint="systemChromeMaterialDark" intensity={80} style={styles.floatingBlur}>
          <View style={styles.floatingInner}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={16} color={C.t3} style={styles.searchIcon} />
              <TextInput
                style={styles.searchBar}
                placeholder="Search by ID or any field"
                placeholderTextColor={C.t3}
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

      <TypedConfirmModal state={confirmState} onCancel={() => setConfirmState(null)} />
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

  // Declared subcollections now come from the nested registry resolver, so
  // they work at any depth (e.g. a 1st Grade doc under Hymns Class offers
  // `students`).
  const subcollections = useMemo(() => declaredSubcollectionsForDoc(docPath), [docPath]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState(null);
  const [addingField, setAddingField] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const [openSubInput, setOpenSubInput] = useState(false);
  const [customSubName, setCustomSubName] = useState('');

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
    Alert.alert('Delete field?', `Remove "${key}" from this document?`, [
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
    ]);
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

  const openCustomSub = () => {
    const name = customSubName.trim();
    if (!name) return;
    setOpenSubInput(false);
    setCustomSubName('');
    onOpenSubcollection(`${docPath}/${name}`, name);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={C.accent} /></View>;
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={40} color={C.t4} />
        <Text style={styles.deniedTitle}>Document not found</Text>
        <Text style={styles.deniedSub}>{docPath}</Text>
      </View>
    );
  }

  const entries = Object.entries(data);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} style={{ flex: 1 }}>
      <View style={styles.docBanner}>
        <View style={styles.docBannerIcon}><Ionicons name="document-text" size={18} color={C.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.docBannerLabel}>Document ID</Text>
          <Text style={styles.docBannerId} numberOfLines={1}>{docPath.split('/').pop()}</Text>
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Fields</Text>
        <Text style={styles.sectionHeaderCount}>{entries.length}</Text>
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyState}><Text style={styles.emptyText}>No fields yet</Text></View>
      ) : (
        entries.map(([k, v]) => {
          const t = detectType(v);
          const tint = TYPE_TINT[t] || C.t3;
          return (
            <View key={k} style={styles.fieldCard}>
              <View style={styles.fieldHeader}>
                <Text style={styles.fieldKey}>{k}</Text>
                <View style={[styles.typeBadge, { borderColor: C.hair }]}>
                  <Text style={[styles.typeBadgeText, { color: tint }]}>{t}</Text>
                </View>
              </View>
              <FieldValueDisplay value={v} />
              <View style={styles.fieldActions}>
                <TouchableOpacity
                  style={styles.fieldEditBtn}
                  onPress={() => setEditingField({ key: k, value: v, type: t, isNew: false })}
                  activeOpacity={0.8}
                >
                  <Ionicons name="pencil" size={14} color={C.accent} />
                  <Text style={styles.fieldEditText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fieldDeleteBtn} onPress={() => deleteField(k)} activeOpacity={0.8}>
                  <Ionicons name="trash-outline" size={14} color={C.danger} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      <TouchableOpacity style={styles.addFieldBtn} onPress={() => setAddingField(true)} activeOpacity={0.8}>
        <Ionicons name="add-circle-outline" size={18} color={C.accent} />
        <Text style={styles.addFieldText}>Add field</Text>
      </TouchableOpacity>

      {/* Subcollections — declared (any depth) + open-by-name escape hatch */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Subcollections</Text>
        {subcollections.length > 0 && <Text style={styles.sectionHeaderCount}>{subcollections.length}</Text>}
      </View>

      {subcollections.map((sub) => (
        <TouchableOpacity
          key={sub}
          style={styles.subcollectionCard}
          onPress={() => onOpenSubcollection(`${docPath}/${sub}`, sub)}
          activeOpacity={0.8}
        >
          <View style={styles.subcollectionIcon}><Ionicons name="folder-open-outline" size={18} color={C.accent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.subcollectionName}>{sub}</Text>
            <Text style={styles.subcollectionPath} numberOfLines={1}>{docPath}/{sub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.t5} />
        </TouchableOpacity>
      ))}

      {openSubInput ? (
        <View style={styles.openSubRow}>
          <TextInput
            style={styles.openSubInput}
            placeholder="subcollection name (e.g. archive_2026)"
            placeholderTextColor={C.t4}
            value={customSubName}
            onChangeText={setCustomSubName}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            onSubmitEditing={openCustomSub}
            returnKeyType="go"
          />
          <TouchableOpacity style={styles.openSubGo} onPress={openCustomSub} activeOpacity={0.8}>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.openSubCancel} onPress={() => { setOpenSubInput(false); setCustomSubName(''); }} activeOpacity={0.8}>
            <Ionicons name="close" size={16} color={C.t3} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.openSubBtn} onPress={() => setOpenSubInput(true)} activeOpacity={0.8}>
          <Ionicons name="folder-outline" size={16} color={C.accent} />
          <Text style={styles.openSubBtnText}>Open subcollection by name</Text>
        </TouchableOpacity>
      )}

      <View style={styles.dangerZone}>
        <Text style={styles.dangerZoneLabel}>Danger Zone</Text>
        <TouchableOpacity style={styles.dangerBtn} onPress={deleteDoc} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={16} color={C.danger} />
          <Text style={styles.dangerText}>Delete document</Text>
        </TouchableOpacity>
      </View>

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
          onSave={(newVal, key) => { if (key) saveField(key, newVal); }}
        />
      )}

      <TypedConfirmModal state={confirmState} onCancel={() => setConfirmState(null)} />
    </ScrollView>
  );
}

// ---------- structured map/array editor ----------
// Hybrid: a structured key/entry editor (add/remove/retype entries) plus a
// raw-JSON mode with LIVE validation. You can't save broken JSON — the Save
// button disables and the error surfaces inline — so a stray comma can't
// corrupt the doc. Special Firestore types (timestamp/reference/geopoint) are
// preserved through the `__fs__` envelope used by toEditable/fromEditable.

const PRIMITIVE_TYPES = ['string', 'number', 'boolean', 'null', 'map', 'array'];

// One editable entry row inside the structured editor.
function EntryRow({ entryKey, value, valueType, isArray, onChangeKey, onChangeValue, onRetype, onRemove, onDrillIn, keyError }) {
  // valueType is supplied by the parent (the value may be an internal pair-tree
  // node, which detectType would misread). Fall back to detectType for safety.
  const t = valueType || detectType(value);
  const editableScalar = t === 'string' || t === 'number' || t === 'boolean' || t === 'null';
  const [text, setText] = useState(() => {
    if (t === 'null') return '';
    if (t === 'boolean') return value ? 'true' : 'false';
    if (t === 'map' || t === 'array') return '';
    return String(value);
  });

  // Keep local text in sync if the type changes underneath us.
  useEffect(() => {
    if (t === 'null') setText('');
    else if (t === 'boolean') setText(value ? 'true' : 'false');
    else if (t === 'string' || t === 'number') setText(String(value));
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitText = (raw) => {
    setText(raw);
    if (t === 'number') {
      const n = Number(raw);
      onChangeValue(raw.trim() === '' ? 0 : (Number.isNaN(n) ? value : n));
    } else if (t === 'boolean') {
      // handled by the toggle, ignore here
    } else {
      onChangeValue(raw);
    }
  };

  // Count children of a nested pair-tree node (or plain value) for the label.
  const nestedCount = () => {
    if (value && typeof value === 'object') {
      if ('__a' in value) return value.__a.length;
      if ('__m' in value) return value.__m.length;
      if (Array.isArray(value)) return value.length;
      return Object.keys(value).length;
    }
    return 0;
  };

  return (
    <View style={styles.entryRow}>
      <View style={styles.entryTopRow}>
        {isArray ? (
          <View style={styles.entryIndexPill}><Text style={styles.entryIndexText}>{entryKey}</Text></View>
        ) : (
          <TextInput
            style={[styles.entryKeyInput, keyError && styles.inputError]}
            value={entryKey}
            onChangeText={onChangeKey}
            placeholder="key"
            placeholderTextColor={C.t4}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
        <TouchableOpacity style={styles.entryTypeChip} onPress={onRetype} activeOpacity={0.8}>
          <Text style={styles.entryTypeChipText}>{t}</Text>
          <Ionicons name="swap-vertical" size={11} color={C.t3} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.entryRemove} onPress={onRemove} activeOpacity={0.8} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name="close-circle" size={18} color={C.danger} />
        </TouchableOpacity>
      </View>

      {editableScalar && t === 'boolean' && (
        <View style={styles.boolToggleRow}>
          {['true', 'false'].map((opt) => {
            const active = (opt === 'true') === value;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.boolToggle, active && styles.boolToggleActive]}
                onPress={() => onChangeValue(opt === 'true')}
                activeOpacity={0.8}
              >
                <Text style={[styles.boolToggleText, active && styles.boolToggleTextActive]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {editableScalar && (t === 'string' || t === 'number') && (
        <TextInput
          style={styles.entryValueInput}
          value={text}
          onChangeText={commitText}
          placeholder={t === 'number' ? '0' : 'value'}
          placeholderTextColor={C.t4}
          keyboardType={t === 'number' ? 'numbers-and-punctuation' : 'default'}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}

      {t === 'null' && <View style={styles.entryNullNote}><Text style={styles.entryNullText}>null</Text></View>}

      {/* Nested map/array: tap to drill into it as its own structured level. */}
      {(t === 'map' || t === 'array') && (
        <TouchableOpacity style={styles.entryDrillBtn} onPress={onDrillIn} activeOpacity={0.8}>
          <Ionicons name={t === 'array' ? 'list-outline' : 'albums-outline'} size={15} color={C.accentSoft} />
          <Text style={styles.entryDrillText}>
            {t === 'array'
              ? `Array · ${nestedCount()} item${nestedCount() === 1 ? '' : 's'}`
              : `Map · ${nestedCount()} field${nestedCount() === 1 ? '' : 's'}`}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={C.t4} />
        </TouchableOpacity>
      )}

      {t === 'timestamp' || t === 'reference' || t === 'geopoint' ? (
        <View style={styles.entryNestedNote}>
          <Ionicons name="lock-closed-outline" size={13} color={C.t4} />
          <Text style={styles.entryNestedText}>{t} — edit in JSON mode</Text>
        </View>
      ) : null}
    </View>
  );
}

// --- internal ordered "pair-tree" for the structured editor --------------
// Plain editable values can't hold transient duplicate/blank keys without
// collapsing, which would lose data mid-edit. So inside the editor we use an
// ordered representation:
//   map   -> { __m: [ [key, node], ... ] }   (ordered, dup keys allowed)
//   array -> { __a: [ node, ... ] }
//   leaf  -> the raw scalar / __fs__ envelope (untouched)
// We convert plain<->tree at the boundary; the modal still sees plain values.

const PT_MAP = '__m', PT_ARR = '__a';
const isPlainMapValue = (v) =>
  v && typeof v === 'object' && !Array.isArray(v) && v[SPECIAL_HINT] === undefined;

const toTree = (v) => {
  if (Array.isArray(v)) return { [PT_ARR]: v.map(toTree) };
  if (isPlainMapValue(v)) return { [PT_MAP]: Object.entries(v).map(([k, x]) => [k, toTree(x)]) };
  return v; // scalar or __fs__ envelope — leave as-is
};
const fromTree = (node) => {
  if (node && typeof node === 'object' && PT_ARR in node) return node[PT_ARR].map(fromTree);
  if (node && typeof node === 'object' && PT_MAP in node) {
    const o = {};
    for (const [k, x] of node[PT_MAP]) o[k.trim()] = fromTree(x); // last-wins; dup blocked by validity
    return o;
  }
  return node;
};
const treeNodeType = (node) => {
  if (node && typeof node === 'object' && PT_ARR in node) return 'array';
  if (node && typeof node === 'object' && PT_MAP in node) return 'map';
  return detectType(node);
};

// Immutable get/set into the pair-tree by a path of positional indices.
// For an array node a segment indexes __a; for a map node it indexes the row
// in __m (so renaming a key never changes the path).
const treeGet = (root, path) => {
  let cur = root;
  for (const seg of path) {
    if (cur && typeof cur === 'object' && PT_ARR in cur) cur = cur[PT_ARR][seg];
    else if (cur && typeof cur === 'object' && PT_MAP in cur) cur = cur[PT_MAP][seg]?.[1];
    else return undefined;
  }
  return cur;
};
const treeSet = (root, path, fn) => {
  if (path.length === 0) return fn(root);
  const [head, ...rest] = path;
  if (root && typeof root === 'object' && PT_ARR in root) {
    const arr = root[PT_ARR].slice();
    arr[head] = treeSet(arr[head], rest, fn);
    return { [PT_ARR]: arr };
  }
  if (root && typeof root === 'object' && PT_MAP in root) {
    const rows = root[PT_MAP].slice();
    const [k, v] = rows[head];
    rows[head] = [k, treeSet(v, rest, fn)];
    return { [PT_MAP]: rows };
  }
  return root;
};

function StructuredEditor({ initial, isArrayRoot, onChange, onValidityChange }) {
  // We hold the value as an ordered pair-tree internally (see toTree/fromTree)
  // so transient duplicate or blank keys never collapse and lose data. `path`
  // is a breadcrumb of positional indices into the tree pointing at the level
  // currently shown. Drilling into a nested map/array pushes onto it.
  const [root, setRoot] = useState(() => toTree(initial));
  const [path, setPath] = useState([]); // [] = top level

  // Stable row ids per level so editing a key doesn't remount inputs.
  const idCounter = useRef(0);
  const rowIdsRef = useRef(new Map()); // pathKey -> [ids]

  const pathKey = path.join('\u0000');
  const current = treeGet(root, path);
  const currentIsArray = !!(current && typeof current === 'object' && PT_ARR in current);
  const currentIsMap = !!(current && typeof current === 'object' && PT_MAP in current);

  const ensureIds = (count) => {
    let ids = rowIdsRef.current.get(pathKey);
    if (!ids) { ids = []; rowIdsRef.current.set(pathKey, ids); }
    while (ids.length < count) { idCounter.current += 1; ids.push(`r${idCounter.current}`); }
    if (ids.length > count) ids.length = count;
    return ids;
  };

  // Entries for the current level, drawn from the live tree.
  const entries = useMemo(() => {
    if (currentIsArray) {
      const ids = ensureIds(current[PT_ARR].length);
      return current[PT_ARR].map((node, i) => ({ id: ids[i], key: String(i), value: node }));
    }
    if (currentIsMap) {
      const rows = current[PT_MAP];
      const ids = ensureIds(rows.length);
      return rows.map(([k, node], i) => ({ id: ids[i], key: k, value: node }));
    }
    return [];
  }, [current, currentIsArray, currentIsMap, pathKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Current-level key errors (for inline display).
  const dupKeysHere = useMemo(() => {
    if (!currentIsMap) return new Set();
    const seen = new Set(), dup = new Set();
    for (const e of entries) {
      const k = e.key.trim();
      if (!k) continue;
      if (seen.has(k)) dup.add(k);
      seen.add(k);
    }
    return dup;
  }, [entries, currentIsMap]);
  const hasBlankKeyHere = currentIsMap && entries.some((e) => !e.key.trim());

  // Whole-tree validity: any map level with a blank/duplicate key blocks save.
  const deepValid = useMemo(() => {
    const check = (node) => {
      if (node && typeof node === 'object' && PT_ARR in node) return node[PT_ARR].every(check);
      if (node && typeof node === 'object' && PT_MAP in node) {
        const seen = new Set();
        for (const [k, v] of node[PT_MAP]) {
          const kk = k.trim();
          if (!kk) return false;
          if (seen.has(kk)) return false;
          seen.add(kk);
          if (!check(v)) return false;
        }
        return true;
      }
      return true;
    };
    return check(root);
  }, [root]);

  // Emit the plain value upward whenever the tree changes (only when valid, so
  // the modal never receives a half-edited structure with colliding keys).
  useEffect(() => {
    onValidityChange(deepValid);
    if (deepValid) onChange(fromTree(root));
  }, [root, deepValid]); // eslint-disable-line react-hooks/exhaustive-deps

  // All mutations rewrite the current level inside the tree at `path`.
  const mutateCurrent = (fn) => setRoot((r) => treeSet(r, path, fn));

  const updateEntryValue = (index, newNode) => {
    mutateCurrent((level) => {
      if (PT_ARR in level) {
        const arr = level[PT_ARR].slice();
        arr[index] = newNode;
        return { [PT_ARR]: arr };
      }
      const rows = level[PT_MAP].slice();
      rows[index] = [rows[index][0], newNode];
      return { [PT_MAP]: rows };
    });
  };

  const updateEntryKey = (index, newKey) => {
    mutateCurrent((level) => {
      if (!(PT_MAP in level)) return level;
      const rows = level[PT_MAP].slice();
      rows[index] = [newKey, rows[index][1]];
      return { [PT_MAP]: rows };
    });
  };

  const removeEntry = (index) => {
    mutateCurrent((level) => {
      if (PT_ARR in level) {
        const arr = level[PT_ARR].slice(); arr.splice(index, 1);
        return { [PT_ARR]: arr };
      }
      const rows = level[PT_MAP].slice(); rows.splice(index, 1);
      return { [PT_MAP]: rows };
    });
    rowIdsRef.current.delete(pathKey); // ids re-sized next render
  };

  const addEntry = () => {
    mutateCurrent((level) => {
      if (PT_ARR in level) return { [PT_ARR]: [...level[PT_ARR], ''] };
      // blank key by default; user names it. Validity blocks save until named.
      return { [PT_MAP]: [...level[PT_MAP], ['', '']] };
    });
  };

  const retype = (index, currentType) => {
    const order = PRIMITIVE_TYPES;
    const idx = order.indexOf(currentType);
    const nextType = order[(idx + 1) % order.length];
    let nextNode;
    switch (nextType) {
      case 'string': nextNode = ''; break;
      case 'number': nextNode = 0; break;
      case 'boolean': nextNode = false; break;
      case 'null': nextNode = null; break;
      case 'map': nextNode = { [PT_MAP]: [] }; break;
      case 'array': nextNode = { [PT_ARR]: [] }; break;
      default: nextNode = '';
    }
    updateEntryValue(index, nextNode);
  };

  const drillInto = (index) => setPath((p) => [...p, index]);
  const popTo = (depth) => setPath((p) => p.slice(0, depth));

  // Breadcrumb labels: resolve each path index back to its key/index name.
  const crumbLabels = useMemo(() => {
    const labels = [];
    let node = root;
    for (const seg of path) {
      if (node && PT_ARR in node) { labels.push(`[${seg}]`); node = node[PT_ARR][seg]; }
      else if (node && PT_MAP in node) {
        const row = node[PT_MAP][seg];
        labels.push(row ? (row[0].trim() || '(unnamed)') : '?');
        node = row?.[1];
      } else { labels.push('?'); }
    }
    return labels;
  }, [root, path]);

  return (
    <View>
      {/* Breadcrumb shown once we've drilled in */}
      {path.length > 0 && (
        <View style={styles.breadcrumbBar}>
          <TouchableOpacity style={styles.breadcrumbBack} onPress={() => popTo(path.length - 1)} activeOpacity={0.8} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Ionicons name="chevron-back" size={16} color={C.accentSoft} />
          </TouchableOpacity>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.breadcrumbScroll}>
            <TouchableOpacity onPress={() => popTo(0)} activeOpacity={0.7}>
              <Text style={styles.breadcrumbRoot}>root</Text>
            </TouchableOpacity>
            {crumbLabels.map((label, i) => (
              <View key={i} style={styles.breadcrumbSegWrap}>
                <Ionicons name="chevron-forward" size={12} color={C.t4} />
                <TouchableOpacity onPress={() => popTo(i + 1)} activeOpacity={0.7}>
                  <Text style={[styles.breadcrumbSeg, i === path.length - 1 && styles.breadcrumbSegActive]} numberOfLines={1}>
                    {label}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {entries.length === 0 && (
        <View style={styles.structEmpty}>
          <Text style={styles.structEmptyText}>{currentIsArray ? 'Empty array' : 'No entries'}</Text>
        </View>
      )}

      {entries.map((e, index) => {
        const t = treeNodeType(e.value);
        const isCyclable = PRIMITIVE_TYPES.includes(t);
        return (
          <EntryRow
            key={e.id}
            entryKey={e.key}
            value={e.value}
            valueType={t}
            isArray={currentIsArray}
            keyError={currentIsMap && (!e.key.trim() || dupKeysHere.has(e.key.trim()))}
            onChangeKey={(k) => updateEntryKey(index, k)}
            onChangeValue={(v) => updateEntryValue(index, v)}
            onRetype={isCyclable ? () => retype(index, t) : () => {}}
            onRemove={() => removeEntry(index)}
            onDrillIn={() => drillInto(index)}
          />
        );
      })}

      {(dupKeysHere.size > 0 || hasBlankKeyHere) && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={14} color={C.danger} />
          <Text style={styles.errorText}>
            {hasBlankKeyHere ? 'Every entry needs a key.' : 'Duplicate keys are not allowed.'}
          </Text>
        </View>
      )}

      {/* A deeper level has an error but this one is clean. */}
      {!deepValid && dupKeysHere.size === 0 && !hasBlankKeyHere && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={14} color={C.danger} />
          <Text style={styles.errorText}>A nested level has a blank or duplicate key. Fix it before saving.</Text>
        </View>
      )}

      <TouchableOpacity style={styles.addEntryBtn} onPress={addEntry} activeOpacity={0.8}>
        <Ionicons name="add" size={16} color={C.accent} />
        <Text style={styles.addEntryText}>Add {currentIsArray ? 'item' : 'entry'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------- field editor modal ----------

function FieldEditorModal({ field, existingKeys = [], onCancel, onSave }) {
  const [key, setKey] = useState(field.key);
  const [type, setType] = useState(field.type === 'null' ? 'string' : field.type);
  const [error, setError] = useState(null);

  // Scalar text state (for non-complex types).
  const [text, setText] = useState(() => {
    if (isComplex(field.value)) return '';
    if (field.type === 'timestamp') return field.value.toDate().toISOString();
    if (field.type === 'reference') return field.value.path;
    if (field.type === 'geopoint') return `${field.value.latitude},${field.value.longitude}`;
    if (field.value === null || field.value === undefined) return '';
    return String(field.value);
  });

  // Complex (map/array) editing: hybrid structured + JSON.
  const isMapOrArray = type === 'map' || type === 'array';
  const [editMode, setEditMode] = useState('structured'); // 'structured' | 'json'

  // Structured working value (plain editable form via toEditable).
  const initialEditable = useMemo(() => {
    if (!isComplex(field.value)) return type === 'array' ? [] : {};
    return toEditable(field.value);
  }, [field.value, type]);
  const [structuredVal, setStructuredVal] = useState(initialEditable);
  const [structuredValid, setStructuredValid] = useState(true);

  // JSON text mirror + live validation.
  const [jsonText, setJsonText] = useState(() => JSON.stringify(initialEditable, null, 2));
  const [jsonError, setJsonError] = useState(null);
  const [jsonParsed, setJsonParsed] = useState(initialEditable);

  const validateJson = (txt) => {
    setJsonText(txt);
    try {
      const parsed = JSON.parse(txt);
      const tOk = type === 'array' ? Array.isArray(parsed)
        : (parsed && typeof parsed === 'object' && !Array.isArray(parsed));
      if (!tOk) {
        setJsonError(type === 'array' ? 'Top level must be a JSON array' : 'Top level must be a JSON object');
        return;
      }
      setJsonError(null);
      setJsonParsed(parsed);
    } catch (e) {
      setJsonError(e.message.replace(/^JSON\.parse:?\s*/i, ''));
    }
  };

  // Switching modes keeps the two views in sync.
  const switchToJson = () => {
    setJsonText(JSON.stringify(structuredVal, null, 2));
    setJsonError(null);
    setJsonParsed(structuredVal);
    setEditMode('json');
  };
  const switchToStructured = () => {
    if (jsonError) {
      setError('Fix the JSON error before switching back.');
      return;
    }
    setStructuredVal(jsonParsed);
    setError(null);
    setEditMode('structured');
  };

  const keyConflict = field.isNew && key && existingKeys.includes(key);
  const types = ['string', 'number', 'boolean', 'timestamp', 'reference', 'geopoint', 'array', 'map', 'null'];

  const complexInvalid = isMapOrArray && (editMode === 'json' ? !!jsonError : !structuredValid);
  const canSave = !(field.isNew && !key.trim()) && !keyConflict && !complexInvalid;

  const save = () => {
    setError(null);
    if (field.isNew && !key.trim()) { setError('Field name is required'); return; }
    if (keyConflict) { setError(`A field named "${key}" already exists`); return; }
    try {
      let parsed;
      if (isMapOrArray) {
        const editable = editMode === 'json' ? jsonParsed : structuredVal;
        if (editMode === 'json' && jsonError) throw new Error(`Invalid JSON: ${jsonError}`);
        if (editMode === 'structured' && !structuredValid) throw new Error('Fix entry errors before saving');
        parsed = fromEditable(editable); // revives __fs__ envelopes into Firestore types
      } else {
        switch (type) {
          case 'string': parsed = text; break;
          case 'number': {
            const n = Number(text);
            if (Number.isNaN(n)) throw new Error('Not a number');
            parsed = n; break;
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
            parsed = firestore.Timestamp.fromDate(d); break;
          }
          case 'reference': {
            if (!text.trim()) throw new Error('Reference path required');
            parsed = firestore().doc(text); break;
          }
          case 'geopoint': {
            const [lat, lng] = text.split(',').map((s) => Number(s.trim()));
            if (Number.isNaN(lat) || Number.isNaN(lng)) throw new Error('Format: lat,lng');
            parsed = new firestore.GeoPoint(lat, lng); break;
          }
          case 'null': parsed = null; break;
          default: parsed = text;
        }
      }
      onSave(parsed, key);
    } catch (e) {
      setError(e.message);
    }
  };

  // When the type changes to/from complex, reset complex working state.
  const onPickType = (t) => {
    setType(t);
    setError(null);
    if (t === 'map' || t === 'array') {
      const base = t === 'array' ? [] : {};
      // If we already had a complex value of the same shape, keep it.
      const keep = (t === 'array' && Array.isArray(structuredVal)) ||
        (t === 'map' && structuredVal && typeof structuredVal === 'object' && !Array.isArray(structuredVal));
      const next = keep ? structuredVal : base;
      setStructuredVal(next);
      setJsonText(JSON.stringify(next, null, 2));
      setJsonParsed(next);
      setJsonError(null);
      setEditMode('structured');
    }
  };

  const placeholder = type === 'timestamp' ? '2026-04-28T12:00:00Z'
    : type === 'reference' ? 'collection/doc/path'
    : type === 'geopoint' ? '40.7128, -74.0060'
    : type === 'boolean' ? 'true or false'
    : '';

  return (
    <Modal animationType="fade" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{field.isNew ? 'Add field' : `Edit "${field.key}"`}</Text>
            <TouchableOpacity onPress={onCancel} style={styles.modalCloseButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={C.t3} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {field.isNew && (
              <>
                <View style={styles.fieldLabelRow}>
                  <Text style={styles.fieldLabelText}>Field name</Text>
                  <View style={styles.requiredBadge}><Text style={styles.requiredBadgeText}>Required</Text></View>
                </View>
                <TextInput
                  style={[styles.input, keyConflict && styles.inputError]}
                  placeholder="e.g. lastSyncedAt"
                  placeholderTextColor={C.t4}
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
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typePill, isSelected && styles.typePillActive]}
                    onPress={() => onPickType(t)}
                    activeOpacity={0.8}
                  >
                    {isSelected && <Ionicons name="checkmark" size={12} color={C.accent} style={{ marginRight: 4 }} />}
                    <Text style={[styles.typePillText, isSelected && styles.typePillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Complex editor */}
            {isMapOrArray && (
              <>
                <View style={styles.editModeRow}>
                  <Text style={styles.fieldLabelText}>Value</Text>
                  <View style={styles.editModeToggle}>
                    <TouchableOpacity
                      style={[styles.editModeBtn, editMode === 'structured' && styles.editModeBtnActive]}
                      onPress={switchToStructured}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.editModeText, editMode === 'structured' && styles.editModeTextActive]}>Structured</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.editModeBtn, editMode === 'json' && styles.editModeBtnActive]}
                      onPress={switchToJson}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.editModeText, editMode === 'json' && styles.editModeTextActive]}>JSON</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {editMode === 'structured' ? (
                  <StructuredEditor
                    key={`${type}-${field.key}`}
                    initial={structuredVal}
                    isArrayRoot={type === 'array'}
                    onChange={setStructuredVal}
                    onValidityChange={setStructuredValid}
                  />
                ) : (
                  <>
                    <TextInput
                      style={[styles.input, styles.inputJson, jsonError && styles.inputError]}
                      value={jsonText}
                      onChangeText={validateJson}
                      multiline
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder={type === 'array' ? '[ ... ]' : '{ ... }'}
                      placeholderTextColor={C.t4}
                    />
                    {jsonError ? (
                      <View style={styles.errorBox}>
                        <Ionicons name="alert-circle" size={14} color={C.danger} />
                        <Text style={styles.errorText}>{jsonError}</Text>
                      </View>
                    ) : (
                      <View style={styles.jsonOkRow}>
                        <Ionicons name="checkmark-circle" size={13} color="#4caf6e" />
                        <Text style={styles.jsonOkText}>Valid JSON</Text>
                      </View>
                    )}
                    <Text style={styles.jsonHint}>
                      Special types use {`{"${SPECIAL_HINT}":"timestamp","value":"…"}`} envelopes; they're preserved on save.
                    </Text>
                  </>
                )}
              </>
            )}

            {/* Scalar editor */}
            {!isMapOrArray && type !== 'null' && (
              <>
                <Text style={[styles.fieldLabelText, { marginTop: 18 }]}>Value</Text>
                <TextInput
                  style={styles.input}
                  value={text}
                  onChangeText={setText}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={placeholder}
                  placeholderTextColor={C.t4}
                />
              </>
            )}

            {!isMapOrArray && type === 'null' && (
              <View style={styles.nullNotice}>
                <Ionicons name="information-circle-outline" size={16} color={C.t3} />
                <Text style={styles.nullNoticeText}>Field will be set to null</Text>
              </View>
            )}

            {error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={14} color={C.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSaveBtn, !canSave && { opacity: 0.4 }]}
              onPress={save}
              disabled={!canSave}
              activeOpacity={0.8}
            >
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
  useEffect(() => { if (state) setTyped(''); }, [state]);
  if (!state) return null;
  const matches = typed === state.phrase;
  return (
    <Modal animationType="fade" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
        <View style={styles.confirmCard}>
          <View style={styles.confirmIconWrap}><Ionicons name="warning" size={28} color={C.danger} /></View>
          <Text style={styles.confirmTitle}>{state.title}</Text>
          <Text style={styles.confirmMessage}>{state.message}</Text>
          {state.sampleIds.length > 0 && (
            <View style={styles.confirmSampleBox}>
              <Text style={styles.confirmSampleLabel}>
                {state.sampleIds.length === state.totalCount ? 'Documents:' : `Sample (${state.sampleIds.length} of ${state.totalCount}):`}
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
            placeholderTextColor={C.t5}
          />
          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmDeleteBtn, !matches && { opacity: 0.4 }]}
              onPress={() => matches && state.onConfirm()}
              disabled={!matches}
              activeOpacity={0.8}
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
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 40 },

  loadingText: { color: C.t3, fontSize: 14, marginTop: 12 },
  deniedIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(229,84,75,0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  bioIcon: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(20,126,251,0.1)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  bioError: { color: C.warn, fontSize: 13, textAlign: 'center', marginTop: 12, paddingHorizontal: 32, lineHeight: 18 },
  bioRetryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.accent, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 18, marginTop: 24,
  },
  bioRetryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  deniedTitle: { color: C.t1, fontSize: 18, fontWeight: '600', marginTop: 8 },
  deniedSub: { color: C.t3, fontSize: 14, marginTop: 6, textAlign: 'center', paddingHorizontal: 24, lineHeight: 20 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: C.t1, fontSize: 17, fontWeight: '600' },
  headerSub: { color: C.t4, fontSize: 11, marginTop: 3 },

  rootList: { padding: 16, paddingBottom: 40 },
  collectionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: C.hair, gap: 14,
  },
  collectionIconWrap: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center',
  },
  collectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  collectionTitle: { color: C.t1, fontSize: 16, fontWeight: '600' },
  collectionPath: { color: C.t4, fontSize: 12, marginTop: 3, fontFamily: C.code },
  collectionMeta: { color: C.t5, fontSize: 12, marginTop: 5 },

  protectedBadge: {
    paddingVertical: 3, paddingHorizontal: 8, borderRadius: 7,
    backgroundColor: 'rgba(232,151,58,0.12)',
  },
  protectedBadgeText: { fontSize: 10, color: C.warn, fontWeight: '600' },
  protectedBadgeSmall: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 3, paddingHorizontal: 8, borderRadius: 7,
    backgroundColor: 'rgba(232,151,58,0.12)', marginLeft: 8,
  },
  protectedBadgeSmallText: { fontSize: 10, color: C.warn, fontWeight: '600' },

  actionBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair,
  },
  actionBarLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  actionBarLabel: { color: C.t3, fontSize: 13, fontWeight: '500' },
  actionBarRight: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.fill,
  },
  iconBtnActive: { backgroundColor: C.accent },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: C.accent,
  },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  bulkBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: C.fillSoft,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair,
  },
  bulkCount: { color: C.t1, fontSize: 14, fontWeight: '600' },
  bulkSelectAll: { color: C.accent, fontSize: 12, marginTop: 2, fontWeight: '500' },
  bulkDeleteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: C.danger,
  },
  bulkDeleteText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  docList: { padding: 16, paddingBottom: 110 },
  docCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: C.hair,
  },
  docCardSelected: { backgroundColor: C.cardRaised, borderColor: 'rgba(20,126,251,0.5)' },
  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: C.t4, alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: C.accent, borderColor: C.accent },
  docHeading: { color: C.t1, fontSize: 15, fontWeight: '600' },
  docIdCaption: { color: C.t4, fontSize: 11, marginTop: 2, fontFamily: C.code },
  docEmpty: { color: C.t5, fontSize: 12, marginTop: 6, fontStyle: 'italic' },
  docKvList: { marginTop: 10, gap: 5 },
  docKvRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  docKvKey: { color: C.t3, fontSize: 12, fontWeight: '500', minWidth: 70, maxWidth: 110 },
  docKvVal: { color: C.t2, fontSize: 13, flex: 1 },
  docMore: { color: C.t5, fontSize: 12, marginTop: 5 },

  sortBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 3, paddingHorizontal: 8, borderRadius: 7,
    backgroundColor: C.fill, marginLeft: 8,
  },
  sortBadgeText: { fontSize: 10, color: C.t3, fontWeight: '600' },

  inlineNull: { color: C.t4, fontStyle: 'italic' },
  inlineMeta: { color: C.t3 },
  inlineCollection: { color: C.t2, fontSize: 12 },
  inlineRef: { color: C.t3 },
  inlineNumber: { color: C.t2 },
  inlineBoolPill: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 6, alignSelf: 'flex-start' },
  inlineBoolText: { fontSize: 11, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyText: { color: C.t4, fontSize: 14, marginTop: 12 },
  endMarker: { color: C.t5, textAlign: 'center', fontSize: 11, paddingVertical: 24, fontStyle: 'italic' },
  scanCapNote: { color: C.t4, fontSize: 12, marginTop: 6, textAlign: 'center', paddingHorizontal: 20 },
  footerStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 24 },
  footerStatusText: { color: C.t3, fontSize: 13 },

  floatingBarWrapper: {
    position: 'absolute', left: 16, right: 16, bottom: Platform.OS === 'ios' ? 28 : 16,
    borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  floatingBlur: {
    borderRadius: 18, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: Platform.OS === 'android' ? 'rgba(28,28,30,0.96)' : 'transparent',
  },
  floatingInner: { paddingHorizontal: 10, paddingVertical: 10 },
  searchContainer: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.fill, borderRadius: 14, paddingHorizontal: 12, height: 42,
  },
  searchIcon: { marginRight: 6 },
  searchBar: { flex: 1, color: C.t1, fontSize: 15, paddingVertical: 0 },

  docBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.fillSoft,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair, padding: 16,
  },
  docBannerIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center',
  },
  docBannerLabel: { color: C.t4, fontSize: 12, fontWeight: '500' },
  docBannerId: { color: C.t1, fontSize: 16, fontWeight: '600', marginTop: 3, fontFamily: C.code },

  sectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 22, paddingBottom: 10,
  },
  sectionHeader: { color: C.t3, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },
  sectionHeaderCount: {
    color: C.t4, fontSize: 12, backgroundColor: C.fill,
    paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, overflow: 'hidden', minWidth: 24, textAlign: 'center',
  },

  fieldCard: {
    backgroundColor: C.card, borderRadius: 18, padding: 16, marginHorizontal: 16, marginBottom: 10,
    borderWidth: 1, borderColor: C.hair,
  },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  fieldKey: { color: C.t1, fontSize: 15, fontWeight: '600', flex: 1 },
  typeBadge: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 7, backgroundColor: C.fill, marginLeft: 8 },
  typeBadgeText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },

  valueRow: { marginTop: 2 },
  stringValue: { color: C.t1, fontSize: 14, lineHeight: 21 },
  emptyString: { color: C.t5, fontStyle: 'italic' },
  numberValue: { color: C.t1, fontSize: 16, fontWeight: '600' },
  nullPill: {
    alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 11, borderRadius: 8,
    backgroundColor: C.fill,
  },
  nullPillText: { color: C.t3, fontSize: 12, fontWeight: '500' },
  boolPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingVertical: 5, paddingHorizontal: 11, borderRadius: 8, borderWidth: 1,
  },
  boolPillText: { fontSize: 13, fontWeight: '600' },
  timestampRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  timestampAbs: { color: C.t1, fontSize: 14, fontWeight: '500' },
  timestampRel: { color: C.t3, fontSize: 12, marginTop: 2 },
  referenceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  referencePath: { color: C.t2, fontSize: 13, flex: 1, fontFamily: C.code },
  geoPoint: { color: C.t2, fontSize: 13, fontFamily: C.code },

  // structured preview (read-only, in doc view)
  structContainer: {
    marginTop: 8, backgroundColor: C.fillSoft, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: C.hair, gap: 7,
  },
  structRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  structKey: { color: C.t3, fontSize: 12, minWidth: 64, maxWidth: 120 },
  structIndex: { color: C.t4 },
  structVal: { flex: 1 },
  structValText: { color: C.t2, fontSize: 12 },
  structNested: { color: C.t4, fontSize: 12, fontStyle: 'italic' },
  structEmpty: { paddingVertical: 8 },
  structEmptyText: { color: C.t4, fontSize: 12, fontStyle: 'italic' },
  jsonToggle: { color: C.accentSoft, fontSize: 12, fontWeight: '600', marginTop: 6 },

  fieldActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  fieldEditBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: C.fill,
  },
  fieldEditText: { color: C.accentSoft, fontSize: 12, fontWeight: '600' },
  fieldDeleteBtn: {
    width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.fill,
  },

  addFieldBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 4, paddingVertical: 14, borderRadius: 16,
    backgroundColor: C.fill,
  },
  addFieldText: { color: C.accentSoft, fontSize: 14, fontWeight: '600' },

  subcollectionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: C.card, borderRadius: 18, padding: 16, marginHorizontal: 16, marginBottom: 10,
    borderWidth: 1, borderColor: C.hair,
  },
  subcollectionIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center',
  },
  subcollectionName: { color: C.t1, fontSize: 14, fontWeight: '600' },
  subcollectionPath: { color: C.t4, fontSize: 11, marginTop: 2, fontFamily: C.code },

  openSubBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 16, marginTop: 2, paddingVertical: 14, borderRadius: 16,
    backgroundColor: C.fill,
  },
  openSubBtnText: { color: C.accentSoft, fontSize: 14, fontWeight: '600' },
  openSubRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 2 },
  openSubInput: {
    flex: 1, backgroundColor: C.fill, color: C.t1, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: C.code,
  },
  openSubGo: { width: 46, height: 46, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  openSubCancel: { width: 46, height: 46, borderRadius: 14, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' },

  dangerZone: {
    marginHorizontal: 16, marginTop: 28, padding: 16, borderRadius: 18,
    backgroundColor: C.fillSoft, borderWidth: 1, borderColor: C.hair,
  },
  dangerZoneLabel: { color: C.t4, fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 12 },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 13, borderRadius: 14,
    backgroundColor: 'rgba(229,84,75,0.12)',
  },
  dangerText: { color: C.danger, fontSize: 14, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: {
    width: '100%', maxWidth: 480, maxHeight: '85%',
    backgroundColor: C.card, borderRadius: 22, borderWidth: 1, borderColor: C.hair, overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair,
  },
  modalTitle: { color: C.t1, fontSize: 18, fontWeight: '600', flex: 1 },
  modalCloseButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' },
  modalScroll: { padding: 20 },

  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  fieldLabelText: { color: C.t2, fontSize: 13, fontWeight: '600', letterSpacing: 0.2, marginBottom: 8 },
  requiredBadge: {
    paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999,
    backgroundColor: 'rgba(229,84,75,0.12)',
  },
  requiredBadgeText: { fontSize: 10, color: C.danger, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  input: {
    backgroundColor: C.fill, color: C.t1, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15,
  },
  inputError: { borderWidth: 1, borderColor: C.danger },
  inputMatch: { borderWidth: 1, borderColor: '#4caf6e' },
  inputJson: { minHeight: 160, fontFamily: C.code, fontSize: 13, textAlignVertical: 'top', lineHeight: 19 },

  typePillsScroll: { gap: 7, paddingVertical: 2, paddingRight: 4 },
  typePill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999,
    backgroundColor: C.fill,
  },
  typePillActive: { backgroundColor: C.accent },
  typePillText: { color: C.t3, fontSize: 12, fontWeight: '600' },
  typePillTextActive: { color: '#fff', fontWeight: '600' },

  // edit-mode toggle (structured / json)
  editModeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 },
  editModeToggle: { flexDirection: 'row', backgroundColor: C.fill, borderRadius: 12, padding: 3 },
  editModeBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9 },
  editModeBtnActive: { backgroundColor: C.accent },
  editModeText: { color: C.t3, fontSize: 12, fontWeight: '600' },
  editModeTextActive: { color: '#fff' },

  // structured entry rows
  entryRow: { backgroundColor: C.fillSoft, borderRadius: 14, padding: 12, marginBottom: 8 },
  entryTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryKeyInput: {
    flex: 1, backgroundColor: C.fill, color: C.t1, borderRadius: 10,
    paddingHorizontal: 11, paddingVertical: 9, fontSize: 14,
  },
  entryIndexPill: {
    minWidth: 38, paddingHorizontal: 8, paddingVertical: 9, borderRadius: 10,
    backgroundColor: C.fill, alignItems: 'center',
  },
  entryIndexText: { color: C.t3, fontSize: 13, fontWeight: '600' },
  entryTypeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10,
    backgroundColor: C.fill,
  },
  entryTypeChipText: { color: C.t2, fontSize: 11, fontWeight: '600' },
  entryRemove: { padding: 2 },
  entryValueInput: {
    backgroundColor: C.fill, color: C.t1, borderRadius: 10,
    paddingHorizontal: 11, paddingVertical: 11, fontSize: 14, marginTop: 8,
  },
  boolToggleRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  boolToggle: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: C.fill,
  },
  boolToggleActive: { backgroundColor: C.accent },
  boolToggleText: { color: C.t3, fontSize: 13, fontWeight: '600' },
  boolToggleTextActive: { color: '#fff' },
  entryNullNote: { marginTop: 8, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 10, backgroundColor: C.fill },
  entryNullText: { color: C.t3, fontSize: 13 },
  entryNestedNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 2 },
  entryNestedText: { color: C.t4, fontSize: 12, fontStyle: 'italic' },
  entryDrillBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
    paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: 'rgba(90,156,240,0.1)',
  },
  entryDrillText: { flex: 1, color: C.accentSoft, fontSize: 13, fontWeight: '600' },

  breadcrumbBar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 10, paddingVertical: 8, paddingHorizontal: 10,
    borderRadius: 12, backgroundColor: C.fill,
  },
  breadcrumbBack: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.fillSoft,
  },
  breadcrumbScroll: { alignItems: 'center', gap: 2, paddingRight: 4 },
  breadcrumbRoot: { color: C.t3, fontSize: 13, fontWeight: '600' },
  breadcrumbSegWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  breadcrumbSeg: { color: C.t3, fontSize: 13, fontWeight: '600', maxWidth: 120 },
  breadcrumbSegActive: { color: C.accentSoft },
  addEntryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12, marginTop: 2,
    backgroundColor: C.fill,
  },
  addEntryText: { color: C.accentSoft, fontSize: 13, fontWeight: '600' },

  jsonOkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  jsonOkText: { color: '#4caf6e', fontSize: 12, fontWeight: '500' },
  jsonHint: { color: C.t4, fontSize: 11, marginTop: 8, lineHeight: 16 },

  nullNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.fill, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12, marginTop: 18,
  },
  nullNoticeText: { color: C.t3, fontSize: 13 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 11,
    backgroundColor: 'rgba(229,84,75,0.1)', borderRadius: 12,
  },
  errorText: { color: C.danger, fontSize: 13, flex: 1 },

  modalBtnRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair,
  },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { color: C.t2, fontSize: 15, fontWeight: '600' },
  modalSaveBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  modalSaveText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  confirmCard: {
    width: '100%', maxWidth: 420, backgroundColor: C.card, borderRadius: 22,
    borderWidth: 1, borderColor: C.hair, overflow: 'hidden', paddingTop: 24,
  },
  confirmIconWrap: {
    alignSelf: 'center', width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(229,84,75,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  confirmTitle: { color: C.t1, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8, paddingHorizontal: 24 },
  confirmMessage: { color: C.t3, fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24, marginBottom: 16 },
  confirmSampleBox: { marginHorizontal: 18, marginBottom: 16, padding: 12, borderRadius: 12, backgroundColor: C.fillSoft },
  confirmSampleLabel: { color: C.t4, fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginBottom: 6 },
  confirmSampleId: { color: C.t2, fontSize: 12, fontFamily: C.code, marginTop: 2 },
  confirmPrompt: { color: C.t3, fontSize: 13, textAlign: 'center', marginBottom: 8, paddingHorizontal: 18 },
  confirmPhrase: { color: C.danger, fontWeight: '600', fontFamily: C.code },
  confirmDeleteBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 14, borderRadius: 14, backgroundColor: C.danger,
  },
  confirmDeleteText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});