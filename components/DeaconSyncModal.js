/**
 * DeaconSyncModal
 *
 * Auto-scans on open. Flow: Scan → Deacon list review → Per-schedule review → Done
 *
 * Deacon sources:
 *   1. Any user doc with church === churchId AND isDeacon === true
 *   2. ALL children from ANY user doc where church === churchId
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  ActivityIndicator, StyleSheet, useWindowDimensions,
} from "react-native";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  where,
} from "@react-native-firebase/firestore";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { LIST_PERF } from "../utils/listConfig";


// ── Config ───────────────────────────────────────────────────────────────────

const READING_KEYS = ["matins","third","sixth","pauline","catholic","praxis","gospel","water","wine"];
const DEFAULTS = { experience: 5, frequency: 5, rank: 5, age: 0 };

// ── Helpers ──────────────────────────────────────────────────────────────────

const ws = (d) => { const x = new Date(d); return new Date(x.setDate(x.getDate()-x.getDay())); };
const fid = (d) => `${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}-${String(d.getFullYear()).slice(-2)}`;
const gw = (s,n=5) => { const r=[],w=ws(s); for(let i=0;i<n;i++){const d=new Date(w);d.setDate(w.getDate()+i*7);r.push(fid(d));}return r; };
const nd = (s) => { if(!s)return""; const[m,d,y]=s.split("-").map(Number); return new Date(2000+y,m-1,d).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}); };

// Generate a Firestore-style random UID client-side
const genUid = () => doc(collection(getFirestore(), "_")).id;

// An unfilled slot is stored as { name: "N/A", uid: <random> } — "nobody is here"
// is carried by the NAME, not the uid. The uid is a throwaway that will never
// match a deacon, so it must not be treated as a broken reference.
const isEmptySlot = (name) => !name || name === "N/A";

// A cleared slot, in the exact shape the backend writes (schedule_generation.py)
const emptySlot = () => ({ uid: genUid(), name: "N/A" });

// Stable address for a slot: a reading key, or an index into altar/extra
const slotKey = (loc, i) => (i === undefined ? loc : `${loc}:${i}`);
const slotLabel = (loc, i) => (i === undefined ? loc : `${loc} ${i + 1}`);

async function fetchAllDeacons(churchId) {
  const allUsersSnap = await getDocs(query(
    collection(getFirestore(), "users"),
    where("church", "==", churchId)
  ));

  const deacons = [];
  const seen = new Set();

  const add = (uid, data) => {
    if (!uid || seen.has(uid)) return;
    seen.add(uid);
    deacons.push({
      uid,
      name: data.name || "",
      age: data.age ?? DEFAULTS.age,
      experience: data.experience ?? DEFAULTS.experience,
      frequency: data.frequency ?? DEFAULTS.frequency,
      rank: data.rank ?? DEFAULTS.rank,
    });
  };

  for (const doc of allUsersSnap.docs) {
    const data = doc.data();
    if (data.isDeacon === true) add(doc.id, data);
    if (Array.isArray(data.children)) {
      for (const child of data.children) {
        if (child.uid) add(child.uid, child);
      }
    }
  }

  return deacons;
}

// Keep in step with ROTATION_MEMORY_DEFAULTS in backend/functions/files/utility.py.
// This is one of only three places that builds a roster entry from scratch —
// every other writer patches with a spread and so preserves unknown fields.
// Omitting the scheduling-memory fields here would hand the scheduler a
// servant with no history, which reads as "brand new" rather than "reliable".
function buildEntry(d) {
  return {
    uid: d.uid, name: d.name || "",
    age: d.age ?? DEFAULTS.age,
    experience: d.experience ?? DEFAULTS.experience,
    frequency: d.frequency ?? DEFAULTS.frequency,
    rank: d.rank ?? DEFAULTS.rank,
    weeksSince: d.weeksSince ?? 4,
    lastWeeksSince: d.lastWeeksSince ?? 4,
    assignedCount: d.assignedCount ?? 0,
    declinedCount: d.declinedCount ?? 0,
    roleHistory: d.roleHistory ?? [],
    value: d.value ?? 0,
  };
}

function diffList(current, expected) {
  const cSet = new Set(current.map(d => d.uid));
  const eSet = new Set(expected.map(u => u.uid));
  const eMap = new Map(expected.map(u => [u.uid, u]));

  const SYNC_FIELDS = ["name", "age", "experience", "frequency", "rank"];
  const REQUIRED_FIELDS = {
    weeksSince: 4,
    lastWeeksSince: 4,
    name: "",
    age: DEFAULTS.age,
    experience: DEFAULTS.experience,
    frequency: DEFAULTS.frequency,
    rank: DEFAULTS.rank,
  };

  const stale = [];
  for (const entry of current) {
    if (!eSet.has(entry.uid)) continue;
    const source = eMap.get(entry.uid);
    const mismatched = [];

    if (source) {
      for (const f of SYNC_FIELDS) {
        const srcVal = source[f] ?? DEFAULTS[f] ?? 0;
        const curVal = entry[f] ?? DEFAULTS[f] ?? 0;
        if (String(srcVal) !== String(curVal)) {
          mismatched.push({ field: f, from: curVal, to: srcVal });
        }
      }
    }

    for (const [f, defaultVal] of Object.entries(REQUIRED_FIELDS)) {
      if (entry[f] === undefined || entry[f] === null) {
        mismatched.push({ field: f, from: "missing", to: defaultVal });
      }
    }

    if (mismatched.length > 0) {
      stale.push({ uid: entry.uid, name: source?.name || entry.name, fields: mismatched });
    }
  }

  return {
    toAdd: expected.filter(u => !cSet.has(u.uid)),
    toRemove: current.filter(d => !eSet.has(d.uid)),
    stale,
  };
}

/**
 * Two, and only two, kinds of defect:
 *   needUid  — an empty ("N/A") slot that has no uid at all. Nothing can be
 *              assigned into a uid-less slot, so it needs one generated.
 *   exDeacon — a real, named person whose uid is not in the deacon source set.
 *              They are no longer a deacon: take them out of the schedule.
 *
 * An empty slot that already has a uid is NOT a defect, even though that uid
 * matches no deacon — that is what an unfilled slot is supposed to look like.
 */
