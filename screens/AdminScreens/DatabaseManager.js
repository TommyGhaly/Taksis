// DatabaseManagerScreen.js
// Firestore admin tool. Gates on superAdmin role + biometric.

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView,
  ActivityIndicator, Alert, StyleSheet, SafeAreaView, Modal,
  KeyboardAvoidingView, Platform, Keyboard, Animated, AppState, Image, Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { getAuth } from '@react-native-firebase/auth';
import {
  FieldPath,
  GeoPoint,
  Timestamp,
  addDoc,
  collection,
  deleteDoc as firestoreDeleteDoc,
  deleteField as firestoreDeleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  writeBatch,
} from '@react-native-firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  getMetadata,
  getStorage,
  list,
  ref as storageRef,
} from '@react-native-firebase/storage';
import {
  KNOWN_COLLECTIONS, AUDIT_COLLECTION, BULK_HARD_CEILING,
  resolveCollectionNode, declaredSubcollectionsForDoc,
} from '../../utils/databaseRegistry';
import { LIST_PERF } from '../../utils/listConfig';
// In-place expanding image (thumbnail that animates up to a larger preview).
// Adjust this path to wherever ProfileImageExpander lives in your tree.
import ProfileImageExpander from '../../components/ProfileImageExpander';
import { useContentWidth, WIDE_MIN } from '../../hooks/useResponsiveLayout';

// ── Palette — matches Taksis dark theme ──────────────────────────────────────
const C = {
  bg: '#121212',
  card: '#1a1a1a',
  cardRaised: '#222',
  accent: '#147efb',
  accentSoft: '#4d9cff',
  warn: '#ff9500',
  danger: '#ff3b30',
  hair: 'rgba(255,255,255,0.07)',
  t1: '#ffffff',
  t2: 'rgba(255,255,255,0.75)',
  t3: 'rgba(255,255,255,0.5)',
  t4: 'rgba(255,255,255,0.35)',
  t5: 'rgba(255,255,255,0.2)',
  fill: 'rgba(255,255,255,0.07)',
  fillSoft: 'rgba(255,255,255,0.04)',
  boolTrue: '#4d9cff',
  boolFalse: 'rgba(255,255,255,0.4)',
  code: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
};

const TYPE_TINT = {
  string: C.t3, number: C.t3, boolean: C.t3,
  timestamp: C.t3, reference: C.t3, geopoint: C.t3,
  array: C.t4, map: C.t4, null: C.t4,
};

// Synthetic root entry for the storage browser. Not a Firestore collection —
// handled by its own view branch.
const STORAGE_ROOT_PREFIX = 'profilePictures';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

// ── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;
const STORAGE_PAGE_SIZE = 50;

const detectType = (v) => {
  if (v === null || v === undefined) return 'null';
  if (v && typeof v.toDate === 'function') return 'timestamp';
  if (v && v.latitude !== undefined && v.longitude !== undefined) return 'geopoint';
  if (v && v.id && v.path && typeof v.path === 'string') return 'reference';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') return 'map';
  return typeof v;
};

const isComplex = (v) => { const t = detectType(v); return t === 'array' || t === 'map'; };

const mmddyyToTime = (id) => {
  if (typeof id !== 'string') return NaN;
  const parts = id.split('-');
  if (parts.length !== 3) return NaN;
  const [m, d, y] = parts.map((p) => parseInt(p, 10));
  if (Number.isNaN(m) || Number.isNaN(d) || Number.isNaN(y)) return NaN;
  return new Date(y < 100 ? 2000 + y : y, m - 1, d).getTime();
};

const formatTimestamp = (date) => {
  const abs = date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000);
  const abs2 = Math.abs(diffSec);
  let rel;
  if (abs2 < 60) rel = 'just now';
  else if (abs2 < 3600) rel = `${Math.round(abs2/60)}m ago`;
  else if (abs2 < 86400) rel = `${Math.round(abs2/3600)}h ago`;
  else if (abs2 < 2592000) rel = `${Math.round(abs2/86400)}d ago`;
  else if (abs2 < 31536000) rel = `${Math.round(abs2/2592000)}mo ago`;
  else rel = `${Math.round(abs2/31536000)}y ago`;
  return { abs, rel };
};

