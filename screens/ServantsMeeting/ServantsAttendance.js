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
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  updateDoc,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
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
import useResponsiveLayout from "../../hooks/useResponsiveLayout";
import useDeferredSearch from "../../hooks/useDeferredSearch";
import {
  isManualId,
  newManualId,
  saveManualPerson,
} from "../../utils/manualPeople";
import { makeStyles, useTheme, GlassSurface, useTabBarInset, floatingBottom } from "../../theme";

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
// SERVANT_HEADER_H (below, once LH exists) is pinned because that row's tallest
// child is a chevron glyph, whose box JS cannot compute; the name line and the
// "Manual" badge both sit under it. The line heights are explicit for the same
// reason a Text without one gets the font's natural line box, which is also not
// computable.
//
// Each line is ~1.3x its font size. They used to sit at ~1.18x, right at SF's
// natural ascent + descent, and iOS clipped the tails of g/y/p/j in names.
const NAME_LINE = 23;
const STATUS_LINE = 20;
const HEADER_LINE = 29;

// RN scales a declared lineHeight by the OS font scale (allowFontScaling defaults
// to on), so the height arithmetic has to scale it too or every constant below is
// wrong for anyone using large text.
//
// The ceil-to-whole-pixel is not cosmetic either. Native rounds a scaled line box
// UP to the device pixel grid, and modelling that as plain multiplication (or as
// roundToNearestPixel) leaves each row a fraction of a point short — which then
// accumulates down the list. Verified on device: at a 0.94 font scale a declared
// 20pt line renders as exactly 19.0, and 14pt as 13.333, which is what ceil gives
// and rounding does not.
const FONT_SCALE = PixelRatio.getFontScale();
const PX = PixelRatio.get();
const LH = (v) => Math.ceil(v * FONT_SCALE * PX) / PX;

// Never shorter than the name's own line box, or large text clips it again.
const SERVANT_HEADER_H = Math.max(24, LH(NAME_LINE));

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

const isManual = isManualId;

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


// The merge helper that used to sit here had no call site in this file — the
// only sync entry point is IndividualServant. It now lives in
// utils/manualPeople.js, which folds *both* of a person's projections into the
// real account rather than just this collection's.

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
  const styles = useStyles();
  const t = useTheme();
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
            <Ionicons name="chevron-forward" size={20} color={t.textTertiary} />
          </TouchableOpacity>

          {isPastDate ? (
            <View style={styles.attendanceStatusContainer}>
              <View style={[styles.attendanceStatus, {
                backgroundColor: status === true ? t.accent : status === false ? t.danger : t.fillStrong,
              }]}>
                <Text style={[styles.attendanceStatusText, { color: status === null || status === undefined ? t.text : t.onAccent }]}>
                  {status === true ? "Present" : status === false ? "Absent" : "Not Recorded"}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.attendanceButtons}>
              <TouchableOpacity
                style={[styles.attendanceButton, { backgroundColor: status === false ? t.danger : t.fill }]}
                onPress={() => onAttendance(servant.uid, false)}
                activeOpacity={0.7}
              >
                <Text style={[styles.attendanceButtonText, { color: status === false ? t.onAccent : t.text }]}>Absent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.attendanceButton, { backgroundColor: status === true ? t.accent : t.fill }]}
                onPress={() => onAttendance(servant.uid, true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.attendanceButtonText, { color: status === true ? t.onAccent : t.text }]}>Present</Text>
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
const WeekRow = React.memo(({ label, selected, dateKey, onPress }) => {
  const styles = useStyles();
  const t = useTheme();
  return (
  <TouchableOpacity
    style={[styles.weekRow, selected && styles.weekRowSelected]}
    onPress={() => onPress(dateKey)}
    activeOpacity={0.7}
  >
    <Text style={[styles.weekRowText, selected && styles.weekRowTextSelected]}>
      {label}
    </Text>
    {selected ? (
      <Ionicons name="checkmark-circle" size={20} color={t.accent} />
    ) : (
      <Ionicons name="chevron-forward" size={18} color={t.textTertiary} />
    )}
  </TouchableOpacity>
  );
});
WeekRow.displayName = "WeekRow";

