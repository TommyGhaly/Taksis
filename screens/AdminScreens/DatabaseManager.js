// DatabaseManagerScreen.js
// One-screen Firestore admin tool for Taksis.
// Gates on superAdmin role, lets you browse the hardcoded registry,
// list/search/edit/delete docs, navigate subcollections, and run bulk ops.
// All writes go through firestore client SDK and are gated by security rules.
// Every mutation writes to _admin_audit.
//
// Adjust the firebase imports at top to match your project's setup.

import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {
  KNOWN_COLLECTIONS,
  AUDIT_COLLECTION,
  BULK_HARD_CEILING,
} from '../../utils/databaseRegistry';

// ---------- helpers ----------

const PAGE_SIZE = 25;
const SAMPLE_SIZE = 20;

// Detect a Firestore value's type for the right inline editor.
const detectType = (v) => {
  if (v === null || v === undefined) return 'null';
  if (v && typeof v.toDate === 'function') return 'timestamp';
  if (v && v.latitude !== undefined && v.longitude !== undefined) return 'geopoint';
  if (v && v.id && v.path && typeof v.path === 'string') return 'reference';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') return 'map';
  return typeof v; // string | number | boolean
};

const previewValue = (v) => {
  const t = detectType(v);
  if (t === 'timestamp') return v.toDate().toISOString();
  if (t === 'reference') return v.path;
  if (t === 'geopoint') return `(${v.latitude}, ${v.longitude})`;
  if (t === 'array') return `[${v.length}]`;
  if (t === 'map') return `{${Object.keys(v).length}}`;
  if (t === 'null') return 'null';
  return String(v);
};

const isComplex = (v) => {
  const t = detectType(v);
  return t === 'array' || t === 'map';
};

// Sample N docs and build a {field: typeSet} map for inferred schema.
const inferSchema = (docs) => {
  const out = {};
  for (const d of docs.slice(0, SAMPLE_SIZE)) {
    const data = d.data ? d.data() : d;
    for (const [k, v] of Object.entries(data || {})) {
      const t = detectType(v);
      if (!out[k]) out[k] = new Set();
      out[k].add(t);
    }
  }
  return out;
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
    // never block the actual op on audit failure, but surface it
    console.warn('audit write failed', e);
  }
};

// Chunk an array into groups of n.
const chunk = (arr, n) => {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

// ---------- main screen ----------

export default function DatabaseManagerScreen({ navigation }) {
  const [view, setView] = useState('root'); // 'root' | 'collection' | 'document'
  const [stack, setStack] = useState([]); // navigation breadcrumb of {type, path, label}
  const [gateState, setGateState] = useState('checking'); // 'checking'|'ok'|'denied'

  // Gate on superAdmin role
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
        if (alive) setGateState(isSuper ? 'ok' : 'denied');
      } catch {
        if (alive) setGateState('denied');
      }
    })();
    return () => { alive = false; };
  }, []);

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
        <ActivityIndicator />
      </SafeAreaView>
    );
  }
  if (gateState === 'denied') {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.denied}>Access denied. superAdmin required.</Text>
      </SafeAreaView>
    );
  }

  const current = stack[stack.length - 1];

  return (
    <SafeAreaView style={styles.screen}>
      <Header
        view={view}
        stack={stack}
        onBack={view !== 'root' ? goBack : null}
      />
      {view === 'root' && <RootList onPick={goCollection} />}
      {view === 'collection' && (
        <CollectionView
          collectionPath={current.path}
          onOpenDoc={(docPath, id) => goDocument(docPath, id)}
        />
      )}
      {view === 'document' && (
        <DocumentView
          docPath={current.path}
          onOpenSubcollection={goSubcollection}
        />
      )}
    </SafeAreaView>
  );
}

// ---------- header / breadcrumb ----------

function Header({ view, stack, onBack }) {
  const trail = stack.map((s) => s.label).join(' / ') || 'Database';
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backTxt}>‹</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 32 }} />
      )}
      <Text style={styles.headerTitle} numberOfLines={1}>{trail}</Text>
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
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.row}
          onPress={() => onPick(item.path, item.displayName)}
        >
          <Text style={styles.rowTitle}>{item.displayName}</Text>
          <Text style={styles.rowSub}>/{item.path}</Text>
        </TouchableOpacity>
      )}
      ListHeaderComponent={
        <Text style={styles.sectionLabel}>Collections</Text>
      }
    />
  );
}

