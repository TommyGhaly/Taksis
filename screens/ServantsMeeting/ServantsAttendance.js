import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  SectionList,
  Dimensions,
  Platform,
  Modal,
  FlatList,
  TextInput,
  Keyboard,
  Animated,
  ScrollView,
  RefreshControl,
  PixelRatio,
} from "react-native";
import { BlurView } from "expo-blur";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import storage from "@react-native-firebase/storage";
import * as Haptics from "react-native-haptic-feedback";
import { Ionicons } from "@expo/vector-icons";
import AlphabetIndexBar from "../../components/AlphabetIndexBar";
import { makeScreenCache } from "../../utils/screenCache";
import { LIST_PERF, REMOVE_CLIPPED_ANDROID_ONLY } from "../../utils/listConfig";
import {
  makeSectionListGetItemLayout,
  makeRowHeightAudit,
} from "../../utils/sectionListLayout";
import { shortDateLabel } from "../../utils/dateKeys";
import PhotoInput from "../../components/photoInput"; // reuse existing photo picker
import Avatar from "../../components/Avatar";
import * as avatarCache from "../../utils/avatarCache";
import SkeletonScreen from "../../components/Skeleton";
import useAfterInteractions from "../../hooks/useAfterInteractions";

// ── Cache ─────────────────────────────────────────────────────────────────────

const CacheUtils = makeScreenCache();

// ── Constants ─────────────────────────────────────────────────────────────────

const { width, height } = Dimensions.get("window");
const isTablet = Platform.isPad || (width >= 768 && height >= 768);
const scale = isTablet ? 1.2 : 1;

// ---------- Fixed row metrics ----------
//
// Note this screen mixes scaled and unscaled dimensions: `sectionHeader` uses
// `paddingVertical: 8 * scale` but `sectionHeaderText` is a bare `fontSize: 22`.
// HDR_H below has to mirror that mix — it is not a scale bug to be tidied here.
//
// SERVANT_HEADER_H is pinned because that row's tallest child is a chevron
// glyph, whose box JS cannot compute; the name line and the "Manual" badge both
// sit under it. The line heights are explicit for the same reason a Text without
// one gets the font's natural line box, which is also not computable.
const SERVANT_HEADER_H = 24;
const NAME_LINE = 20;
const STATUS_LINE = 18;
const HEADER_LINE = 26;

// RN scales a declared lineHeight by the OS font scale (allowFontScaling defaults
// to on), so the height arithmetic has to scale it too or every constant below is
// wrong for anyone using large text.
const FONT_SCALE = PixelRatio.getFontScale();
const LH = (v) => v * FONT_SCALE;

// servantCard: 1px border top and bottom, 16 padding all round, then the taller
// of the avatar and the details column, then its own margin.
//
// The two isPastDate branches are height-identical — a status pill and a pair of
// buttons both being marginTop 14 + paddingVertical 14 + a 15pt line — so one
// constant covers both and the row does not change height when the week does.
const ATTENDANCE_BLOCK_H = 14 + 28 + LH(STATUS_LINE);
const SERVANT_DETAILS_H = SERVANT_HEADER_H + ATTENDANCE_BLOCK_H;
const ROW_H = 2 + 32 + Math.max(48, SERVANT_DETAILS_H) + 12;
// Note the mix: sectionHeader's padding scales with device class but
// sectionHeaderText's font size does not. That is the existing styling, mirrored.
const HDR_H = 16 * scale + LH(HEADER_LINE);

const getItemLayout = makeSectionListGetItemLayout({
  getItemHeight: () => ROW_H,
  getSectionHeaderHeight: () => HDR_H,
});

const auditServantRow = makeRowHeightAudit("ServantRow", ROW_H, 12);

const isManual = (uid) => typeof uid === "string" && uid.startsWith("manual_");

// ── Date helpers ──────────────────────────────────────────────────────────────

const formatDate = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
};

const getNextSunday = () => {
  const today = new Date();
  const currentDay = today.getDay();
  if (currentDay === 0) return formatDate(today);
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + (7 - currentDay));
  return formatDate(nextSunday);
};


// ── Merge logic ───────────────────────────────────────────────────────────────