const weekKeyExtractor = (item) => item;

const ServantsAttendance = () => {
  const styles = useStyles();
  const t = useTheme();
  const tabBarInset = useTabBarInset();
  const navigation = useNavigation();
  const user = getAuth().currentUser;

  // Hold the reads and the Sunday date math until the drawer/stack transition
  // has finished animating — both run on the thread driving that animation.
  const ready = useAfterInteractions();
  // On an iPad this screen sits in a centered column (MainContainer wraps it);
  // this is the padding inside it, a touch roomier than a phone's.
  const { gutter, isWide } = useResponsiveLayout({ maxContentWidth: 720, phoneGutter: 20 });

  const [userData, setUserData] = useState(null);
  const [rawServantsData, setRawServantsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [previousSundays, setPreviousSundays] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // The TextInput below stays bound to `searchQuery` so the caret never lags.
  // Everything that describes the *result* of the search reads `search`, which
  // trails by a render under fast typing instead of re-grouping the whole roster
  // and re-rendering every mounted cell on each keystroke.
  const search = useDeferredSearch(searchQuery);

  // Add manual servant modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhotoUid, setNewPhotoUid] = useState(null);
  const [tempPhotoUploaded, setTempPhotoUploaded] = useState(false); // a photo exists in storage under newPhotoUid
  const [showPhotoInput, setShowPhotoInput] = useState(false);
  const [addingServant, setAddingServant] = useState(false);

  const isMounted = useRef(true);
  const servantsUnsubscribe = useRef(null);
  const userUnsubscribe = useRef(null);
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

  // Keyed on the uid, never on the `user` object: RNFB builds a new User on
  // every ID-token refresh, which made this effect restart mid-load, drop the
  // live listeners and repaint the roster from the on-device copy.
  useEffect(() => {
    if (!ready) return;
    isMounted.current = true;
    // Set by this run's cleanup, so a superseded run that was still awaiting the
    // cache read does not open a second, leaked pair of listeners.
    let cancelled = false;
    const init = async () => {
      if (!user) { Alert.alert("Error", "No user found."); setLoading(false); return; }
      cacheKeys.current = {
        user: `servants_user_${user.uid}`,
        servants: `servants_data_${user.uid}`,
      };
      // Paint from cache as soon as it's read. setupListeners() waits on the
      // users/{uid} snapshot, so awaiting it here meant the screen stayed blocked
      // on a network round-trip even when the cache already had everything.
      // Fire it off instead; setupListeners' stopLoading() clears the skeleton
      // once the servants snapshot actually delivers. We deliberately do NOT
      // clear it on a cache hit — a warm cache isn't a completed read.
      await loadCachedData();
      await generatePreviousSundays();
      if (cancelled) return;
      setupListeners();
    };
    init();
    return () => {
      cancelled = true;
      isMounted.current = false;
      if (userUnsubscribe.current) userUnsubscribe.current();
      if (servantsUnsubscribe.current) servantsUnsubscribe.current();
      userUnsubscribe.current = null;
      servantsUnsubscribe.current = null;
    };
  }, [user?.uid, ready]);

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

  const setupListeners = () => {
    // Every exit path clears loading so a cold start (no cache) can't sit on
    // the skeleton forever.
    const stopLoading = () => { if (isMounted.current) setLoading(false); };
    // The user doc is live too: it used to be read once, so an admin moving
    // someone to another church left this screen on the old roster until it
    // remounted.
    let servantsChurch = null;
    userUnsubscribe.current = onSnapshot(
      doc(getFirestore(), "users", user.uid),
      (userDoc) => {
        if (!isMounted.current) return;
        if (!userDoc.exists) { stopLoading(); return; }
        const localUserData = userDoc.data();
        setUserData(localUserData);
        CacheUtils.set(cacheKeys.current.user, localUserData);
        if (!localUserData.church) { stopLoading(); Alert.alert("Error", "No church assigned."); return; }
        if (localUserData.church === servantsChurch) return;

        servantsChurch = localUserData.church;
        if (servantsUnsubscribe.current) servantsUnsubscribe.current();
        servantsUnsubscribe.current = onSnapshot(
          collection(
            getFirestore(),
            "churches",
            localUserData.church,
            "Servants Meeting"
          ),
          async (snapshot) => {
            if (!isMounted.current) return;
            const data = snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
            setRawServantsData(data);
            stopLoading();
            // Adopt any photoURL already on these docs — no Storage request, and
            // safe to call on every snapshot: primeFromUser is a no-op when the
            // url/version is unchanged, so attendance toggles cost nothing.
            avatarCache.primeMany(data);
            CacheUtils.set(cacheKeys.current.servants, data);
          },
          () => { stopLoading(); if (isMounted.current) Alert.alert("Error", "Failed to load servants."); }
        );
      },
      (e) => { stopLoading(); if (isMounted.current) Alert.alert("Error", e.message); }
    );
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
    const filtered = search.active
      ? processedServants.filter((s) => (s.name || "").toLowerCase().includes(search.lower))
      : processedServants;
    const grouped = filtered.reduce((acc, s) => {
      const key = (s.name || "").charAt(0).toUpperCase() || "#";
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {});
    return Object.keys(grouped).sort().map((k) => ({ title: k, data: grouped[k] }));
  }, [processedServants, search]);

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
    updateDoc(
      doc(getFirestore(), "churches", userData?.church, "Servants Meeting", servantID),
      { [dateKey]: status }
    )
      .catch(() => Alert.alert("Error", "Failed to update attendance."));
  }, [selectedDate, userData?.church]);

  // ── Add manual servant ────────────────────────────────────────────────────

  const openAddModal = () => {
    const tempUid = newManualId();
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
      // Writes the registry entry plus BOTH projections. Adding someone here
      // makes them a Sunday School servant too — with no classes yet, so they
      // appear in nobody's class list until an admin assigns some in Servants
      // Management. That mirrors what isSSTeacher does for a real servant.
      await saveManualPerson(userData.church, {
        id: docId,
        name: trimmed,
        ssGrades: [],
        createdBy: user?.uid || null,
      });

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
  // Built once per refresh state rather than once per render. As a JSX literal
  // inline on the list this was a fresh element every time, and SectionList is a
  // PureComponent — one changed prop identity re-renders every mounted cell.
  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor={t.accent}
        colors={[t.accent]}
      />
    ),
    [refreshing, onRefresh, t]
  );

  const listEmpty = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={64} color={t.textTertiary} />
        <Text style={styles.noStudentsText}>
          {search.active ? "No servants match your search" : "No servants yet"}
        </Text>
      </View>
    ),
    [search, styles, t]
  );

  const renderSectionHeader = useMemo(
    () => ({ section: { title } }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{title}</Text>
      </View>
    ), [styles]
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
    <View style={[styles.container, { paddingHorizontal: gutter }]}>
      {isNavigating && (
        <View style={styles.navigatingOverlay}>
          <ActivityIndicator size="large" color={t.accent} />
        </View>
      )}

      {/* Week selector */}
      <TouchableOpacity onPress={() => setDateModalVisible(true)} activeOpacity={0.7}>
        <GlassSurface style={styles.weekSelector} interactive>
          <View style={styles.weekSelectorLeft}>
            <Ionicons name="calendar-outline" size={20} color={t.accent} />
            <View style={styles.weekSelectorTextWrap}>
              <Text style={styles.weekSelectorLabel}>
                {isCurrentWeek ? "This Week" : "Viewing"}
              </Text>
              <Text style={styles.weekSelectorDate}>{shortDateLabel(dateKey)}</Text>
            </View>
          </View>
          <View style={styles.weekSelectorRight}>
            <Text style={styles.weekSelectorChange}>Change</Text>
            <Ionicons name="chevron-down" size={14} color={t.accent} style={{ marginLeft: 4 }} />
          </View>
        </GlassSurface>
      </TouchableOpacity>

      <View style={styles.listWrapper}>
        <SectionList
          ref={sectionListRef}
          sections={sections}
          renderItem={renderServant}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={keyExtractor}
          contentContainerStyle={[styles.listContainer, { paddingBottom: 120 + tabBarInset }]}
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
          refreshControl={refreshControl}
          ListEmptyComponent={listEmpty}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={true}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        />
        {/* Gated on the deferred value so the bar and the list change together. */}
        {sections.length > 0 && !search.active && (
          <View style={{ position: "absolute", top: 85 * scale, right: 0, width: 30 }}>
            <AlphabetIndexBar onLetterChange={scrollToSection} availableLetters={availableLetters} />
          </View>
        )}
      </View>

      {/* Floating search bar + add button */}
      <Animated.View
        style={[styles.floatingBarWrapper, { bottom: floatingBottom((Platform.OS === "ios" ? 28 : 16), tabBarInset) }, isWide && { left: gutter, right: gutter }, { transform: [{ translateY: Animated.multiply(keyboardOffset, -1) }] }]}
        pointerEvents="box-none"
      >
        {(() => {
          const floatingContent = (
          <View style={styles.floatingInner}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={16} color={t.textSecondary} style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchBar}
                placeholder="Search servants"
                placeholderTextColor={t.isDark ? "rgba(255,255,255,0.55)" : t.placeholder}
                keyboardAppearance={t.keyboardAppearance}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={openAddModal} activeOpacity={0.8}>
              <Ionicons name="person-add-outline" size={18} color={t.onAccent} />
            </TouchableOpacity>
          </View>
          );
          return t.glass ? (
            <GlassSurface style={styles.floatingBlur}>{floatingContent}</GlassSurface>
          ) : (
            <BlurView tint={t.blurTint} intensity={80} style={styles.floatingBlur}>{floatingContent}</BlurView>
          );
        })()}
      </Animated.View>

      {/* ── Date picker modal ── */}
      <Modal visible={dateModalVisible} transparent animationType="fade" onRequestClose={() => setDateModalVisible(false)}>
        <View style={styles.modalContainer}>
          <GlassSurface sheet style={styles.weekModalCard}>
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
                <Ionicons name="close" size={20} color={t.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Jump to this week */}
            <TouchableOpacity
              style={[styles.thisWeekRow, isCurrentWeek && styles.weekRowSelected]}
              onPress={() => { setSelectedDate(null); setDateModalVisible(false); }}
              activeOpacity={0.7}
            >
              <View style={styles.thisWeekIcon}>
                <Ionicons name="today-outline" size={18} color={t.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.thisWeekTitle}>This week</Text>
                <Text style={styles.thisWeekDate}>{shortDateLabel(getNextSunday())}</Text>
              </View>
              {isCurrentWeek && <Ionicons name="checkmark-circle" size={20} color={t.accent} />}
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
                indicatorStyle={t.isDark ? "white" : "black"}
                renderItem={renderWeek}
              />
              {/* bottom fade to signal more content scrolls */}
              <View pointerEvents="none" style={styles.weekListFade} />
            </View>
          </GlassSurface>
        </View>
      </Modal>

      {/* ── Add manual servant modal ── */}
      <Modal visible={addModalVisible} transparent animationType="fade" onRequestClose={cancelAddModal}>
        <View style={styles.sheetOverlayCentered}>
          <TouchableOpacity style={styles.sheetDismiss} activeOpacity={1} onPress={cancelAddModal} />
          <GlassSurface sheet style={styles.centeredCard}>
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
                    <Ionicons name="camera-outline" size={28} color={t.textTertiary} />
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
                placeholderTextColor={t.placeholder}
                keyboardAppearance={t.keyboardAppearance}
                value={newName}
                onChangeText={setNewName}
                autoCapitalize="words"
                autoCorrect={false}
              />

              <View style={styles.sheetNote}>
                <Ionicons name="information-circle-outline" size={14} color={t.textTertiary} />
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
                  <ActivityIndicator size="small" color={t.onAccent} />
                ) : (
                  <Text style={styles.sheetConfirmText}>Add Servant</Text>
                )}
              </TouchableOpacity>
            </View>
          </GlassSurface>
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