// ---------- collection view: list, search, paginate, bulk ops ----------

function CollectionView({ collectionPath, onOpenDoc }) {
  const config = useMemo(
    () => KNOWN_COLLECTIONS.find((c) => c.path === collectionPath) || {
      path: collectionPath,
      displayName: collectionPath,
      searchableFields: [],
    },
    [collectionPath]
  );

  // collectionPath may be a subcollection path like 'users/abc/attendance'
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

  const loadPage = useCallback(async (reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      let q = collRef.orderBy(firestore.FieldPath.documentId()).limit(PAGE_SIZE);
      if (!reset && lastCursor) q = q.startAfter(lastCursor);
      const snap = await q.get();
      const newDocs = snap.docs.map((d) => ({ id: d.id, data: d.data(), ref: d.ref }));
      setDocs((prev) => reset ? newDocs : [...prev, ...newDocs]);
      setLastCursor(snap.docs[snap.docs.length - 1] || lastCursor);
      setDone(snap.docs.length < PAGE_SIZE);
    } catch (e) {
      Alert.alert('Load error', e.message);
    } finally {
      setLoading(false);
    }
  }, [collRef, lastCursor, loading]);

  useEffect(() => {
    setDocs([]);
    setLastCursor(null);
    setDone(false);
    setSelected(new Set());
    setSelectMode(false);
    loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionPath]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    const fields = config.searchableFields || [];
    return docs.filter((d) => {
      if (d.id.toLowerCase().includes(q)) return true;
      for (const f of fields) {
        const v = d.data?.[f];
        if (v != null && String(v).toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [docs, search, config]);

  const toggleSelect = (id) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const runBulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (ids.length > BULK_HARD_CEILING) {
      Alert.alert('Too many', `Hard cap is ${BULK_HARD_CEILING} per bulk op.`);
      return;
    }
    const ok = await confirmTyped(config.path, `Delete ${ids.length} docs from /${config.path}`);
    if (!ok) return;
    if (config.protected) {
      const ok2 = await confirmTyped(`DELETE-${config.path}`, 'Protected collection — confirm again');
      if (!ok2) return;
    }
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
      Alert.alert('Done', `Deleted ${ids.length} docs.`);
    } catch (e) {
      Alert.alert('Bulk delete failed', e.message);
    }
  };

  const createNewDoc = async () => {
    try {
      const ref = await collRef.add({ _createdBy: 'admin', _createdAt: firestore.FieldValue.serverTimestamp() });
      await writeAudit('create', `${collectionPath}/${ref.id}`, null, { _createdBy: 'admin' });
      onOpenDoc(`${collectionPath}/${ref.id}`, ref.id);
    } catch (e) {
      Alert.alert('Create failed', e.message);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.search}
          placeholder={`Search ${config.searchableFields?.length ? config.searchableFields.join(', ') : 'id'}`}
          placeholderTextColor="#888"
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity
          style={[styles.toolBtn, selectMode && styles.toolBtnActive]}
          onPress={() => { setSelectMode((m) => !m); setSelected(new Set()); }}
        >
          <Text style={styles.toolBtnTxt}>{selectMode ? 'Cancel' : 'Select'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolBtn} onPress={createNewDoc}>
          <Text style={styles.toolBtnTxt}>+ New</Text>
        </TouchableOpacity>
      </View>

      {selectMode && (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkTxt}>{selected.size} selected</Text>
          <TouchableOpacity
            style={[styles.dangerBtn, selected.size === 0 && { opacity: 0.4 }]}
            disabled={selected.size === 0}
            onPress={runBulkDelete}
          >
            <Text style={styles.dangerTxt}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(d) => d.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.row,
              selectMode && selected.has(item.id) && styles.rowSelected,
            ]}
            onPress={() => {
              if (selectMode) toggleSelect(item.id);
              else onOpenDoc(`${collectionPath}/${item.id}`, item.id);
            }}
            onLongPress={() => { setSelectMode(true); toggleSelect(item.id); }}
          >
            <Text style={styles.rowTitle} numberOfLines={1}>{item.id}</Text>
            <Text style={styles.rowSub} numberOfLines={1}>
              {Object.keys(item.data || {}).slice(0, 3).map((k) => `${k}: ${previewValue(item.data[k])}`).join(' · ')}
            </Text>
          </TouchableOpacity>
        )}
        onEndReachedThreshold={0.5}
        onEndReached={() => !done && loadPage(false)}
        ListFooterComponent={
          loading ? <ActivityIndicator style={{ margin: 16 }} /> :
          done ? <Text style={styles.footerTxt}>End of collection</Text> : null
        }
      />
    </View>
  );
}