async function mergeManualIntoReal(church, manualServant, realUID) {
  const collRef = firestore()
    .collection("churches")
    .doc(church)
    .collection("Servants Meeting");

  const manualDocRef = collRef.doc(manualServant.uid);
  const realDocRef = collRef.doc(realUID);

  // Build attendance map from manual doc (exclude metadata fields)
  const SKIP = new Set(["name", "uid", "manual", "phone"]);
  const manualAttendance = {};
  for (const [k, v] of Object.entries(manualServant)) {
    if (!SKIP.has(k)) manualAttendance[k] = v;
  }

  // Get real doc (may not exist yet)
  const realSnap = await realDocRef.get();
  const realData = realSnap.exists ? realSnap.data() : {};

  // Merge: real account wins on conflict
  const merged = { ...manualAttendance, ...realData };

  // Fetch real user's name from users collection
  let realName = realData.name || "";
  if (!realName) {
    try {
      const userSnap = await firestore().collection("users").doc(realUID).get();
      if (userSnap.exists) realName = userSnap.data()?.name || "";
    } catch {}
  }

  // Write merged doc under real UID
  await realDocRef.set({ ...merged, uid: realUID, name: realName }, { merge: true });

  // ── Profile photo merge ──
  const manualPhotoRef = storage().ref(`profilePictures/${manualServant.uid}.png`);
  const realPhotoRef = storage().ref(`profilePictures/${realUID}.png`);

  let realHasPhoto = false;
  try {
    await realPhotoRef.getDownloadURL();
    realHasPhoto = true;
  } catch {}

  let manualHasPhoto = false;
  try {
    await manualPhotoRef.getDownloadURL();
    manualHasPhoto = true;
  } catch {}

  if (manualHasPhoto) {
    if (!realHasPhoto) {
      // Download manual photo bytes and upload under real UID
      try {
        const url = await manualPhotoRef.getDownloadURL();
        const response = await fetch(url);
        const blob = await response.blob();
        await realPhotoRef.put(blob);
      } catch (e) {
        console.warn("Photo copy failed:", e);
      }
    }
    // Always delete the manual photo regardless
    try { await manualPhotoRef.delete(); } catch {}
  }

  // Delete manual doc
  await manualDocRef.delete();
}

// ── Main screen ───────────────────────────────────────────────────────────────

/**
 * One servant row, memoized.
 *
 * This was an inline closure returned from a `useMemo`. VirtualizedList's
 * CellRenderer is not memoized against parent re-renders, so every parent render
 * re-ran it for *every* mounted cell — each rebuilding an <Avatar> (which carries
 * a useSyncExternalStore subscription plus two effects) and three
 * TouchableOpacity trees. With windowSize at its default 21 that is ~150 live
 * cells rebuilt on every state change, including every attendance write.
 */
const ServantRow = React.memo(({ servant, isPastDate, isNavigating, onOpen, onAttendance }) => {
  const manual = isManual(servant.uid);
  const status = servant.attendance;

  return (
    <View style={styles.servantCard} onLayout={auditServantRow}>
      <View style={styles.servantInfo}>
        <Avatar
          uid={servant.uid}
          user={servant}
          size={48}
          borderRadius={24}
          style={styles.servantImage}
          showBorder={false}
          onPress={() => onOpen(servant)}
        />
        <View style={styles.servantDetails}>
          <TouchableOpacity
            style={styles.servantHeader}
            activeOpacity={0.7}
            onPress={() => onOpen(servant)}
            disabled={isNavigating}
          >
            <View style={styles.servantNameRow}>
              {/* Capped to one line so the card height is a constant. See ROW_H. */}
              <Text style={styles.servantName} numberOfLines={1}>
                {servant.name}
              </Text>
              {manual && (
                <View style={styles.manualBadge}>
                  <Text style={styles.manualBadgeText}>Manual</Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>

          {isPastDate ? (
            <View style={styles.attendanceStatusContainer}>
              <View style={[styles.attendanceStatus, {
                backgroundColor: status === true ? "#147EFB" : status === false ? "#ff3b30" : "rgba(255,255,255,0.1)",
              }]}>
                <Text style={styles.attendanceStatusText}>
                  {status === true ? "Present" : status === false ? "Absent" : "Not Recorded"}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.attendanceButtons}>
              <TouchableOpacity
                style={[styles.attendanceButton, { backgroundColor: status === false ? "#ff3b30" : "rgba(255,255,255,0.08)" }]}
                onPress={() => onAttendance(servant.uid, false)}
                activeOpacity={0.7}
              >
                <Text style={styles.attendanceButtonText}>Absent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.attendanceButton, { backgroundColor: status === true ? "#147EFB" : "rgba(255,255,255,0.08)" }]}
                onPress={() => onAttendance(servant.uid, true)}
                activeOpacity={0.7}
              >
                <Text style={styles.attendanceButtonText}>Present</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </View>
  );
});
ServantRow.displayName = "ServantRow";


/**
 * One row in the week picker, memoized.
 *
 * Was an inline `renderItem` closure that called the date formatter per row per
 * render. The label now arrives precomputed and cached (see utils/dateKeys.js).
 */
const WeekRow = React.memo(({ label, selected, dateKey, onPress }) => (
  <TouchableOpacity
    style={[styles.weekRow, selected && styles.weekRowSelected]}
    onPress={() => onPress(dateKey)}
    activeOpacity={0.7}
  >
    <Text style={[styles.weekRowText, selected && styles.weekRowTextSelected]}>
      {label}
    </Text>
    {selected ? (
      <Ionicons name="checkmark-circle" size={20} color="#147EFB" />
    ) : (
      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.25)" />
    )}
  </TouchableOpacity>
));
WeekRow.displayName = "WeekRow";