function diffSched(data, uids, names) {
  const scheduled = new Set(), needUid = [], exDeacons = [];

  const check = (uid, name, loc, i) => {
    if (isEmptySlot(name)) {
      // Extras are a pool of real people waiting to be assigned; a placeholder
      // in there is dead weight (every consumer filters it out) — drop it.
      if (loc === "extra") exDeacons.push({ uid: uid || "", name: "N/A", loc, i });
      else if (!uid) needUid.push({ uid: "", name: "N/A", loc, i });
      return;
    }
    if (uid) scheduled.add(uid);
    // No uid to match on, or a uid that no current deacon owns → not a deacon.
    if (!uid || !uids.has(uid)) exDeacons.push({ uid: uid || "", name, loc, i });
  };

  for (const k of READING_KEYS) { const e = data[k]; if (e !== undefined) check(e?.uid, e?.name, k); }
  (data.altar || []).forEach((e, i) => check(e?.uid, e?.name, "altar", i));
  (data.extra || []).forEach((e, i) => check(e?.uid, e?.name, "extra", i));

  const missing = [];
  for (const uid of uids) { if (!scheduled.has(uid)) missing.push({ uid, name: names.get(uid) || "Unknown" }); }
  return { needUid, exDeacons, missing };
}

async function applyListFix(churchId, current, toAdd, toRemove, stale) {
  const rm = new Set(toRemove.map(d => d.uid));
  const staleMap = new Map(stale.map(s => [s.uid, s]));

  let up = current
    .filter(d => !rm.has(d.uid))
    .map(d => {
      const s = staleMap.get(d.uid);
      if (!s) return d;
      const patched = { ...d };
      for (const f of s.fields) patched[f.field] = f.to;
      return patched;
    });

  for (const u of toAdd) up.push(buildEntry(u));
  await updateDoc(doc(getFirestore(), "churches", churchId), { deacons: up });
  return up;
}

