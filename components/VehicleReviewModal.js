/**
 * VehicleReviewModal
 *
 * For each driver in a review item:
 *   1. Auto-searches allUsers by name/phone and shows ranked candidates
 *   2. Admin taps the correct match or creates unreg
 *   3. Manual search available as fallback if auto-suggestions miss
 *   4. Auto-advances to next item after approve/delete
 */

import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, FlatList,
  TextInput, Alert, ActivityIndicator, ScrollView,
} from "react-native";
import { Image } from "expo-image";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { COLOR_OPTIONS } from "./TrafficVehicleComponents";
import { approveReviewItem, deleteReviewItem, resolveDriver } from "../utils/carsMigration";

const DEFAULT_PROFILE = require("../assets/default_profile.png");

// ── Fuzzy matching helpers ───────────────────────────────────────────────────

function normalizePhone(phone) {
  if (!phone) return "";
  return phone.replace(/[^\d]/g, "");
}

function normalizeStr(s) {
  return (s || "").trim().toLowerCase();
}

/**
 * Score a user against a driver entry. Higher = better match.
 * Returns 0 if no plausible match.
 */
function scoreMatch(user, driver) {
  if (typeof driver === "string") {
    // Raw uid — exact match only
    if (user.uid === driver) return 100;
    return 0;
  }

  let score = 0;
  const driverName = normalizeStr(driver.name);
  const driverPhone = normalizePhone(driver.phone);
  const userName = normalizeStr(user.name);
  const userPhone = normalizePhone(user.phone);

  // Phone match (strongest signal)
  if (driverPhone && userPhone) {
    if (userPhone === driverPhone) score += 60;
    else if (userPhone.endsWith(driverPhone) || driverPhone.endsWith(userPhone)) score += 40;
  }

  // Name match
  if (driverName && userName) {
    if (userName === driverName) {
      score += 50;
    } else {
      // Check first name match
      const dFirst = driverName.split(" ")[0];
      const uFirst = userName.split(" ")[0];
      if (dFirst && uFirst && dFirst === uFirst) score += 30;

      // Check last name match
      const dParts = driverName.split(" ");
      const uParts = userName.split(" ");
      if (dParts.length > 1 && uParts.length > 1) {
        const dLast = dParts[dParts.length - 1];
        const uLast = uParts[uParts.length - 1];
        if (dLast === uLast) score += 20;
      }

      // Substring / contains
      if (userName.includes(driverName) || driverName.includes(userName)) score += 15;
    }
  }

  // uid match
  if (driver.uid && user.uid === driver.uid) score += 100;

  return score;
}

/**
 * Rank all users by match score for a given driver.
 * Returns top N candidates with score > 0, plus an "exact" flag for auto-link.
 */
