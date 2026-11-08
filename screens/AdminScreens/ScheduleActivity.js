// ScheduleActivity.js
// Database Manager's dashboard over churches/{church}/scheduleAudit - the trail
// the functions write for every schedule change (backend/functions/files/audit.py).
// Read-only apart from deleting entries, and every deletion is itself recorded
// in `_admin_audit` like the rest of the Database Manager's writes.

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, SectionList, ScrollView,
  ActivityIndicator, Alert, StyleSheet, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuth } from '@react-native-firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from '@react-native-firebase/firestore';
import { AUDIT_COLLECTION as ADMIN_AUDIT_COLLECTION } from '../../utils/databaseRegistry';
import {
  AUDIT_COLLECTION,
  AuditRow,
  STATUS,
  normalise,
  foldFollowOns,
  withFollowOns,
} from '../../components/ScheduleAuditModal';

// Same tokens as DatabaseManager's palette.
const C = {
  bg: '#121212',
  card: '#1a1a1a',
  accent: '#147efb',
  accentSoft: '#4d9cff',
  danger: '#ff3b30',
  hair: 'rgba(255,255,255,0.07)',
  t1: '#ffffff',
  t2: 'rgba(255,255,255,0.75)',
  t3: 'rgba(255,255,255,0.5)',
  t4: 'rgba(255,255,255,0.35)',
  t5: 'rgba(255,255,255,0.2)',
  fill: 'rgba(255,255,255,0.07)',
  grid: 'rgba(255,255,255,0.06)',
};

const MAX_ENTRIES = 1000;
const DAY = 24 * 60 * 60 * 1000;

const RANGES = [
  { key: '7d', label: '7D', days: 7, bucketDays: 1 },
  { key: '30d', label: '30D', days: 30, bucketDays: 1 },
  { key: '90d', label: '90D', days: 90, bucketDays: 7 },
  { key: 'all', label: 'All', days: null, bucketDays: 7 },
];

// What each stat tile and filter chip counts. Admin edits are judged by action,
// not actor.kind, so an edit made before someone's admin flag was set still counts.
const CATEGORIES = {
  admin: {
    label: 'Admin edits',
    icon: 'construct',
    actions: ['switch_server', 'remove_server', 'add_server', 'set_altar_default', 'approve_replacement', 'rebalance', 'reminder_sent'],
  },
  availability: {
    label: 'Availability answers',
    icon: 'chatbubble-ellipses',
    actions: ['availability_response'],
  },
  unavailable: {
    label: 'Unavailable',
    icon: 'close-circle',
    actions: ['marked_unavailable', 'left_schedules'],
  },
  automatic: {
    label: 'Automatic',
    icon: 'sync',
    actions: ['generated', 'schedule_created', 'schedule_archived'],
  },
};

const categoryOf = (action) =>
  Object.keys(CATEGORIES).find((k) => CATEGORIES[k].actions.includes(action)) || 'other';

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const shortDate = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const dayTitle = (time) => {
  const today = startOfDay(new Date()).getTime();
  if (time === today) return 'Today';
  if (time === today - DAY) return 'Yesterday';
  return new Date(time).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
};

// Everyone an entry touched: the endpoint's context plus the trigger's diff.
const peopleIn = (entry) => {
  const seen = new Map();
  [...entry.affected, ...entry.changes].forEach((p) => {
    if (p?.uid && !seen.has(p.uid)) seen.set(p.uid, p.name || 'Unknown');
  });
  return seen;
};

const matchesSearch = (entry, q) => {
  if (!q) return true;
  const hay = [
    entry.summary, entry.actor?.name, entry.week,
    ...Array.from(peopleIn(entry).values()),
  ].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q);
};