async function applySchedFix(churchId, wid, data, needUid, exDeacons, missing, names) {
  const up = {};

  // Address slots by position, not by uid: the defective entries are exactly the
  // ones the scan flagged, and a uid-less entry has nothing else to match on.
  const fill = new Set(needUid.map(u => slotKey(u.loc, u.i)));
  const drop = new Set(exDeacons.map(g => slotKey(g.loc, g.i)));

  // Readings: give a uid-less empty slot a uid; clear a slot held by an ex-deacon
  // back to the standard unfilled placeholder (the 9 keys are fixed, so "remove"
  // here means "empty the slot", same as the backend's unavailable() path).
  for (const k of READING_KEYS) {
    if (data[k] === undefined) continue;
    if (fill.has(k) || drop.has(k)) up[k] = emptySlot();
  }

  // Altar: same treatment, in place — the array length is the church's altar
  // server count, so removals leave a placeholder rather than shrinking it.
  const altar = data.altar || [];
  let altarChanged = false;
  const fixedAltar = altar.map((e, i) => {
    const key = slotKey("altar", i);
    if (fill.has(key) || drop.has(key)) { altarChanged = true; return emptySlot(); }
    return e;
  });
  if (altarChanged) up.altar = fixedAltar;

  // Extra: a plain list, so ex-deacons come straight out. Then top it up with
  // every current deacon who isn't scheduled anywhere.
  let ex = (data.extra || []).filter((e, i) => {
    const key = slotKey("extra", i);
    return e && !drop.has(key) && !fill.has(key);
  });
  for (const m of missing) {
    if (!ex.find(e => e.uid === m.uid))
      ex.push({ uid: m.uid, name: names.get(m.uid) || m.name || "Unknown" });
  }
  ex.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  up.extra = ex;

  await updateDoc(doc(getFirestore(), "churches", churchId, "schedule", wid), up);
}

function schedSummary(sd) {
  const p = [];
  if (sd.needUid.length) p.push(`${sd.needUid.length} uid${sd.needUid.length !== 1 ? "s" : ""} generated`);
  if (sd.exDeacons.length) p.push(`${sd.exDeacons.length} removed`);
  if (sd.missing.length) p.push(`${sd.missing.length} → extras`);
  return p.join(", ");
}

// ── Phases ───────────────────────────────────────────────────────────────────

const P = { SCAN: 0, LIST: 1, SCHED: 2, DONE: 3 };

// ── Row ──────────────────────────────────────────────────────────────────────

const Row = React.memo(({ name, action, color }) => (
  <View style={st.row}>
    <View style={[st.dot, { backgroundColor: color }]} />
    <Text style={st.rowName} numberOfLines={1}>{name}</Text>
    <Text style={[st.rowTag, { color }]} numberOfLines={2}>{action}</Text>
  </View>
));
Row.displayName = "Row";

// Hoisted: as inline `ItemSeparatorComponent={() => …}` / `renderItem={…}` props
// these were a new component identity on every render, which remounted every
// separator and defeated the memo on Row above.
const Separator = () => <View style={st.sep} />;
const renderDiffRow = ({ item }) => (
  <Row name={item.n} action={item.a} color={item.c} />
);
const renderLogRow = ({ item }) => (
  <View style={st.logRow}>
    <Text style={st.logBullet}>•</Text>
    <Text style={st.logText}>{item}</Text>
  </View>
);

// ── Component ────────────────────────────────────────────────────────────────

