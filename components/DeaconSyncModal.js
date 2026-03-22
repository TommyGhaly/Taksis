/**
 * DeaconSyncModal
 *
 * Two-phase data integrity sync:
 *   Phase 1 — Deacons list (church.deacons[] vs user docs with isDeacon)
 *   Phase 2 — Schedules (each of 5 weeks, one at a time)
 *
 * Shows issues first, lets admin confirm before writing.
 */

import React, { useState, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  ActivityIndicator, StyleSheet, Alert,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

// ── Schedule structure ───────────────────────────────────────────────────────

const READING_KEYS = [
  "matins", "third", "sixth", "pauline",
  "catholic", "praxis", "gospel", "water", "wine",
];
const ARRAY_KEYS = ["altar", "extra"];

const DEFAULT_DEACON_FIELDS = { experience: 5, frequency: 5, rank: 5, age: 0 };

// ── Date helpers (same as EditSchedule) ──────────────────────────────────────

const getWeekStart = (d) => { const x = new Date(d); return new Date(x.setDate(x.getDate() - x.getDay())); };
const fmt = (d) => {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  const y = String(d.getFullYear()).slice(-2);
  return `${m}-${dy}-${y}`;
};
const generateWeeks = (start, n = 5) => {
  const ws = [], s = getWeekStart(start);
  for (let i = 0; i < n; i++) { const d = new Date(s); d.setDate(s.getDate() + i * 7); ws.push(fmt(d)); }
  return ws;
};
const fmtDisplay = (s) => {
  if (!s) return "";
  const [m, d, y] = s.split("-").map(Number);
  return new Date(2000 + y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
};

// ── Scan helpers ─────────────────────────────────────────────────────────────

async function fetchAllDeaconUsers(churchId) {
  const snap = await firestore()
    .collection("users")
    .where("church", "==", churchId)
    .where("isDeacon", "==", true)
    .get();

  const users = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    users.push({ uid: doc.id, name: data.name || "", ...data });

    // Children with their own user docs are fetched by the query already
    // (they have isDeacon: true and church set). But also check embedded
    // children array for UIDs that might have their own docs.
    if (Array.isArray(data.children)) {
      for (const child of data.children) {
        if (child.uid && !snap.docs.find((d) => d.id === child.uid)) {
          try {
            const childDoc = await firestore().collection("users").doc(child.uid).get();
            if (childDoc.exists) {
              const cd = childDoc.data();
              if (cd.isDeacon && cd.church === churchId) {
                users.push({ uid: child.uid, name: cd.name || child.name || "", ...cd });
              }
            }
          } catch {}
        }
      }
    }
  }

  // Deduplicate by uid
  const seen = new Set();
  return users.filter((u) => { if (seen.has(u.uid)) return false; seen.add(u.uid); return true; });
}

function buildDeaconEntry(userDoc) {
  return {
    uid: userDoc.uid,
    name: userDoc.name || "",
    age: userDoc.age ?? DEFAULT_DEACON_FIELDS.age,
    experience: userDoc.experience ?? DEFAULT_DEACON_FIELDS.experience,
    frequency: userDoc.frequency ?? DEFAULT_DEACON_FIELDS.frequency,
    rank: userDoc.rank ?? DEFAULT_DEACON_FIELDS.rank,
  };
}

function scanDeaconList(currentArray, allDeaconUsers) {
  const currentUids = new Set(currentArray.map((d) => d.uid));
  const expectedUids = new Set(allDeaconUsers.map((u) => u.uid));

  const missing = allDeaconUsers
    .filter((u) => !currentUids.has(u.uid))
    .map((u) => ({ type: "missing", uid: u.uid, name: u.name, userData: u }));

  const extra = currentArray
    .filter((d) => !expectedUids.has(d.uid))
    .map((d) => ({ type: "extra", uid: d.uid, name: d.name }));

  return { missing, extra };
}

function scanSchedule(scheduleData, masterUids, masterMap) {
  const issues = [];
  const seenUids = new Set();
  const scheduledUids = new Set();

  // Check reading roles
  for (const key of READING_KEYS) {
    const entry = scheduleData[key];
    if (!entry?.uid) continue;

    if (seenUids.has(entry.uid)) {
      issues.push({ type: "duplicate", key, uid: entry.uid, name: entry.name, location: `role: ${key}` });
    }
    seenUids.add(entry.uid);
    scheduledUids.add(entry.uid);

    if (!masterUids.has(entry.uid)) {
      issues.push({ type: "unknown", key, uid: entry.uid, name: entry.name, location: `role: ${key}` });
    }
  }

  // Check altar array
  const altar = scheduleData.altar || [];
  altar.forEach((entry, i) => {
    if (!entry?.uid) return;
    if (seenUids.has(entry.uid)) {
      issues.push({ type: "duplicate", key: "altar", index: i, uid: entry.uid, name: entry.name, location: `altar[${i}]` });
    }
    seenUids.add(entry.uid);
    scheduledUids.add(entry.uid);

    if (!masterUids.has(entry.uid)) {
      issues.push({ type: "unknown", key: "altar", index: i, uid: entry.uid, name: entry.name, location: `altar[${i}]` });
    }
  });

  // Check extra array for unknowns
  const extra = scheduleData.extra || [];
  extra.forEach((entry, i) => {
    if (!entry?.uid) return;
    scheduledUids.add(entry.uid);
    if (!masterUids.has(entry.uid)) {
      issues.push({ type: "unknown", key: "extra", index: i, uid: entry.uid, name: entry.name, location: `extra[${i}]` });
    }
  });

  // Find deacons missing from the entire schedule
  const missingFromSchedule = [];
  for (const uid of masterUids) {
    if (!scheduledUids.has(uid)) {
      missingFromSchedule.push({ type: "missing_from_schedule", uid, name: masterMap.get(uid) || "Unknown" });
    }
  }

  return { issues, missingFromSchedule };
}

// ── Fix helpers ──────────────────────────────────────────────────────────────

async function fixDeaconList(churchId, currentArray, toAdd, toRemove) {
  const removeUids = new Set(toRemove.map((d) => d.uid));
  let updated = currentArray.filter((d) => !removeUids.has(d.uid));

  for (const item of toAdd) {
    updated.push(buildDeaconEntry(item.userData));
  }

  await firestore().collection("churches").doc(churchId).update({ deacons: updated });
  return updated;
}

async function fixSchedule(churchId, weekId, scheduleData, unknowns, missingDeacons, masterMap) {
  const updates = {};
  const unknownUids = new Set(unknowns.map((u) => u.uid));

  // Remove unknowns from reading roles
  for (const key of READING_KEYS) {
    const entry = scheduleData[key];
    if (entry?.uid && unknownUids.has(entry.uid)) {
      updates[key] = { uid: "", name: "N/A" };
    }
  }

  // Remove unknowns from altar
  const altar = scheduleData.altar || [];
  const filteredAltar = altar.filter((e) => !e?.uid || !unknownUids.has(e.uid));
  if (filteredAltar.length !== altar.length) {
    updates.altar = filteredAltar;
  }

  // Remove unknowns from extra + add missing deacons to extra
  let extra = (scheduleData.extra || []).filter((e) => !e?.uid || !unknownUids.has(e.uid));
  for (const d of missingDeacons) {
    if (!extra.find((e) => e.uid === d.uid)) {
      extra.push({ uid: d.uid, name: masterMap.get(d.uid) || d.name || "Unknown" });
    }
  }
  extra.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  updates.extra = extra;

  if (Object.keys(updates).length > 0) {
    await firestore()
      .collection("churches").doc(churchId)
      .collection("schedule").doc(weekId)
      .update(updates);
  }
}

// ── Phase enum ───────────────────────────────────────────────────────────────

const PHASE = {
  IDLE: "idle",
  SCANNING: "scanning",
  DEACON_REVIEW: "deacon_review",
  DEACON_FIXING: "deacon_fixing",
  SCHEDULE_REVIEW: "schedule_review",
  SCHEDULE_FIXING: "schedule_fixing",
  DONE: "done",
};

// ── Component ────────────────────────────────────────────────────────────────

const DeaconSyncModal = ({ visible, onClose, churchId }) => {
  const [phase, setPhase] = useState(PHASE.IDLE);
  const [scanResult, setScanResult] = useState(null);
  const [scheduleResults, setScheduleResults] = useState([]);
  const [currentScheduleIdx, setCurrentScheduleIdx] = useState(0);
  const [fixLog, setFixLog] = useState([]);
  const [error, setError] = useState(null);

  const masterMapRef = useRef(new Map());
  const masterUidsRef = useRef(new Set());
  const allDeaconUsersRef = useRef([]);
  const currentDeaconsRef = useRef([]);
  const weekIdsRef = useRef([]);
  const scheduleDataRef = useRef({});

  // ── Start scan ─────────────────────────────────────────────────────────────

  const startScan = useCallback(async () => {
    setPhase(PHASE.SCANNING);
    setError(null);
    setFixLog([]);
    setScanResult(null);
    setScheduleResults([]);
    setCurrentScheduleIdx(0);

    try {
      // 1. Fetch all deacon users
      const allUsers = await fetchAllDeaconUsers(churchId);
      allDeaconUsersRef.current = allUsers;

      const mMap = new Map();
      const mUids = new Set();
      allUsers.forEach((u) => { mMap.set(u.uid, u.name); mUids.add(u.uid); });
      masterMapRef.current = mMap;
      masterUidsRef.current = mUids;

      // 2. Fetch current deacons array
      const churchDoc = await firestore().collection("churches").doc(churchId).get();
      const churchData = churchDoc.data() || {};
      const currentDeacons = churchData.deacons || [];
      currentDeaconsRef.current = currentDeacons;

      // 3. Scan deacon list
      const deaconIssues = scanDeaconList(currentDeacons, allUsers);

      // 4. Generate week IDs and fetch schedules
      const today = new Date();
      const nextSunday = getWeekStart(today);
      if (nextSunday <= today) nextSunday.setDate(nextSunday.getDate() + 7);

      // Also check existing schedule docs
      const schedSnap = await firestore()
        .collection("churches").doc(churchId)
        .collection("schedule").get();

      const existingIds = new Set(schedSnap.docs.map((d) => d.id));
      const generated = generateWeeks(nextSunday, 5);
      const weekIds = generated.filter((id) => existingIds.has(id));
      // Also include any existing ones not in generated (edge case)
      schedSnap.docs.forEach((d) => { if (!weekIds.includes(d.id)) weekIds.push(d.id); });
      weekIds.sort();

      weekIdsRef.current = weekIds;

      // 5. Scan each schedule
      const schedResults = [];
      const schedDataMap = {};
      for (const wid of weekIds) {
        const doc = schedSnap.docs.find((d) => d.id === wid);
        if (!doc) continue;
        const data = doc.data();
        schedDataMap[wid] = data;
        const result = scanSchedule(data, mUids, mMap);
        schedResults.push({ weekId: wid, ...result });
      }
      scheduleDataRef.current = schedDataMap;

      setScanResult(deaconIssues);
      setScheduleResults(schedResults);

      // Decide where to go
      if (deaconIssues.missing.length > 0 || deaconIssues.extra.length > 0) {
        setPhase(PHASE.DEACON_REVIEW);
      } else if (schedResults.some((r) => r.issues.length > 0 || r.missingFromSchedule.length > 0)) {
        setPhase(PHASE.SCHEDULE_REVIEW);
        setCurrentScheduleIdx(0);
      } else {
        setPhase(PHASE.DONE);
        setFixLog(["Everything looks clean — no issues found."]);
      }
    } catch (err) {
      console.error("Sync scan error:", err);
      setError(err.message || "Failed to scan");
      setPhase(PHASE.IDLE);
    }
  }, [churchId]);

  // ── Fix deacon list ────────────────────────────────────────────────────────

  const applyDeaconFix = useCallback(async () => {
    if (!scanResult) return;
    setPhase(PHASE.DEACON_FIXING);
    try {
      const updated = await fixDeaconList(
        churchId,
        currentDeaconsRef.current,
        scanResult.missing,
        scanResult.extra,
      );
      currentDeaconsRef.current = updated;

      // Update master sets to include newly added
      const mMap = masterMapRef.current;
      const mUids = masterUidsRef.current;
      scanResult.missing.forEach((m) => { mUids.add(m.uid); mMap.set(m.uid, m.name); });

      const log = [];
      if (scanResult.missing.length > 0)
        log.push(`Added ${scanResult.missing.length} deacon(s) to list`);
      if (scanResult.extra.length > 0)
        log.push(`Removed ${scanResult.extra.length} non-deacon(s) from list`);
      setFixLog((prev) => [...prev, ...log]);

      // Move to schedules
      if (scheduleResults.some((r) => r.issues.length > 0 || r.missingFromSchedule.length > 0)) {
        setPhase(PHASE.SCHEDULE_REVIEW);
        setCurrentScheduleIdx(0);
      } else {
        setPhase(PHASE.DONE);
        setFixLog((prev) => [...prev, "All schedules are clean."]);
      }
    } catch (err) {
      console.error("Fix deacon list error:", err);
      setError(err.message);
      setPhase(PHASE.DEACON_REVIEW);
    }
  }, [churchId, scanResult, scheduleResults]);

  const skipDeaconFix = useCallback(() => {
    if (scheduleResults.some((r) => r.issues.length > 0 || r.missingFromSchedule.length > 0)) {
      setPhase(PHASE.SCHEDULE_REVIEW);
      setCurrentScheduleIdx(0);
    } else {
      setPhase(PHASE.DONE);
      setFixLog((prev) => [...prev, "Skipped deacon list fix.", "All schedules are clean."]);
    }
  }, [scheduleResults]);

  // ── Fix schedule ───────────────────────────────────────────────────────────

  const applyScheduleFix = useCallback(async () => {
    const result = scheduleResults[currentScheduleIdx];
    if (!result) return;
    setPhase(PHASE.SCHEDULE_FIXING);

    try {
      const unknowns = result.issues.filter((i) => i.type === "unknown");
      await fixSchedule(
        churchId, result.weekId,
        scheduleDataRef.current[result.weekId],
        unknowns, result.missingFromSchedule,
        masterMapRef.current,
      );

      const log = [];
      if (unknowns.length > 0) log.push(`${fmtDisplay(result.weekId)}: removed ${unknowns.length} unknown(s)`);
      if (result.missingFromSchedule.length > 0) log.push(`${fmtDisplay(result.weekId)}: added ${result.missingFromSchedule.length} to extras`);
      setFixLog((prev) => [...prev, ...log]);

      advanceSchedule();
    } catch (err) {
      console.error("Fix schedule error:", err);
      setError(err.message);
      setPhase(PHASE.SCHEDULE_REVIEW);
    }
  }, [churchId, currentScheduleIdx, scheduleResults]);

  const skipScheduleFix = useCallback(() => {
    setFixLog((prev) => [...prev, `${fmtDisplay(scheduleResults[currentScheduleIdx]?.weekId)}: skipped`]);
    advanceSchedule();
  }, [currentScheduleIdx, scheduleResults]);

  const advanceSchedule = useCallback(() => {
    const next = currentScheduleIdx + 1;
    if (next < scheduleResults.length) {
      // Find next schedule with issues
      let idx = next;
      while (idx < scheduleResults.length) {
        const r = scheduleResults[idx];
        if (r.issues.length > 0 || r.missingFromSchedule.length > 0) break;
        idx++;
      }
      if (idx < scheduleResults.length) {
        setCurrentScheduleIdx(idx);
        setPhase(PHASE.SCHEDULE_REVIEW);
      } else {
        setPhase(PHASE.DONE);
      }
    } else {
      setPhase(PHASE.DONE);
    }
  }, [currentScheduleIdx, scheduleResults]);

  // Fix all remaining schedules at once
  const fixAllSchedules = useCallback(async () => {
    setPhase(PHASE.SCHEDULE_FIXING);
    try {
      for (let i = currentScheduleIdx; i < scheduleResults.length; i++) {
        const result = scheduleResults[i];
        if (result.issues.length === 0 && result.missingFromSchedule.length === 0) continue;

        const unknowns = result.issues.filter((x) => x.type === "unknown");
        await fixSchedule(
          churchId, result.weekId,
          scheduleDataRef.current[result.weekId],
          unknowns, result.missingFromSchedule,
          masterMapRef.current,
        );

        const log = [];
        if (unknowns.length > 0) log.push(`${fmtDisplay(result.weekId)}: removed ${unknowns.length} unknown(s)`);
        if (result.missingFromSchedule.length > 0) log.push(`${fmtDisplay(result.weekId)}: added ${result.missingFromSchedule.length} to extras`);
        setFixLog((prev) => [...prev, ...log]);
      }
      setPhase(PHASE.DONE);
    } catch (err) {
      setError(err.message);
      setPhase(PHASE.SCHEDULE_REVIEW);
    }
  }, [churchId, currentScheduleIdx, scheduleResults]);

  // ── Reset ──────────────────────────────────────────────────────────────────

  const handleClose = () => {
    setPhase(PHASE.IDLE);
    setScanResult(null);
    setScheduleResults([]);
    setCurrentScheduleIdx(0);
    setFixLog([]);
    setError(null);
    onClose();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const currentSched = scheduleResults[currentScheduleIdx];
  const totalScheduleIssues = scheduleResults.reduce(
    (sum, r) => sum + r.issues.length + r.missingFromSchedule.length, 0
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={st.overlay}>
        <View style={st.sheet}>
          {/* Header */}
          <View style={st.header}>
            <View style={st.headerLeft}>
              <Icon name="sync" size={20} color="#147efb" />
              <Text style={st.headerTitle}>Sync & Fix</Text>
            </View>
            <TouchableOpacity style={st.closeBtn} onPress={handleClose}>
              <Icon name="close" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          <ScrollView style={st.body} showsVerticalScrollIndicator={false}>

            {/* ── IDLE ── */}
            {phase === PHASE.IDLE && (
              <View style={st.centeredSection}>
                <View style={st.iconCircle}>
                  <Icon name="database-sync-outline" size={32} color="#147efb" />
                </View>
                <Text style={st.title}>Data Integrity Check</Text>
                <Text style={st.desc}>
                  This will scan your deacons list and all schedules for corruption, missing entries, and unknown people. You'll review all issues before any changes are made.
                </Text>
                {error && <Text style={st.errorText}>{error}</Text>}
                <TouchableOpacity style={st.primaryBtn} onPress={startScan} activeOpacity={0.8}>
                  <Icon name="magnify" size={18} color="#fff" />
                  <Text style={st.primaryBtnText}>Start Scan</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── SCANNING ── */}
            {phase === PHASE.SCANNING && (
              <View style={st.centeredSection}>
                <ActivityIndicator size="large" color="#147efb" />
                <Text style={st.scanningText}>Scanning data…</Text>
                <Text style={st.scanningSubtext}>Checking deacons list and schedules</Text>
              </View>
            )}

            {/* ── DEACON REVIEW ── */}
            {phase === PHASE.DEACON_REVIEW && scanResult && (
              <View>
                <View style={st.phaseHeader}>
                  <View style={st.phaseBadge}>
                    <Text style={st.phaseBadgeText}>Step 1 of 2</Text>
                  </View>
                  <Text style={st.phaseTitle}>Deacons List</Text>
                  <Text style={st.phaseDesc}>
                    {scanResult.missing.length + scanResult.extra.length} issue(s) found
                  </Text>
                </View>

                {scanResult.missing.length > 0 && (
                  <View style={st.issueSection}>
                    <View style={st.issueLabelRow}>
                      <Icon name="account-plus" size={16} color="#30d158" />
                      <Text style={st.issueLabel}>Missing from deacons list ({scanResult.missing.length})</Text>
                    </View>
                    <Text style={st.issueDesc}>These users have isDeacon but aren't in the church's deacon array.</Text>
                    {scanResult.missing.map((m) => (
                      <View key={m.uid} style={st.issueItem}>
                        <Icon name="account-outline" size={16} color="#30d158" />
                        <Text style={st.issueItemText}>{m.name || m.uid}</Text>
                        <Text style={st.issueAction}>Will add</Text>
                      </View>
                    ))}
                  </View>
                )}

                {scanResult.extra.length > 0 && (
                  <View style={st.issueSection}>
                    <View style={st.issueLabelRow}>
                      <Icon name="account-remove" size={16} color="#ff453a" />
                      <Text style={st.issueLabel}>Shouldn't be on list ({scanResult.extra.length})</Text>
                    </View>
                    <Text style={st.issueDesc}>These are in the deacon array but don't have isDeacon: true.</Text>
                    {scanResult.extra.map((e) => (
                      <View key={e.uid} style={st.issueItem}>
                        <Icon name="account-off-outline" size={16} color="#ff453a" />
                        <Text style={st.issueItemText}>{e.name || e.uid}</Text>
                        <Text style={[st.issueAction, { color: "#ff453a" }]}>Will remove</Text>
                      </View>
                    ))}
                  </View>
                )}

                {error && <Text style={st.errorText}>{error}</Text>}

                <View style={st.actionRow}>
                  <TouchableOpacity style={st.secondaryBtn} onPress={skipDeaconFix}>
                    <Text style={st.secondaryBtnText}>Skip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.primaryBtn} onPress={applyDeaconFix} activeOpacity={0.8}>
                    <Icon name="check" size={18} color="#fff" />
                    <Text style={st.primaryBtnText}>Fix Deacons List</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── DEACON FIXING ── */}
            {phase === PHASE.DEACON_FIXING && (
              <View style={st.centeredSection}>
                <ActivityIndicator size="large" color="#30d158" />
                <Text style={st.scanningText}>Fixing deacons list…</Text>
              </View>
            )}

            {/* ── SCHEDULE REVIEW ── */}
            {phase === PHASE.SCHEDULE_REVIEW && currentSched && (
              <View>
                <View style={st.phaseHeader}>
                  <View style={st.phaseBadge}>
                    <Text style={st.phaseBadgeText}>
                      Step 2 of 2 — Schedule {currentScheduleIdx + 1}/{scheduleResults.length}
                    </Text>
                  </View>
                  <Text style={st.phaseTitle}>{fmtDisplay(currentSched.weekId)}</Text>
                  <Text style={st.phaseDesc}>
                    {currentSched.issues.length + currentSched.missingFromSchedule.length} issue(s)
                  </Text>
                </View>

                {currentSched.issues.filter((i) => i.type === "unknown").length > 0 && (
                  <View style={st.issueSection}>
                    <View style={st.issueLabelRow}>
                      <Icon name="account-question" size={16} color="#ff453a" />
                      <Text style={st.issueLabel}>
                        Unknown people ({currentSched.issues.filter((i) => i.type === "unknown").length})
                      </Text>
                    </View>
                    <Text style={st.issueDesc}>These are in the schedule but not on the deacons list.</Text>
                    {currentSched.issues.filter((i) => i.type === "unknown").map((u, idx) => (
                      <View key={`${u.uid}-${idx}`} style={st.issueItem}>
                        <Icon name="account-off-outline" size={16} color="#ff453a" />
                        <View style={{ flex: 1 }}>
                          <Text style={st.issueItemText}>{u.name || u.uid}</Text>
                          <Text style={st.issueItemSub}>{u.location}</Text>
                        </View>
                        <Text style={[st.issueAction, { color: "#ff453a" }]}>Remove</Text>
                      </View>
                    ))}
                  </View>
                )}

                {currentSched.issues.filter((i) => i.type === "duplicate").length > 0 && (
                  <View style={st.issueSection}>
                    <View style={st.issueLabelRow}>
                      <Icon name="content-duplicate" size={16} color="#ff9f0a" />
                      <Text style={st.issueLabel}>
                        Duplicates ({currentSched.issues.filter((i) => i.type === "duplicate").length})
                      </Text>
                    </View>
                    {currentSched.issues.filter((i) => i.type === "duplicate").map((d, idx) => (
                      <View key={`${d.uid}-dup-${idx}`} style={st.issueItem}>
                        <Icon name="content-duplicate" size={16} color="#ff9f0a" />
                        <View style={{ flex: 1 }}>
                          <Text style={st.issueItemText}>{d.name}</Text>
                          <Text style={st.issueItemSub}>{d.location}</Text>
                        </View>
                        <Text style={[st.issueAction, { color: "#ff9f0a" }]}>Duplicate</Text>
                      </View>
                    ))}
                  </View>
                )}

                {currentSched.missingFromSchedule.length > 0 && (
                  <View style={st.issueSection}>
                    <View style={st.issueLabelRow}>
                      <Icon name="account-plus" size={16} color="#30d158" />
                      <Text style={st.issueLabel}>
                        Missing from schedule ({currentSched.missingFromSchedule.length})
                      </Text>
                    </View>
                    <Text style={st.issueDesc}>These deacons aren't anywhere in this week. Will be added to extras.</Text>
                    <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                      {currentSched.missingFromSchedule.map((m) => (
                        <View key={m.uid} style={st.issueItem}>
                          <Icon name="account-outline" size={16} color="#30d158" />
                          <Text style={st.issueItemText}>{m.name}</Text>
                          <Text style={st.issueAction}>→ extras</Text>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {error && <Text style={st.errorText}>{error}</Text>}

                <View style={st.actionRow}>
                  <TouchableOpacity style={st.secondaryBtn} onPress={skipScheduleFix}>
                    <Text style={st.secondaryBtnText}>Skip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.primaryBtn} onPress={applyScheduleFix} activeOpacity={0.8}>
                    <Icon name="check" size={18} color="#fff" />
                    <Text style={st.primaryBtnText}>Fix This Week</Text>
                  </TouchableOpacity>
                </View>

                {scheduleResults.length - currentScheduleIdx > 1 && (
                  <TouchableOpacity style={st.fixAllBtn} onPress={fixAllSchedules} activeOpacity={0.8}>
                    <Icon name="check-all" size={18} color="#147efb" />
                    <Text style={st.fixAllBtnText}>Fix all remaining weeks</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ── SCHEDULE FIXING ── */}
            {phase === PHASE.SCHEDULE_FIXING && (
              <View style={st.centeredSection}>
                <ActivityIndicator size="large" color="#30d158" />
                <Text style={st.scanningText}>Fixing schedule…</Text>
              </View>
            )}

            {/* ── DONE ── */}
            {phase === PHASE.DONE && (
              <View style={st.centeredSection}>
                <View style={[st.iconCircle, { backgroundColor: "rgba(48,209,88,0.1)" }]}>
                  <Icon name="check-circle-outline" size={32} color="#30d158" />
                </View>
                <Text style={st.title}>Sync Complete</Text>

                {fixLog.length > 0 && (
                  <View style={st.logSection}>
                    {fixLog.map((entry, i) => (
                      <View key={i} style={st.logItem}>
                        <Icon name="check" size={14} color="rgba(255,255,255,0.4)" />
                        <Text style={st.logText}>{entry}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity style={st.primaryBtn} onPress={handleClose} activeOpacity={0.8}>
                  <Text style={st.primaryBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#1a1a1a", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", minHeight: 300 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#fff" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center" },
  body: { padding: 20 },

  centeredSection: { alignItems: "center", paddingVertical: 24 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(20,126,251,0.1)", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "700", color: "#fff", marginBottom: 10, textAlign: "center" },
  desc: { fontSize: 14, color: "rgba(255,255,255,0.45)", textAlign: "center", lineHeight: 20, marginBottom: 24, paddingHorizontal: 8 },

  scanningText: { fontSize: 16, fontWeight: "600", color: "#fff", marginTop: 16 },
  scanningSubtext: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 6 },

  phaseHeader: { marginBottom: 20 },
  phaseBadge: { backgroundColor: "rgba(20,126,251,0.12)", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginBottom: 10 },
  phaseBadgeText: { fontSize: 11, fontWeight: "600", color: "#147efb", textTransform: "uppercase", letterSpacing: 0.5 },
  phaseTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  phaseDesc: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 },

  issueSection: { backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.04)" },
  issueLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  issueLabel: { fontSize: 14, fontWeight: "600", color: "#fff" },
  issueDesc: { fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 10 },

  issueItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.04)" },
  issueItemText: { flex: 1, fontSize: 14, color: "#fff" },
  issueItemSub: { fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 1 },
  issueAction: { fontSize: 12, fontWeight: "600", color: "#30d158" },

  actionRow: { flexDirection: "row", gap: 10, marginTop: 20, marginBottom: 10 },
  primaryBtn: { flex: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#147efb", paddingVertical: 16, borderRadius: 14 },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  secondaryBtn: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)", paddingVertical: 16, borderRadius: 14 },
  secondaryBtnText: { fontSize: 15, fontWeight: "600", color: "rgba(255,255,255,0.5)" },

  fixAllBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, marginTop: 4, marginBottom: 10 },
  fixAllBtnText: { fontSize: 14, fontWeight: "500", color: "#147efb" },

  errorText: { fontSize: 13, color: "#ff453a", textAlign: "center", marginVertical: 10 },

  logSection: { width: "100%", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 14, marginBottom: 20 },
  logItem: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 4 },
  logText: { fontSize: 13, color: "rgba(255,255,255,0.5)", flex: 1 },
});

export default DeaconSyncModal;