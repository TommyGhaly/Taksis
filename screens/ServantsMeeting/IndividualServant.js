import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  TextInput,
  Dimensions,
  Platform,
} from "react-native";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
} from "@react-native-firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytes,
} from "@react-native-firebase/storage";
import { Ionicons } from "@expo/vector-icons";
import BackArrow from "../../components/backArrow";
import Avatar from "../../components/Avatar";
import SkeletonScreen, { SkeletonPersonList } from "../../components/Skeleton";
import * as avatarCache from "../../utils/avatarCache";
import { LIST_PERF, LIST_KEYBOARD } from "../../utils/listConfig";
import { dateKeyToSortable } from "../../utils/dateKeys";

const { height } = Dimensions.get("window");

// ── Helpers ───────────────────────────────────────────────────────────────────

const isManual = (uid) => typeof uid === "string" && uid.startsWith("manual_");

/**
 * One attendance record.
 *
 * The history used to be a ScrollView + `.map()` with `key={index}`, so every
 * record ever written for this servant was mounted at once — an unbounded list
 * that grows by one row per week forever. It is a FlatList now.
 */
const AttendanceHistoryRow = React.memo(({ date, status }) => (
  <View style={styles.attendanceItem}>
    <Text style={styles.dateText}>{date}</Text>
    <View
      style={[
        styles.statusContainer,
        status === false
          ? styles.absent
          : status === true
          ? styles.present
          : styles.unrecorded,
      ]}
    >
      <Text style={styles.statusText}>
        {status === true ? "Present" : status === false ? "Absent" : "No Status"}
      </Text>
    </View>
  </View>
));
AttendanceHistoryRow.displayName = "AttendanceHistoryRow";

const renderAttendanceRow = ({ item }) => (
  <AttendanceHistoryRow date={item.date} status={item.status} />
);
const attendanceKeyExtractor = (item) => item.date;
const EmptyAttendance = () => (
  <Text style={styles.emptyText}>No attendance records yet.</Text>
);

/**
 * One candidate in the "sync to app account" picker. Memoized because it mounts an
 * <Avatar>, which carries a useSyncExternalStore subscription plus two effects —
 * as an inline renderItem it was rebuilding all of that for every mounted row on
 * every keystroke in the search field above it.
 */
const SyncUserRow = React.memo(({ user, syncing, onPress }) => (
  <TouchableOpacity
    style={styles.syncUserRow}
    onPress={() => onPress(user)}
    activeOpacity={0.75}
    disabled={syncing}
  >
    <Avatar
      uid={user.uid}
      user={user}
      size={40}
      showBorder={false}
      style={styles.syncUserAvatar}
    />
    <View style={styles.syncUserNameWrap}>
      <Text style={styles.syncUserName}>{user.name}</Text>
    </View>
    {syncing ? (
      <ActivityIndicator size="small" color="#147efb" />
    ) : (
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" />
    )}
  </TouchableOpacity>
));
SyncUserRow.displayName = "SyncUserRow";

const syncUserKeyExtractor = (u) => u.uid;
const SyncSeparator = () => <View style={styles.syncSep} />;
const EmptySyncUsers = () => (
  <Text style={styles.syncEmpty}>No users found.</Text>
);

// ── Merge helper (same logic as ServantsAttendance) ───────────────────────────

async function mergeManualIntoReal(church, manualServant, realUID) {
  const collRef = collection(getFirestore(), "churches", church, "Servants Meeting");

  const manualDocRef = doc(collRef, manualServant.uid);
  const realDocRef = doc(collRef, realUID);

  // Build attendance map — skip metadata fields
  const SKIP = new Set(["name", "uid", "manual", "phone"]);
  const manualAttendance = {};
  for (const [k, v] of Object.entries(manualServant)) {
    if (!SKIP.has(k)) manualAttendance[k] = v;
  }

  // Real doc wins on conflict
  const realSnap = await getDoc(realDocRef);
  const realData = realSnap.exists ? realSnap.data() : {};
  const merged = { ...manualAttendance, ...realData };

  // Get real user's name
  let realName = realData.name || "";
  if (!realName) {
    try {
      const userSnap = await getDoc(doc(getFirestore(), "users", realUID));
      if (userSnap.exists) realName = userSnap.data()?.name || "";
    } catch {}
  }

  await setDoc(realDocRef, { ...merged, uid: realUID, name: realName }, { merge: true });

  // ── Profile photo ──
  const manualPhotoRef = ref(getStorage(), `profilePictures/${manualServant.uid}.png`);
  const realPhotoRef = ref(getStorage(), `profilePictures/${realUID}.png`);

  let realHasPhoto = false;
  try { await getDownloadURL(realPhotoRef); realHasPhoto = true; } catch {}

  let manualHasPhoto = false;
  try { await getDownloadURL(manualPhotoRef); manualHasPhoto = true; } catch {}

  if (manualHasPhoto) {
    if (!realHasPhoto) {
      try {
        const url = await getDownloadURL(manualPhotoRef);
        const response = await fetch(url);
        const blob = await response.blob();
        await uploadBytes(realPhotoRef, blob);
        // This uid was cached as "no photo"; drop it so the copy is picked up.
        await avatarCache.invalidate(realUID);
      } catch (e) { console.warn("Photo copy failed:", e); }
    }
    try { await deleteObject(manualPhotoRef); } catch {}
    await avatarCache.invalidate(manualServant.uid);
  }

  await deleteDoc(manualDocRef);
}