const formatBytes = (n) => {
  if (n == null || Number.isNaN(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const writeAudit = async (action, path, before, after, meta = {}) => {
  try {
    await addDoc(collection(getFirestore(), AUDIT_COLLECTION), {
      ts: serverTimestamp(),
      uid: getAuth().currentUser?.uid || null,
      action, path,
      before: before ?? null, after: after ?? null, meta,
    });
  } catch (e) { console.warn('audit write failed', e); }
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
  if (t === 'string') return v.length > 24 ? `"${v.slice(0,24)}…"` : `"${v}"`;
  if (t === 'boolean') return v ? 'true' : 'false';
  if (t === 'number') return String(v);
  if (depth >= 1) {
    if (t === 'array') return `[${v.length}]`;
    if (t === 'map') return `{${Object.keys(v).length}}`;
  }
  if (t === 'array') {
    if (v.length === 0) return '[]';
    return `[${v.slice(0,3).map((x) => inlineSummary(x, depth+1)).join(', ')}${v.length > 3 ? ', …' : ''}]`;
  }
  if (t === 'map') {
    const keys = Object.keys(v);
    if (keys.length === 0) return '{}';
    return `{${keys.slice(0,3).map((k) => `${k}: ${inlineSummary(v[k], depth+1)}`).join(', ')}${keys.length > 3 ? ', …' : ''}}`;
  }
  return String(v);
};

const SPECIAL_HINT = '__fs__';
const toEditable = (v) => {
  const t = detectType(v);
  if (t === 'timestamp') return { [SPECIAL_HINT]: 'timestamp', value: v.toDate().toISOString() };
  if (t === 'reference') return { [SPECIAL_HINT]: 'reference', value: v.path };
  if (t === 'geopoint') return { [SPECIAL_HINT]: 'geopoint', lat: v.latitude, lng: v.longitude };
  if (t === 'array') return v.map(toEditable);
  if (t === 'map') { const o = {}; for (const k of Object.keys(v)) o[k] = toEditable(v[k]); return o; }
  return v;
};
const fromEditable = (v) => {
  if (v == null) return v;
  if (Array.isArray(v)) return v.map(fromEditable);
  if (typeof v === 'object') {
    if (v[SPECIAL_HINT] === 'timestamp') {
      const d = new Date(v.value);
      if (Number.isNaN(d.getTime())) throw new Error(`Bad timestamp: ${v.value}`);
      return Timestamp.fromDate(d);
    }
    if (v[SPECIAL_HINT] === 'reference') {
      if (!v.value) throw new Error('Reference path required');
      return doc(getFirestore(), v.value);
    }
    if (v[SPECIAL_HINT] === 'geopoint') {
      const lat = Number(v.lat), lng = Number(v.lng);
      if (Number.isNaN(lat) || Number.isNaN(lng)) throw new Error('Bad geopoint');
      return new GeoPoint(lat, lng);
    }
    const o = {}; for (const k of Object.keys(v)) o[k] = fromEditable(v[k]); return o;
  }
  return v;
};

// ── Scalar inline chip (for list previews) ───────────────────────────────────

function InlineValue({ value, style }) {
  const t = detectType(value);
  if (t === 'boolean') {
    return (
      <View style={[iv.boolPill, { backgroundColor: value ? 'rgba(77,156,255,0.12)' : C.fill }]}>
        <Text style={[iv.boolText, { color: value ? C.boolTrue : C.boolFalse }]}>
          {value ? 'true' : 'false'}
        </Text>
      </View>
    );
  }
  if (t === 'null') return <Text style={[style, { color: C.t4, fontStyle: 'italic' }]} numberOfLines={1}>null</Text>;
  if (t === 'timestamp') return <Text style={[style, { color: C.accentSoft }]} numberOfLines={1}>{formatTimestamp(value.toDate()).rel}</Text>;
  if (t === 'reference') return <Text style={[style, { color: C.t3 }]} numberOfLines={1}>→ {value.path}</Text>;
  if (t === 'array') return <Text style={[style, { color: C.t3 }]} numberOfLines={1}>[{value.length} items]</Text>;
  if (t === 'map') return <Text style={[style, { color: C.t3 }]} numberOfLines={1}>{`{${Object.keys(value).length} fields}`}</Text>;
  if (t === 'number') return <Text style={[style, { color: C.t2 }]} numberOfLines={1}>{value}</Text>;
  return <Text style={style} numberOfLines={1}>{String(value)}</Text>;
}

const iv = StyleSheet.create({
  boolPill: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: 6, alignSelf: 'flex-start' },
  boolText: { fontSize: 11, fontWeight: '600' },
});

// ── Recursive nested preview (read-only, doc view) ───────────────────────────
// Renders maps and arrays as indented trees. Arrays of maps show each item
// as a numbered card. Depth-limited with "Show more" expansion.

const PREVIEW_DEPTH_LIMIT = 4;
const PREVIEW_ITEM_LIMIT = 6;
// Above this many entries, a collection starts collapsed behind "Show more".
const PREVIEW_AUTOCOLLAPSE_SIZE = 8;

/** Entry count for arrays and maps alike; 0 for scalars and null. */
function collectionSize(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value).length;
  return 0;
}

function RecursivePreview({ value, depth = 0, label = null }) {
  // The size test used to be `Array.isArray(value) && value.length > 8`, so only
  // long *arrays* auto-collapsed. A map was never measured — which meant opening a
  // document with a 300-key map rendered all 300 rows, nested, inside a plain
  // ScrollView. Maps now collapse on the same threshold as arrays.
  const [expanded, setExpanded] = useState(
    () => collectionSize(value) <= PREVIEW_AUTOCOLLAPSE_SIZE && depth < 2
  );
  const t = detectType(value);

  if (depth > PREVIEW_DEPTH_LIMIT) {
    return <Text style={rp.deepLimit}>…</Text>;
  }

  // ── Scalar leaf ──
  if (t !== 'array' && t !== 'map') {
    return (
      <View style={rp.leafRow}>
        {label !== null && <Text style={rp.leafKey} numberOfLines={1}>{label}</Text>}
        <View style={rp.leafVal}>
          <InlineValue value={value} style={rp.leafValText} />
        </View>
      </View>
    );
  }

  const isArr = t === 'array';
  const entries = isArr
    ? value.map((v, i) => ({ key: String(i), val: v }))
    : Object.entries(value).map(([k, v]) => ({ key: k, val: v }));

  const isEmpty = entries.length === 0;
  const shown = expanded ? entries : entries.slice(0, PREVIEW_ITEM_LIMIT);
  const hidden = entries.length - shown.length;

  // Is this an array of maps? Render each item as a mini card.
  const isArrayOfMaps = isArr && entries.length > 0 && entries.every(e => detectType(e.val) === 'map');

  const headerLabel = isArr
    ? `[${entries.length} ${entries.length === 1 ? 'item' : 'items'}]`
    : `{${entries.length} ${entries.length === 1 ? 'field' : 'fields'}}`;

  return (
    <View style={[rp.block, depth === 0 && rp.blockRoot]}>
      {/* Collapse/expand header */}
      <TouchableOpacity
        style={rp.header}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <View style={rp.headerLeft}>
          <View style={[rp.typeChip, { backgroundColor: isArr ? 'rgba(77,156,255,0.1)' : 'rgba(255,149,0,0.1)' }]}>
            <Ionicons
              name={isArr ? 'list-outline' : 'albums-outline'}
              size={11}
              color={isArr ? C.accentSoft : C.warn}
            />
            <Text style={[rp.typeChipText, { color: isArr ? C.accentSoft : C.warn }]}>
              {isArr ? 'array' : 'map'}
            </Text>
          </View>
          {label !== null && <Text style={rp.headerLabel} numberOfLines={1}>{label}</Text>}
          <Text style={rp.headerCount}>{headerLabel}</Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={C.t4}
        />
      </TouchableOpacity>

      {expanded && !isEmpty && (
        <View style={[rp.body, depth === 0 && rp.bodyRoot]}>
          {isArrayOfMaps ? (
            // Array of maps: each item is a mini numbered card
            shown.map((e, i) => (
              <View key={i} style={rp.mapCard}>
                <View style={rp.mapCardIndex}>
                  <Text style={rp.mapCardIndexText}>{i}</Text>
                </View>
                <View style={rp.mapCardBody}>
                  {Object.entries(e.val).slice(0, 8).map(([k, v]) => (
                    <RecursivePreview key={k} value={v} depth={depth + 1} label={k} />
                  ))}
                  {Object.keys(e.val).length > 8 && (
                    <Text style={rp.moreFields}>+{Object.keys(e.val).length - 8} more fields</Text>
                  )}
                </View>
              </View>
            ))
          ) : (
            // Normal map or primitive array
            shown.map((e, i) => (
              <View key={i} style={[rp.entryRow, isArr && rp.entryRowArr]}>
                {isArr && (
                  <View style={rp.arrIndex}>
                    <Text style={rp.arrIndexText}>{i}</Text>
                  </View>
                )}
                <View style={rp.entryVal}>
                  <RecursivePreview value={e.val} depth={depth + 1} label={isArr ? null : e.key} />
                </View>
              </View>
            ))
          )}

          {hidden > 0 && (
            <TouchableOpacity onPress={() => setExpanded(true)} style={rp.showMoreBtn} activeOpacity={0.7}>
              <Text style={rp.showMoreText}>Show {hidden} more</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {expanded && isEmpty && (
        <View style={rp.emptyBody}>
          <Text style={rp.emptyText}>{isArr ? 'Empty array' : 'Empty map'}</Text>
        </View>
      )}
    </View>
  );
}

const rp = StyleSheet.create({
  block: {
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 4,
  },
  blockRoot: {
    backgroundColor: C.fillSoft,
    borderWidth: 1,
    borderColor: C.hair,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeChipText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  headerLabel: { color: C.t1, fontSize: 13, fontWeight: '600', flex: 1 },
  headerCount: { color: C.t4, fontSize: 12 },
  body: {
    paddingHorizontal: 10,
    paddingBottom: 8,
    gap: 2,
  },
  bodyRoot: { paddingHorizontal: 12 },
  emptyBody: { paddingHorizontal: 12, paddingBottom: 10 },
  emptyText: { color: C.t4, fontSize: 12, fontStyle: 'italic' },

  // Array of maps
  mapCard: {
    flexDirection: 'row',
    backgroundColor: C.fill,
    borderRadius: 8,
    marginBottom: 6,
    overflow: 'hidden',
  },
  mapCardIndex: {
    width: 28,
    backgroundColor: 'rgba(77,156,255,0.1)',
    alignItems: 'center',
    paddingTop: 10,
  },
  mapCardIndexText: { color: C.accentSoft, fontSize: 11, fontWeight: '700' },
  mapCardBody: { flex: 1, padding: 8, gap: 2 },
  moreFields: { color: C.t4, fontSize: 11, fontStyle: 'italic', marginTop: 2 },

  // Normal array rows
  entryRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 2 },
  entryRowArr: { gap: 8 },
  arrIndex: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: C.fill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  arrIndexText: { color: C.t4, fontSize: 10, fontWeight: '700' },
  entryVal: { flex: 1 },

  // Leaf
  leafRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    gap: 8,
  },
  leafKey: { color: C.t3, fontSize: 12, minWidth: 64, maxWidth: 120, fontWeight: '500' },
  leafVal: { flex: 1 },
  leafValText: { color: C.t2, fontSize: 13 },

  deepLimit: { color: C.t5, fontSize: 11, fontStyle: 'italic', paddingVertical: 4 },

  showMoreBtn: { paddingVertical: 8, alignItems: 'center' },
  showMoreText: { color: C.accentSoft, fontSize: 12, fontWeight: '600' },
});

// ── Field value display (doc detail view) ────────────────────────────────────

function FieldValueDisplay({ value }) {
  const t = detectType(value);
  const [expanded, setExpanded] = useState(false);

  if (t === 'null') {
    return (
      <View style={fv.row}>
        <View style={fv.nullPill}><Text style={fv.nullText}>null</Text></View>
      </View>
    );
  }
  if (t === 'boolean') {
    return (
      <View style={fv.row}>
        <View style={[fv.boolPill,
          { backgroundColor: value ? 'rgba(77,156,255,0.1)' : C.fill,
            borderColor: value ? 'rgba(77,156,255,0.25)' : C.hair }]}>
          <Ionicons name={value ? 'checkmark-circle' : 'close-circle'} size={14} color={value ? C.boolTrue : C.boolFalse} />
          <Text style={[fv.boolText, { color: value ? C.boolTrue : C.boolFalse }]}>
            {value ? 'true' : 'false'}
          </Text>
        </View>
      </View>
    );
  }
  if (t === 'number') return <View style={fv.row}><Text style={fv.number}>{value}</Text></View>;
  if (t === 'timestamp') {
    const { abs, rel } = formatTimestamp(value.toDate());
    return (
      <View style={fv.tsRow}>
        <Ionicons name="time-outline" size={14} color={C.accentSoft} />
        <View style={{ flex: 1 }}>
          <Text style={fv.tsAbs}>{abs}</Text>
          <Text style={fv.tsRel}>{rel}</Text>
        </View>
      </View>
    );
  }
  if (t === 'reference') {
    return (
      <View style={fv.refRow}>
        <Ionicons name="link" size={14} color={C.accent} />
        <Text style={fv.refPath} numberOfLines={2}>{value.path}</Text>
      </View>
    );
  }
  if (t === 'geopoint') {
    return (
      <View style={fv.refRow}>
        <Ionicons name="location" size={14} color={C.accentSoft} />
        <Text style={fv.refPath}>{value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}</Text>
      </View>
    );
  }
  if (t === 'array' || t === 'map') {
    // Use the recursive tree renderer
    return <RecursivePreview value={value} depth={0} />;
  }
  const str = String(value);
  const isLong = str.length > 140;
  return (
    <View style={fv.row}>
      <Text style={fv.string} numberOfLines={!expanded && isLong ? 3 : undefined}>
        {str || <Text style={{ color: C.t4, fontStyle: 'italic' }}>(empty string)</Text>}
      </Text>
      {isLong && (
        <TouchableOpacity onPress={() => setExpanded(e => !e)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={fv.toggle}>{expanded ? 'Show less' : 'Show all'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const fv = StyleSheet.create({
  row: { marginTop: 2 },
  string: { color: C.t1, fontSize: 14, lineHeight: 21 },
  number: { color: C.t1, fontSize: 16, fontWeight: '600' },
  toggle: { color: C.accentSoft, fontSize: 12, fontWeight: '600', marginTop: 6 },
  nullPill: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 11, borderRadius: 8, backgroundColor: C.fill },
  nullText: { color: C.t3, fontSize: 12, fontWeight: '500' },
  boolPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 11, borderRadius: 10, borderWidth: 1 },
  boolText: { fontSize: 13, fontWeight: '600' },
  tsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  tsAbs: { color: C.t1, fontSize: 14, fontWeight: '500' },
  tsRel: { color: C.t3, fontSize: 12, marginTop: 2 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  refPath: { color: C.t2, fontSize: 13, flex: 1, fontFamily: C.code },
});

// ── Gate screen ───────────────────────────────────────────────────────────────

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
        const uid = getAuth().currentUser?.uid;
        if (!uid) { if (alive) setGateState('denied'); return; }
        const snap = await getDoc(doc(getFirestore(), 'users', uid));
        const isSuper = snap.exists ? snap.data()?.superAdmin === true : false;
        if (!alive) return;
        setGateState(isSuper ? 'bio_prompt' : 'denied');
      } catch { if (alive) setGateState('denied'); }
    })();
    return () => { alive = false; };
  }, []);

  const runBiometric = useCallback(async () => {
    setBioError(null);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) { setGateState('bio_unavailable'); return; }
      // Don't block on !enrolled — let the system prompt handle passcode fallback
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
            : result.error === 'user_cancel' ? null : (result.error || null)
        );
      }
    } catch (e) { setBioError(e.message || 'Authentication error'); }
  }, []);

  useEffect(() => { if (gateState === 'bio_prompt') runBiometric(); }, [gateState, runBiometric]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appState.current; appState.current = next;
      if (gateState !== 'ok') return;
      if (next === 'background' || next === 'inactive') { backgroundedAt.current = Date.now(); }
      else if (next === 'active' && prev !== 'active') {
        const elapsed = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        if (elapsed > REAUTH_AFTER_BACKGROUND_MS) setGateState('locked');
      }
    });
    return () => sub.remove();
  }, [gateState]);

  useEffect(() => { if (gateState === 'locked') runBiometric(); }, [gateState, runBiometric]);

  const goCollection = (path, label) => { setStack([{ type: 'collection', path, label: label || path }]); setView('collection'); };
  const goStorage = () => { setStack([{ type: 'storage', path: STORAGE_ROOT_PREFIX, label: 'Profile Pictures' }]); setView('storage'); };
  const goDocument = (path, label) => { setStack((s) => [...s, { type: 'document', path, label }]); setView('document'); };
  const goSubcollection = (path, label) => { setStack((s) => [...s, { type: 'collection', path, label }]); setView('collection'); };
  const goBack = () => {
    setStack((s) => {
      const next = s.slice(0, -1);
      if (next.length === 0) setView('root');
      else setView(next[next.length - 1].type);
      return next;
    });
  };

  // Gate screens
  if (gateState === 'checking') {
    return (
      <SafeAreaView style={g.center}>
        <ActivityIndicator color={C.accent} size="large" />
        <Text style={g.sub}>Verifying access…</Text>
      </SafeAreaView>
    );
  }
  if (gateState === 'denied') {
    return (
      <SafeAreaView style={g.center}>
        <View style={[g.iconWrap, { backgroundColor: 'rgba(255,59,48,0.1)' }]}>
          <Ionicons name="lock-closed" size={36} color={C.danger} />
        </View>
        <Text style={g.title}>Access denied</Text>
        <Text style={g.sub}>This area requires superAdmin privileges.</Text>
      </SafeAreaView>
    );
  }
  if (gateState === 'bio_unavailable' || gateState === 'bio_prompt' || gateState === 'locked') {
    return (
      <SafeAreaView style={g.center}>
        <View style={g.iconWrap}>
          <Ionicons name={Platform.OS === 'ios' ? 'scan-circle-outline' : 'finger-print'} size={48} color={C.accent} />
        </View>
        <Text style={g.title}>
          {gateState === 'locked' ? 'Locked' : gateState === 'bio_unavailable' ? 'Authentication required' : 'Authentication required'}
        </Text>
        <Text style={g.sub}>
          {gateState === 'locked' ? 'Verify your identity to resume.' : 'Verify your identity to access the Database Admin.'}
        </Text>
        {bioError ? <Text style={g.err}>{bioError}</Text> : null}
        <TouchableOpacity style={g.btn} onPress={runBiometric} activeOpacity={0.8}>
          <Ionicons name="lock-open-outline" size={16} color="#fff" />
          <Text style={g.btnText}>{bioError ? 'Try again' : 'Authenticate'}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const current = stack[stack.length - 1];
  return (
    <SafeAreaView style={styles.screen}>
      <Header view={view} stack={stack} onBack={view !== 'root' ? goBack : null} />
      {view === 'root' && <RootList onPick={goCollection} onPickStorage={goStorage} />}
      {view === 'collection' && (
        <CollectionView key={current.path} collectionPath={current.path} label={current.label}
          onOpenDoc={(docPath, id) => goDocument(docPath, id)} />
      )}
      {view === 'storage' && (
        <StorageView key={current.path} prefix={current.path} />
      )}
      {view === 'document' && (
        <DocumentView key={current.path} docPath={current.path} label={current.label}
          onOpenSubcollection={goSubcollection} onAfterDelete={goBack} />
      )}
    </SafeAreaView>
  );
}

const g = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 40 },
  iconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(20,126,251,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { color: C.t1, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  sub: { color: C.t3, fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
  err: { color: C.warn, fontSize: 13, textAlign: 'center', marginTop: 12, paddingHorizontal: 32, lineHeight: 18 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.accent, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, marginTop: 24 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

// ── Header ────────────────────────────────────────────────────────────────────

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

// ── Root list ─────────────────────────────────────────────────────────────────

function RootList({ onPick, onPickStorage }) {
  return (
    <FlatList
      data={KNOWN_COLLECTIONS}
      keyExtractor={(c) => c.path}
      contentContainerStyle={styles.rootList}
      ListFooterComponent={
        <>
          <Text style={styles.rootSectionLabel}>Storage</Text>
          <TouchableOpacity style={styles.collectionCard} onPress={onPickStorage} activeOpacity={0.8}>
            <View style={[styles.collectionIconWrap, { backgroundColor: 'rgba(20,126,251,0.12)' }]}>
              <Ionicons name="images" size={20} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.collectionTitle}>Profile Pictures</Text>
              <Text style={styles.collectionPath}>/{STORAGE_ROOT_PREFIX}</Text>
              <Text style={styles.collectionMeta}>Cloud Storage · browse &amp; delete</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.t5} />
          </TouchableOpacity>
        </>
      }
      renderItem={({ item }) => {
        const subCount = item.subcollections ? Object.keys(item.subcollections).length : 0;
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
              {subCount > 0 && <Text style={styles.collectionMeta}>{subCount} subcollection{subCount === 1 ? '' : 's'}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.t5} />
          </TouchableOpacity>
        );
      }}
    />
  );
}

// ── Collection view ───────────────────────────────────────────────────────────

const docKeyExtractor = (d) => d.id;

/**
 * One document card in a collection listing.
 *
 * The key/preview derivation (Object.keys, filter, slice) runs in here rather than
 * being hoisted, because it depends only on `item` — which is what the memo is
 * keyed on, so it runs once per document rather than once per render.
 */
const DocCard = React.memo(({ item, isSelected, selectMode, onPress, onLongPress }) => {
  const data = item.data || {};
  const allKeys = Object.keys(data);
  const hasName = typeof data.name === 'string' && data.name.trim().length > 0;
  const heading = hasName ? data.name : item.id;
  const previewKeys = allKeys.filter((k) => !(hasName && k === 'name')).slice(0, 3);
  const hiddenCount = allKeys.length - previewKeys.length - (hasName ? 1 : 0);

  return (
    <TouchableOpacity
      style={[styles.docCard, isSelected && styles.docCardSelected]}
      onPress={() => onPress(item.id)}
      onLongPress={() => onLongPress(item.id)}
      activeOpacity={0.8}
    >
      {selectMode && (
        <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      )}
      <View style={styles.docCardBody}>
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
            {hiddenCount > 0 && <Text style={styles.docMore}>+{hiddenCount} more</Text>}
          </View>
        )}
      </View>
      {!selectMode && <Ionicons name="chevron-forward" size={16} color={C.t5} />}
    </TouchableOpacity>
  );
});
DocCard.displayName = "DocCard";

