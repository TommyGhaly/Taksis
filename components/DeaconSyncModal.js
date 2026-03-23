/**
 * DeaconSyncModal
 *
 * Auto-scans on open. Flow: Scan → Deacon list review → Per-schedule review → Done
 *
 * Deacon sources:
 *   1. Any user doc with church === churchId AND isDeacon === true
 *   2. ALL children from ANY user doc where church === churchId
 *      (children are embedded objects in the parent's children[] array,
 *       each child has uid, name, age, experience, frequency, rank, etc.)
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  ActivityIndicator, StyleSheet, Dimensions,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const { height: SH } = Dimensions.get("window");

// ── Config ───────────────────────────────────────────────────────────────────

const READING_KEYS = ["matins","third","sixth","pauline","catholic","praxis","gospel","water","wine"];
const DEFAULTS = { experience: 5, frequency: 5, rank: 5, age: 0 };

// ── Helpers ──────────────────────────────────────────────────────────────────

const ws = (d) => { const x = new Date(d); return new Date(x.setDate(x.getDate()-x.getDay())); };
const fid = (d) => `${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}-${String(d.getFullYear()).slice(-2)}`;
const gw = (s,n=5) => { const r=[],w=ws(s); for(let i=0;i<n;i++){const d=new Date(w);d.setDate(w.getDate()+i*7);r.push(fid(d));}return r; };
const nd = (s) => { if(!s)return""; const[m,d,y]=s.split("-").map(Number); return new Date(2000+y,m-1,d).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}); };

/**
 * Fetch all deacons for a church:
 *  - Users with isDeacon: true AND church === churchId
 *  - ALL children[] entries from ANY user with church === churchId
 */
async function fetchAllDeacons(churchId) {
  // Get all users in this church
  const allUsersSnap = await firestore()
    .collection("users")
    .where("church", "==", churchId)
    .get();

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

    // 1. If user is a deacon, add them
    if (data.isDeacon === true) {
      add(doc.id, data);
    }

    // 2. ALL children of ANY church member are deacons
    if (Array.isArray(data.children)) {
      for (const child of data.children) {
        if (child.uid) {
          add(child.uid, child);
        }
      }
    }
  }

  return deacons;
}

function buildEntry(d) {
  return {
    uid: d.uid, name: d.name || "",
    age: d.age ?? DEFAULTS.age,
    experience: d.experience ?? DEFAULTS.experience,
    frequency: d.frequency ?? DEFAULTS.frequency,
    rank: d.rank ?? DEFAULTS.rank,
    weeksSince: d.weeksSince ?? 4,
    lastWeeksSince: d.lastWeeksSince ?? 4,
    value: d.value ?? 0,
  };
}

function diffList(current, expected) {
  const cSet = new Set(current.map(d => d.uid));
  const eSet = new Set(expected.map(u => u.uid));
  const eMap = new Map(expected.map(u => [u.uid, u]));

  // Fields synced from user doc → deacon array (one-way)
  const SYNC_FIELDS = ["name", "age", "experience", "frequency", "rank"];

  // Fields that must exist on every deacon array entry (with defaults)
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
    if (!eSet.has(entry.uid)) continue; // will be caught by toRemove
    const source = eMap.get(entry.uid);
    const mismatched = [];

    // Check user-doc-synced fields
    if (source) {
      for (const f of SYNC_FIELDS) {
        const srcVal = source[f] ?? DEFAULTS[f] ?? 0;
        const curVal = entry[f] ?? DEFAULTS[f] ?? 0;
        if (String(srcVal) !== String(curVal)) {
          mismatched.push({ field: f, from: curVal, to: srcVal });
        }
      }
    }

    // Check required fields are present (not undefined/null)
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

function diffSched(data, uids, names) {
  const scheduled = new Set(), unknowns = [];
  const check = (uid, name, loc) => {
    if (!uid) return;
    scheduled.add(uid);
    if (!uids.has(uid)) unknowns.push({ uid, name, loc });
  };
  for (const k of READING_KEYS) { const e = data[k]; check(e?.uid, e?.name, k); }
  for (const e of (data.altar || [])) check(e?.uid, e?.name, "altar");
  for (const e of (data.extra || [])) check(e?.uid, e?.name, "extra");

  const missing = [];
  for (const uid of uids) { if (!scheduled.has(uid)) missing.push({ uid, name: names.get(uid) || "Unknown" }); }
  return { unknowns, missing };
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
      for (const f of s.fields) {
        // f.to is either the user-doc value or the default for missing fields
        patched[f.field] = f.to;
      }
      return patched;
    });

  for (const u of toAdd) up.push(buildEntry(u));
  await firestore().collection("churches").doc(churchId).update({ deacons: up });
  return up;
}