// ── Component ─────────────────────────────────────────────────────────────────

const IndividualServant = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { church, servantID } = route.params;

  const [attendanceData, setAttendanceData] = useState([]);
  const [servantName, setServantName] = useState("");
  const [servantPhone, setServantPhone] = useState("");
  const [servantRaw, setServantRaw] = useState(null); // full doc data for merge
  const [loading, setLoading] = useState(true);
  const manual = isManual(servantID);

  // Sync state
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [allChurchUsers, setAllChurchUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setAttendanceData([]);
      setServantName("");
      setServantPhone("");
      setServantRaw(null);
      setLoading(true);

      let unsub = null;

      unsub = onSnapshot(
        doc(getFirestore(), "churches", church, "Servants Meeting", servantID),
        (doc) => {
          try {
            if (doc.exists) {
              const data = doc.data();
              setServantName(data.name || "");
              setServantPhone(data.phone || "");
              setServantRaw({ uid: servantID, ...data });

              const attendance = [];
              for (const [key, value] of Object.entries(data)) {
                if (!["name", "uid", "manual", "phone"].includes(key)) {
                  attendance.push({ date: key, status: value });
                }
              }
              setAttendanceData(attendance);

              // Priming is free and idempotent, so it is safe to run on every
              // snapshot. The old code did a getDownloadURL() here, which meant
              // every attendance toggle (a doc write re-triggers this snapshot)
              // refetched the photo over the network. <Avatar> now resolves the
              // URL once, outside this callback, and caches it.
              avatarCache.primeFromUser({ uid: servantID, ...data });
            } else {
              setServantName(""); setAttendanceData([]);
            }
            setLoading(false);
          } catch {
            Alert.alert("Error", "Failed to fetch data. Please try again.");
            setLoading(false);
          }
        },
        () => { Alert.alert("Error", "Failed to fetch data."); setLoading(false); }
      );

      return () => { if (unsub) unsub(); };
    }, [church, servantID])
  );

  // Sorted on an integer date key; the old comparator allocated two Date objects
  // per comparison via `parseDate`.
  const sortedAttendance = useMemo(
    () =>
      attendanceData
        .map((a) => ({ ...a, sortKey: dateKeyToSortable(a.date) }))
        .sort((a, b) => b.sortKey - a.sortKey),
    [attendanceData]
  );

  // ── Sync ──────────────────────────────────────────────────────────────────

  const openSyncModal = async () => {
    setUserSearchQuery("");
    setLoadingUsers(true);
    setSyncModalVisible(true);
    try {
      const snap = await getDocs(
        collection(getFirestore(), "churches", church, "Servants Meeting")
      );
      const servants = snap.docs
        .filter((d) => !d.id.startsWith("manual_"))
        .map((d) => ({ uid: d.id, ...d.data() }));
      setAllChurchUsers(servants);

      // Free: adopt any photoURL already on the docs we just read. Anything
      // still missing is resolved once by <Avatar> and cached from then on.
      avatarCache.primeMany(servants);
    } catch {
      Alert.alert("Error", "Failed to load servants.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    if (!q) return allChurchUsers;
    return allChurchUsers.filter((u) => (u.name || "").toLowerCase().includes(q));
  }, [allChurchUsers, userSearchQuery]);

  const handleSyncConfirm = useCallback((realUser) => {
    Alert.alert(
      "Sync to Account",
      `Merge "${servantName}" into ${realUser.name}'s account?\n\nTheir existing attendance records will take priority. This manual entry will be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sync",
          onPress: async () => {
            setSyncing(true);
            try {
              await mergeManualIntoReal(church, servantRaw, realUser.uid);
              setSyncModalVisible(false);
              Alert.alert(
                "Synced",
                `${servantName} has been merged into ${realUser.name}'s account.`,
                [{ text: "OK", onPress: () => navigation.goBack() }]
              );
            } catch (e) {
              Alert.alert("Sync failed", e.message);
            } finally {
              setSyncing(false);
            }
          },
        },
      ]
    );
  }, [church, servantRaw, servantName, navigation]);

  const renderSyncUser = useCallback(
    ({ item }) => (
      <SyncUserRow user={item} syncing={syncing} onPress={handleSyncConfirm} />
    ),
    [syncing, handleSyncConfirm]
  );

  // ── Remove ────────────────────────────────────────────────────────────────

  const handleDelete = () => {
    Alert.alert(
      "Confirm Removal",
      `Are you sure you want to remove ${servantName} from Servants Meeting?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(
                doc(getFirestore(), "churches", church, "Servants Meeting", servantID)
              );

              // Only delete the stored photo for MANUAL servants. The manual
              // photo lives solely at profilePictures/{manual_id}.png and is
              // referenced nowhere else, so removing the servant should clean
              // it up. For real users, profilePictures/{uid}.png is their
              // app-wide profile picture and must NOT be deleted just because
              // they were taken off this list.
              if (manual) {
                try {
                  await avatarCache.removePhoto(servantID);
                } catch {}
              }

              if (!manual) {
                // Offer to revoke role only for real users
                Alert.alert(
                  "Revoke Role",
                  `Would you also like to revoke ${servantName}'s Sunday School Teacher role?`,
                  [
                    {
                      text: "No, Keep Role",
                      style: "cancel",
                      onPress: () => navigation.goBack(),
                    },
                    {
                      text: "Yes, Revoke Role",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          await updateDoc(doc(getFirestore(), "users", servantID), { isSSTeacher: false });
                        } catch {}
                        navigation.goBack();
                      },
                    },
                  ]
                );
              } else {
                Alert.alert("Removed", `${servantName} has been removed.`, [
                  { text: "OK", onPress: () => navigation.goBack() },
                ]);
              }
            } catch {
              Alert.alert("Error", "Failed to remove servant. Please try again.");
            }
          },
        },
      ]
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    // Single-servant detail: avatar, name, then the attendance rows.
    return <SkeletonScreen variant="profile" showHeader={false} />;
  }

  return (
    <View style={styles.container}>
      <BackArrow style={styles.backArrow} onPress={() => navigation.goBack()} />

      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={styles.title}>{servantName}</Text>
        {manual && (
          <View style={styles.manualBadgeRow}>
            <View style={styles.manualBadge}>
              <Ionicons name="person-outline" size={11} color="#ff9500" />
              <Text style={styles.manualBadgeText}>Manual Entry</Text>
            </View>
          </View>
        )}
        <View style={styles.profileContainer}>
          <Avatar
            uid={servantID}
            size={100}
            finalSize={300}
            borderRadius={50}
            expandable
            style={styles.profilePicture}
          />
        </View>
        {!manual && (
          <Text style={styles.subtitle}>Servants Meeting</Text>
        )}
      </View>

      {/* Attendance list */}
      <FlatList
        {...LIST_PERF}
        data={sortedAttendance}
        keyExtractor={attendanceKeyExtractor}
        renderItem={renderAttendanceRow}
        ListEmptyComponent={EmptyAttendance}
        style={styles.attendanceList}
        contentContainerStyle={styles.attendanceContainer}
      />

      {/* Actions */}
      <View style={styles.actionArea}>
        {manual && (
          <TouchableOpacity style={styles.syncButton} onPress={openSyncModal} activeOpacity={0.8}>
            <Ionicons name="link-outline" size={18} color="#fff" />
            <Text style={styles.syncButtonText}>Sync to App Account</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.removeButton} onPress={handleDelete} activeOpacity={0.8}>
          <Text style={styles.removeButtonText}>Remove Servant</Text>
        </TouchableOpacity>
      </View>

      {/* Sync bottom sheet */}
      <Modal
        visible={syncModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSyncModalVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetDismiss} activeOpacity={1} onPress={() => setSyncModalVisible(false)} />
          <View style={[styles.sheet, { height: height * 0.65 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Sync to Account</Text>
                <Text style={styles.sheetSubtitle}>Search for "{servantName}" in the app</Text>
              </View>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setSyncModalVisible(false)}>
                <Text style={styles.sheetCloseX}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.syncSearchWrap}>
              <Ionicons name="search" size={15} color="rgba(255,255,255,0.4)" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.syncSearchInput}
                placeholder="Search by name"
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={userSearchQuery}
                onChangeText={setUserSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
                autoFocus
              />
            </View>

            {loadingUsers ? (
              <View style={styles.syncSkeleton}>
                <SkeletonPersonList count={6} avatarSize={40} />
              </View>
            ) : (
              <FlatList
                {...LIST_PERF}
                {...LIST_KEYBOARD}
                data={filteredUsers}
                keyExtractor={syncUserKeyExtractor}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.syncListContent}
                ListEmptyComponent={EmptySyncUsers}
                renderItem={renderSyncUser}
                ItemSeparatorComponent={SyncSeparator}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: "#121212", padding: 20, paddingBottom: 40, justifyContent: "center",
  },
  backArrow: { position: "absolute", top: 50, left: 16 },

  headerSection: {
    alignItems: "center", marginBottom: 20, marginTop: 10, width: "100%", paddingHorizontal: 20,
  },
  profileContainer: { alignItems: "center", marginVertical: 10 },
  profilePicture: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, borderColor: "#ffffff" },
  title: { fontSize: 26, fontWeight: "bold", color: "#fff", textAlign: "center", marginBottom: 6, paddingHorizontal: 10 },
  subtitle: { fontSize: 16, color: "#b0b0b0", textAlign: "center", marginTop: 4 },

  manualBadgeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  manualBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,149,0,0.12)", borderRadius: 6,
    paddingHorizontal: 9, paddingVertical: 4,
    borderWidth: 1, borderColor: "rgba(255,149,0,0.25)",
  },
  manualBadgeText: { fontSize: 11, fontWeight: "700", color: "#ff9500", textTransform: "uppercase", letterSpacing: 0.3 },
  manualPhone: { fontSize: 13, color: "rgba(255,255,255,0.45)" },

  // The list sits between a fixed header block and `actionArea`, so it needs to
  // claim the space between them — a FlatList won't grow into it the way the
  // ScrollView's `flexGrow` contentContainer did.
  attendanceList: { flex: 1 },
  attendanceContainer: { flexGrow: 1, paddingBottom: 16 },
  emptyText: { color: "rgba(255,255,255,0.35)", textAlign: "center", marginTop: 32, fontSize: 14 },
  attendanceItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12, marginBottom: 10,
    borderBottomWidth: 1, borderBottomColor: "#333",
  },
  dateText: { fontSize: 16, color: "#fff" },
  statusContainer: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 10, paddingHorizontal: 18, borderRadius: 8, minWidth: 110,
  },
  statusText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  present: { backgroundColor: "#147efb", borderColor: "#0f64d2", borderWidth: 1 },
  absent: { backgroundColor: "#ff3b30", borderColor: "#cc2f26", borderWidth: 1 },
  unrecorded: { backgroundColor: "rgba(255,255,255,0.08)" },

  actionArea: { gap: 10, paddingTop: 8 },
  syncButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#147efb", borderRadius: 14, paddingVertical: 15,
  },
  syncButtonText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  removeButton: { paddingVertical: 14, alignItems: "center" },
  removeButtonText: { fontSize: 16, fontWeight: "600", color: "#ff3b30" },

  // Sync sheet
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheetDismiss: { flex: 1 },
  sheet: {
    backgroundColor: "#1a1a1a", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginTop: 10, marginBottom: 4 },
  sheetHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
  },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  sheetSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  sheetClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  sheetCloseX: { color: "rgba(255,255,255,0.6)", fontSize: 20, fontWeight: "300", marginTop: -1 },

  syncSearchWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12,
    marginHorizontal: 16, marginVertical: 12,
    paddingHorizontal: 12, height: 44,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  syncSearchInput: { flex: 1, color: "#fff", fontSize: 15, paddingVertical: 0 },
  syncSkeleton: { flex: 1, paddingHorizontal: 16 },
  syncEmpty: { color: "rgba(255,255,255,0.35)", textAlign: "center", fontSize: 14, paddingVertical: 32 },
  syncUserRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  syncUserAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.06)" },
  syncUserName: { color: "#fff", fontSize: 15, fontWeight: "600" },
  syncUserPhone: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 },
  syncSep: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.06)", marginHorizontal: 16 },
  // Hoisted out of the JSX, where they were fresh object literals every render.
  syncListContent: { paddingBottom: 24 },
  syncUserNameWrap: { flex: 1 },
});

export default IndividualServant;