function CollectionView({ collectionPath, label, onOpenDoc }) {
  const { node: config } = useMemo(() => resolveCollectionNode(collectionPath), [collectionPath]);
  const effectiveConfig = config || { path: collectionPath };
  const protectedColl = !!effectiveConfig.protected;

  // Build the ref from the whole path in one call. Chaining
  // `collection(parentCollectionRef, ...)` used to look right but always threw:
  // a CollectionReference has no `.collection()` method, so the modular helper's
  // `parent.collection.call(...)` blew up on `undefined` — inside a useMemo, i.e.
  // during render, which crashes the screen. It only bit nested paths
  // (churches/{id}/schedule, .../unavailable, .../Hymns Class/...), which is why
  // the top-level collections always worked.
  const collRef = useMemo(() => {
    const segs = collectionPath.split('/').filter(Boolean);
    return collection(getFirestore(), segs[0], ...segs.slice(1));
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
  const dateSorted = effectiveConfig.sortBy === '__date_mmddyy__';

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardOffset, { toValue: e.endCoordinates.height, duration: Platform.OS === 'ios' ? e.duration || 250 : 200, useNativeDriver: false }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardOffset, { toValue: 0, duration: Platform.OS === 'ios' ? e.duration || 250 : 200, useNativeDriver: false }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [keyboardOffset]);

  const loadPage = useCallback(async (reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true; setLoading(true);
    try {
      let activeSort = sortField, probeDocs = null;
      if (reset || !activeSort) {
        if (dateSorted) { activeSort = '__id__'; }
        else if (effectiveConfig.sortBy) { activeSort = effectiveConfig.sortBy; }
        else {
          const probe = await getDocs(query(collRef, orderBy(FieldPath.documentId()), limit(PAGE_SIZE)));
          probeDocs = probe.docs;
          // Only sort by `name` when EVERY probed doc has a string `name`.
          // orderBy('name') silently drops docs missing the field, so a single
          // stray `name` must not switch the whole collection into name-sort —
          // that's what was hiding most grade docs (containers have no `name`).
          activeSort = probe.docs.length > 0 && probe.docs.every((d) => typeof d.data()?.name === 'string') ? 'name' : '__id__';
        }
        setSortField(activeSort);
      }
      const cursor = reset ? null : cursorRef.current;
      let snap;
      if (activeSort === '__id__') {
        if (probeDocs && reset) { snap = { docs: probeDocs }; }
        else {
          let q = query(collRef, orderBy(FieldPath.documentId()), limit(PAGE_SIZE));
          if (cursor) q = query(q, startAfter(cursor));
          snap = await getDocs(q);
        }
      } else {
        let q = query(collRef, orderBy(activeSort), limit(PAGE_SIZE));
        if (cursor) q = query(q, startAfter(cursor));
        snap = await getDocs(q);
      }
      if (reset) seenIdsRef.current = new Set();
      const newDocs = [];
      for (const d of snap.docs) {
        if (seenIdsRef.current.has(d.id)) continue;
        seenIdsRef.current.add(d.id);
        newDocs.push({ id: d.id, data: d.data(), ref: d.ref });
      }
      setDocs((prev) => (reset ? newDocs : [...prev, ...newDocs]));
      const last = snap.docs[snap.docs.length - 1];
      if (last) cursorRef.current = last;
      setDone(snap.docs.length < PAGE_SIZE);
    } catch (e) { Alert.alert('Load error', e.message); }
    finally { loadingRef.current = false; setLoading(false); }
  }, [collRef, sortField, effectiveConfig.sortBy, dateSorted]);

  useEffect(() => {
    setDocs([]); setDone(false); setSelected(new Set()); setSelectMode(false);
    setSortField(null); cursorRef.current = null; seenIdsRef.current = new Set(); loadingRef.current = false;
    loadPage(true);
  }, [collectionPath]); // eslint-disable-line react-hooks/exhaustive-deps

  const orderedDocs = useMemo(() => {
    if (!dateSorted) return docs;
    return [...docs].sort((a, b) => {
      const ta = mmddyyToTime(a.id), tb = mmddyyToTime(b.id);
      if (Number.isNaN(ta) && Number.isNaN(tb)) return a.id.localeCompare(b.id);
      if (Number.isNaN(ta)) return 1; if (Number.isNaN(tb)) return -1;
      return tb - ta;
    });
  }, [docs, dateSorted]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orderedDocs;
    return orderedDocs.filter((d) => {
      if (d.id.toLowerCase().includes(q)) return true;
      for (const v of Object.values(d.data || {})) if (valueContains(v, q)) return true;
      return false;
    });
  }, [orderedDocs, search]);

  const SEARCH_SCAN_CAP = 500;
  useEffect(() => {
    if (!search.trim() || done || loading || docs.length >= SEARCH_SCAN_CAP) return;
    loadPage(false);
  }, [search, docs.length, done, loading, loadPage]);

  const toggleSelect = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAllVisible = () => setSelected(new Set(filtered.map((d) => d.id)));

  const handleDocPress = useCallback((id) => {
    if (selectMode) toggleSelect(id);
    else onOpenDoc(`${collectionPath}/${id}`, id);
  }, [selectMode, collectionPath, onOpenDoc]);

  const handleDocLongPress = useCallback((id) => {
    setSelectMode(true);
    toggleSelect(id);
  }, []);

  // `docs` grows without bound as the user pages, so the row is memoized and the
  // list is windowed — the previous inline renderItem rebuilt every mounted card
  // (each doing Object.keys + filter + slice) on every render.
  const renderDoc = useCallback(
    ({ item }) => (
      <DocCard
        item={item}
        isSelected={selected.has(item.id)}
        selectMode={selectMode}
        onPress={handleDocPress}
        onLongPress={handleDocLongPress}
      />
    ),
    [selected, selectMode, handleDocPress, handleDocLongPress]
  );

  const runBulkDelete = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (ids.length > BULK_HARD_CEILING) { Alert.alert('Too many', `Hard cap is ${BULK_HARD_CEILING} per bulk op.`); return; }
    const phrase = protectedColl ? `DELETE-${effectiveConfig.path}` : effectiveConfig.path;
    setConfirmState({
      phrase, title: `Delete ${ids.length} document${ids.length === 1 ? '' : 's'}`,
      message: `From /${effectiveConfig.path}${protectedColl ? ' (protected)' : ''}.\n\nThis cannot be undone.`,
      sampleIds: ids.slice(0, 5), totalCount: ids.length,
      onConfirm: async () => {
        try {
          for (const g of chunk(ids, 500)) {
            const batch = writeBatch(getFirestore());
            for (const id of g) batch.delete(doc(collRef, id));
            await batch.commit();
          }
          await writeAudit('bulkDelete', collectionPath, null, null, { count: ids.length });
          setDocs((prev) => prev.filter((d) => !selected.has(d.id)));
          setSelected(new Set()); setSelectMode(false); setConfirmState(null);
          Alert.alert('Done', `Deleted ${ids.length} documents.`);
        } catch (e) { setConfirmState(null); Alert.alert('Bulk delete failed', e.message); }
      },
    });
  };

  const createNewDoc = async () => {
    try {
      const ref = await addDoc(collRef, { _createdBy: 'admin', _createdAt: serverTimestamp() });
      await writeAudit('create', `${collectionPath}/${ref.id}`, null, { _createdBy: 'admin' });
      onOpenDoc(`${collectionPath}/${ref.id}`, ref.id);
    } catch (e) { Alert.alert('Create failed', e.message); }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.actionBar}>
        <View style={styles.actionBarLeft}>
          <Text style={styles.actionBarLabel}>
            {filtered.length}{search ? ` of ${docs.length}` : ''} {filtered.length === 1 ? 'doc' : 'docs'}{!done && !search ? '+' : ''}
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
            disabled={selected.size === 0} onPress={runBulkDelete} activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={16} color="#fff" />
            <Text style={styles.bulkDeleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        {...LIST_PERF}
        data={filtered}
        keyExtractor={docKeyExtractor}
        contentContainerStyle={styles.docList}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        renderItem={renderDoc}
        onEndReachedThreshold={0.5}
        onEndReached={() => !done && loadPage(false)}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyState}>
            <Ionicons name={search ? 'search' : 'document-outline'} size={40} color="rgba(255,255,255,0.1)" />
            <Text style={styles.emptyText}>{search ? (done || docs.length >= SEARCH_SCAN_CAP ? 'No documents match your search' : 'Searching…') : 'No documents yet'}</Text>
          </View>
        ) : null}
        ListFooterComponent={
          loading ? (
            <View style={styles.footerStatus}>
              <ActivityIndicator color={C.accent} size="small" />
              <Text style={styles.footerStatusText}>{search ? `Searching… ${docs.length} scanned` : 'Loading…'}</Text>
            </View>
          ) : done && filtered.length > 0 ? (
            <Text style={styles.endMarker}>End of collection</Text>
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

// ── Storage view ──────────────────────────────────────────────────────────────
// Browses Cloud Storage objects under a prefix (profilePictures/). The client
// Storage SDK CAN enumerate objects (unlike Firestore subcollections), so we
// paginate with list({ maxResults, pageToken }). Thumbnails load lazily per
// row. Single + bulk delete; deletes ONLY the storage object (no Firestore).

const STORAGE_GRID_GAP = 10;
const STORAGE_LIST_PADDING = 12;

// Three across on a phone; more when the screen has the room (iPad), so the
// thumbnails stay thumbnail-sized instead of growing to 250pt. Sized off the
// width the screen actually has, not the window captured at import time.
function useStorageGrid() {
  const width = useContentWidth();
  const columns = width >= WIDE_MIN ? 5 : 3;
  const tileSize = Math.floor(
    (width - STORAGE_LIST_PADDING * 2 - STORAGE_GRID_GAP * (columns - 1)) / columns
  );
  return { columns, tileSize };
}

/**
 * One storage thumbnail.
 *
 * Memoized, and its handlers take the item rather than being pre-bound closures, so
 * the parent can keep them stable. Each of these mounts an effect that makes two
 * Storage calls (getDownloadURL + getMetadata), which is also why windowing this
 * grid matters — fewer mounted cells means fewer requests.
 */
const StorageItemRow = React.memo(function StorageItemRow({ item, tileSize, selectMode, isSelected, onPress, onLongPress, onDelete }) {
  const [url, setUrl] = useState(null);
  const [meta, setMeta] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const u = await getDownloadURL(item.ref);
        if (alive) setUrl(u);
      } catch { if (alive) setFailed(true); }
      try {
        const m = await getMetadata(item.ref);
        if (alive) setMeta(m);
      } catch { /* metadata is best-effort */ }
    })();
    return () => { alive = false; };
  }, [item.fullPath]);

  const sizeLabel = meta?.size != null ? formatBytes(Number(meta.size)) : '';
  const updated = meta?.updated ? formatTimestamp(new Date(meta.updated)).rel : '';

  const Wrapper = selectMode ? TouchableOpacity : View;
  const wrapperProps = selectMode
    ? {
        onPress: () => onPress(item),
        onLongPress: () => onLongPress(item),
        activeOpacity: 0.85,
      }
    : {};

  return (
    <View style={{ width: tileSize }}>
      <Wrapper
        style={[styles.gridImageWrap, { width: tileSize, height: tileSize }, isSelected && styles.gridImageSelected]}
        {...wrapperProps}
      >
        {url && !failed ? (
          selectMode ? (
            // In select mode tap selects — plain image, no in-place expand.
            <Image source={{ uri: url }} style={styles.gridImage} resizeMode="cover" onError={() => setFailed(true)} />
          ) : (
            <ProfileImageExpander
              imageUrl={url}
              size={tileSize}
              finalSize={Math.min(WINDOW_WIDTH, WINDOW_HEIGHT) * 0.9}
              borderRadius={12}
            />
          )
        ) : (
          <View style={styles.gridPlaceholder}>
            <Ionicons name={failed ? 'image-outline' : 'hourglass-outline'} size={24} color={C.t4} />
          </View>
        )}

        {/* Selection check overlay */}
        {selectMode && (
          <View style={[styles.gridCheck, isSelected && styles.checkboxActive]}>
            {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
          </View>
        )}

        {/* Delete overlay (hidden in select mode — use bulk delete instead) */}
        {!selectMode && (
          <TouchableOpacity
            style={styles.gridDeleteBtn}
            onPress={() => onDelete(item)}
            activeOpacity={0.8}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="trash" size={13} color="#fff" />
          </TouchableOpacity>
        )}
      </Wrapper>

      {/* Size · age, small text under the image */}
      <Text style={styles.gridMeta} numberOfLines={1}>
        {sizeLabel}{sizeLabel && updated ? '  ·  ' : ''}{updated}
      </Text>
    </View>
  );
});