async function applySchedFix(churchId, wid, data, unknowns, missing, names) {
  const up = {}, unk = new Set(unknowns.map(u => u.uid));
  for (const k of READING_KEYS) { if (data[k]?.uid && unk.has(data[k].uid)) up[k] = { uid: "", name: "N/A" }; }
  const a = data.altar || [], fa = a.filter(e => !e?.uid || !unk.has(e.uid));
  if (fa.length !== a.length) up.altar = fa;
  let ex = (data.extra || []).filter(e => !e?.uid || !unk.has(e.uid));
  for (const m of missing) { if (!ex.find(e => e.uid === m.uid)) ex.push({ uid: m.uid, name: names.get(m.uid) || m.name || "Unknown" }); }
  ex.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  up.extra = ex;
  await firestore().collection("churches").doc(churchId).collection("schedule").doc(wid).update(up);
}

// ── Phases ───────────────────────────────────────────────────────────────────

const P = { SCAN: 0, LIST: 1, SCHED: 2, DONE: 3 };

// ── Row ──────────────────────────────────────────────────────────────────────

const Row = ({ name, action, color }) => (
  <View style={st.row}>
    <View style={[st.dot, { backgroundColor: color }]} />
    <Text style={st.rowName} numberOfLines={1}>{name}</Text>
    <Text style={[st.rowTag, { color }]} numberOfLines={2}>{action}</Text>
  </View>
);

// ── Component ────────────────────────────────────────────────────────────────