const recordAdminDeletion = async (entries) => {
  try {
    await addDoc(collection(getFirestore(), ADMIN_AUDIT_COLLECTION), {
      ts: serverTimestamp(),
      uid: getAuth().currentUser?.uid || null,
      action: entries.length === 1 ? 'delete' : 'bulkDelete',
      path: entries.length === 1 ? entries[0].path : entries[0].path.split('/').slice(0, -1).join('/'),
      before: entries.length === 1 ? entries[0].raw : null,
      after: null,
      meta: { source: 'scheduleActivity', count: entries.length, ids: entries.slice(0, 200).map((e) => e.id) },
    });
  } catch (e) { console.warn('audit write failed', e); }
};

// ── Pieces ───────────────────────────────────────────────────────────────────

function Chip({ label, active, onPress, icon }) {
  return (
    <TouchableOpacity style={[s.chip, active && s.chipActive]} onPress={onPress} activeOpacity={0.8}>
      {icon ? <Ionicons name={icon} size={13} color={active ? '#fff' : C.t3} style={{ marginRight: 5 }} /> : null}
      <Text style={[s.chipText, active && s.chipTextActive]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatTile({ label, value, icon, active, onPress }) {
  return (
    <TouchableOpacity style={[s.tile, active && s.tileActive]} onPress={onPress} activeOpacity={0.85}>
      <View style={s.tileIcon}><Ionicons name={icon} size={16} color={C.accentSoft} /></View>
      <Text style={s.tileValue}>{value}</Text>
      <Text style={s.tileLabel} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Changes over time. One series, so one hue and no legend - the card title names
 * it. Tapping a bar reads it out and filters the timeline to that span; tapping
 * it again clears the filter.
 */
function ActivityChart({ buckets, bucketDays, selected, onSelect }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const active = buckets.find((b) => b.start === selected);
  const span = (b) => (bucketDays === 1
    ? shortDate(new Date(b.start))
    : `Week of ${shortDate(new Date(b.start))}`);
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>Changes over time</Text>
        <Text style={s.cardMeta}>
          {active ? `${span(active)} · ${active.count} change${active.count === 1 ? '' : 's'}` : `per ${bucketDays === 1 ? 'day' : 'week'}`}
        </Text>
      </View>
      <View style={s.chartArea}>
        <View style={[s.gridLine, { top: 0 }]} />
        <Text style={s.gridLabel}>{max}</Text>
        <View style={[s.gridLine, { top: '50%' }]} />
        <View style={s.bars}>
          {buckets.map((b) => {
            const isSel = b.start === selected;
            const dim = selected != null && !isSel;
            return (
              <TouchableOpacity
                key={b.start}
                style={s.barHit}
                onPress={() => onSelect(isSel ? null : b.start)}
                activeOpacity={0.7}
                accessibilityLabel={`${span(b)}, ${b.count} changes`}
              >
                <View style={[
                  s.bar,
                  { height: b.count ? `${Math.max(4, (b.count / max) * 100)}%` : 0 },
                  isSel && s.barSelected,
                  dim && s.barDim,
                ]} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <View style={s.axisRow}>
        <Text style={s.axisLabel}>{buckets.length ? shortDate(new Date(buckets[0].start)) : ''}</Text>
        <Text style={s.axisLabel}>{buckets.length ? shortDate(new Date(buckets[buckets.length - 1].start)) : ''}</Text>
      </View>
    </View>
  );
}

/** Ranked list with a proportional bar behind each count. */
function RankedList({ title, rows, onPick, emptyText }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <View style={s.card}>
      <Text style={[s.cardTitle, { marginBottom: 10 }]}>{title}</Text>
      {rows.length === 0 ? <Text style={s.cardMeta}>{emptyText}</Text> : rows.map((r) => (
        <TouchableOpacity key={r.key} style={s.rankRow} onPress={() => onPick?.(r)} activeOpacity={0.75}>
          <View style={s.rankText}>
            <Text style={s.rankName} numberOfLines={1}>{r.name}</Text>
            {r.sub ? <Text style={s.rankSub} numberOfLines={1}>{r.sub}</Text> : null}
          </View>
          <View style={s.rankBarTrack}>
            <View style={[s.rankBar, { width: `${(r.count / max) * 100}%` }]} />
          </View>
          <Text style={s.rankCount}>{r.count}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Latest answer counts. Status colours come with their label, never alone. */
function AnswerBreakdown({ counts }) {
  const total = counts.confirmed + counts.unsure + counts.unavailable;
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>Availability answers</Text>
        <Text style={s.cardMeta}>{total} total</Text>
      </View>
      {total > 0 && (
        <View style={s.stackTrack}>
          {['confirmed', 'unsure', 'unavailable'].map((k) => counts[k] > 0 && (
            <View key={k} style={{ flex: counts[k], backgroundColor: STATUS[k].color, marginHorizontal: 1 }} />
          ))}
        </View>
      )}
      <View style={s.answerRow}>
        {['confirmed', 'unsure', 'unavailable'].map((k) => (
          <View key={k} style={s.answerItem}>
            <View style={[s.answerDot, { backgroundColor: STATUS[k].color }]} />
            <Text style={s.answerLabel}>{STATUS[k].label}</Text>
            <Text style={s.answerCount}>{counts[k]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function ScheduleActivity() {
  const [churches, setChurches] = useState([]);
  const [churchId, setChurchId] = useState(null);
  const [range, setRange] = useState('30d');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState(null);
  const [bucket, setBucket] = useState(null);
  const [search, setSearch] = useState('');

  const rangeDef = RANGES.find((r) => r.key === range);

  // Churches, defaulting to the viewer's own.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const db = getFirestore();
        const [snap, me] = await Promise.all([
          getDocs(collection(db, 'churches')),
          getDoc(doc(db, 'users', getAuth().currentUser?.uid || '_')),
        ]);
        if (!alive) return;
        const mine = me.exists ? me.data()?.church : null;
        // The viewer's own church leads the row, so the selected chip is in view.
        const ids = snap.docs.map((d) => d.id).sort((a, b) =>
          (a === mine ? -1 : b === mine ? 1 : a.localeCompare(b)));
        setChurches(ids);
        setChurchId(ids.includes(mine) ? mine : ids[0] || null);
      } catch (e) {
        console.error('Error loading churches:', e);
        if (alive) setError("Couldn't load churches.");
      }
    })();
    return () => { alive = false; };
  }, []);

  const load = useCallback(async () => {
    if (!churchId) return;
    setLoading(true);
    setError(null);
    try {
      const ref = collection(getFirestore(), 'churches', churchId, AUDIT_COLLECTION);
      // Range and order on the same field: no composite index needed.
      const q = rangeDef.days
        ? query(ref, where('at', '>=', new Date(startOfDay(new Date()).getTime() - (rangeDef.days - 1) * DAY)), orderBy('at', 'desc'), limit(MAX_ENTRIES))
        : query(ref, orderBy('at', 'desc'), limit(MAX_ENTRIES));
      const snap = await getDocs(q);
      setEntries(foldFollowOns(snap.docs.map(normalise).filter((e) => e.at)));
    } catch (e) {
      console.error('Error loading schedule activity:', e);
      setError("Couldn't load activity.");
    } finally {
      setLoading(false);
    }
  }, [churchId, rangeDef]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setBucket(null); }, [churchId, range]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const buckets = useMemo(() => {
    const size = rangeDef.bucketDays * DAY;
    const today = startOfDay(new Date()).getTime();
    const oldest = entries.length ? startOfDay(entries[entries.length - 1].at).getTime() : today;
    const spanDays = rangeDef.days || Math.min(365, Math.max(28, Math.ceil((today - oldest) / DAY) + 1));
    const count = Math.ceil(spanDays / rangeDef.bucketDays);
    const first = today - (count - 1) * size;
    const list = Array.from({ length: count }, (_, i) => ({ start: first + i * size, count: 0 }));
    entries.forEach((e) => {
      const i = Math.floor((startOfDay(e.at).getTime() - first) / size);
      if (i >= 0 && i < list.length) list[i].count += 1;
    });
    return list;
  }, [entries, rangeDef]);

  const stats = useMemo(() => {
    const out = { total: entries.length, admin: 0, availability: 0, unavailable: 0, automatic: 0 };
    entries.forEach((e) => { const c = categoryOf(e.action); if (c in out) out[c] += 1; });
    return out;
  }, [entries]);

  const answers = useMemo(() => {
    const out = { confirmed: 0, unsure: 0, unavailable: 0 };
    entries.forEach((e) => {
      if (e.action !== 'availability_response') return;
      e.changes.forEach((c) => { if (c.statusAfter in out) out[c.statusAfter] += 1; });
    });
    return out;
  }, [entries]);

  const topAffected = useMemo(() => {
    const counts = new Map();
    entries.forEach((e) => {
      if (categoryOf(e.action) === 'automatic') return; // generation touches everyone
      // A replacement entry also carries the person being replaced. They were
      // already counted when they were marked unavailable, and by now they are
      // off the sheet, so they arrive nameless and tallied as "Unknown".
      const skip = e.action === 'approve_replacement' ? e.details?.originalUid : null;
      peopleIn(e).forEach((name, uid) => {
        if (uid === skip) return;
        const row = counts.get(uid) || { key: uid, name, count: 0 };
        row.count += 1;
        counts.set(uid, row);
      });
    });
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  }, [entries]);

  const topActors = useMemo(() => {
    const counts = new Map();
    entries.forEach((e) => {
      if (categoryOf(e.action) !== 'admin' || !e.actor?.uid) return;
      const row = counts.get(e.actor.uid) || { key: e.actor.uid, name: e.actor.name || 'Unknown', count: 0 };
      row.count += 1;
      counts.set(e.actor.uid, row);
    });
    return [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((r) => ({ ...r, sub: `${r.count} edit${r.count === 1 ? '' : 's'}` }));
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const size = rangeDef.bucketDays * DAY;
    return entries.filter((e) => {
      if (category && categoryOf(e.action) !== category) return false;
      if (bucket != null) {
        const t = startOfDay(e.at).getTime();
        if (t < bucket || t >= bucket + size) return false;
      }
      return matchesSearch(e, q);
    });
  }, [entries, category, bucket, search, rangeDef]);

  const sections = useMemo(() => {
    const byDay = new Map();
    filtered.forEach((e) => {
      const key = startOfDay(e.at).getTime();
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(e);
    });
    return [...byDay.entries()].map(([time, data]) => ({ key: String(time), title: dayTitle(time), data }));
  }, [filtered]);

  const isFiltered = !!(category || bucket != null || search.trim());

  // ── Deletion ───────────────────────────────────────────────────────────────

  const removeLocally = (ids) => setEntries((list) => list.filter((e) => !ids.has(e.id)));

  const deleteEntries = useCallback(async (shown) => {
    const list = withFollowOns(shown);
    const db = getFirestore();
    for (let i = 0; i < list.length; i += 450) {
      const batch = writeBatch(db);
      list.slice(i, i + 450).forEach((e) => batch.delete(doc(db, e.path)));
      await batch.commit();
    }
    await recordAdminDeletion(list);
    removeLocally(new Set(list.map((e) => e.id)));
  }, []);

  const confirmDeleteOne = useCallback((entry) => {
    Alert.alert(
      'Delete this entry?',
      `${entry.summary || 'This change'} will be removed from the history. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => deleteEntries([entry]).catch((e) => {
            console.error('Delete failed:', e);
            Alert.alert('Error', "Couldn't delete the entry.");
          }),
        },
      ],
    );
  }, [deleteEntries]);

  const confirmDeleteShown = useCallback(() => {
    if (!filtered.length) return;
    Alert.alert(
      `Delete ${filtered.length} entr${filtered.length === 1 ? 'y' : 'ies'}?`,
      `Everything currently shown for ${churchId} will be removed from the history. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all shown', style: 'destructive',
          onPress: () => deleteEntries(filtered).catch((e) => {
            console.error('Bulk delete failed:', e);
            Alert.alert('Error', "Some entries couldn't be deleted.");
            load();
          }),
        },
      ],
    );
  }, [filtered, churchId, deleteEntries, load]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const header = (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
        {churches.map((id) => (
          <Chip key={id} label={id} active={id === churchId} onPress={() => setChurchId(id)} icon="business" />
        ))}
      </ScrollView>

      <View style={s.segment}>
        {RANGES.map((r) => (
          <TouchableOpacity key={r.key} style={[s.segmentBtn, range === r.key && s.segmentActive]} onPress={() => setRange(r.key)}>
            <Text style={[s.segmentText, range === r.key && s.segmentTextActive]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.tiles}>
        <StatTile label="All changes" value={stats.total} icon="pulse" active={!category} onPress={() => setCategory(null)} />
        {Object.entries(CATEGORIES).filter(([k]) => k !== 'automatic').map(([k, c]) => (
          <StatTile key={k} label={c.label} value={stats[k]} icon={c.icon} active={category === k}
            onPress={() => setCategory(category === k ? null : k)} />
        ))}
      </View>

      <ActivityChart buckets={buckets} bucketDays={rangeDef.bucketDays} selected={bucket} onSelect={setBucket} />
      <AnswerBreakdown counts={answers} />
      <RankedList
        title="Most affected"
        rows={topAffected}
        emptyText="Nobody has been moved yet."
        onPick={(r) => setSearch(r.name)}
      />
      <RankedList
        title="Who made changes"
        rows={topActors}
        emptyText="No admin edits in this range."
        onPick={(r) => setSearch(r.name)}
      />

      <Text style={s.sectionLabel}>Timeline</Text>
      <View style={s.searchBox}>
        <Ionicons name="search" size={16} color={C.t4} />
        <TextInput
          style={s.searchInput}
          placeholder="Search people, admins, weeks…"
          placeholderTextColor={C.t4}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
        <Chip label="Everything" active={!category} onPress={() => setCategory(null)} />
        {Object.entries(CATEGORIES).map(([k, c]) => (
          <Chip key={k} label={c.label} icon={c.icon} active={category === k} onPress={() => setCategory(category === k ? null : k)} />
        ))}
        <Chip label="Other" active={category === 'other'} onPress={() => setCategory(category === 'other' ? null : 'other')} />
      </ScrollView>

      <View style={s.resultBar}>
        <Text style={s.resultText}>
          {filtered.length} entr{filtered.length === 1 ? 'y' : 'ies'}
          {entries.length >= MAX_ENTRIES ? ` · latest ${MAX_ENTRIES}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          {isFiltered && (
            <TouchableOpacity onPress={() => { setCategory(null); setBucket(null); setSearch(''); }}>
              <Text style={s.clearText}>Clear filters</Text>
            </TouchableOpacity>
          )}
          {filtered.length > 0 && (
            <TouchableOpacity onPress={confirmDeleteShown} style={s.deleteShown}>
              <Ionicons name="trash-outline" size={14} color={C.danger} />
              <Text style={s.deleteShownText}>Delete shown</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  if (!churchId && !error) {
    return <View style={s.center}><ActivityIndicator color={C.accent} /></View>;
  }

  return (
    <SectionList
      style={s.screen}
      contentContainerStyle={s.content}
      sections={sections}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={header}
      renderSectionHeader={({ section }) => (
        <View style={s.dayHeader}>
          <Text style={s.dayTitle}>{section.title}</Text>
          <Text style={s.dayCount}>{section.data.length}</Text>
        </View>
      )}
      renderItem={({ item }) => <AuditRow entry={item} showWeek onDelete={confirmDeleteOne} />}
      stickySectionHeadersEnabled={false}
      refreshing={loading}
      onRefresh={load}
      keyboardShouldPersistTaps="handled"
      ListEmptyComponent={loading ? null : (
        <View style={s.empty}>
          <Ionicons name="time-outline" size={36} color={C.t5} />
          <Text style={s.emptyText}>{error || (isFiltered ? 'Nothing matches these filters.' : 'No schedule changes recorded in this range.')}</Text>
        </View>
      )}
    />
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },

  chipRow: { gap: 8, paddingBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.hair, maxWidth: 260 },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { color: C.t2, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  segment: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 10, padding: 3, marginBottom: 14, borderWidth: 1, borderColor: C.hair },
  segmentBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  segmentText: { color: C.t3, fontSize: 13, fontWeight: '700' },
  segmentTextActive: { color: C.t1 },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  tile: { flexGrow: 1, flexBasis: '45%', backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.hair },
  tileActive: { borderColor: C.accentSoft, backgroundColor: 'rgba(20,126,251,0.10)' },
  tileIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(77,156,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  tileValue: { color: C.t1, fontSize: 28, fontWeight: '700', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  tileLabel: { color: C.t3, fontSize: 13, marginTop: 2 },

  card: { backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.hair },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  cardTitle: { color: C.t1, fontSize: 15, fontWeight: '600' },
  cardMeta: { color: C.t3, fontSize: 12, fontVariant: ['tabular-nums'] },

  chartArea: { height: 120, position: 'relative' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: C.grid },
  gridLabel: { position: 'absolute', top: 2, left: 0, color: C.t4, fontSize: 10, fontVariant: ['tabular-nums'] },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.t5 },
  barHit: { flex: 1, height: '100%', justifyContent: 'flex-end', paddingHorizontal: 1 },
  bar: { backgroundColor: C.accentSoft, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barSelected: { backgroundColor: '#8ec1ff' },
  barDim: { opacity: 0.35 },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisLabel: { color: C.t4, fontSize: 11 },

  stackTrack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 12, marginHorizontal: -1 },
  answerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  answerItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  answerDot: { width: 8, height: 8, borderRadius: 4 },
  answerLabel: { color: C.t2, fontSize: 13 },
  answerCount: { color: C.t1, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },

  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, gap: 10 },
  rankText: { width: '38%' },
  rankName: { color: C.t1, fontSize: 14, fontWeight: '500' },
  rankSub: { color: C.t4, fontSize: 11, marginTop: 1 },
  rankBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: C.fill, overflow: 'hidden' },
  rankBar: { height: '100%', borderRadius: 4, backgroundColor: C.accentSoft },
  rankCount: { color: C.t2, fontSize: 13, fontWeight: '600', width: 28, textAlign: 'right', fontVariant: ['tabular-nums'] },

  sectionLabel: { color: C.t4, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 10, marginBottom: 10, marginLeft: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 10 : 4, marginBottom: 10, borderWidth: 1, borderColor: C.hair },
  searchInput: { flex: 1, color: C.t1, fontSize: 15 },

  resultBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingHorizontal: 4 },
  resultText: { color: C.t3, fontSize: 13 },
  clearText: { color: C.accentSoft, fontSize: 13, fontWeight: '600' },
  deleteShown: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleteShownText: { color: C.danger, fontSize: 13, fontWeight: '600' },

  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, paddingBottom: 8, paddingHorizontal: 4 },
  dayTitle: { color: C.t1, fontSize: 15, fontWeight: '700' },
  dayCount: { color: C.t4, fontSize: 12, fontVariant: ['tabular-nums'] },

  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { color: C.t3, fontSize: 14, textAlign: 'center', paddingHorizontal: 30 },
});