const storageKeyExtractor = (it) => it.fullPath;

function StorageView({ prefix }) {
  const grid = useStorageGrid();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [search, setSearch] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [confirmState, setConfirmState] = useState(null);

  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const loadingRef = useRef(false);
  const pageTokenRef = useRef(undefined);
  const seenRef = useRef(new Set());

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardOffset, { toValue: e.endCoordinates.height, duration: Platform.OS === 'ios' ? e.duration || 250 : 200, useNativeDriver: false }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardOffset, { toValue: 0, duration: Platform.OS === 'ios' ? e.duration || 250 : 200, useNativeDriver: false }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [keyboardOffset]);

  const loadPage = useCallback(async (reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true; setLoading(true);
    try {
      const ref = storageRef(getStorage(), prefix);
      const opts = { maxResults: STORAGE_PAGE_SIZE };
      if (!reset && pageTokenRef.current) opts.pageToken = pageTokenRef.current;
      const res = await list(ref, opts);
      if (reset) seenRef.current = new Set();
      const newItems = [];
      for (const r of res.items) {
        if (seenRef.current.has(r.fullPath)) continue;
        seenRef.current.add(r.fullPath);
        newItems.push({ name: r.name, fullPath: r.fullPath, ref: r });
      }
      setItems((prev) => (reset ? newItems : [...prev, ...newItems]));
      pageTokenRef.current = res.nextPageToken || undefined;
      setDone(!res.nextPageToken);
    } catch (e) {
      Alert.alert('Storage load error', e.message);
      setDone(true);
    } finally {
      loadingRef.current = false; setLoading(false);
    }
  }, [prefix]);

  useEffect(() => {
    setItems([]); setDone(false); setSelected(new Set()); setSelectMode(false);
    pageTokenRef.current = undefined; seenRef.current = new Set(); loadingRef.current = false;
    loadPage(true);
  }, [prefix]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.name.toLowerCase().includes(q) || it.fullPath.toLowerCase().includes(q));
  }, [items, search]);

  // Keep paging while a search is active and more pages remain (cap to avoid
  // unbounded scans on very large buckets).
  const SEARCH_SCAN_CAP = 1000;
  useEffect(() => {
    if (!search.trim() || done || loading || items.length >= SEARCH_SCAN_CAP) return;
    loadPage(false);
  }, [search, items.length, done, loading, loadPage]);

  const toggleSelect = (path) => setSelected((s) => { const n = new Set(s); n.has(path) ? n.delete(path) : n.add(path); return n; });
  const selectAllVisible = () => setSelected(new Set(filtered.map((it) => it.fullPath)));

  const deleteByPaths = async (paths) => {
    // Delete with limited concurrency to be gentle on the network.
    const failures = [];
    for (const group of chunk(paths, 10)) {
      await Promise.all(group.map(async (p) => {
        try { await deleteObject(storageRef(getStorage(), p)); }
        catch (e) { failures.push({ p, e }); }
      }));
    }
    return failures;
  };

  const doDeleteSingle = async (item) => {
    const failures = await deleteByPaths([item.fullPath]);
    await writeAudit('storageDelete', item.fullPath, null, null, {});
    if (failures.length) { Alert.alert('Delete failed', failures[0].e.message); return; }
    setItems((prev) => prev.filter((it) => it.fullPath !== item.fullPath));
    seenRef.current.delete(item.fullPath);
  };

  // Single-picture delete is low-stakes (one file, recoverable by re-upload),
  // so a simple confirm is enough — no type-to-confirm. Bulk delete still uses
  // the typed modal below.
  const confirmDeleteSingle = (item) => {
    Alert.alert(
      'Delete picture?',
      `"${item.name}" will be permanently deleted from Cloud Storage.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => doDeleteSingle(item) },
      ],
    );
  };

  // Declared after confirmDeleteSingle: a dependency array is evaluated during
  // render, so referencing a `const` defined further down would hit its TDZ.
  const handleStoragePress = useCallback((item) => {
    if (selectMode) toggleSelect(item.fullPath);
  }, [selectMode]);

  const handleStorageLongPress = useCallback((item) => {
    setSelectMode(true);
    toggleSelect(item.fullPath);
  }, []);

  const renderStorageItem = useCallback(
    ({ item }) => (
      <StorageItemRow
        item={item}
        tileSize={grid.tileSize}
        selectMode={selectMode}
        isSelected={selected.has(item.fullPath)}
        onPress={handleStoragePress}
        onLongPress={handleStorageLongPress}
        onDelete={confirmDeleteSingle}
      />
    ),
    [grid.tileSize, selectMode, selected, handleStoragePress, handleStorageLongPress, confirmDeleteSingle]
  );

  const runBulkDelete = () => {
    const paths = Array.from(selected);
    if (paths.length === 0) return;
    if (paths.length > BULK_HARD_CEILING) { Alert.alert('Too many', `Hard cap is ${BULK_HARD_CEILING} per bulk op.`); return; }
    setConfirmState({
      phrase: `DELETE-${paths.length}`,
      title: `Delete ${paths.length} picture${paths.length === 1 ? '' : 's'}`,
      message: `From /${prefix}.\n\nThis permanently deletes the files from Cloud Storage. This cannot be undone.`,
      sampleIds: paths.slice(0, 5).map((p) => p.split('/').pop()), totalCount: paths.length,
      onConfirm: async () => {
        const failures = await deleteByPaths(paths);
        await writeAudit('storageBulkDelete', prefix, null, null, { count: paths.length, failures: failures.length });
        const failedSet = new Set(failures.map((f) => f.p));
        setItems((prev) => prev.filter((it) => failedSet.has(it.fullPath) || !selected.has(it.fullPath)));
        for (const p of paths) if (!failedSet.has(p)) seenRef.current.delete(p);
        setSelected(new Set()); setSelectMode(false); setConfirmState(null);
        if (failures.length) Alert.alert('Partially done', `Deleted ${paths.length - failures.length} of ${paths.length}. ${failures.length} failed.`);
        else Alert.alert('Done', `Deleted ${paths.length} picture${paths.length === 1 ? '' : 's'}.`);
      },
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.actionBar}>
        <View style={styles.actionBarLeft}>
          <Text style={styles.actionBarLabel}>
            {filtered.length}{search ? ` of ${items.length}` : ''} {filtered.length === 1 ? 'file' : 'files'}{!done && !search ? '+' : ''}
          </Text>
          <View style={styles.sortBadge}>
            <Ionicons name="cloud-outline" size={10} color={C.accentSoft} />
            <Text style={styles.sortBadgeText}>storage</Text>
          </View>
        </View>
        <View style={styles.actionBarRight}>
          <TouchableOpacity
            style={[styles.iconBtn, selectMode && styles.iconBtnActive]}
            onPress={() => { setSelectMode((m) => !m); setSelected(new Set()); }}
            activeOpacity={0.8}
          >
            <Ionicons name={selectMode ? 'close' : 'checkbox-outline'} size={18} color={selectMode ? '#fff' : C.accent} />
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
            disabled={selected.size === 0} onPress={runBulkDelete} activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={16} color="#fff" />
            <Text style={styles.bulkDeleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        {...LIST_PERF}
        // numColumns cannot change on a mounted FlatList; the key remounts it
        // when a rotation or resize changes the column count.
        key={`storage-grid-${grid.columns}`}
        data={filtered}
        keyExtractor={storageKeyExtractor}
        numColumns={grid.columns}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridList}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        renderItem={renderStorageItem}
        onEndReachedThreshold={0.5}
        onEndReached={() => !done && loadPage(false)}
        ListEmptyComponent={!loading ? (
          <View style={styles.emptyState}>
            <Ionicons name={search ? 'search' : 'images-outline'} size={40} color="rgba(255,255,255,0.1)" />
            <Text style={styles.emptyText}>{search ? (done || items.length >= SEARCH_SCAN_CAP ? 'No files match your search' : 'Searching…') : 'No files in storage'}</Text>
          </View>
        ) : null}
        ListFooterComponent={
          loading ? (
            <View style={styles.footerStatus}>
              <ActivityIndicator color={C.accent} size="small" />
              <Text style={styles.footerStatusText}>{search ? `Searching… ${items.length} scanned` : 'Loading…'}</Text>
            </View>
          ) : done && filtered.length > 0 ? (
            <Text style={styles.endMarker}>End of storage</Text>
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
                placeholder="Search by filename"
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

function DocumentView({ docPath, label, onOpenSubcollection, onAfterDelete }) {
  // Same fix as CollectionView's collRef: a DocumentReference has no `.doc()`,
  // so chaining `doc(parentDocRef, ...)` threw during render for every nested
  // document (a schedule week, an `unavailable` week, a student, a pascha doc).
  const docRef = useMemo(() => {
    const segs = docPath.split('/').filter(Boolean);
    return doc(getFirestore(), segs[0], ...segs.slice(1));
  }, [docPath]);

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
    try { const snap = await getDoc(docRef); setData(snap.exists ? snap.data() : null); }
    catch (e) { Alert.alert('Load failed', e.message); }
    finally { setLoading(false); }
  }, [docRef]);

  useEffect(() => { load(); }, [load]);

  const saveField = async (key, newValue) => {
    const before = data ? { ...data } : null;
    try {
      await updateDoc(docRef, { [key]: newValue });
      const after = { ...(data || {}), [key]: newValue };
      setData(after);
      await writeAudit('update', docPath, before, after, { field: key });
      setEditingField(null); setAddingField(false);
    } catch (e) { Alert.alert('Save failed', e.message); }
  };

  const deleteField = (key) => {
    Alert.alert('Delete field?', `Remove "${key}" from this document?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await updateDoc(docRef, { [key]: firestoreDeleteField() });
          const after = { ...(data || {}) }; delete after[key];
          setData(after);
          await writeAudit('update', docPath, data, after, { fieldDeleted: key });
        } catch (e) { Alert.alert('Delete failed', e.message); }
      }},
    ]);
  };

  const deleteDoc = () => {
    const docId = docPath.split('/').pop();
    setConfirmState({
      phrase: docId, title: 'Delete document',
      message: `${docPath}\n\nThis cannot be undone. Subcollections (if any) will be orphaned.`,
      sampleIds: [], totalCount: 1,
      onConfirm: async () => {
        try {
          await firestoreDeleteDoc(docRef);
          await writeAudit('delete', docPath, data, null);
          setConfirmState(null);
          if (onAfterDelete) onAfterDelete();
        } catch (e) { setConfirmState(null); Alert.alert('Delete failed', e.message); }
      },
    });
  };

  const openCustomSub = () => {
    const name = customSubName.trim();
    if (!name) return;
    setOpenSubInput(false); setCustomSubName('');
    onOpenSubcollection(`${docPath}/${name}`, name);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={C.accent} /></View>;
  if (!data) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={40} color={C.t4} />
        <Text style={styles.emptyText}>Document not found</Text>
        <Text style={[styles.emptyText, { fontSize: 12, marginTop: 4 }]}>{docPath}</Text>
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
        <View style={styles.sectionCount}><Text style={styles.sectionCountText}>{entries.length}</Text></View>
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyState}><Text style={styles.emptyText}>No fields yet</Text></View>
      ) : (
        entries.map(([k, v]) => {
          const t = detectType(v);
          return (
            <View key={k} style={styles.fieldCard}>
              <View style={styles.fieldHeader}>
                <Text style={styles.fieldKey}>{k}</Text>
                <View style={styles.typeBadge}>
                  <Text style={[styles.typeBadgeText, { color: TYPE_TINT[t] || C.t3 }]}>{t}</Text>
                </View>
              </View>
              <FieldValueDisplay value={v} />
              <View style={styles.fieldActions}>
                <TouchableOpacity style={styles.fieldEditBtn} onPress={() => setEditingField({ key: k, value: v, type: t, isNew: false })} activeOpacity={0.8}>
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

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeader}>Subcollections</Text>
        {subcollections.length > 0 && <View style={styles.sectionCount}><Text style={styles.sectionCountText}>{subcollections.length}</Text></View>}
      </View>

      {subcollections.map((sub) => (
        <TouchableOpacity key={sub} style={styles.subcollectionCard} onPress={() => onOpenSubcollection(`${docPath}/${sub}`, sub)} activeOpacity={0.8}>
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
            placeholder="subcollection name"
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
        <FieldEditorModal field={editingField} onCancel={() => setEditingField(null)} onSave={(v) => saveField(editingField.key, v)} />
      )}
      {addingField && (
        <FieldEditorModal field={{ key: '', value: '', type: 'string', isNew: true }} existingKeys={Object.keys(data)}
          onCancel={() => setAddingField(false)} onSave={(v, k) => { if (k) saveField(k, v); }} />
      )}
      <TypedConfirmModal state={confirmState} onCancel={() => setConfirmState(null)} />
    </ScrollView>
  );
}

// ── Structured map/array editor (unchanged logic, same as original) ───────────

const PRIMITIVE_TYPES = ['string', 'number', 'boolean', 'null', 'map', 'array'];
const PT_MAP = '__m', PT_ARR = '__a';
const isPlainMapValue = (v) => v && typeof v === 'object' && !Array.isArray(v) && v[SPECIAL_HINT] === undefined;
const toTree = (v) => {
  if (Array.isArray(v)) return { [PT_ARR]: v.map(toTree) };
  if (isPlainMapValue(v)) return { [PT_MAP]: Object.entries(v).map(([k, x]) => [k, toTree(x)]) };
  return v;
};
const fromTree = (node) => {
  if (node && typeof node === 'object' && PT_ARR in node) return node[PT_ARR].map(fromTree);
  if (node && typeof node === 'object' && PT_MAP in node) { const o = {}; for (const [k, x] of node[PT_MAP]) o[k.trim()] = fromTree(x); return o; }
  return node;
};
const treeNodeType = (node) => {
  if (node && typeof node === 'object' && PT_ARR in node) return 'array';
  if (node && typeof node === 'object' && PT_MAP in node) return 'map';
  // toEditable() turns a nested timestamp/reference/geopoint into a `__fs__`
  // envelope. detectType() sees a plain object and says 'map', which made
  // EntryRow offer a drill-in button; drilling in landed the editor on a level
  // that is neither map nor array, and the next "Add entry" spread
  // `level.__m` (undefined) and crashed. Report the real type instead — those
  // types already render as read-only "edit in JSON mode" rows.
  if (node && typeof node === 'object' && node[SPECIAL_HINT] !== undefined) return node[SPECIAL_HINT];
  return detectType(node);
};
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
    const arr = root[PT_ARR].slice(); arr[head] = treeSet(arr[head], rest, fn); return { [PT_ARR]: arr };
  }
  if (root && typeof root === 'object' && PT_MAP in root) {
    const rows = root[PT_MAP].slice(); const [k, v] = rows[head]; rows[head] = [k, treeSet(v, rest, fn)]; return { [PT_MAP]: rows };
  }
  return root;
};