const DeaconSyncModal = ({ visible, onClose, churchId }) => {
  // Live, not read at import: an iPad that rotates after launch otherwise keeps
  // portrait-height caps in landscape and the dialog overflows the screen.
  const { height: SH } = useWindowDimensions();
  const heights = useMemo(() => ({
    dialog:  { maxHeight: SH * 0.72 },
    list:    { maxHeight: SH * 0.38 },
    logList: { maxHeight: SH * 0.25 },
  }), [SH]);
  const [phase, setPhase] = useState(P.SCAN);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [log, setLog] = useState([]);
  const [listDiff, setListDiff] = useState(null);
  const [schedDiffs, setSchedDiffs] = useState([]);
  const [idx, setIdx] = useState(0);
  const ref = useRef({});

  useEffect(() => {
    if (visible && churchId) {
      setPhase(P.SCAN); setError(null); setLog([]);
      setListDiff(null); setSchedDiffs([]); setIdx(0);
      setBusy(false);
      scan();
    }
  }, [visible, churchId]);

  const scan = useCallback(async () => {
    try {
      const allDeacons = await fetchAllDeacons(churchId);
      const names = new Map(), uids = new Set();
      allDeacons.forEach(d => { names.set(d.uid, d.name); uids.add(d.uid); });

      const cDoc = await getDoc(doc(getFirestore(), "churches", churchId));
      const currentList = cDoc.data()?.deacons || [];
      const ld = diffList(currentList, allDeacons);

      const sSnap = await getDocs(collection(getFirestore(), "churches", churchId, "schedule"));
      const exist = new Set(sSnap.docs.map(d => d.id));
      const today = new Date(), sun = ws(today);
      if (sun <= today) sun.setDate(sun.getDate() + 7);
      const weeks = gw(sun, 5).filter(id => exist.has(id));
      sSnap.docs.forEach(d => { if (!weeks.includes(d.id)) weeks.push(d.id); });
      weeks.sort();

      const sData = {}, diffs = [];
      for (const w of weeks) {
        const doc = sSnap.docs.find(d => d.id === w);
        if (!doc) continue;
        const data = doc.data();
        sData[w] = data;
        const r = diffSched(data, uids, names);
        if (r.needUid.length > 0 || r.exDeacons.length > 0 || r.missing.length > 0)
          diffs.push({ weekId: w, ...r });
      }

      ref.current = { allDeacons, names, uids, currentList, sData };
      setListDiff(ld); setSchedDiffs(diffs); setIdx(0);

      const hasListIssues = ld.toAdd.length > 0 || ld.toRemove.length > 0 || ld.stale.length > 0;
      if (hasListIssues) setPhase(P.LIST);
      else if (diffs.length > 0) setPhase(P.SCHED);
      else { setLog(["No issues found — everything is clean."]); setPhase(P.DONE); }
    } catch (e) {
      setError(e.message || "Scan failed");
      setPhase(P.DONE);
    }
  }, [churchId]);

  const doFixList = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const up = await applyListFix(churchId, ref.current.currentList, listDiff.toAdd, listDiff.toRemove, listDiff.stale);
      ref.current.currentList = up;
      listDiff.toAdd.forEach(u => { ref.current.uids.add(u.uid); ref.current.names.set(u.uid, u.name); });
      const p = [];
      if (listDiff.toAdd.length) p.push(`+${listDiff.toAdd.length} added`);
      if (listDiff.toRemove.length) p.push(`-${listDiff.toRemove.length} removed`);
      if (listDiff.stale.length) p.push(`${listDiff.stale.length} updated`);
      setLog(prev => [...prev, `Deacon list: ${p.join(", ")}`]);
      afterList();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }, [churchId, listDiff, schedDiffs]);

  const skipList = () => { setLog(prev => [...prev, "Deacon list: skipped"]); afterList(); };
  const afterList = () => { if (schedDiffs.length > 0) { setIdx(0); setPhase(P.SCHED); } else setPhase(P.DONE); };

  const doFixSched = useCallback(async () => {
    const sd = schedDiffs[idx]; if (!sd) return;
    setBusy(true); setError(null);
    try {
      await applySchedFix(churchId, sd.weekId, ref.current.sData[sd.weekId], sd.needUid, sd.exDeacons, sd.missing, ref.current.names);
      setLog(prev => [...prev, `${nd(sd.weekId)}: ${schedSummary(sd)}`]);
      next();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }, [churchId, schedDiffs, idx]);

  const skipSched = () => { setLog(prev => [...prev, `${nd(schedDiffs[idx]?.weekId)}: skipped`]); next(); };
  const next = () => { const n = idx + 1; if (n < schedDiffs.length) setIdx(n); else setPhase(P.DONE); };

  const fixAll = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      for (let i = idx; i < schedDiffs.length; i++) {
        const sd = schedDiffs[i];
        await applySchedFix(churchId, sd.weekId, ref.current.sData[sd.weekId], sd.needUid, sd.exDeacons, sd.missing, ref.current.names);
        setLog(prev => [...prev, `${nd(sd.weekId)}: ${schedSummary(sd)}`]);
      }
      setPhase(P.DONE);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }, [churchId, schedDiffs, idx]);

  const close = () => {
    setPhase(P.SCAN); setListDiff(null); setSchedDiffs([]);
    setIdx(0); setLog([]); setError(null); setBusy(false);
    onClose();
  };

  // NOTE: everything below runs on every render, including the renders where
  // `visible` is false. The `if (!visible) return null` bail-out has to stay
  // BELOW the useMemos — putting it above them meant this component called 13
  // hooks while closed and 15 once opened, and React threw "Rendered more hooks
  // than during the previous render" the moment the Sync button was tapped.
  const cs = schedDiffs[idx];
  const lc = listDiff ? listDiff.toAdd.length + listDiff.toRemove.length + listDiff.stale.length : 0;
  const sc = cs ? cs.needUid.length + cs.exDeacons.length + cs.missing.length : 0;

  // Both of these used to be built inline as the FlatList `data` prop, so the
  // list's data identity changed on every render — every keystroke of unrelated
  // state re-rendered every row.
  const listRows = useMemo(() => {
    if (!listDiff) return [];
    return [
      ...listDiff.toAdd.map((u) => ({ k: u.uid, n: u.name, a: "Add", c: "#30d158" })),
      ...listDiff.toRemove.map((d) => ({ k: d.uid, n: d.name, a: "Remove", c: "#ff453a" })),
      ...listDiff.stale.map((s) => ({
        k: `s-${s.uid}`,
        n: s.name,
        a: s.fields.map((f) => `${f.field}: ${f.from} → ${f.to}`).join(", "),
        c: "#ff9f0a",
      })),
    ];
  }, [listDiff]);

  const schedRows = useMemo(() => {
    if (!cs) return [];
    return [
      ...cs.needUid.map((u) => ({
        k: `u-${slotKey(u.loc, u.i)}`,
        n: "N/A",
        a: `Generate UID — ${slotLabel(u.loc, u.i)}`,
        c: "#ff9f0a",
      })),
      ...cs.exDeacons.map((g) => ({
        k: `x-${slotKey(g.loc, g.i)}`,
        n: g.name,
        a: `Remove — ${slotLabel(g.loc, g.i)}`,
        c: "#ff453a",
      })),
      ...cs.missing.map((m) => ({ k: `m${m.uid}`, n: m.name, a: "→ Extras", c: "#30d158" })),
    ];
  }, [cs]);

  if (!visible) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={close}>
      <View style={st.backdrop}>
        <View style={[st.dialog, heights.dialog]}>

          <TouchableOpacity style={st.closeBtn} onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="close" size={18} color="rgba(255,255,255,0.3)" />
          </TouchableOpacity>

          {/* ── SCANNING ── */}
          {phase === P.SCAN && (
            <View style={st.center}>
              <ActivityIndicator color="#147efb" size="large" />
              <Text style={st.scanTitle}>Scanning…</Text>
              <Text style={st.scanText}>Checking deacons and schedules</Text>
            </View>
          )}

          {/* ── DEACON LIST ── */}
          {phase === P.LIST && listDiff && (
            <>
              <View style={st.header}>
                <Text style={st.label}>DEACON LIST</Text>
                <Text style={st.headerTitle}>{lc} issue{lc !== 1 ? "s" : ""} found</Text>
              </View>

              <FlatList
                {...LIST_PERF}
                data={listRows}
                keyExtractor={i => i.k}
                renderItem={renderDiffRow}
                style={[st.list, heights.list]}
                contentContainerStyle={st.listContent}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={Separator}
              />

              {error && <Text style={st.err}>{error}</Text>}

              <View style={st.footer}>
                <TouchableOpacity style={st.ghostBtn} onPress={skipList} disabled={busy}>
                  <Text style={st.ghostBtnText}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.mainBtn} onPress={doFixList} disabled={busy} activeOpacity={0.8}>
                  {busy && <ActivityIndicator color="#fff" size={14} />}
                  <Text style={st.mainBtnText}>Fix List</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── SCHEDULE ── */}
          {phase === P.SCHED && cs && (
            <>
              <View style={st.header}>
                <Text style={st.label}>SCHEDULE {idx + 1} OF {schedDiffs.length}</Text>
                <Text style={st.headerTitle}>{nd(cs.weekId)}</Text>
                <Text style={st.headerSub}>{sc} issue{sc !== 1 ? "s" : ""}</Text>
              </View>

              <FlatList
                {...LIST_PERF}
                data={schedRows}
                keyExtractor={i => i.k}
                renderItem={renderDiffRow}
                style={[st.list, heights.list]}
                contentContainerStyle={st.listContent}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={Separator}
              />

              {error && <Text style={st.err}>{error}</Text>}

              <View style={st.footer}>
                <TouchableOpacity style={st.ghostBtn} onPress={skipSched} disabled={busy}>
                  <Text style={st.ghostBtnText}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.mainBtn} onPress={doFixSched} disabled={busy} activeOpacity={0.8}>
                  {busy && <ActivityIndicator color="#fff" size={14} />}
                  <Text style={st.mainBtnText}>Fix</Text>
                </TouchableOpacity>
              </View>

              {schedDiffs.length - idx > 1 && !busy && (
                <TouchableOpacity style={st.linkBtn} onPress={fixAll}>
                  <Text style={st.linkBtnText}>Fix all remaining ({schedDiffs.length - idx})</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* ── DONE ── */}
          {phase === P.DONE && (
            <View style={st.doneWrap}>
              <View style={st.doneTop}>
                <View style={st.doneIcon}>
                  <Icon name={error ? "alert-circle-outline" : "check-circle-outline"} size={28} color={error ? "#ff453a" : "#30d158"} />
                </View>
                <Text style={st.doneTitle}>{error ? "Finished with errors" : "Sync Complete"}</Text>

                {log.length > 0 && (
                  <FlatList
                    {...LIST_PERF}
                    data={log}
                    // Append-only log: the index is stable for a given entry, and
                    // entries are never reordered or removed.
                    keyExtractor={(_, i) => String(i)}
                    style={[st.logList, heights.logList]}
                    showsVerticalScrollIndicator={false}
                    renderItem={renderLogRow}
                  />
                )}

                {error && <Text style={st.err}>{error}</Text>}
              </View>

              <TouchableOpacity style={st.doneBtn} onPress={close} activeOpacity={0.8}>
                <Text style={st.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center", alignItems: "center",
    paddingHorizontal: 20,
  },
  dialog: {
    backgroundColor: "#1c1c1e", borderRadius: 20,
    width: "100%", maxWidth: 560, minHeight: 200,
    paddingTop: 24, paddingBottom: 22, paddingHorizontal: 22,
  },
  closeBtn: { position: "absolute", top: 16, right: 16, zIndex: 1 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  scanTitle: { fontSize: 18, fontWeight: "600", color: "#fff", marginTop: 18 },
  scanText: { fontSize: 14, color: "rgba(255,255,255,0.4)", marginTop: 6 },
  header: { marginBottom: 12 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 1, color: "rgba(255,255,255,0.25)", marginBottom: 6 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 14, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  list: { flexGrow: 0, marginBottom: 16 },
  listContent: { paddingVertical: 4 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.06)" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 14 },
  rowName: { flex: 1, fontSize: 16, color: "#fff" },
  rowTag: { fontSize: 12, fontWeight: "600", maxWidth: "45%", textAlign: "right" },
  err: { fontSize: 13, color: "#ff453a", marginBottom: 10 },
  footer: { flexDirection: "row", gap: 10 },
  mainBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#147efb", paddingVertical: 15, borderRadius: 12,
  },
  mainBtnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  ghostBtn: {
    paddingVertical: 15, paddingHorizontal: 22, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  ghostBtnText: { fontSize: 16, fontWeight: "500", color: "rgba(255,255,255,0.35)" },
  linkBtn: { alignItems: "center", paddingVertical: 14 },
  linkBtnText: { fontSize: 14, color: "#147efb", fontWeight: "500" },
  doneWrap: { flex: 1, justifyContent: "space-between" },
  doneTop: { alignItems: "center", flex: 1 },
  doneIcon: { alignItems: "center", marginBottom: 12 },
  doneTitle: { fontSize: 20, fontWeight: "700", color: "#fff", textAlign: "center", marginBottom: 16 },
  doneBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#30d158", paddingVertical: 15, borderRadius: 12,
    width: "100%", marginTop: 12,
  },
  doneBtnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  logList: { width: "100%", marginBottom: 8 },
  logRow: { flexDirection: "row", paddingVertical: 4 },
  logBullet: { fontSize: 13, color: "rgba(255,255,255,0.3)", marginRight: 8, marginTop: 1 },
  logText: { flex: 1, fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 20 },
});

export default DeaconSyncModal;