// ---------- document view: edit fields, delete doc, open subcollections ----------

function DocumentView({ docPath, onOpenSubcollection }) {
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
  const [editingField, setEditingField] = useState(null); // {key, value, type, isNew}
  const [addingField, setAddingField] = useState(false);

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
    } catch (e) {
      Alert.alert('Save failed', e.message);
    }
  };

  const deleteField = async (key) => {
    Alert.alert('Delete field?', key, [
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
        }
      },
    ]);
  };

  const deleteDoc = async () => {
    const ok = await confirmTyped(docPath.split('/').pop(), `Delete ${docPath}`);
    if (!ok) return;
    try {
      await docRef.delete();
      await writeAudit('delete', docPath, data, null);
      Alert.alert('Deleted', 'Document removed.');
    } catch (e) {
      Alert.alert('Delete failed', e.message);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 32 }} />;
  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.denied}>Document does not exist.</Text>
      </View>
    );
  }

  const entries = Object.entries(data);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
      <Text style={styles.sectionLabel}>Fields</Text>
      {entries.map(([k, v]) => (
        <View key={k} style={styles.fieldRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldKey}>{k}</Text>
            <Text style={styles.fieldVal} numberOfLines={2}>
              {previewValue(v)}{' '}
              <Text style={styles.fieldType}>· {detectType(v)}</Text>
            </Text>
          </View>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => setEditingField({ key: k, value: v, type: detectType(v), isNew: false })}
          >
            <Text style={styles.editTxt}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editBtn} onPress={() => deleteField(k)}>
            <Text style={[styles.editTxt, { color: '#c33' }]}>×</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.addBtn} onPress={() => setAddingField(true)}>
        <Text style={styles.addTxt}>+ Add field</Text>
      </TouchableOpacity>

      {subcollections.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Subcollections</Text>
          {subcollections.map((sub) => (
            <TouchableOpacity
              key={sub}
              style={styles.row}
              onPress={() => onOpenSubcollection(`${docPath}/${sub}`, sub)}
            >
              <Text style={styles.rowTitle}>{sub}</Text>
              <Text style={styles.rowSub}>{docPath}/{sub}</Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      <TouchableOpacity style={[styles.dangerBtn, { margin: 16 }]} onPress={deleteDoc}>
        <Text style={styles.dangerTxt}>Delete document</Text>
      </TouchableOpacity>

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
          onCancel={() => setAddingField(false)}
          onSave={(newVal, key) => {
            if (!key) return;
            saveField(key, newVal);
            setAddingField(false);
          }}
        />
      )}
    </ScrollView>
  );
}

// ---------- field editor modal: inline for primitives, JSON for complex ----------