// Extract a human-readable label from a map node (pair-tree or plain object).
// Prefers `name`, then `title`, then first string value, then field count.
function mapLabel(node) {
  // node may be a pair-tree { __m: [[k,v],...] } or a plain object
  let pairs = [];
  if (node && typeof node === 'object' && '__m' in node) {
    pairs = node.__m; // [[key, treeNode], ...]
  } else if (node && typeof node === 'object' && !Array.isArray(node)) {
    pairs = Object.entries(node);
  }
  if (pairs.length === 0) return 'Empty map';

  // Try priority keys first
  for (const preferred of ['name', 'title', 'label', 'displayName']) {
    const hit = pairs.find(([k]) => k === preferred);
    if (hit) {
      const v = hit[1];
      const str = typeof v === 'string' ? v : (v && typeof v === 'object' ? null : String(v));
      if (str && str.trim()) return str.trim();
    }
  }
  // Fall back to first scalar string value
  for (const [, v] of pairs) {
    const str = typeof v === 'string' ? v : null;
    if (str && str.trim()) return str.trim();
  }
  // Last resort: field summary
  return `${pairs.length} field${pairs.length === 1 ? '' : 's'}`;
}

// Compact key/value preview lines for a map (up to `max` entries)
function MapPreviewLines({ node, max = 3 }) {
  let pairs = [];
  if (node && typeof node === 'object' && '__m' in node) pairs = node.__m;
  else if (node && typeof node === 'object' && !Array.isArray(node)) pairs = Object.entries(node);

  const shown = pairs.slice(0, max);
  const more = pairs.length - shown.length;
  return (
    <View style={{ gap: 3 }}>
      {shown.map(([k, v], i) => {
        const vt = treeNodeType ? treeNodeType(v) : detectType(v);
        const isNested = vt === 'map' || vt === 'array';
        const scalar = typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null ? v : null;
        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '600', minWidth: 36, maxWidth: 72 }} numberOfLines={1}>{k}</Text>
            {isNested ? (
              <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, fontStyle: 'italic' }}>{vt === 'array' ? '[…]' : '{…}'}</Text>
            ) : scalar !== null ? (
              <InlineValue value={scalar} style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, flex: 1 }} />
            ) : (
              // timestamp / reference / geopoint arrive as `__fs__` envelopes;
              // String() on one renders "[object Object]".
              <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }} numberOfLines={1}>
                {v && typeof v === 'object' && v[SPECIAL_HINT] !== undefined
                  ? (v.value ?? `${v.lat}, ${v.lng}`)
                  : String(v)}
              </Text>
            )}
          </View>
        );
      })}
      {more > 0 && <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, fontStyle: 'italic', marginTop: 1 }}>+{more} more</Text>}
    </View>
  );
}