const DeaconSyncModal = ({ visible, onClose, churchId }) => {
  const [phase, setPhase] = useState(P.SCAN);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [log, setLog] = useState([]);
  const [listDiff, setListDiff] = useState(null);
  const [schedDiffs, setSchedDiffs] = useState([]);
  const [idx, setIdx] = useState(0);
  const ref = useRef({});

  // ── Auto-scan on open ──────────────────────────────────────────────────────

  useEffect(() => {
    if (visible && churchId) {
      setPhase(P.SCAN); setError(null); setLog([]);
      setListDiff(null); setSchedDiffs([]); setIdx(0);
      setBusy(false);
      scan();
    }
  }, [visible, churchId]);

  // ── Scan ───────────────────────────────────────────────────────────────────

  const scan = useCallback(async () => {
    try {
      const allDeacons = await fetchAllDeacons(churchId);
      const names = new Map(), uids = new Set();
      allDeacons.forEach(d => { names.set(d.uid, d.name); uids.add(d.uid); });

      const cDoc = await firestore().collection("churches").doc(churchId).get();
      const currentList = cDoc.data()?.deacons || [];
      const ld = diffList(currentList, allDeacons);

      const sSnap = await firestore().collection("churches").doc(churchId).collection("schedule").get();
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
        if (r.unknowns.length > 0 || r.missing.length > 0) diffs.push({ weekId: w, ...r });
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

  // ── Fix list ───────────────────────────────────────────────────────────────

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

  // ── Fix schedule ───────────────────────────────────────────────────────────

  const doFixSched = useCallback(async () => {
    const sd = schedDiffs[idx]; if (!sd) return;
    setBusy(true); setError(null);
    try {
      await applySchedFix(churchId, sd.weekId, ref.current.sData[sd.weekId], sd.unknowns, sd.missing, ref.current.names);
      const p = [];
      if (sd.unknowns.length) p.push(`${sd.unknowns.length} removed`);
      if (sd.missing.length) p.push(`${sd.missing.length} → extras`);
      setLog(prev => [...prev, `${nd(sd.weekId)}: ${p.join(", ")}`]);
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
        await applySchedFix(churchId, sd.weekId, ref.current.sData[sd.weekId], sd.unknowns, sd.missing, ref.current.names);
        const p = [];
        if (sd.unknowns.length) p.push(`${sd.unknowns.length} removed`);
        if (sd.missing.length) p.push(`${sd.missing.length} → extras`);
        setLog(prev => [...prev, `${nd(sd.weekId)}: ${p.join(", ")}`]);
      }
      setPhase(P.DONE);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }, [churchId, schedDiffs, idx]);

  // ── Close ──────────────────────────────────────────────────────────────────

  const close = () => {
    setPhase(P.SCAN); setListDiff(null); setSchedDiffs([]);
    setIdx(0); setLog([]); setError(null); setBusy(false);
    onClose();
  };

  if (!visible) return null;

  const cs = schedDiffs[idx];
  const lc = listDiff ? listDiff.toAdd.length + listDiff.toRemove.length + listDiff.stale.length : 0;
  const sc = cs ? cs.unknowns.length + cs.missing.length : 0;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={close}>
      <View style={st.backdrop}>
        <View style={st.dialog}>

          {/* Close button — always visible */}
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
                <Text style={st.headerTitle}>
                  {lc} issue{lc !== 1 ? "s" : ""} found
                </Text>
              </View>

              <FlatList
                data={[
                  ...listDiff.toAdd.map(u => ({ k: u.uid, n: u.name, a: "Add", c: "#30d158" })),
                  ...listDiff.toRemove.map(d => ({ k: d.uid, n: d.name, a: "Remove", c: "#ff453a" })),
                  ...listDiff.stale.map(s => ({ k: `s-${s.uid}`, n: s.name, a: s.fields.map(f => `${f.field}: ${f.from} → ${f.to}`).join(", "), c: "#ff9f0a" })),
                ]}
                keyExtractor={i => i.k}
                renderItem={({ item }) => <Row name={item.n} action={item.a} color={item.c} />}
                style={st.list}
                contentContainerStyle={st.listContent}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={st.sep} />}
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
                <Text style={st.label}>
                  SCHEDULE {idx + 1} OF {schedDiffs.length}
                </Text>
                <Text style={st.headerTitle}>{nd(cs.weekId)}</Text>
                <Text style={st.headerSub}>
                  {sc} issue{sc !== 1 ? "s" : ""}
                </Text>
              </View>

              <FlatList
                data={[
                  ...cs.unknowns.map((u, i) => ({ k: `u${u.uid}${i}`, n: u.name, a: "Remove", c: "#ff453a" })),
                  ...cs.missing.map(m => ({ k: `m${m.uid}`, n: m.name, a: "→ Extras", c: "#30d158" })),
                ]}
                keyExtractor={i => i.k}
                renderItem={({ item }) => <Row name={item.n} action={item.a} color={item.c} />}
                style={st.list}
                contentContainerStyle={st.listContent}
                showsVerticalScrollIndicator={false}
                ItemSeparatorComponent={() => <View style={st.sep} />}
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
                    data={log}
                    keyExtractor={(_, i) => String(i)}
                    style={st.logList}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <View style={st.logRow}>
                        <Text style={st.logBullet}>•</Text>
                        <Text style={st.logText}>{item}</Text>
                      </View>
                    )}
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
    width: "100%", minHeight: 200, maxHeight: SH * 0.72,
    paddingTop: 24, paddingBottom: 22, paddingHorizontal: 22,
  },

  // Close
  closeBtn: { position: "absolute", top: 16, right: 16, zIndex: 1 },

  // Scanning
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  scanTitle: { fontSize: 18, fontWeight: "600", color: "#fff", marginTop: 18 },
  scanText: { fontSize: 14, color: "rgba(255,255,255,0.4)", marginTop: 6 },

  // Header area
  header: { marginBottom: 12 },
  label: {
    fontSize: 11, fontWeight: "700", letterSpacing: 1,
    color: "rgba(255,255,255,0.25)", marginBottom: 6,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#fff" },
  headerSub: { fontSize: 14, color: "rgba(255,255,255,0.4)", marginTop: 2 },

  // List
  list: { flexGrow: 0, maxHeight: SH * 0.38, marginBottom: 16 },
  listContent: { paddingVertical: 4 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.06)" },

  // Row
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 14 },
  rowName: { flex: 1, fontSize: 16, color: "#fff" },
  rowTag: { fontSize: 12, fontWeight: "600", maxWidth: "45%", textAlign: "right" },

  // Error
  err: { fontSize: 13, color: "#ff453a", marginBottom: 10 },

  // Footer buttons
  footer: { flexDirection: "row", gap: 10 },
  mainBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, backgroundColor: "#147efb",
    paddingVertical: 15, borderRadius: 12,
  },
  mainBtnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  ghostBtn: {
    paddingVertical: 15, paddingHorizontal: 22, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  ghostBtnText: { fontSize: 16, fontWeight: "500", color: "rgba(255,255,255,0.35)" },

  // Fix all link
  linkBtn: { alignItems: "center", paddingVertical: 14 },
  linkBtnText: { fontSize: 14, color: "#147efb", fontWeight: "500" },

  // Done
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

  // Log
  logList: { maxHeight: SH * 0.25, width: "100%", marginBottom: 8 },
  logRow: { flexDirection: "row", paddingVertical: 4 },
  logBullet: { fontSize: 13, color: "rgba(255,255,255,0.3)", marginRight: 8, marginTop: 1 },
  logText: { flex: 1, fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 20 },
});

export default DeaconSyncModal;