function findCandidates(driver, allUsers, maxResults = 5) {
  const scored = allUsers
    .map((u) => ({ user: u, score: scoreMatch(u, driver) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return scored;
}

// ── DriverResolutionRow ──────────────────────────────────────────────────────

const DriverResolutionRow = memo(({
  driver, index, resolved, allUsers, getImageSource,
  onLink, onCreateUnreg, onUnlink,
}) => {
  const [manualSearch, setManualSearch] = useState(false);
  const [search, setSearch] = useState("");

  const driverLabel = useMemo(() => {
    if (typeof driver === "string") return driver;
    const parts = [];
    if (driver.name) parts.push(driver.name);
    if (driver.phone) parts.push(driver.phone);
    if (!parts.length && driver.uid) parts.push(driver.uid);
    return parts.join(" · ") || "Unknown";
  }, [driver]);

  // Auto-suggested candidates
  const candidates = useMemo(
    () => findCandidates(driver, allUsers),
    [driver, allUsers]
  );

  // Manual search results (only when manual search is open)
  const manualResults = useMemo(() => {
    if (!manualSearch) return [];
    const q = normalizeStr(search);
    if (!q) return allUsers.slice(0, 15);
    return allUsers.filter(
      (u) =>
        normalizeStr(u.name).includes(q) ||
        normalizePhone(u.phone).includes(q) ||
        u.uid?.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [manualSearch, search, allUsers]);

  const linkedUser = useMemo(() => {
    if (!resolved) return null;
    return allUsers.find((u) => u.uid === resolved);
  }, [resolved, allUsers]);

  // ── Already linked ──
  if (resolved) {
    return (
      <View style={rs.linkedRow}>
        <Image
          source={linkedUser ? getImageSource(resolved) : DEFAULT_PROFILE}
          style={rs.avatar}
          contentFit="cover"
        />
        <View style={rs.rowInfo}>
          <Text style={rs.rowName}>{linkedUser?.name || "Linked"}</Text>
          <Text style={rs.rowSub}>
            {linkedUser?.phone || resolved}
            {resolved.startsWith("unreg_") ? " · No Account" : ""}
          </Text>
        </View>
        <View style={rs.linkedCheck}>
          <Icon name="check-circle" size={18} color="#34c759" />
        </View>
        <TouchableOpacity style={rs.unlinkBtn} onPress={() => onUnlink(index)}>
          <Icon name="close-circle" size={18} color="#ff453a" />
        </TouchableOpacity>
      </View>
    );
  }

  // ── Unresolved: show driver info + auto-suggestions ──
  return (
    <View style={rs.unresolvedBlock}>
      {/* Driver info header */}
      <View style={rs.driverHeader}>
        <View style={rs.avatarWarning}>
          <Icon name="account-question" size={18} color="#ff9f0a" />
        </View>
        <View style={rs.driverHeaderInfo}>
          <Text style={rs.driverHeaderName}>{driverLabel}</Text>
          <Text style={rs.driverHeaderSub}>Select the correct match</Text>
        </View>
        <TouchableOpacity
          style={rs.unregBtn}
          onPress={() => onCreateUnreg(index, driver)}
        >
          <Icon name="account-plus" size={15} color="#bf5af2" />
          <Text style={rs.unregBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Auto-suggested candidates */}
      {candidates.length > 0 && (
        <View style={rs.candidateList}>
          {candidates.map(({ user: u, score }) => (
            <TouchableOpacity
              key={u.uid}
              style={rs.candidateRow}
              onPress={() => onLink(index, u.uid)}
              activeOpacity={0.7}
            >
              <Image source={getImageSource(u.uid)} style={rs.candidateAvatar} contentFit="cover" />
              <View style={rs.candidateInfo}>
                <Text style={rs.candidateName}>{u.name}</Text>
                {u.phone ? <Text style={rs.candidatePhone}>{u.phone}</Text> : null}
              </View>
              {u.uid?.startsWith("unreg_") && (
                <View style={rs.unregBadge}>
                  <Text style={rs.unregBadgeText}>No Acct</Text>
                </View>
              )}
              <View style={[rs.scoreBadge, score >= 50 ? rs.scoreBadgeHigh : rs.scoreBadgeLow]}>
                <Text style={[rs.scoreBadgeText, score >= 50 ? rs.scoreBadgeTextHigh : rs.scoreBadgeTextLow]}>
                  {score >= 80 ? "Strong" : score >= 50 ? "Likely" : "Weak"}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color="rgba(255,255,255,0.2)" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* No auto-suggestions found */}
      {candidates.length === 0 && !manualSearch && (
        <View style={rs.noMatchBox}>
          <Icon name="magnify-close" size={16} color="rgba(255,255,255,0.25)" />
          <Text style={rs.noMatchText}>No auto-matches found</Text>
        </View>
      )}

      {/* Manual search toggle */}
      <TouchableOpacity
        style={rs.manualToggle}
        onPress={() => { setManualSearch(!manualSearch); setSearch(""); }}
        activeOpacity={0.7}
      >
        <Icon
          name={manualSearch ? "chevron-up" : "magnify"}
          size={15}
          color="#147efb"
        />
        <Text style={rs.manualToggleText}>
          {manualSearch ? "Hide search" : "Search manually"}
        </Text>
      </TouchableOpacity>

      {/* Manual search panel */}
      {manualSearch && (
        <View style={rs.searchPanel}>
          <View style={rs.searchBox}>
            <Icon name="magnify" size={16} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={rs.searchInput}
              placeholder="Name or phone..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Icon name="close-circle" size={14} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={manualResults}
            keyExtractor={(u) => u.uid}
            style={rs.searchResults}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            renderItem={({ item: u }) => (
              <TouchableOpacity
                style={rs.candidateRow}
                onPress={() => {
                  onLink(index, u.uid);
                  setManualSearch(false);
                  setSearch("");
                }}
                activeOpacity={0.7}
              >
                <Image source={getImageSource(u.uid)} style={rs.candidateAvatar} contentFit="cover" />
                <View style={rs.candidateInfo}>
                  <Text style={rs.candidateName}>{u.name}</Text>
                  {u.phone ? <Text style={rs.candidatePhone}>{u.phone}</Text> : null}
                </View>
                {u.uid?.startsWith("unreg_") && (
                  <View style={rs.unregBadge}>
                    <Text style={rs.unregBadgeText}>No Acct</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={rs.noResults}>No users found</Text>
            }
          />
        </View>
      )}
    </View>
  );
});

// ── Main modal ───────────────────────────────────────────────────────────────

const VehicleReviewModal = ({
  visible,
  reviewQueue,
  churchId,
  allUsers,
  getImageSource,
  onComplete,
  onItemResolved,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolvedDrivers, setResolvedDrivers] = useState([]);
  const [busy, setBusy] = useState(false);

  const item = reviewQueue[currentIndex] || null;

  // Reset resolved drivers when item changes
  useEffect(() => {
    if (!item) return;
    // Pre-resolve: if a driver is already a plain string uid, link it immediately
    const initial = (item.drivers || []).map((d) => {
      if (typeof d === "string") {
        // Verify it exists
        if (allUsers.some((u) => u.uid === d)) return d;
        if (d.startsWith("unreg_")) return d;
      }
      return null;
    });
    setResolvedDrivers(initial);
  }, [currentIndex, item?.id, allUsers]);

  const allResolved = useMemo(
    () => resolvedDrivers.length > 0 && resolvedDrivers.every((r) => r !== null),
    [resolvedDrivers]
  );

  const resolvedCount = useMemo(
    () => resolvedDrivers.filter(Boolean).length,
    [resolvedDrivers]
  );

  const remaining = reviewQueue.length - currentIndex;

  const handleLink = useCallback((driverIndex, uid) => {
    setResolvedDrivers((prev) => {
      const next = [...prev];
      next[driverIndex] = uid;
      return next;
    });
  }, []);

  const handleUnlink = useCallback((driverIndex) => {
    setResolvedDrivers((prev) => {
      const next = [...prev];
      next[driverIndex] = null;
      return next;
    });
  }, []);

  const handleCreateUnreg = useCallback(async (driverIndex, driver) => {
    const name = typeof driver === "object" ? driver.name : null;
    const phone = typeof driver === "object" ? driver.phone : null;

    if (!name && !phone) {
      Alert.alert("No Info", "This driver has no name or phone to create an entry from.");
      return;
    }

    setBusy(true);
    try {
      const unregUsers = allUsers.filter((u) => u.uid?.startsWith("unreg_"));
      const uid = await resolveDriver(driver, allUsers, unregUsers, churchId);
      if (uid) {
        setResolvedDrivers((prev) => {
          const next = [...prev];
          next[driverIndex] = uid;
          return next;
        });
      }
    } catch (e) {
      Alert.alert("Error", "Failed to create unregistered user.");
    }
    setBusy(false);
  }, [allUsers, churchId]);

  const advance = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= reviewQueue.length) {
      onComplete?.();
    } else {
      setCurrentIndex(nextIndex);
    }
  }, [currentIndex, reviewQueue.length, onComplete]);

  const handleApprove = useCallback(async () => {
    if (!item) return;
    const ownerIds = resolvedDrivers.filter(Boolean);
    if (ownerIds.length === 0) {
      Alert.alert("No Drivers", "Link at least one driver before approving.");
      return;
    }

    setBusy(true);
    try {
      await approveReviewItem(churchId, item, ownerIds);
      onItemResolved?.(item, "approved");
      advance();
    } catch (e) {
      Alert.alert("Error", `Failed to approve: ${e.message}`);
    }
    setBusy(false);
  }, [item, resolvedDrivers, churchId, advance, onItemResolved]);

  const handleDelete = useCallback(() => {
    if (!item) return;
    const label = item.source === "malformed_car"
      ? "Delete this car"
      : "Reject this registration";
    Alert.alert(label + "?", `${item.license || "This vehicle"} will be permanently removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await deleteReviewItem(item);
            onItemResolved?.(item, "deleted");
            advance();
          } catch (e) {
            Alert.alert("Error", "Failed to delete.");
          }
          setBusy(false);
        },
      },
    ]);
  }, [item, advance, onItemResolved]);

  if (!visible || !item) return null;

  const colorObj = COLOR_OPTIONS.find((c) => c.value === item.color);
  const sourceLabel = item.source === "malformed_car"
    ? "Needs Fix — drivers not linked"
    : "Pending Registration";

  return (
    <Modal visible animationType="slide" transparent onRequestClose={() => {}}>
      <View style={ms.overlay}>
        <View style={ms.sheet}>
          {/* Header */}
          <View style={ms.header}>
            <View style={ms.headerLeft}>
              <View style={[
                ms.sourceBadge,
                item.source === "malformed_car" ? ms.sourceBadgeMalformed : ms.sourceBadgePending,
              ]}>
                <Icon
                  name={item.source === "malformed_car" ? "alert-circle" : "clock-outline"}
                  size={12}
                  color={item.source === "malformed_car" ? "#ff9f0a" : "#147efb"}
                />
                <Text style={[
                  ms.sourceBadgeText,
                  { color: item.source === "malformed_car" ? "#ff9f0a" : "#147efb" },
                ]}>{sourceLabel}</Text>
              </View>
              <Text style={ms.counter}>{remaining} remaining</Text>
            </View>
          </View>

          {/* Vehicle info */}
          <View style={ms.vehicleSection}>
            <View style={ms.plateRow}>
              <Icon name="car" size={20} color="#147efb" />
              <Text style={ms.plateText}>{item.license || "NO PLATE"}</Text>
            </View>
            {(item.make || item.model || item.color) && (
              <View style={ms.metaRow}>
                {colorObj && <View style={[ms.colorDot, { backgroundColor: colorObj.hex }]} />}
                <Text style={ms.metaText}>
                  {[colorObj?.label, item.make, item.model].filter(Boolean).join(" ")}
                </Text>
              </View>
            )}
          </View>

          {/* Driver resolution */}
          <Text style={ms.sectionLabel}>
            Drivers ({resolvedCount}/{(item.drivers || []).length} linked)
          </Text>

          <ScrollView
            style={ms.driverList}
            contentContainerStyle={ms.driverListContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {(item.drivers || []).map((driver, index) => (
              <DriverResolutionRow
                key={index}
                driver={driver}
                index={index}
                resolved={resolvedDrivers[index]}
                allUsers={allUsers}
                getImageSource={getImageSource}
                onLink={handleLink}
                onCreateUnreg={handleCreateUnreg}
                onUnlink={handleUnlink}
              />
            ))}
            {(item.drivers || []).length === 0 && (
              <View style={ms.emptyDrivers}>
                <Icon name="account-off" size={24} color="rgba(255,255,255,0.2)" />
                <Text style={ms.emptyDriversText}>No drivers listed</Text>
              </View>
            )}
          </ScrollView>

          {/* Actions */}
          <View style={ms.footer}>
            {busy ? (
              <ActivityIndicator size="small" color="#147efb" style={{ paddingVertical: 16 }} />
            ) : (
              <>
                <TouchableOpacity
                  style={[ms.approveBtn, !allResolved && ms.approveBtnDisabled]}
                  onPress={handleApprove}
                  disabled={!allResolved}
                  activeOpacity={0.8}
                >
                  <Icon name="check" size={18} color="#fff" />
                  <Text style={ms.approveBtnText}>
                    {item.source === "malformed_car" ? "Fix & Save" : "Approve"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={ms.deleteBtn} onPress={handleDelete} activeOpacity={0.8}>
                  <Icon name="trash-can-outline" size={18} color="#ff453a" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#1a1a1a", borderTopLeftRadius: 22, borderTopRightRadius: 22,
    maxHeight: "92%", paddingBottom: 40,
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  headerLeft: { flex: 1 },
  sourceBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: "flex-start",
  },
  sourceBadgeMalformed: { backgroundColor: "rgba(255,159,10,0.12)" },
  sourceBadgePending: { backgroundColor: "rgba(20,126,251,0.12)" },
  sourceBadgeText: { fontSize: 12, fontWeight: "600" },
  counter: { fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 6 },
  vehicleSection: { paddingHorizontal: 20, paddingBottom: 16 },
  plateRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(20,126,251,0.08)", padding: 14, borderRadius: 12,
  },
  plateText: { fontSize: 22, fontWeight: "700", color: "#fff", letterSpacing: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  colorDot: {
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  metaText: { fontSize: 14, color: "rgba(255,255,255,0.5)" },
  sectionLabel: {
    fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase", letterSpacing: 0.5,
    paddingHorizontal: 20, marginBottom: 10,
  },
  driverList: { flexGrow: 0, maxHeight: 420 },
  driverListContent: { paddingHorizontal: 20, paddingBottom: 8 },
  emptyDrivers: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyDriversText: { fontSize: 14, color: "rgba(255,255,255,0.3)" },
  footer: {
    flexDirection: "row", paddingHorizontal: 20, paddingTop: 16, gap: 10,
  },
  approveBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#34c759", paddingVertical: 16, borderRadius: 14, gap: 8,
  },
  approveBtnDisabled: { backgroundColor: "rgba(52,199,89,0.3)" },
  approveBtnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  deleteBtn: {
    width: 54, height: 54, borderRadius: 14,
    backgroundColor: "rgba(255,69,58,0.12)",
    justifyContent: "center", alignItems: "center",
  },
});

const rs = StyleSheet.create({
  // ── Linked state ──
  linkedRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(52,199,89,0.06)", padding: 12, borderRadius: 12,
    marginBottom: 10, borderWidth: 1, borderColor: "rgba(52,199,89,0.15)",
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  rowInfo: { flex: 1, marginLeft: 12 },
  rowName: { fontSize: 15, fontWeight: "500", color: "#fff" },
  rowSub: { fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 1 },
  linkedCheck: { marginRight: 8 },
  unlinkBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: "rgba(255,69,58,0.1)", justifyContent: "center", alignItems: "center",
  },

  // ── Unresolved state ──
  unresolvedBlock: {
    backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 14,
    marginBottom: 10, borderWidth: 1, borderColor: "rgba(255,159,10,0.15)",
    overflow: "hidden",
  },
  driverHeader: {
    flexDirection: "row", alignItems: "center", padding: 12, gap: 10,
  },
  avatarWarning: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,159,10,0.12)", justifyContent: "center", alignItems: "center",
  },
  driverHeaderInfo: { flex: 1 },
  driverHeaderName: { fontSize: 15, fontWeight: "600", color: "#fff" },
  driverHeaderSub: { fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 1 },
  unregBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(191,90,242,0.12)", paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 8,
  },
  unregBtnText: { fontSize: 12, fontWeight: "600", color: "#bf5af2" },

  // ── Auto-suggested candidates ──
  candidateList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  candidateRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  candidateAvatar: { width: 34, height: 34, borderRadius: 17 },
  candidateInfo: { flex: 1, marginLeft: 10 },
  candidateName: { fontSize: 14, fontWeight: "500", color: "#fff" },
  candidatePhone: { fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 1 },
  unregBadge: {
    backgroundColor: "rgba(255,159,10,0.15)", paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 4, marginRight: 6,
  },
  unregBadgeText: { fontSize: 9, fontWeight: "600", color: "#ff9f0a" },
  scoreBadge: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, marginRight: 6,
  },
  scoreBadgeHigh: { backgroundColor: "rgba(52,199,89,0.12)" },
  scoreBadgeLow: { backgroundColor: "rgba(255,255,255,0.06)" },
  scoreBadgeText: { fontSize: 10, fontWeight: "600" },
  scoreBadgeTextHigh: { color: "#34c759" },
  scoreBadgeTextLow: { color: "rgba(255,255,255,0.35)" },

  // ── No match ──
  noMatchBox: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  noMatchText: { fontSize: 13, color: "rgba(255,255,255,0.25)" },

  // ── Manual search toggle ──
  manualToggle: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  manualToggleText: { fontSize: 13, fontWeight: "500", color: "#147efb" },

  // ── Manual search panel ──
  searchPanel: {
    paddingHorizontal: 12, paddingBottom: 10,
  },
  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 8, paddingHorizontal: 10,
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 14, paddingVertical: 10, marginLeft: 6 },
  searchResults: { maxHeight: 160, marginTop: 6 },
  noResults: {
    fontSize: 13, color: "rgba(255,255,255,0.25)", textAlign: "center", paddingVertical: 16,
  },
});

export default VehicleReviewModal;