function EntryRow({ entryKey, value, valueType, isArray, onChangeKey, onChangeValue, onRetype, onRemove, onDrillIn, keyError }) {
  const t = valueType || detectType(value);
  const editableScalar = t === 'string' || t === 'number' || t === 'boolean' || t === 'null';
  const [text, setText] = useState(() => {
    if (t === 'null') return '';
    if (t === 'boolean') return value ? 'true' : 'false';
    if (t === 'map' || t === 'array') return '';
    return String(value);
  });

  useEffect(() => {
    if (t === 'null') setText('');
    else if (t === 'boolean') setText(value ? 'true' : 'false');
    else if (t === 'string' || t === 'number') setText(String(value));
  }, [t]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitText = (raw) => {
    setText(raw);
    if (t === 'number') { const n = Number(raw); onChangeValue(raw.trim() === '' ? 0 : (Number.isNaN(n) ? value : n)); }
    else if (t !== 'boolean') onChangeValue(raw);
  };

  const nestedCount = () => {
    if (value && typeof value === 'object') {
      if ('__a' in value) return value.__a.length;
      if ('__m' in value) return value.__m.length;
      if (Array.isArray(value)) return value.length;
      return Object.keys(value).length;
    }
    return 0;
  };

  // ── Array-of-maps: full-card tap-to-drill, content as identifier ──
  if (isArray && t === 'map') {
    const label = mapLabel(value);
    return (
      <TouchableOpacity
        onPress={onDrillIn}
        activeOpacity={0.8}
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          padding: 12,
          marginBottom: 8,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', marginBottom: 4 }} numberOfLines={1}>
            {label}
          </Text>
          <MapPreviewLines node={value} max={3} />
        </View>
        <View style={{ alignItems: 'center', paddingLeft: 12, gap: 10 }}>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.2)" />
          <TouchableOpacity onPress={onRemove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={15} color="#ff3b30" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.entryRow}>
      <View style={styles.entryTopRow}>
        {isArray ? (
          <View style={styles.entryIndexPill}><Text style={styles.entryIndexText}>{entryKey}</Text></View>
        ) : (
          <TextInput style={[styles.entryKeyInput, keyError && styles.inputError]} value={entryKey} onChangeText={onChangeKey} placeholder="key" placeholderTextColor={C.t4} autoCapitalize="none" autoCorrect={false} />
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
              <TouchableOpacity key={opt} style={[styles.boolToggle, active && styles.boolToggleActive]} onPress={() => onChangeValue(opt === 'true')} activeOpacity={0.8}>
                <Text style={[styles.boolToggleText, active && styles.boolToggleTextActive]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {editableScalar && (t === 'string' || t === 'number') && (
        <TextInput style={styles.entryValueInput} value={text} onChangeText={commitText} placeholder={t === 'number' ? '0' : 'value'} placeholderTextColor={C.t4} keyboardType={t === 'number' ? 'numbers-and-punctuation' : 'default'} autoCapitalize="none" autoCorrect={false} />
      )}
      {t === 'null' && <View style={styles.entryNullNote}><Text style={styles.entryNullText}>null</Text></View>}
      {(t === 'map' || t === 'array') && (
        <TouchableOpacity style={styles.entryDrillBtn} onPress={onDrillIn} activeOpacity={0.8}>
          <Ionicons name={t === 'array' ? 'list-outline' : 'albums-outline'} size={15} color={C.accentSoft} />
          <Text style={styles.entryDrillText}>
            {t === 'array' ? `Array · ${nestedCount()} item${nestedCount() === 1 ? '' : 's'}` : `Map · ${nestedCount()} field${nestedCount() === 1 ? '' : 's'}`}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={C.t4} />
        </TouchableOpacity>
      )}
      {(t === 'timestamp' || t === 'reference' || t === 'geopoint') && (
        <View style={styles.entryNestedNote}>
          <Ionicons name="lock-closed-outline" size={13} color={C.t4} />
          <Text style={styles.entryNestedText}>{t} — edit in JSON mode</Text>
        </View>
      )}
    </View>
  );
}

function StructuredEditor({ initial, isArrayRoot, onChange, onValidityChange }) {
  const [root, setRoot] = useState(() => toTree(initial));
  const [path, setPath] = useState([]);
  const idCounter = useRef(0);
  const rowIdsRef = useRef(new Map());
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

  const entries = useMemo(() => {
    if (currentIsArray) { const ids = ensureIds(current[PT_ARR].length); return current[PT_ARR].map((node, i) => ({ id: ids[i], key: String(i), value: node })); }
    if (currentIsMap) { const rows = current[PT_MAP]; const ids = ensureIds(rows.length); return rows.map(([k, node], i) => ({ id: ids[i], key: k, value: node })); }
    return [];
  }, [current, currentIsArray, currentIsMap, pathKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const dupKeysHere = useMemo(() => {
    if (!currentIsMap) return new Set();
    const seen = new Set(), dup = new Set();
    for (const e of entries) { const k = e.key.trim(); if (!k) continue; if (seen.has(k)) dup.add(k); seen.add(k); }
    return dup;
  }, [entries, currentIsMap]);
  const hasBlankKeyHere = currentIsMap && entries.some((e) => !e.key.trim());

  const deepValid = useMemo(() => {
    const check = (node) => {
      if (node && typeof node === 'object' && PT_ARR in node) return node[PT_ARR].every(check);
      if (node && typeof node === 'object' && PT_MAP in node) {
        const seen = new Set();
        for (const [k, v] of node[PT_MAP]) {
          const kk = k.trim();
          if (!kk || seen.has(kk)) return false;
          seen.add(kk);
          if (!check(v)) return false;
        }
        return true;
      }
      return true;
    };
    return check(root);
  }, [root]);

  useEffect(() => {
    onValidityChange(deepValid);
    if (deepValid) onChange(fromTree(root));
  }, [root, deepValid]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutateCurrent = (fn) => setRoot((r) => treeSet(r, path, fn));
  const updateEntryValue = (index, newNode) => mutateCurrent((level) => {
    if (PT_ARR in level) { const arr = level[PT_ARR].slice(); arr[index] = newNode; return { [PT_ARR]: arr }; }
    const rows = level[PT_MAP].slice(); rows[index] = [rows[index][0], newNode]; return { [PT_MAP]: rows };
  });
  const updateEntryKey = (index, newKey) => mutateCurrent((level) => {
    if (!(PT_MAP in level)) return level;
    const rows = level[PT_MAP].slice(); rows[index] = [newKey, rows[index][1]]; return { [PT_MAP]: rows };
  });
  const removeEntry = (index) => {
    mutateCurrent((level) => {
      if (PT_ARR in level) { const arr = level[PT_ARR].slice(); arr.splice(index, 1); return { [PT_ARR]: arr }; }
      const rows = level[PT_MAP].slice(); rows.splice(index, 1); return { [PT_MAP]: rows };
    });
    rowIdsRef.current.delete(pathKey);
  };
  const addEntry = () => mutateCurrent((level) => {
    if (level && typeof level === 'object' && PT_ARR in level) return { [PT_ARR]: [...level[PT_ARR], ''] };
    if (level && typeof level === 'object' && PT_MAP in level) return { [PT_MAP]: [...level[PT_MAP], ['', '']] };
    return level;
  });
  const retype = (index, currentType) => {
    const order = PRIMITIVE_TYPES;
    const next = order[(order.indexOf(currentType) + 1) % order.length];
    const nextNode = next === 'string' ? '' : next === 'number' ? 0 : next === 'boolean' ? false : next === 'null' ? null : next === 'map' ? { [PT_MAP]: [] } : { [PT_ARR]: [] };
    updateEntryValue(index, nextNode);
  };
  const drillInto = (index) => setPath((p) => [...p, index]);
  const popTo = (depth) => setPath((p) => p.slice(0, depth));

  const crumbLabels = useMemo(() => {
    const labels = []; let node = root;
    for (const seg of path) {
      if (node && PT_ARR in node) { labels.push(`[${seg}]`); node = node[PT_ARR][seg]; }
      else if (node && PT_MAP in node) { const row = node[PT_MAP][seg]; labels.push(row ? (row[0].trim() || '(unnamed)') : '?'); node = row?.[1]; }
      else { labels.push('?'); }
    }
    return labels;
  }, [root, path]);

  return (
    <View>
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
                  <Text style={[styles.breadcrumbSeg, i === path.length - 1 && styles.breadcrumbSegActive]} numberOfLines={1}>{label}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
      {entries.length === 0 && <View style={styles.structEmpty}><Text style={styles.structEmptyText}>{currentIsArray ? 'Empty array' : 'No entries'}</Text></View>}
      {entries.map((e, index) => {
        const t = treeNodeType(e.value);
        return (
          <EntryRow key={e.id} entryKey={e.key} value={e.value} valueType={t} isArray={currentIsArray}
            keyError={currentIsMap && (!e.key.trim() || dupKeysHere.has(e.key.trim()))}
            onChangeKey={(k) => updateEntryKey(index, k)} onChangeValue={(v) => updateEntryValue(index, v)}
            onRetype={PRIMITIVE_TYPES.includes(t) ? () => retype(index, t) : () => {}}
            onRemove={() => removeEntry(index)} onDrillIn={() => drillInto(index)} />
        );
      })}
      {(dupKeysHere.size > 0 || hasBlankKeyHere) && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={14} color={C.danger} />
          <Text style={styles.errorText}>{hasBlankKeyHere ? 'Every entry needs a key.' : 'Duplicate keys are not allowed.'}</Text>
        </View>
      )}
      {!deepValid && dupKeysHere.size === 0 && !hasBlankKeyHere && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={14} color={C.danger} />
          <Text style={styles.errorText}>A nested level has a blank or duplicate key.</Text>
        </View>
      )}
      {(currentIsArray || currentIsMap) && (
        <TouchableOpacity style={styles.addEntryBtn} onPress={addEntry} activeOpacity={0.8}>
          <Ionicons name="add" size={16} color={C.accent} />
          <Text style={styles.addEntryText}>Add {currentIsArray ? 'item' : 'entry'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Field editor modal ────────────────────────────────────────────────────────

function FieldEditorModal({ field, existingKeys = [], onCancel, onSave }) {
  const [key, setKey] = useState(field.key);
  const [type, setType] = useState(field.type === 'null' ? 'string' : field.type);
  const [error, setError] = useState(null);
  const [text, setText] = useState(() => {
    if (isComplex(field.value)) return '';
    if (field.type === 'timestamp') return field.value.toDate().toISOString();
    if (field.type === 'reference') return field.value.path;
    if (field.type === 'geopoint') return `${field.value.latitude},${field.value.longitude}`;
    if (field.value === null || field.value === undefined) return '';
    return String(field.value);
  });

  const isMapOrArray = type === 'map' || type === 'array';
  const [editMode, setEditMode] = useState('structured');
  const initialEditable = useMemo(() => { if (!isComplex(field.value)) return type === 'array' ? [] : {}; return toEditable(field.value); }, [field.value, type]);
  const [structuredVal, setStructuredVal] = useState(initialEditable);
  const [structuredValid, setStructuredValid] = useState(true);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(initialEditable, null, 2));
  const [jsonError, setJsonError] = useState(null);
  const [jsonParsed, setJsonParsed] = useState(initialEditable);

  const validateJson = (txt) => {
    setJsonText(txt);
    try {
      const parsed = JSON.parse(txt);
      const tOk = type === 'array' ? Array.isArray(parsed) : (parsed && typeof parsed === 'object' && !Array.isArray(parsed));
      if (!tOk) { setJsonError(type === 'array' ? 'Top level must be a JSON array' : 'Top level must be a JSON object'); return; }
      setJsonError(null); setJsonParsed(parsed);
    } catch (e) { setJsonError(e.message.replace(/^JSON\.parse:?\s*/i, '')); }
  };

  const switchToJson = () => { setJsonText(JSON.stringify(structuredVal, null, 2)); setJsonError(null); setJsonParsed(structuredVal); setEditMode('json'); };
  const switchToStructured = () => { if (jsonError) { setError('Fix the JSON error before switching back.'); return; } setStructuredVal(jsonParsed); setError(null); setEditMode('structured'); };

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
        if (editMode === 'json' && jsonError) throw new Error(`Invalid JSON: ${jsonError}`);
        if (editMode === 'structured' && !structuredValid) throw new Error('Fix entry errors before saving');
        parsed = fromEditable(editMode === 'json' ? jsonParsed : structuredVal);
      } else {
        switch (type) {
          case 'string': parsed = text; break;
          case 'number': { const n = Number(text); if (Number.isNaN(n)) throw new Error('Not a number'); parsed = n; break; }
          case 'boolean': { if (text.toLowerCase() === 'true') parsed = true; else if (text.toLowerCase() === 'false') parsed = false; else throw new Error('Must be "true" or "false"'); break; }
          case 'timestamp': { const d = new Date(text); if (Number.isNaN(d.getTime())) throw new Error('Invalid date (use ISO 8601)'); parsed = Timestamp.fromDate(d); break; }
          case 'reference': { if (!text.trim()) throw new Error('Reference path required'); parsed = doc(getFirestore(), text); break; }
          case 'geopoint': { const [lat, lng] = text.split(',').map((s) => Number(s.trim())); if (Number.isNaN(lat) || Number.isNaN(lng)) throw new Error('Format: lat,lng'); parsed = new GeoPoint(lat, lng); break; }
          case 'null': parsed = null; break;
          default: parsed = text;
        }
      }
      onSave(parsed, key);
    } catch (e) { setError(e.message); }
  };

  const onPickType = (t) => {
    setType(t); setError(null);
    if (t === 'map' || t === 'array') {
      const base = t === 'array' ? [] : {};
      const keep = (t === 'array' && Array.isArray(structuredVal)) || (t === 'map' && structuredVal && typeof structuredVal === 'object' && !Array.isArray(structuredVal));
      const next = keep ? structuredVal : base;
      setStructuredVal(next); setJsonText(JSON.stringify(next, null, 2)); setJsonParsed(next); setJsonError(null); setEditMode('structured');
    }
  };

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
                <TextInput style={[styles.input, keyConflict && styles.inputError]} placeholder="e.g. lastSyncedAt" placeholderTextColor={C.t4} value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} />
              </>
            )}
            <Text style={[styles.fieldLabelText, { marginTop: field.isNew ? 18 : 0 }]}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typePillsScroll}>
              {types.map((t) => {
                const isSelected = type === t;
                return (
                  <TouchableOpacity key={t} style={[styles.typePill, isSelected && styles.typePillActive]} onPress={() => onPickType(t)} activeOpacity={0.8}>
                    {isSelected && <Ionicons name="checkmark" size={12} color={C.accent} style={{ marginRight: 4 }} />}
                    <Text style={[styles.typePillText, isSelected && styles.typePillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {isMapOrArray && (
              <>
                <View style={styles.editModeRow}>
                  <Text style={styles.fieldLabelText}>Value</Text>
                  <View style={styles.editModeToggle}>
                    <TouchableOpacity style={[styles.editModeBtn, editMode === 'structured' && styles.editModeBtnActive]} onPress={switchToStructured} activeOpacity={0.8}>
                      <Text style={[styles.editModeText, editMode === 'structured' && styles.editModeTextActive]}>Structured</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.editModeBtn, editMode === 'json' && styles.editModeBtnActive]} onPress={switchToJson} activeOpacity={0.8}>
                      <Text style={[styles.editModeText, editMode === 'json' && styles.editModeTextActive]}>JSON</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {editMode === 'structured' ? (
                  <StructuredEditor key={`${type}-${field.key}`} initial={structuredVal} isArrayRoot={type === 'array'} onChange={setStructuredVal} onValidityChange={setStructuredValid} />
                ) : (
                  <>
                    <TextInput style={[styles.input, styles.inputJson, jsonError && styles.inputError]} value={jsonText} onChangeText={validateJson} multiline autoCapitalize="none" autoCorrect={false} placeholder={type === 'array' ? '[ ... ]' : '{ ... }'} placeholderTextColor={C.t4} />
                    {jsonError ? (
                      <View style={styles.errorBox}><Ionicons name="alert-circle" size={14} color={C.danger} /><Text style={styles.errorText}>{jsonError}</Text></View>
                    ) : (
                      <View style={styles.jsonOkRow}><Ionicons name="checkmark-circle" size={13} color="#34c759" /><Text style={styles.jsonOkText}>Valid JSON</Text></View>
                    )}
                  </>
                )}
              </>
            )}
            {!isMapOrArray && type !== 'null' && (
              <>
                <Text style={[styles.fieldLabelText, { marginTop: 18 }]}>Value</Text>
                <TextInput style={styles.input} value={text} onChangeText={setText} autoCapitalize="none" autoCorrect={false}
                  placeholder={type === 'timestamp' ? '2026-04-28T12:00:00Z' : type === 'reference' ? 'collection/doc/path' : type === 'geopoint' ? '40.7128, -74.0060' : type === 'boolean' ? 'true or false' : ''}
                  placeholderTextColor={C.t4} />
              </>
            )}
            {!isMapOrArray && type === 'null' && (
              <View style={styles.nullNotice}><Ionicons name="information-circle-outline" size={16} color={C.t3} /><Text style={styles.nullNoticeText}>Field will be set to null</Text></View>
            )}
            {error && <View style={styles.errorBox}><Ionicons name="alert-circle" size={14} color={C.danger} /><Text style={styles.errorText}>{error}</Text></View>}
          </ScrollView>
          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalSaveBtn, !canSave && { opacity: 0.4 }]} onPress={save} disabled={!canSave} activeOpacity={0.8}>
              <Text style={styles.modalSaveText}>{field.isNew ? 'Add field' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Typed confirm modal ───────────────────────────────────────────────────────

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
              <Text style={styles.confirmSampleLabel}>{state.sampleIds.length === state.totalCount ? 'Documents:' : `Sample (${state.sampleIds.length} of ${state.totalCount}):`}</Text>
              {state.sampleIds.map((id) => <Text key={id} style={styles.confirmSampleId} numberOfLines={1}>· {id}</Text>)}
            </View>
          )}
          <Text style={styles.confirmPrompt}>Type <Text style={styles.confirmPhrase}>{state.phrase}</Text> to confirm</Text>
          <TextInput style={[styles.input, matches && styles.inputMatch]} value={typed} onChangeText={setTyped} autoCapitalize="none" autoCorrect={false} placeholder={state.phrase} placeholderTextColor={C.t5} />
          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onCancel} activeOpacity={0.8}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmDeleteBtn, !matches && { opacity: 0.4 }]} onPress={() => matches && state.onConfirm()} disabled={!matches} activeOpacity={0.8}>
              <Ionicons name="trash" size={14} color="#fff" />
              <Text style={styles.confirmDeleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 40 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: C.t1, fontSize: 17, fontWeight: '600' },
  headerSub: { color: C.t4, fontSize: 11, marginTop: 3 },

  rootList: { padding: 16, paddingBottom: 40 },
  rootSectionLabel: { color: C.t4, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 18, marginBottom: 10, marginLeft: 4 },
  collectionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.hair, gap: 14 },
  collectionIconWrap: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' },
  collectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  collectionTitle: { color: C.t1, fontSize: 16, fontWeight: '600' },
  collectionPath: { color: C.t4, fontSize: 12, marginTop: 3, fontFamily: C.code },
  collectionMeta: { color: C.t5, fontSize: 12, marginTop: 5 },

  protectedBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 7, backgroundColor: 'rgba(255,149,0,0.12)' },
  protectedBadgeText: { fontSize: 10, color: C.warn, fontWeight: '600' },
  protectedBadgeSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 7, backgroundColor: 'rgba(255,149,0,0.12)', marginLeft: 8 },
  protectedBadgeSmallText: { fontSize: 10, color: C.warn, fontWeight: '600' },

  actionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  actionBarLeft: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  actionBarLabel: { color: C.t3, fontSize: 13, fontWeight: '500' },
  actionBarRight: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fill },
  iconBtnActive: { backgroundColor: C.accent },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: C.accent },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  bulkBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: C.fillSoft, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  bulkCount: { color: C.t1, fontSize: 14, fontWeight: '600' },
  bulkSelectAll: { color: C.accent, fontSize: 12, marginTop: 2, fontWeight: '500' },
  bulkDeleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: C.danger },
  bulkDeleteText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  sortBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 7, backgroundColor: C.fill, marginLeft: 8 },
  sortBadgeText: { fontSize: 10, color: C.t3, fontWeight: '600' },

  docList: { padding: 12, paddingBottom: 110 },
  docCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 12, padding: 11, marginBottom: 6, borderWidth: 1, borderColor: C.hair },
  // Hoisted out of the JSX, where it was a fresh object literal every render.
  docCardBody: { flex: 1 },
  docCardSelected: { backgroundColor: C.cardRaised, borderColor: 'rgba(20,126,251,0.4)' },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: C.t4, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: C.accent, borderColor: C.accent },
  docHeading: { color: C.t1, fontSize: 13, fontWeight: '600' },
  docIdCaption: { color: C.t4, fontSize: 10, marginTop: 1, fontFamily: C.code },
  docEmpty: { color: C.t5, fontSize: 11, marginTop: 3, fontStyle: 'italic' },
  docKvList: { marginTop: 5, gap: 3 },
  docKvRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  docKvKey: { color: C.t3, fontSize: 11, fontWeight: '500', minWidth: 60, maxWidth: 100 },
  docKvVal: { color: C.t2, fontSize: 12, flex: 1 },
  docMore: { color: C.t5, fontSize: 11, marginTop: 3 },

  // Storage grid
  gridList: { padding: STORAGE_LIST_PADDING, paddingBottom: 110 },
  gridRow: { gap: STORAGE_GRID_GAP, marginBottom: STORAGE_GRID_GAP },
  gridImageWrap: {
    borderRadius: 12,
    backgroundColor: C.fill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.hair,
  },
  gridImageSelected: { borderColor: C.accent, borderWidth: 2 },
  gridImage: { width: '100%', height: '100%' },
  gridPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  gridMeta: { color: C.t4, fontSize: 10, marginTop: 5, textAlign: 'center' },
  gridCheck: {
    position: 'absolute', top: 6, left: 6,
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  gridDeleteBtn: {
    position: 'absolute', top: 6, right: 6,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,59,48,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },


  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyText: { color: C.t4, fontSize: 14, marginTop: 12 },
  endMarker: { color: C.t5, textAlign: 'center', fontSize: 11, paddingVertical: 24, fontStyle: 'italic' },
  footerStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 24 },
  footerStatusText: { color: C.t3, fontSize: 13 },

  floatingBarWrapper: { position: 'absolute', left: 16, right: 16, bottom: Platform.OS === 'ios' ? 28 : 16, borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 },
  floatingBlur: { borderRadius: 18, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: Platform.OS === 'android' ? 'rgba(28,28,30,0.96)' : 'transparent' },
  floatingInner: { paddingHorizontal: 10, paddingVertical: 10 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.fill, borderRadius: 14, paddingHorizontal: 12, height: 42 },
  searchIcon: { marginRight: 6 },
  searchBar: { flex: 1, color: C.t1, fontSize: 15, paddingVertical: 0 },

  docBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.fillSoft, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair, padding: 16 },
  docBannerIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' },
  docBannerLabel: { color: C.t4, fontSize: 12, fontWeight: '500' },
  docBannerId: { color: C.t1, fontSize: 16, fontWeight: '600', marginTop: 3, fontFamily: C.code },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 22, paddingBottom: 10 },
  sectionHeader: { color: C.accentSoft, fontSize: 13, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  sectionCount: { backgroundColor: C.fill, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  sectionCountText: { color: C.t4, fontSize: 12, textAlign: 'center' },

  fieldCard: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: C.hair },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  fieldKey: { color: C.t1, fontSize: 15, fontWeight: '600', flex: 1 },
  typeBadge: { paddingVertical: 3, paddingHorizontal: 9, borderRadius: 7, backgroundColor: C.fill, marginLeft: 8 },
  typeBadgeText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
  fieldActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  fieldEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: C.fill },
  fieldEditText: { color: C.accentSoft, fontSize: 12, fontWeight: '600' },
  fieldDeleteBtn: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fill },

  addFieldBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 16, marginTop: 4, paddingVertical: 14, borderRadius: 14, backgroundColor: C.fill },
  addFieldText: { color: C.accentSoft, fontSize: 14, fontWeight: '600' },

  subcollectionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 14, padding: 16, marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: C.hair },
  subcollectionIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' },
  subcollectionName: { color: C.t1, fontSize: 14, fontWeight: '600' },
  subcollectionPath: { color: C.t4, fontSize: 11, marginTop: 2, fontFamily: C.code },

  openSubBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 16, marginTop: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: C.fill },
  openSubBtnText: { color: C.accentSoft, fontSize: 14, fontWeight: '600' },
  openSubRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 2 },
  openSubInput: { flex: 1, backgroundColor: C.fill, color: C.t1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: C.code },
  openSubGo: { width: 46, height: 46, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  openSubCancel: { width: 46, height: 46, borderRadius: 14, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' },

  dangerZone: { marginHorizontal: 16, marginTop: 28, padding: 16, borderRadius: 14, backgroundColor: C.fillSoft, borderWidth: 1, borderColor: C.hair },
  dangerZoneLabel: { color: C.t4, fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 12 },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 12, backgroundColor: 'rgba(255,59,48,0.1)' },
  dangerText: { color: C.danger, fontSize: 14, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 480, maxHeight: '85%', backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.hair, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.hair },
  modalTitle: { color: C.t1, fontSize: 18, fontWeight: '600', flex: 1 },
  modalCloseButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' },
  modalScroll: { padding: 20 },

  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  fieldLabelText: { color: C.t2, fontSize: 13, fontWeight: '600', letterSpacing: 0.2, marginBottom: 8 },
  requiredBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: 'rgba(255,59,48,0.1)' },
  requiredBadgeText: { fontSize: 10, color: C.danger, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  input: { backgroundColor: C.fill, color: C.t1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15 },
  inputError: { borderWidth: 1, borderColor: C.danger },
  inputMatch: { borderWidth: 1, borderColor: '#34c759' },
  inputJson: { minHeight: 160, fontFamily: C.code, fontSize: 13, textAlignVertical: 'top', lineHeight: 19 },

  typePillsScroll: { gap: 7, paddingVertical: 2, paddingRight: 4 },
  typePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, backgroundColor: C.fill },
  typePillActive: { backgroundColor: 'rgba(20,126,251,0.15)', borderWidth: 1, borderColor: 'rgba(20,126,251,0.3)' },
  typePillText: { color: C.t3, fontSize: 12, fontWeight: '600' },
  typePillTextActive: { color: C.accent },

  editModeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 },
  editModeToggle: { flexDirection: 'row', backgroundColor: C.fill, borderRadius: 10, padding: 3 },
  editModeBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 7 },
  editModeBtnActive: { backgroundColor: C.accent },
  editModeText: { color: C.t3, fontSize: 12, fontWeight: '600' },
  editModeTextActive: { color: '#fff' },

  entryRow: { backgroundColor: C.fillSoft, borderRadius: 12, padding: 12, marginBottom: 8 },
  entryTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  entryKeyInput: { flex: 1, backgroundColor: C.fill, color: C.t1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, fontSize: 14 },
  entryIndexPill: { minWidth: 38, paddingHorizontal: 8, paddingVertical: 9, borderRadius: 10, backgroundColor: C.fill, alignItems: 'center' },
  entryIndexText: { color: C.t3, fontSize: 13, fontWeight: '600' },
  entryTypeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, backgroundColor: C.fill },
  entryTypeChipText: { color: C.t2, fontSize: 11, fontWeight: '600' },
  entryRemove: { padding: 2 },
  entryValueInput: { backgroundColor: C.fill, color: C.t1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 11, fontSize: 14, marginTop: 8 },
  boolToggleRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  boolToggle: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: C.fill },
  boolToggleActive: { backgroundColor: C.accent },
  boolToggleText: { color: C.t3, fontSize: 13, fontWeight: '600' },
  boolToggleTextActive: { color: '#fff' },
  entryNullNote: { marginTop: 8, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 10, backgroundColor: C.fill },
  entryNullText: { color: C.t3, fontSize: 13 },
  entryNestedNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 2 },
  entryNestedText: { color: C.t4, fontSize: 12, fontStyle: 'italic' },
  entryDrillBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 10, backgroundColor: 'rgba(77,156,255,0.08)' },
  entryDrillText: { flex: 1, color: C.accentSoft, fontSize: 13, fontWeight: '600' },

  // Array-of-maps card
  mapItemCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: C.fillSoft, borderRadius: 12,
    borderWidth: 1, borderColor: C.hair,
    padding: 12, marginBottom: 8,
  },
  mapItemCardBody: { flex: 1 },
  mapItemLabel: { color: C.t1, fontSize: 14, fontWeight: '600' },
  mapItemRight: { alignItems: 'center', paddingLeft: 10, paddingTop: 2 },
  mapPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mapPreviewKey: { color: C.t4, fontSize: 12, minWidth: 48, maxWidth: 80, fontWeight: '500' },
  mapPreviewVal: { color: C.t3, fontSize: 12, flex: 1 },
  mapPreviewNested: { color: C.t5, fontSize: 12, fontStyle: 'italic' },
  mapPreviewMore: { color: C.t5, fontSize: 11, marginTop: 2, fontStyle: 'italic' },

  breadcrumbBar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: C.fill },
  breadcrumbBack: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: C.fillSoft },
  breadcrumbScroll: { alignItems: 'center', gap: 2, paddingRight: 4 },
  breadcrumbRoot: { color: C.t3, fontSize: 13, fontWeight: '600' },
  breadcrumbSegWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  breadcrumbSeg: { color: C.t3, fontSize: 13, fontWeight: '600', maxWidth: 120 },
  breadcrumbSegActive: { color: C.accentSoft },
  addEntryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, marginTop: 2, backgroundColor: C.fill },
  addEntryText: { color: C.accentSoft, fontSize: 13, fontWeight: '600' },

  structEmpty: { paddingVertical: 8 },
  structEmptyText: { color: C.t4, fontSize: 12, fontStyle: 'italic' },

  jsonOkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  jsonOkText: { color: '#34c759', fontSize: 12, fontWeight: '500' },

  nullNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.fill, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12, marginTop: 18 },
  nullNoticeText: { color: C.t3, fontSize: 13 },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: 'rgba(255,59,48,0.08)', borderRadius: 12 },
  errorText: { color: C.danger, fontSize: 13, flex: 1 },

  modalBtnRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.hair },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: C.fill, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { color: C.t2, fontSize: 15, fontWeight: '600' },
  modalSaveBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  modalSaveText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  confirmCard: { width: '100%', maxWidth: 420, backgroundColor: C.card, borderRadius: 20, borderWidth: 1, borderColor: C.hair, overflow: 'hidden', paddingTop: 24 },
  confirmIconWrap: { alignSelf: 'center', width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,59,48,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  confirmTitle: { color: C.t1, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8, paddingHorizontal: 24 },
  confirmMessage: { color: C.t3, fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 24, marginBottom: 16 },
  confirmSampleBox: { marginHorizontal: 18, marginBottom: 16, padding: 12, borderRadius: 12, backgroundColor: C.fillSoft },
  confirmSampleLabel: { color: C.t4, fontSize: 11, fontWeight: '600', letterSpacing: 0.3, marginBottom: 6 },
  confirmSampleId: { color: C.t2, fontSize: 12, fontFamily: C.code, marginTop: 2 },
  confirmPrompt: { color: C.t3, fontSize: 13, textAlign: 'center', marginBottom: 8, paddingHorizontal: 18 },
  confirmPhrase: { color: C.danger, fontWeight: '600', fontFamily: C.code },
  confirmDeleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: C.danger },
  confirmDeleteText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});