const useStyles = makeStyles((t) => ({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 20, backgroundColor: t.background },

  weekSelector: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: t.surface, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
    marginBottom: 16, borderWidth: 1, borderColor: t.border,
  },
  weekSelectorLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  weekSelectorTextWrap: { marginLeft: 12 },
  weekSelectorLabel: { fontSize: 11, color: t.textSecondary, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.5 },
  weekSelectorDate: { fontSize: 16, color: t.text, fontWeight: "600", marginTop: 2 },
  weekSelectorRight: { flexDirection: "row", alignItems: "center", backgroundColor: t.accentFill, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  weekSelectorChange: { fontSize: 13, color: t.accent, fontWeight: "600" },

  listWrapper: { flex: 1, position: "relative" },
  // paddingRight clears the alphabet index bar. It was 32 here and then
  // overridden to 30 by an inline `[styles.listContainer, { paddingRight: 30 }]`
  // array on the list — a fresh array identity every render, which defeats
  // SectionList's PureComponent bail-out. Folded in at its effective value.
  listContainer: { flexGrow: 1, paddingRight: 30, paddingBottom: 120 },

  servantCard: {
    backgroundColor: t.surface, borderRadius: 14, padding: 16, paddingRight: 24,
    marginBottom: 12, borderWidth: 1, borderColor: t.border,
  },
  servantInfo: { flexDirection: "row", alignItems: "center" },
  servantImage: { width: 48, height: 48, borderRadius: 24, marginRight: 14 },
  servantDetails: { flex: 1 },
  servantHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", height: SERVANT_HEADER_H },
  servantNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  servantName: { fontSize: 17, lineHeight: NAME_LINE, fontWeight: "600", color: t.text },

  manualBadge: {
    backgroundColor: "rgba(255,149,0,0.15)", borderRadius: 5,
    paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(255,149,0,0.3)",
  },
  manualBadgeText: { fontSize: 10, fontWeight: "700", color: t.warningText, textTransform: "uppercase", letterSpacing: 0.3 },

  syncBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(77,156,255,0.1)", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(77,156,255,0.2)",
  },
  syncBtnText: { fontSize: 12, fontWeight: "600", color: t.accentText },

  attendanceButtons: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, gap: 12 },
  attendanceButton: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  attendanceButtonText: { fontSize: 15, lineHeight: STATUS_LINE, fontWeight: "600", color: t.onAccent },
  attendanceStatusContainer: { marginTop: 14 },
  attendanceStatus: { borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  attendanceStatusText: { fontSize: 15, lineHeight: STATUS_LINE, fontWeight: "600", color: t.onAccent },

  // Floating search + add
  floatingBarWrapper: {
    position: "absolute", left: 12, right: 12,
    bottom: Platform.OS === "ios" ? 28 : 16,
    borderRadius: 18, overflow: "hidden",
    shadowColor: t.shadow, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  floatingBlur: {
    borderRadius: 18, overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.borderStrong,
    backgroundColor: Platform.OS === "android" ? (t.isDark ? "rgba(28,28,30,0.92)" : "rgba(242,242,247,0.92)") : "transparent",
  },
  floatingInner: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 10, gap: 8,
  },
  searchContainer: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: t.fillStrong, borderRadius: 10, paddingHorizontal: 10, height: 38,
  },
  searchIcon: { marginRight: 6 },
  searchBar: { flex: 1, color: t.text, fontSize: 15, paddingVertical: 0 },
  addBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: t.accent,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },

  // Section
  sectionHeader: { backgroundColor: "transparent", paddingVertical: 8 * scale, paddingHorizontal: 4 },
  sectionHeaderText: { fontSize: 22, lineHeight: HEADER_LINE, fontWeight: "600", color: t.text },

  // Loading / empty
  emptyContainer: { alignItems: "center", marginTop: 60 },
  noStudentsText: { fontSize: 16, color: t.textSecondary, textAlign: "center", marginTop: 16 },
  navigatingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: t.overlay, justifyContent: "center", alignItems: "center", zIndex: 1000 },

  // ── Week picker modal (redesigned) ──
  modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: t.overlay, paddingHorizontal: 20 },
  weekModalCard: {
    width: "100%", maxWidth: 400, backgroundColor: t.surface, borderRadius: 18,
    borderWidth: 1, borderColor: t.border, overflow: "hidden",
    // Of the overlay, so it is still right after an iPad rotates.
    maxHeight: "78%",
  },
  weekModalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
  },
  weekModalTitle: { fontSize: 20, color: t.text, fontWeight: "700" },
  weekModalSubtitle: { fontSize: 13, color: t.textSecondary, marginTop: 4 },
  weekModalClose: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: t.fill,
    alignItems: "center", justifyContent: "center",
  },

  thisWeekRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 16, marginBottom: 4, paddingVertical: 14, paddingHorizontal: 14,
    borderRadius: 12, backgroundColor: t.fill,
    borderWidth: 1, borderColor: t.border,
  },
  thisWeekIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: t.accentFill,
    alignItems: "center", justifyContent: "center",
  },
  thisWeekTitle: { fontSize: 15, color: t.text, fontWeight: "600" },
  thisWeekDate: { fontSize: 13, color: t.textSecondary, marginTop: 1 },

  weekModalDivider: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  weekModalDividerText: {
    fontSize: 11, color: t.textTertiary, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.6,
  },

  weekListWrap: { position: "relative", flexShrink: 1 },
  dateList: { width: "100%", paddingHorizontal: 16 },
  weekRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 14, paddingHorizontal: 14, marginBottom: 8,
    borderRadius: 12, backgroundColor: t.fill,
    borderWidth: 1, borderColor: t.border,
  },
  weekRowSelected: { backgroundColor: t.accentFill, borderColor: "rgba(20,126,251,0.4)" },
  weekRowText: { fontSize: 15, color: t.text, fontWeight: "500" },
  weekRowTextSelected: { color: t.text, fontWeight: "700" },
  weekListFade: {
    position: "absolute", left: 0, right: 0, bottom: 0, height: 28,
    // subtle fade so it's obvious the list scrolls
    backgroundColor: "transparent",
    borderBottomLeftRadius: 18, borderBottomRightRadius: 18,
  },

  // Centered card (add manual servant — no slide animation)
  sheetOverlayCentered: { flex: 1, backgroundColor: t.overlay, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  sheetDismiss: { ...StyleSheet.absoluteFillObject },
  centeredCard: {
    width: "100%", maxWidth: 400, backgroundColor: t.surface, borderRadius: 20,
    borderWidth: 1, borderColor: t.border, overflow: "hidden",
    maxHeight: "82%",
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: t.border },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: t.text },
  sheetClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: t.fill, alignItems: "center", justifyContent: "center" },
  sheetCloseX: { color: t.textSecondary, fontSize: 20, fontWeight: "300", marginTop: -1 },
  sheetBody: { paddingHorizontal: 20, paddingTop: 16 },
  sheetFooter: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: t.border },
  sheetCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: t.fill, alignItems: "center" },
  sheetCancelText: { color: t.textSecondary, fontSize: 15, fontWeight: "600" },
  sheetConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: t.accent, alignItems: "center" },
  sheetConfirmText: { color: t.onAccent, fontSize: 15, fontWeight: "600" },

  // Add servant form
  photoPickerRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  photoPickerCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: t.fill, borderWidth: 1, borderColor: t.borderStrong, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  photoPickerImage: { width: 64, height: 64, borderRadius: 32 },
  photoPickerLabel: { color: t.accentText, fontSize: 14, fontWeight: "500" },
  inputLabel: { color: t.textSecondary, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  textInput: { backgroundColor: t.fill, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: t.text, fontSize: 15, marginBottom: 16, borderWidth: 1, borderColor: t.border },
  sheetNote: { flexDirection: "row", gap: 8, backgroundColor: t.fill, borderRadius: 10, padding: 12, marginBottom: 8 },
  sheetNoteText: { flex: 1, color: t.textTertiary, fontSize: 12, lineHeight: 17 },
}));

export default ServantsAttendance;