const weekKeyExtractor = (item) => item;

const ServantsAttendance = () => {
  const navigation = useNavigation();
  const user = auth().currentUser;

  // Hold the reads and the Sunday date math until the drawer/stack transition
  // has finished animating — both run on the thread driving that animation.
  const ready = useAfterInteractions();

  const [userData, setUserData] = useState(null);
  const [rawServantsData, setRawServantsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [previousSundays, setPreviousSundays] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Add manual servant modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhotoUid, setNewPhotoUid] = useState(null);
  const [tempPhotoUploaded, setTempPhotoUploaded] = useState(false); // a photo exists in storage under newPhotoUid
  const [showPhotoInput, setShowPhotoInput] = useState(false);
  const [addingServant, setAddingServant] = useState(false);

  const isMounted = useRef(true);
  const servantsUnsubscribe = useRef(null);
  const cacheKeys = useRef({ user: null, servants: null });
  const searchInputRef = useRef(null);
  const keyboardOffset = useRef(new Animated.Value(0)).current;

  // Keyboard animation
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === "ios" ? e.duration || 250 : 200,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: Platform.OS === "ios" ? e.duration || 250 : 200,
        useNativeDriver: false,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [keyboardOffset]);

  useEffect(() => {
    if (!ready) return;
    isMounted.current = true;
    const init = async () => {
      if (!user) { Alert.alert("Error", "No user found."); setLoading(false); return; }
      cacheKeys.current = {
        user: `servants_user_${user.uid}`,
        servants: `servants_data_${user.uid}`,
      };
      // Paint from cache as soon as it's read. setupListeners() opens with a
      // users/{uid}.get(), so awaiting it here meant the screen stayed blocked
      // on a network round-trip even when the cache already had everything.
      // Fire it off instead; setupListeners' stopLoading() clears the skeleton
      // once the servants snapshot actually delivers. We deliberately do NOT
      // clear it on a cache hit — a warm cache isn't a completed read.
      await loadCachedData();
      await generatePreviousSundays();
      setupListeners();
    };
    init();
    return () => {
      isMounted.current = false;
      if (servantsUnsubscribe.current) servantsUnsubscribe.current();
    };
  }, [user, ready]);

  /** Hydrates from AsyncStorage. Returns true if anything was restored. */
  const loadCachedData = async () => {
    try {
      const [cu, cs] = await Promise.all([
        CacheUtils.get(cacheKeys.current.user),
        CacheUtils.get(cacheKeys.current.servants),
      ]);
      if (cu && isMounted.current) setUserData(cu);
      if (cs && isMounted.current) setRawServantsData(cs);
      return Boolean(cu || cs);
    } catch {
      return false;
    }
  };

  const generatePreviousSundays = async () => {
    const today = new Date();
    const sundays = [];
    let cur = new Date(today);
    const currentYear = today.getFullYear();
    const sep11 = new Date(currentYear, 8, 11);
    const cutoff = today < sep11 ? new Date(currentYear - 1, 8, 11) : sep11;
    const diff = cur.getDay() === 0 ? 0 : cur.getDay();
    cur.setDate(cur.getDate() - diff);
    while (cur >= cutoff) { sundays.push(formatDate(cur)); cur.setDate(cur.getDate() - 7); }
    setPreviousSundays(sundays);
  };

  const setupListeners = async () => {
    // Every exit path clears loading so a cold start (no cache) can't sit on
    // the skeleton forever.
    const stopLoading = () => { if (isMounted.current) setLoading(false); };
    try {
      const userDoc = await firestore().collection("users").doc(user.uid).get();
      if (!isMounted.current) return;
      if (!userDoc.exists) { stopLoading(); return; }
      const localUserData = userDoc.data();
      setUserData(localUserData);
      CacheUtils.set(cacheKeys.current.user, localUserData);
      if (!localUserData.church) { stopLoading(); Alert.alert("Error", "No church assigned."); return; }

      servantsUnsubscribe.current = firestore()
        .collection("churches")
        .doc(localUserData.church)
        .collection("Servants Meeting")
        .onSnapshot(async (snapshot) => {
          if (!isMounted.current) return;
          const data = snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
          setRawServantsData(data);
          stopLoading();
          // Adopt any photoURL already on these docs — no Storage request, and
          // safe to call on every snapshot: primeFromUser is a no-op when the
          // url/version is unchanged, so attendance toggles cost nothing.
          avatarCache.primeMany(data);
          CacheUtils.set(cacheKeys.current.servants, data);
        }, () => { stopLoading(); if (isMounted.current) Alert.alert("Error", "Failed to load servants."); });
    } catch (e) { stopLoading(); if (isMounted.current) Alert.alert("Error", e.message); }
  };

  // Pull-to-refresh: force a re-check for every servant in case a photo
  // changed server-side. This is the only path that re-hits Storage — steady
  // state is served from avatarCache with no requests at all.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const uids = rawServantsData.map((s) => s.uid).filter(Boolean);
      await Promise.all(uids.map((uid) => avatarCache.invalidate(uid)));
      avatarCache.primeMany(rawServantsData);
      await avatarCache.resolveMany(uids);
    } finally {
      if (isMounted.current) setRefreshing(false);
    }
  }, [rawServantsData]);

  // Build sections.
  //
  // Derived with useMemo, not state-in-an-effect. An effect runs *after* the
  // render that set `rawServantsData`, so in that first frame the data was full
  // while `sections` was still [] — long enough for the empty state to paint.
  /**
   * The roster, mapped and sorted — deliberately separate from the search filter
   * below.
   *
   * These two used to be one memo keyed on `searchQuery` as well, so every
   * keystroke re-ran the spread-map over every servant *and* a full localeCompare
   * sort. Only the filtering depends on the query, so only the filtering should
   * re-run when it changes.
   */
  const processedServants = useMemo(() => {
    if (rawServantsData.length === 0) return [];
    const dateKey = selectedDate || getNextSunday();
    return rawServantsData
      .map((s) => ({ ...s, attendance: s[dateKey] !== undefined ? s[dateKey] : null }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [selectedDate, rawServantsData]);

  const sections = useMemo(() => {
    if (processedServants.length === 0) return [];
    const lower = searchQuery.trim().toLowerCase();
    const filtered = lower
      ? processedServants.filter((s) => (s.name || "").toLowerCase().includes(lower))
      : processedServants;
    const grouped = filtered.reduce((acc, s) => {
      const key = (s.name || "").charAt(0).toUpperCase() || "#";
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {});
    return Object.keys(grouped).sort().map((k) => ({ title: k, data: grouped[k] }));
  }, [processedServants, searchQuery]);

  // AlphabetIndexBar takes this as an array prop; building it inline in the JSX
  // gave it a new identity every render.
  const availableLetters = useMemo(() => sections.map((s) => s.title), [sections]);

  const handleWeekPress = useCallback((date) => {
    setSelectedDate(date);
    setDateModalVisible(false);
  }, []);

  const renderWeek = useCallback(
    ({ item }) => (
      <WeekRow
        label={shortDateLabel(item)}
        selected={selectedDate === item}
        dateKey={item}
        onPress={handleWeekPress}
      />
    ),
    [selectedDate, handleWeekPress]
  );

  const scrollToSection = (letter) => {
    const idx = sections.findIndex((s) => s.title === letter);
    if (idx < 0 || !sectionListRef.current) return;
    // itemIndex 0 is the section header's own slot. It used to be 1, which
    // targets data item 0 and only lands on the header because sticky-header
    // handling subtracts the header's height back off — which in turn needed the
    // header's frame to be known. 0 addresses it directly.
    sectionListRef.current.scrollToLocation({ sectionIndex: idx, itemIndex: 0, animated: false, viewPosition: 0, viewOffset: 0 });
  };
  const sectionListRef = useRef(null);

  const handleAttendance = useCallback((servantID, status) => {
    const dateKey = selectedDate || getNextSunday();
    if (selectedDate && selectedDate !== getNextSunday()) return;
    Haptics.trigger("impactLight");
    firestore()
      .collection("churches").doc(userData?.church)
      .collection("Servants Meeting").doc(servantID)
      .update({ [dateKey]: status })
      .catch(() => Alert.alert("Error", "Failed to update attendance."));
  }, [selectedDate, userData?.church]);

  // ── Add manual servant ────────────────────────────────────────────────────

  const openAddModal = () => {
    const tempUid = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setNewPhotoUid(tempUid);
    setNewName("");
    setTempPhotoUploaded(false);
    setAddModalVisible(true);
  };

  // Cancelling without saving: delete any photo already uploaded under the
  // temp uid so we don't leave an orphaned file in storage.
  const cancelAddModal = useCallback(async () => {
    setAddModalVisible(false);
    setNewName("");
    if (tempPhotoUploaded && newPhotoUid) {
      const uid = newPhotoUid;
      // Drops the object and the cached url. The manual_ prefix means
      // removePhoto skips the users/{uid} write entirely.
      try {
        await avatarCache.removePhoto(uid);
      } catch {}
    }
    setTempPhotoUploaded(false);
  }, [tempPhotoUploaded, newPhotoUid]);

  const handleAddServant = async () => {
    const trimmed = newName.trim().replace(/\s+/g, " ");
    const words = trimmed.split(" ").filter(Boolean);
    if (words.length < 2) {
      Alert.alert("Full name required", "Please enter both a first and last name.");
      return;
    }
    setAddingServant(true);
    try {
      const docId = newPhotoUid; // already has manual_ prefix

      // The photo (if any) was uploaded to profilePictures/{docId}.png when the
      // user confirmed in PhotoInput. Since the temp uid IS the docId, it's
      // already at the correct path — no move needed.
      await firestore()
        .collection("churches").doc(userData.church)
        .collection("Servants Meeting").doc(docId)
        .set({ uid: docId, name: trimmed, manual: true });

      setAddModalVisible(false);
      setNewName("");
      setTempPhotoUploaded(false); // committed — do not delete on next open
    } catch (e) {
      Alert.alert("Error", "Failed to add servant. " + e.message);
    } finally {
      setAddingServant(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  // Hoisted out of the row so the memoized ServantRow gets a stable callback
  // rather than a fresh closure per cell per render.
  const openServant = useCallback((servant) => {
    if (!userData || isNavigating) return;
    setIsNavigating(true);
    navigation.navigate("IndividualServant", { church: userData.church, servantID: servant.uid });
    setTimeout(() => setIsNavigating(false), 1000);
  }, [userData, isNavigating, navigation]);

  const isPastDate = Boolean(selectedDate && selectedDate !== getNextSunday());

  const renderServant = useCallback(
    ({ item: servant }) => (
      <ServantRow
        servant={servant}
        isPastDate={isPastDate}
        isNavigating={isNavigating}
        onOpen={openServant}
        onAttendance={handleAttendance}
      />
    ),
    [isPastDate, isNavigating, openServant, handleAttendance]
  );

  const keyExtractor = useCallback((item) => item.uid, []);

  // Was an inline literal on the SectionList, so every parent render handed it a
  // new identity and it re-rendered every mounted cell.
  const listEmpty = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={64} color="rgba(255,255,255,0.3)" />
        <Text style={styles.noStudentsText}>
          {searchQuery.trim() ? "No servants match your search" : "No servants yet"}
        </Text>
      </View>
    ),
    [searchQuery]
  );

  const renderSectionHeader = useMemo(
    () => ({ section: { title } }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{title}</Text>
      </View>
    ), []
  );

  // `loading` is only cleared by stopLoading(), which every terminal path of
  // setupListeners() calls — so !loading means a read actually finished. The
  // old `&& !userData && rawServantsData.length === 0` clauses opened the gate
  // as soon as the *cache* landed, which flashed "No servants yet" while the
  // snapshot was still in flight.
  if (!ready || loading) {
    return <SkeletonScreen variant="list" count={8} />;
  }

  const dateKey = selectedDate || getNextSunday();
  const isCurrentWeek = !selectedDate || selectedDate === getNextSunday();

  return (
    <View style={styles.container}>
      {isNavigating && (
        <View style={styles.navigatingOverlay}>
          <ActivityIndicator size="large" color="#147EFB" />
        </View>
      )}

      {/* Week selector */}
      <TouchableOpacity style={styles.weekSelector} onPress={() => setDateModalVisible(true)} activeOpacity={0.7}>
        <View style={styles.weekSelectorLeft}>
          <Ionicons name="calendar-outline" size={20} color="#147EFB" />
          <View style={styles.weekSelectorTextWrap}>
            <Text style={styles.weekSelectorLabel}>
              {isCurrentWeek ? "This Week" : "Viewing"}
            </Text>
            <Text style={styles.weekSelectorDate}>{shortDateLabel(dateKey)}</Text>
          </View>
        </View>
        <View style={styles.weekSelectorRight}>
          <Text style={styles.weekSelectorChange}>Change</Text>
          <Ionicons name="chevron-down" size={14} color="#147EFB" style={{ marginLeft: 4 }} />
        </View>
      </TouchableOpacity>

      <View style={styles.listWrapper}>
        <SectionList
          ref={sectionListRef}
          sections={sections}
          renderItem={renderServant}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          contentContainerStyle={[styles.listContainer, { paddingRight: 30 }]}
          {...LIST_PERF}
          // Every row is a fixed height, so the offset of any letter is known
          // without having rendered it. This is what makes the A-Z bar land
          // instantly instead of failing: there used to be a no-op
          // onScrollToIndexFailed here, which meant tapping a far letter did
          // nothing at all. That handler is unreachable once getItemLayout is set
          // (VirtualizedList guards the whole failure path on it), so it is gone
          // rather than kept as a silent catch-all.
          getItemLayout={getItemLayout}
          // Android only: on iOS this has a history of blanking cells and
          // breaking touch targets.
          removeClippedSubviews={REMOVE_CLIPPED_ANDROID_ONLY}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#147EFB"
              colors={["#147EFB"]}
            />
          }
          ListEmptyComponent={listEmpty}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={true}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        />
        {sections.length > 0 && !searchQuery.trim() && (
          <View style={{ position: "absolute", top: 85 * scale, right: 0, width: 30 }}>
            <AlphabetIndexBar onLetterChange={scrollToSection} availableLetters={availableLetters} />
          </View>
        )}
      </View>

      {/* Floating search bar + add button */}
      <Animated.View
        style={[styles.floatingBarWrapper, { transform: [{ translateY: Animated.multiply(keyboardOffset, -1) }] }]}
        pointerEvents="box-none"
      >
        <BlurView tint="systemChromeMaterialDark" intensity={80} style={styles.floatingBlur}>
          <View style={styles.floatingInner}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={16} color="rgba(255,255,255,0.55)" style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchBar}
                placeholder="Search servants"
                placeholderTextColor="rgba(255,255,255,0.55)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={openAddModal} activeOpacity={0.8}>
              <Ionicons name="person-add-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>

      {/* ── Date picker modal ── */}
      <Modal visible={dateModalVisible} transparent animationType="fade" onRequestClose={() => setDateModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.weekModalCard}>
            {/* Header */}
            <View style={styles.weekModalHeader}>
              <View>
                <Text style={styles.weekModalTitle}>Select a week</Text>
                <Text style={styles.weekModalSubtitle}>Tap any Sunday to view its attendance</Text>
              </View>
              <TouchableOpacity
                style={styles.weekModalClose}
                onPress={() => setDateModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            {/* Jump to this week */}
            <TouchableOpacity
              style={[styles.thisWeekRow, isCurrentWeek && styles.weekRowSelected]}
              onPress={() => { setSelectedDate(null); setDateModalVisible(false); }}
              activeOpacity={0.7}
            >
              <View style={styles.thisWeekIcon}>
                <Ionicons name="today-outline" size={18} color="#147EFB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.thisWeekTitle}>This week</Text>
                <Text style={styles.thisWeekDate}>{shortDateLabel(getNextSunday())}</Text>
              </View>
              {isCurrentWeek && <Ionicons name="checkmark-circle" size={20} color="#147EFB" />}
            </TouchableOpacity>

            <View style={styles.weekModalDivider}>
              <Text style={styles.weekModalDividerText}>Previous weeks</Text>
            </View>

            {/* Scrollable list with fade hint */}
            <View style={styles.weekListWrap}>
              <FlatList
                {...LIST_PERF}
                data={previousSundays}
                keyExtractor={weekKeyExtractor}
                style={styles.dateList}
                showsVerticalScrollIndicator={true}
                indicatorStyle="white"
                renderItem={renderWeek}
              />
              {/* bottom fade to signal more content scrolls */}
              <View pointerEvents="none" style={styles.weekListFade} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add manual servant modal ── */}
      <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={cancelAddModal}>
        <View style={styles.sheetOverlayCentered}>
          <TouchableOpacity style={styles.sheetDismiss} activeOpacity={1} onPress={cancelAddModal} />
          <View style={styles.centeredCard}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Add Servant Manually</Text>
              <TouchableOpacity style={styles.sheetClose} onPress={cancelAddModal}>
                <Text style={styles.sheetCloseX}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Photo */}
              <TouchableOpacity style={styles.photoPickerRow} onPress={() => { setAddModalVisible(false); setTimeout(() => setShowPhotoInput(true), Platform.OS === "ios" ? 350 : 0); }} activeOpacity={0.8}>
                <View style={styles.photoPickerCircle}>
                  {tempPhotoUploaded ? (
                    <Avatar
                      uid={newPhotoUid}
                      size={64}
                      borderRadius={32}
                      style={styles.photoPickerImage}
                      showBorder={false}
                    />
                  ) : (
                    <Ionicons name="camera-outline" size={28} color="rgba(255,255,255,0.4)" />
                  )}
                </View>
                <Text style={styles.photoPickerLabel}>
                  {tempPhotoUploaded ? "Change photo" : "Add photo (optional)"}
                </Text>
              </TouchableOpacity>

              {/* Name */}
              <Text style={styles.inputLabel}>Full name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="First and last name"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={newName}
                onChangeText={setNewName}
                autoCapitalize="words"
                autoCorrect={false}
              />

              <View style={styles.sheetNote}>
                <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.35)" />
                <Text style={styles.sheetNoteText}>
                  Enter both a first and last name. This servant appears with a Manual badge; once they join the app you can sync their record to their account.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.sheetFooter}>
              <TouchableOpacity style={styles.sheetCancelBtn} onPress={cancelAddModal} activeOpacity={0.8}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sheetConfirmBtn, (!newName.trim() || addingServant) && { opacity: 0.4 }]}
                onPress={handleAddServant}
                disabled={!newName.trim() || addingServant}
                activeOpacity={0.8}
              >
                {addingServant ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sheetConfirmText}>Add Servant</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Photo picker (reuses existing PhotoInput component, unchanged) */}
      {showPhotoInput && newPhotoUid && (
        <PhotoInput
          visible={showPhotoInput}
          userId={newPhotoUid}
          onUploadSuccess={() => {
            // PhotoInput writes the new url straight into avatarCache.
            setTempPhotoUploaded(true);
          }}
          onClose={() => { setShowPhotoInput(false); setAddModalVisible(true); }}
        />
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 20, backgroundColor: "#121212" },

  weekSelector: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#1a1a1a", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  weekSelectorLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  weekSelectorTextWrap: { marginLeft: 12 },
  weekSelectorLabel: { fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  weekSelectorDate: { fontSize: 16, color: "#fff", fontWeight: "600", marginTop: 2 },
  weekSelectorRight: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(20,126,251,0.15)", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  weekSelectorChange: { fontSize: 13, color: "#147EFB", fontWeight: "600" },

  listWrapper: { flex: 1, position: "relative" },
  listContainer: { flexGrow: 1, paddingRight: 32, paddingBottom: 120 },

  servantCard: {
    backgroundColor: "#1a1a1a", borderRadius: 14, padding: 16, paddingRight: 24,
    marginBottom: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  servantInfo: { flexDirection: "row", alignItems: "center" },
  servantImage: { width: 48, height: 48, borderRadius: 24, marginRight: 14 },
  servantDetails: { flex: 1 },
  servantHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: SERVANT_HEADER_H },
  servantNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  servantName: { fontSize: 17, lineHeight: NAME_LINE, fontWeight: "600", color: "#fff" },

  manualBadge: {
    backgroundColor: "rgba(255,149,0,0.15)", borderRadius: 5,
    paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(255,149,0,0.3)",
  },
  manualBadgeText: { fontSize: 10, fontWeight: "700", color: "#ff9500", textTransform: "uppercase", letterSpacing: 0.3 },

  syncBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(77,156,255,0.1)", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(77,156,255,0.2)",
  },
  syncBtnText: { fontSize: 12, fontWeight: "600", color: "#4d9cff" },

  attendanceButtons: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, gap: 12 },
  attendanceButton: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  attendanceButtonText: { fontSize: 15, lineHeight: STATUS_LINE, fontWeight: "600", color: "#fff" },
  attendanceStatusContainer: { marginTop: 14 },
  attendanceStatus: { borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  attendanceStatusText: { fontSize: 15, lineHeight: STATUS_LINE, fontWeight: "600", color: "#fff" },

  // Floating search + add
  floatingBarWrapper: {
    position: "absolute", left: 12, right: 12,
    bottom: Platform.OS === "ios" ? 28 : 16,
    borderRadius: 18, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  floatingBlur: {
    borderRadius: 18, overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: Platform.OS === "android" ? "rgba(28,28,30,0.92)" : "transparent",
  },
  floatingInner: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 10, gap: 8,
  },
  searchContainer: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, paddingHorizontal: 10, height: 38,
  },
  searchIcon: { marginRight: 6 },
  searchBar: { flex: 1, color: "#fff", fontSize: 15, paddingVertical: 0 },
  addBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: "#147efb",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },

  // Section
  sectionHeader: { backgroundColor: "transparent", paddingVertical: 8 * scale, paddingHorizontal: 4 },
  sectionHeaderText: { fontSize: 22, lineHeight: HEADER_LINE, fontWeight: "600", color: "#fff" },

  // Loading / empty
  emptyContainer: { alignItems: "center", marginTop: 60 },
  noStudentsText: { fontSize: 16, color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 16 },
  navigatingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", zIndex: 1000 },

  // ── Week picker modal (redesigned) ──
  modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 20 },
  weekModalCard: {
    width: "100%", maxWidth: 400, backgroundColor: "#1a1a1a", borderRadius: 18,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", overflow: "hidden",
    maxHeight: height * 0.78,
  },
  weekModalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  weekModalTitle: { fontSize: 20, color: "#fff", fontWeight: "700" },
  weekModalSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 },
  weekModalClose: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },

  thisWeekRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 16, marginBottom: 4, paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 12, backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  thisWeekIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(20,126,251,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  thisWeekTitle: { fontSize: 15, color: "#fff", fontWeight: "600" },
  thisWeekDate: { fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 1 },

  weekModalDivider: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  weekModalDividerText: {
    fontSize: 11, color: "rgba(255,255,255,0.4)", fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.6,
  },

  weekListWrap: { position: "relative", flexShrink: 1 },
  dateList: { width: "100%", paddingHorizontal: 16 },
  weekRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 14, paddingHorizontal: 14, marginBottom: 8,
    borderRadius: 12, backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  weekRowSelected: { backgroundColor: "rgba(20,126,251,0.15)", borderColor: "rgba(20,126,251,0.4)" },
  weekRowText: { fontSize: 15, color: "#fff", fontWeight: "500" },
  weekRowTextSelected: { color: "#fff", fontWeight: "700" },
  weekListFade: {
    position: "absolute", left: 0, right: 0, bottom: 0, height: 28,
    // subtle fade so it's obvious the list scrolls
    backgroundColor: "transparent",
    borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
  },

  // Centered card (add manual servant — no slide animation)
  sheetOverlayCentered: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  sheetDismiss: { ...StyleSheet.absoluteFillObject },
  centeredCard: {
    width: "100%", maxWidth: 400, backgroundColor: "#1a1a1a", borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", overflow: "hidden",
    maxHeight: height * 0.82,
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  sheetClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  sheetCloseX: { color: "rgba(255,255,255,0.6)", fontSize: 20, fontWeight: "300", marginTop: -1 },
  sheetBody: { paddingHorizontal: 20, paddingTop: 16 },
  sheetFooter: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  sheetCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center" },
  sheetCancelText: { color: "rgba(255,255,255,0.6)", fontSize: 15, fontWeight: "600" },
  sheetConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: "#147efb", alignItems: "center" },
  sheetConfirmText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  // Add servant form
  photoPickerRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  photoPickerCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photoPickerImage: { width: 64, height: 64, borderRadius: 32 },
  photoPickerLabel: { color: "#4d9cff", fontSize: 14, fontWeight: "500" },
  inputLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  textInput: { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: "#fff", fontSize: 15, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  sheetNote: { flexDirection: "row", gap: 8, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 12, marginBottom: 8 },
  sheetNoteText: { flex: 1, color: "rgba(255,255,255,0.35)", fontSize: 12, lineHeight: 17 },
});

export default ServantsAttendance;