function FieldEditorModal({ field, onCancel, onSave }) {
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

  const save = () => {
    setError(null);
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
          if (type === 'map' && (Array.isArray(parsed) || typeof parsed !== 'object')) throw new Error('Must be a JSON object');
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

  return (
    <Modal animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalWrap}
      >
        <View style={styles.modalBody}>
          <Text style={styles.modalTitle}>
            {field.isNew ? 'Add field' : `Edit "${field.key}"`}
          </Text>

          {field.isNew && (
            <TextInput
              style={styles.input}
              placeholder="Field name"
              placeholderTextColor="#888"
              value={key}
              onChangeText={setKey}
              autoCapitalize="none"
            />
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
            {types.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typePill, type === t && styles.typePillActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.typePillTxt, type === t && { color: '#fff' }]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {type !== 'null' && (
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
              placeholder={
                type === 'timestamp' ? 'ISO 8601, e.g. 2026-04-28T12:00:00Z'
                : type === 'reference' ? 'collection/doc path'
                : type === 'geopoint' ? 'lat,lng'
                : (type === 'array' || type === 'map') ? 'Valid JSON'
                : ''
              }
              placeholderTextColor="#888"
            />
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.modalBtnRow}>
            <TouchableOpacity style={styles.modalBtn} onPress={onCancel}>
              <Text style={styles.modalBtnTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={save}>
              <Text style={[styles.modalBtnTxt, { color: '#fff' }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------- typed-confirmation prompt (returns Promise<boolean>) ----------

let _confirmResolve = null;
let _confirmTarget = null;
let _confirmMessage = null;
let _confirmListeners = new Set();

function confirmTyped(target, message) {
  return new Promise((resolve) => {
    _confirmResolve = resolve;
    _confirmTarget = target;
    _confirmMessage = message;
    _confirmListeners.forEach((l) => l());
  });
}

// We use a simple Alert.prompt-style fallback. RN core has Alert.prompt only on iOS,
// so we re-implement with a Modal that we mount globally via a hook.
// Simpler approach: use Alert.prompt on iOS, fallback to Alert.alert with no typing on Android.
// For a strict typed-confirm on both platforms, swap this for a real modal component.
function _confirmTypedImpl(target, message) {
  return new Promise((resolve) => {
    if (Platform.OS === 'ios' && Alert.prompt) {
      Alert.prompt(
        message,
        `Type "${target}" to confirm`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Confirm', style: 'destructive', onPress: (txt) => resolve(txt === target) },
        ],
        'plain-text'
      );
    } else {
      Alert.alert(
        message,
        `This will run as if you typed "${target}".`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Confirm', style: 'destructive', onPress: () => resolve(true) },
        ]
      );
    }
  });
}
// Override the placeholder above
// eslint-disable-next-line no-func-assign
confirmTyped = _confirmTypedImpl;

// ---------- styles ----------

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0f1115' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1115' },
  denied: { color: '#aaa', fontSize: 16 },

  header: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#333',
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backTxt: { color: '#9cf', fontSize: 28, lineHeight: 28 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 16, textAlign: 'center', fontWeight: '600' },

  sectionLabel: {
    color: '#888', fontSize: 12, textTransform: 'uppercase',
    marginTop: 16, marginHorizontal: 16, marginBottom: 4, letterSpacing: 0.5,
  },

  row: {
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#222',
  },
  rowSelected: { backgroundColor: '#1c3550' },
  rowTitle: { color: '#fff', fontSize: 15, fontWeight: '500' },
  rowSub: { color: '#888', fontSize: 12, marginTop: 2 },

  toolbar: {
    flexDirection: 'row', padding: 8, gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#222',
  },
  search: {
    flex: 1, backgroundColor: '#1a1d24', color: '#fff',
    borderRadius: 8, paddingHorizontal: 12, height: 38,
  },
  toolBtn: {
    backgroundColor: '#1a1d24', paddingHorizontal: 12,
    borderRadius: 8, height: 38, alignItems: 'center', justifyContent: 'center',
  },
  toolBtnActive: { backgroundColor: '#2a4d6e' },
  toolBtnTxt: { color: '#fff', fontSize: 13 },

  bulkBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#1a1d24',
  },
  bulkTxt: { color: '#fff' },
  dangerBtn: {
    backgroundColor: '#7a1f1f', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 6, alignItems: 'center',
  },
  dangerTxt: { color: '#fff', fontWeight: '600' },

  footerTxt: { color: '#666', textAlign: 'center', padding: 16, fontSize: 12 },

  fieldRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#222',
  },
  fieldKey: { color: '#9cf', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  fieldVal: { color: '#fff', fontSize: 14, marginTop: 2 },
  fieldType: { color: '#666', fontSize: 11 },
  editBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  editTxt: { color: '#9cf', fontSize: 14 },

  addBtn: {
    margin: 16, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#333', borderRadius: 8, borderStyle: 'dashed',
  },
  addTxt: { color: '#9cf' },

  modalWrap: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBody: {
    backgroundColor: '#1a1d24', padding: 16,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
  },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  input: {
    backgroundColor: '#0f1115', color: '#fff',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  inputJson: {
    minHeight: 120, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlignVertical: 'top',
  },
  typePill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#0f1115', marginRight: 6,
  },
  typePillActive: { backgroundColor: '#2a4d6e' },
  typePillTxt: { color: '#aaa', fontSize: 12 },
  error: { color: '#f88', marginTop: 8, fontSize: 13 },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, gap: 8 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#0f1115' },
  modalBtnPrimary: { backgroundColor: '#2a6e4d' },
  modalBtnTxt: { color: '#fff', fontSize: 14 },
});