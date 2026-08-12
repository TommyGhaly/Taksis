import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Switch,
  Alert,
  FlatList,
  Dimensions,
  Platform,
  ScrollView,
  RefreshControl,
  TextInput,
  Keyboard,
  Animated,
  PixelRatio,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Slider from "@react-native-community/slider";
import IndividualProfile from "../../components/individualProfile";
import AlphabetIndexBar from "../../components/AlphabetIndexBar";
import DeaconSyncModal from "../../components/DeaconSyncModal";
import Avatar from "../../components/Avatar";
import SkeletonScreen from "../../components/Skeleton";
import * as avatarCache from "../../utils/avatarCache";
import { LIST_PERF } from "../../utils/listConfig";
import {
  makeSectionListGetItemLayout,
  makeRowHeightAudit,
} from "../../utils/sectionListLayout";
import { getDocsByIds, watchDocsByIds } from "../../utils/firestoreBatch";
import {
  dateKeyToSortable,
  fullDateLabel,
  sortableCutoffWeeksAgo,
} from "../../utils/dateKeys";

import { useFirestoreDocument } from "../../hooks/useFirebaseCache";
import { useAfterInteractions } from "../../hooks/useAfterInteractions";

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const formatNumber = (num) => {
  if (!num && num !== 0) return "N/A";
  if (num % 1 === 0) return num.toString();
  return num.toFixed(2).replace(/\.?0+$/, "");
};

/**
 * How many weeks back counts as "recent" (12 weeks ≈ 3 months).
 *
 * The `filterRecent` helper that used to live here is gone: it allocated a cutoff
 * Date plus one Date per entry, and it was being called from inside render bodies.
 * Recency is now decided by comparing integer date keys against
 * `sortableCutoffWeeksAgo(RECENT_WEEKS)`, computed once per data pass.
 *
 * One deliberate semantic change: the cutoff is now day-granular rather than
 * carrying the current time of day, so an entry dated exactly 12 weeks ago counts
 * as recent all day instead of expiring partway through it. That is the more
 * defensible reading of a date-only key.
 *
 * The date label formatter also moved out, to `fullDateLabel` in utils/dateKeys.js,
 * which caches per date instead of re-running Intl per row per render.
 */
const RECENT_WEEKS = 12;

// Returns { color, bg, border } based on 0-1=neutral, 2-3=amber, 4+=red
const pillTheme = (count) => {
  if (count >= 4) return { color: "#ff3b30", bg: "rgba(255,59,48,0.12)", border: "rgba(255,59,48,0.3)" };
  if (count >= 2) return { color: "#ff9f0a", bg: "rgba(255,159,10,0.12)", border: "rgba(255,159,10,0.28)" };
  return { color: "rgba(255,255,255,0.35)", bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.1)" };
};

const { width, height } = Dimensions.get("window");
const isTablet = Platform.isPad || (width >= 768 && height >= 768);
const scale = isTablet ? 1.2 : 1;
const paddingHorizontal = isTablet ? 32 : 16;

// ---------- Fixed row metrics ----------
//
// This screen has two row types and swaps between them on `attendanceMode`, so
// there are two row constants (ROW_H / ATT_CARD_H below) and the getItemLayout
// is built per mode.
//
// Explicit line heights, because a Text with no lineHeight gets the font's
// natural line box, which JS cannot compute and which differs across platforms.
// PILL_H and SAVE_BTN_H are pinned because their tallest children are an Ionicons
// glyph and an ActivityIndicator respectively — neither is computable, and the
// save button in particular swapped between a 13pt Text and a "small" spinner,
// which made the card change height mid-save.
//
// Note `styles` scales with device class but `aStyles` does not, so the deacon
// row is scale-dependent and the attendance card is one flat number.
const NAME_LINE = 20;
const DETAIL_LINE = 17;
const HEADER_LINE = 26;
const CARD_NAME_LINE = 17;
const PILL_H = 22;
const SLIDER_LABEL_LINE = 14;
const SAVE_BTN_TEXT_LINE = 16;
const SAVE_BTN_H = 30;

// RN scales a declared lineHeight by the OS font scale (allowFontScaling defaults
// to on), so the height arithmetic has to scale it too or every constant below is
// wrong for anyone using large text.
const FONT_SCALE = PixelRatio.getFontScale();
const LH = (v) => v * FONT_SCALE;

// deaconItem: 1px border top and bottom, 16*scale padding all round, then the
// tallest of the avatar, the five-line info block and the pencil icon, then its
// own margin. The info block normally wins by a wide margin.
const DEACON_INFO_H =
  LH(NAME_LINE * scale) + 4 * (4 * scale + LH(DETAIL_LINE * scale));
const DEACON_ROW_H =
  2 + 32 * scale + Math.max(48 * scale, DEACON_INFO_H) + 12 * scale;

// The attendance card uses aStyles, which does not scale with device class, so
// this is one flat number on phone and tablet alike.
//   topRow      = paddingTop 10 + max(avatar 36, nameBlock) + paddingBottom 8
//   nameBlock   = name line + its 4px margin + the pill row
//   sliderBlock = 1px top border + paddingTop 6 + (label + slider) x2
//                 + save button + its margin + paddingBottom 8
const ATT_TOP_ROW_H =
  10 + Math.max(36, LH(CARD_NAME_LINE) + 4 + PILL_H) + 8;
const ATT_SLIDER_BLOCK_H =
  1 + 6 + 2 * (LH(SLIDER_LABEL_LINE) + 28) + 4 + SAVE_BTN_H + 8;
const ATT_CARD_H = 2 + ATT_TOP_ROW_H + ATT_SLIDER_BLOCK_H + 8;

// sectionHeader: 8*scale padding top and bottom around one 22*scale line. Shared
// by both modes — only the row swaps.
const HDR_H = 16 * scale + LH(HEADER_LINE * scale);

const auditDeaconRow = makeRowHeightAudit("DeaconRow", DEACON_ROW_H, 12 * scale);
const auditAttendanceCard = makeRowHeightAudit("AttendanceCard", ATT_CARD_H, 8);

// ─── Attendance card ──────────────────────────────────────────────────────────
const AttendanceCard = React.memo(({ deacon, onPillPress, onProfilePress }) => {
  const [tempExp, setTempExp] = useState(deacon.experience ?? 0);
  const [tempFreq, setTempFreq] = useState(deacon.frequency ?? 0);
  const [saving, setSaving] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Counts arrive precomputed from `deaconsWithAttendance`. They used to be two
  // `filterRecent` calls in this render body, each allocating a cutoff Date plus
  // one Date per entry — for every mounted card, on every render.
  const recentUnavailableCount = deacon.recentUnavailableCount ?? 0;
  const recentSwitchedCount = deacon.recentSwitchedCount ?? 0;
  const unavailTheme = pillTheme(recentUnavailableCount);
  const switchedTheme = pillTheme(recentSwitchedCount);

  const triggerPulse = () => {
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 0.88, duration: 100, useNativeDriver: true }),
      Animated.spring(pulseAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const batch = firestore().batch();
      const churchRef = firestore().collection("churches").doc(deacon.churchId);
      const churchDoc = await churchRef.get();
      if (!churchDoc.exists) throw new Error("Church not found");
      const churchData = churchDoc.data();
      const deacons = churchData.deacons || [];

      const syncDeacon = (uid, experience, frequency) => {
        const idx = deacons.findIndex((d) => d.uid === uid);
        if (idx !== -1) deacons[idx] = { ...deacons[idx], experience, frequency };
      };

      // Check if this is a child (no own user doc — parent has children[])
      const userDoc = await firestore().collection("users").doc(deacon.uid).get();
      const isChild = !userDoc.exists;

      if (isChild) {
        // Find parent
        const allUsersSnap = await firestore()
          .collection("users")
          .where("church", "==", deacon.churchId)
          .get();
        let parentRef = null, parentData = null;
        for (const doc of allUsersSnap.docs) {
          const d = doc.data();
          if ((d.children || []).some((c) => c.uid === deacon.uid)) {
            parentRef = doc.ref;
            parentData = d;
            break;
          }
        }
        if (parentRef && parentData) {
          const updatedChildren = (parentData.children || []).map((c) =>
            c.uid === deacon.uid
              ? { ...c, experience: tempExp ?? 0, frequency: tempFreq ?? 0 }
              : c
          );
          // If frequency changed, sync across parent + all siblings
          if ((deacon.frequency ?? 0) !== tempFreq) {
            const syncedChildren = updatedChildren.map((c) => ({ ...c, frequency: tempFreq ?? 0 }));
            batch.update(parentRef, { frequency: tempFreq ?? 0, children: syncedChildren });
            syncDeacon(parentData.uid || parentRef.id, deacons.find(d => d.uid === (parentData.uid || parentRef.id))?.experience ?? 0, tempFreq ?? 0);
            syncedChildren.forEach((c) => syncDeacon(c.uid, c.experience ?? 0, tempFreq ?? 0));
          } else {
            batch.update(parentRef, { children: updatedChildren });
          }
          syncDeacon(deacon.uid, tempExp ?? 0, tempFreq ?? 0);
        }
      } else {
        // Regular user
        const userRef = firestore().collection("users").doc(deacon.uid);
        batch.update(userRef, { experience: tempExp ?? 0, frequency: tempFreq ?? 0 });

        // Sync children if frequency changed
        const userData = userDoc.data();
        if ((userData.children?.length > 0) && (deacon.frequency ?? 0) !== tempFreq) {
          const syncedChildren = (userData.children || []).map((c) => ({ ...c, frequency: tempFreq ?? 0 }));
          batch.update(userRef, { children: syncedChildren });
          syncedChildren.forEach((c) => syncDeacon(c.uid, c.experience ?? 0, tempFreq ?? 0));
        }
        syncDeacon(deacon.uid, tempExp ?? 0, tempFreq ?? 0);
      }

      batch.update(churchRef, { deacons });
      await batch.commit();
      ReactNativeHapticFeedback.trigger("notificationSuccess", hapticOptions);
      triggerPulse();
    } catch {
      Alert.alert("Error", "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={aStyles.card} onLayout={auditAttendanceCard}>
      {/* Top row: avatar + name + pills */}
      <View style={aStyles.topRow}>
        {/* Tapping the avatar or the name opens the profile, same destination
            as the whole-row tap in non-attendance mode. */}
        <Avatar
          uid={deacon.uid}
          user={deacon}
          size={36}
          borderRadius={18}
          style={aStyles.avatar}
          showBorder={false}
          onPress={onProfilePress ? () => onProfilePress(deacon) : undefined}
        />
        <View style={aStyles.nameBlock}>
          <TouchableOpacity
            onPress={() => onProfilePress?.(deacon)}
            activeOpacity={0.7}
            disabled={!onProfilePress}
          >
            <Text style={aStyles.name} numberOfLines={1}>{deacon.name || "Unknown"}</Text>
          </TouchableOpacity>
          <View style={aStyles.pillRow}>
            <TouchableOpacity
              style={[aStyles.pill, { backgroundColor: unavailTheme.bg, borderColor: unavailTheme.border }]}
              onPress={() => onPillPress("unavailable", deacon)}
              activeOpacity={0.75}
            >
              <Ionicons name="close-circle-outline" size={12} color={unavailTheme.color} />
              <Text style={[aStyles.pillText, { color: unavailTheme.color }]}>
                {recentUnavailableCount} unavailable
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[aStyles.pill, { backgroundColor: switchedTheme.bg, borderColor: switchedTheme.border }]}
              onPress={() => onPillPress("switched", deacon)}
              activeOpacity={0.75}
            >
              <Ionicons name="swap-horizontal-outline" size={12} color={switchedTheme.color} />
              <Text style={[aStyles.pillText, { color: switchedTheme.color }]}>
                {recentSwitchedCount} switched
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Sliders */}
      <View style={aStyles.sliderBlock}>
        <View style={aStyles.sliderRow}>
          <Text style={aStyles.sliderLabel}>Experience</Text>
          <Text style={aStyles.sliderValue}>{formatNumber(tempExp)}</Text>
        </View>
        <Slider
          value={tempExp}
          onValueChange={setTempExp}
          minimumValue={0}
          maximumValue={10}
          step={0.25}
          thumbTintColor="#147efb"
          minimumTrackTintColor="#147efb"
          maximumTrackTintColor="#333"
          style={aStyles.slider}
        />
        <View style={aStyles.sliderRow}>
          <Text style={aStyles.sliderLabel}>Frequency</Text>
          <Text style={aStyles.sliderValue}>{formatNumber(tempFreq)}</Text>
        </View>
        <Slider
          value={tempFreq}
          onValueChange={setTempFreq}
          minimumValue={0}
          maximumValue={10}
          step={0.25}
          thumbTintColor="#147efb"
          minimumTrackTintColor="#147efb"
          maximumTrackTintColor="#333"
          style={aStyles.slider}
        />
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[aStyles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={aStyles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
});
AttendanceCard.displayName = "AttendanceCard";

// ─── Pill detail modal ────────────────────────────────────────────────────────

/**
 * One date row in the pill sheet.
 *
 * `isRecent` and `label` are computed once per row when the list is built, not per
 * render. The label especially: it was `formatDateStr(item)` inline, which goes
 * through Intl's toLocaleDateString for every row on every render.
 */
const PillDateRow = React.memo(({ label, isRecent, accentColor }) => {
  const dotColor = isRecent ? accentColor : "rgba(255,255,255,0.2)";
  return (
    <View style={pmStyles.dateRow}>
      <View style={[pmStyles.dot, { backgroundColor: dotColor }]} />
      <Text style={[pmStyles.dateText, !isRecent && pmStyles.dateTextOld]}>{label}</Text>
      {isRecent && (
        <View
          style={[
            pmStyles.recentBadge,
            { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}35` },
          ]}
        >
          <Text style={[pmStyles.recentText, { color: accentColor }]}>recent</Text>
        </View>
      )}
    </View>
  );
});
PillDateRow.displayName = "PillDateRow";

const PillSeparator = () => <View style={pmStyles.sep} />;
// Index-suffixed on purpose. `unavailableWeeks` is a plain array that could in
// principle hold the same date twice, and unlike the attendance-history lists this
// one is a static snapshot of the deacon taken when the sheet opened — it never
// reorders or grows while mounted, so the index is stable and can't mismatch rows.
const pillKeyExtractor = (item, index) => `${item.date}-${index}`;

const PillModal = React.memo(({ visible, type, deacon, onClose }) => {
  const isUnavail = type === "unavailable";

  /**
   * Rows, newest first, with recency and label resolved up front.
   *
   * Previously this sorted in the render body with two Date allocations per
   * comparison, and `filterRecent` was called twice on the same array in both arms
   * of a ternary whose arms were identical.
   */
  const rows = useMemo(() => {
    if (!deacon) return [];
    const dates = (isUnavail ? deacon.unavailableWeeks : deacon.switched_weeks) || [];
    const cutoff = sortableCutoffWeeksAgo(RECENT_WEEKS);
    return dates
      .map((date) => {
        const sortKey = dateKeyToSortable(date);
        return {
          date,
          sortKey,
          isRecent: sortKey >= cutoff,
          label: fullDateLabel(date),
        };
      })
      .sort((a, b) => b.sortKey - a.sortKey);
  }, [deacon, isUnavail]);

  const recentCount = useMemo(
    () => rows.reduce((n, r) => (r.isRecent ? n + 1 : n), 0),
    [rows]
  );
  const accentColor = pillTheme(recentCount).color;

  const renderPillRow = useCallback(
    ({ item }) => (
      <PillDateRow label={item.label} isRecent={item.isRecent} accentColor={accentColor} />
    ),
    [accentColor]
  );

  if (!deacon) return null;
  const sorted = rows;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pmStyles.overlay}>
        <TouchableOpacity style={pmStyles.dismissArea} activeOpacity={1} onPress={onClose} />
        <View style={pmStyles.sheet}>
          {/* Drag handle */}
          <View style={pmStyles.handle} />

          <View style={pmStyles.header}>
            <View style={pmStyles.headerLeft}>
              <Ionicons
                name={isUnavail ? "close-circle-outline" : "swap-horizontal-outline"}
                size={18}
                color={accentColor}
              />
              <Text style={pmStyles.title}>
                {isUnavail ? "Marked Unavailable" : "Switched Off"}
              </Text>
            </View>
            <TouchableOpacity style={pmStyles.closeBtn} onPress={onClose}>
              <Text style={pmStyles.closeX}>×</Text>
            </TouchableOpacity>
          </View>

          <View style={pmStyles.subtitleRow}>
            <Text style={pmStyles.subtitle}>{deacon.name}</Text>
            <View style={[pmStyles.countBadge, { backgroundColor: `${accentColor}20`, borderColor: `${accentColor}40` }]}>
              <Text style={[pmStyles.countText, { color: accentColor }]}>{sorted.length} total</Text>
            </View>
          </View>

          {sorted.length === 0 ? (
            <Text style={pmStyles.empty}>No records found.</Text>
          ) : (
            <FlatList
              {...LIST_PERF}
              data={sorted}
              keyExtractor={pillKeyExtractor}
              showsVerticalScrollIndicator={true}
              bounces={true}
              style={pmStyles.list}
              contentContainerStyle={pmStyles.listContent}
              renderItem={renderPillRow}
              ItemSeparatorComponent={PillSeparator}
            />
          )}
        </View>
      </View>
    </Modal>
  );
});
PillModal.displayName = "PillModal";

// ─── Main screen ──────────────────────────────────────────────────────────────
/**
 * One roster row, memoized on the deacon record.
 *
 * The row used to be an inline closure rebuilt on every parent render, so any
 * unrelated state change re-rendered every mounted cell — with a 48px avatar in
 * each one, that showed up as a stutter mid-scroll.
 */
const DeaconRow = React.memo(({ item, onPress }) => (
  <TouchableOpacity style={styles.deaconItem} onPress={() => onPress(item)} activeOpacity={0.7} onLayout={auditDeaconRow}>
    <View style={styles.deaconImageContainer}>
      <Avatar
        uid={item.uid}
        user={item}
        size={48 * scale}
        borderRadius={24 * scale}
        style={styles.deaconImage}
        showBorder={false}
      />
    </View>
    {/* All five capped to one line so the card height is a constant. See ROW_H. */}
    <View style={styles.deaconInfo}>
      <Text style={styles.deaconName} numberOfLines={1}>{item.name || "Unknown"}</Text>
      <Text style={styles.deaconDetail} numberOfLines={1}>Age: {formatNumber(item.age)}</Text>
      <Text style={styles.deaconDetail} numberOfLines={1}>Phone: {item.phone !== undefined && item.phone !== null ? item.phone : "Not provided"}</Text>
      <Text style={styles.deaconDetail} numberOfLines={1}>Experience: {formatNumber(item.experience)}</Text>
      <Text style={styles.deaconDetail} numberOfLines={1}>Frequency: {formatNumber(item.frequency)}</Text>
    </View>
    <Ionicons name="pencil" size={20 * scale} color="#147efb" />
  </TouchableOpacity>
));
DeaconRow.displayName = "DeaconRow";

const SectionHeader = React.memo(({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
));
SectionHeader.displayName = "SectionHeader";

const DeaconEdits = () => {
  const user = auth().currentUser;

  // Hold every Firestore read until the drawer/stack transition has finished
  // animating — the listeners below would otherwise stall it mid-slide.
  const ready = useAfterInteractions();

  const [currentChurch, setCurrentChurch] = useState(null);
  // The church whose deacon snapshot has actually delivered. Without this the
  // screen flashes "No deacons found." in the gap between `currentChurch`
  // resolving and the church listener re-attaching for it.
  const [loadedChurch, setLoadedChurch] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deacons, setDeacons] = useState([]);
  const [selectedDeacon, setSelectedDeacon] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isLoadingDeacons, setIsLoadingDeacons] = useState(true);
  const [userDataLoading, setUserDataLoading] = useState(true);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Attendance mode
  const [attendanceMode, setAttendanceMode] = useState(false);
  const [attendanceData, setAttendanceData] = useState({}); // uid -> { unavailableWeeks, switched_weeks }
  const [pillModal, setPillModal] = useState({ visible: false, type: null, deacon: null });

  const sectionListRef = useRef(null);
  const deaconsListenerRef = useRef(null);
  const userListenerRef = useRef(null);
  // uid -> user doc (or null for uids that have no users doc, e.g. children and
  // manually-created deacons). Memoised across snapshots so a write to
  // churches/{id} does not re-read every deacon's user doc again.
  const userDocsRef = useRef(new Map());
  const attendanceListenersRef = useRef([]);
  // Coalesced attendance updates: several chunk listeners delivering in the same
  // tick produce one setState, not one each.
  const pendingAttendance = useRef(null);
  const pendingAttendanceFlush = useRef(null);
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

  // User listener
  useEffect(() => {
    if (!ready) return;
    if (!user?.uid) { setUserDataLoading(false); return; }
    if (userListenerRef.current) { userListenerRef.current(); userListenerRef.current = null; }
    userListenerRef.current = firestore()
      .collection("users").doc(user.uid)
      .onSnapshot(
        (doc) => {
          if (doc.exists) {
            const newChurch = doc.data()?.church || null;
            if (newChurch !== currentChurch) setCurrentChurch(newChurch);
          }
          setUserDataLoading(false);
        },
        () => setUserDataLoading(false)
      );
    return () => { if (userListenerRef.current) { userListenerRef.current(); userListenerRef.current = null; } };
  }, [user?.uid, ready]);

  // Read the user docs for a set of uids in chunks rather than one request per
  // deacon, and only for uids we have not already read. The chunking itself lives
  // in utils/firestoreBatch.js so the chunk size is defined once for the whole app;
  // the memoization and the "record the misses" behaviour stay here.
  const loadUserDocs = useCallback(async (uids) => {
    const missing = uids.filter((uid) => uid && !userDocsRef.current.has(uid));
    if (missing.length === 0) return userDocsRef.current;

    const fetched = await getDocsByIds("users", missing);
    // getDocsByIds already reports misses as null, so this copies both hits and
    // misses across — without the misses, every church write would retry them.
    fetched.forEach((value, uid) => userDocsRef.current.set(uid, value));

    return userDocsRef.current;
  }, []);

  // Process deacon list
  const processDeaconList = useCallback(async (deaconList, churchData) => {
    try {
      const userDocs = await loadUserDocs(deaconList.map((d) => d.uid));

      // Zero-cost avatar priming: these docs carry photoURL, so no Storage
      // round-trip is needed for anybody who has uploaded a picture.
      avatarCache.primeMany([...userDocs.values()].filter(Boolean));

      const withPhone = deaconList.map((deacon) => {
        const userData = deacon.uid ? userDocs.get(deacon.uid) : null;
        return {
          ...deacon,
          phone: userData ? userData.phone || userData.number || "Not provided" : "Not provided",
          // Carried through from the same batched user docs we just read for the
          // phone. These fields live on those documents, and this pass used to
          // discard them — which is why attendance mode had to open its own
          // listener per deacon just to fetch data already sitting in memory.
          // Seeding them here means attendance mode paints instantly on toggle
          // instead of popping in one row at a time.
          unavailableWeeks: userData?.unavailableWeeks || [],
          switched_weeks: userData?.switched_weeks || [],
        };
      });

      // Sort on a precomputed key rather than lowercasing `name` in place and
      // then restoring it from `deaconList.find(...)` — that restore pass was a
      // linear scan per deacon, so O(n²) every time the church doc changed.
      // Unlike the admin rosters this one was NOT dead code: it genuinely put the
      // display name back after the sort clobbered it. The key keeps that
      // trimmed-sort / raw-display behaviour exactly.
      const sorted = withPhone
        .map((d) => {
          const name = String(d.name ?? "");
          const uid = String(d.uid ?? "");
          return { item: { ...d, name }, key: name.trim().toLowerCase(), uid };
        })
        .sort(
          (a, b) =>
            a.key.localeCompare(b.key) ||
            (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0)
        )
        .map((entry) => entry.item);

      setDeacons(sorted);
    } catch (err) {
      console.error("Error processing deacons:", err);
    }
  }, [loadUserDocs]);

  // Build sections.
  //
  // Derived with useMemo, not state-in-an-effect. An effect runs *after* the
  // render that set `deacons`, so in that first frame `deacons` was full while
  // `sections` was still [] — and the "No deacons found." branch below painted
  // before the effect caught up. Deriving it keeps the two consistent within a
  // single render. (attendanceSections below was already derived this way.)
  const sections = useMemo(() => {
    if (deacons.length === 0) return [];
    const lower = searchQuery.trim().toLowerCase();
    const filtered = lower ? deacons.filter((d) => (d.name || "").toLowerCase().includes(lower)) : deacons;
    const grouped = filtered.reduce((acc, d) => {
      const c = (d.name || "").charAt(0).toUpperCase();
      const key = /^[A-Z]$/.test(c) ? c : "#";
      if (!acc[key]) acc[key] = [];
      acc[key].push(d);
      return acc;
    }, {});
    return Object.keys(grouped)
      .sort((a, b) => a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b))
      .map((title) => ({ title, data: grouped[title] }));
  }, [deacons, searchQuery]);

  // Church / deacons listener
  useEffect(() => {
    if (!ready) return;
    if (deaconsListenerRef.current) { deaconsListenerRef.current(); deaconsListenerRef.current = null; }
    // A different church means a different set of people — drop the memoised
    // user docs so they are re-read for the new roster.
    userDocsRef.current = new Map();
    if (!currentChurch) { setDeacons([]); setLoadedChurch(null); setIsLoadingDeacons(false); return; }
    setIsLoadingDeacons(true);
    deaconsListenerRef.current = firestore()
      .collection("churches").doc(currentChurch)
      .onSnapshot(
        async (doc) => {
          if (doc.exists) {
            const churchData = doc.data();
            const deaconData = (churchData.deacons || []).map((d) => ({ ...d, churchId: currentChurch }));
            await processDeaconList(deaconData, churchData);
          } else {
            setDeacons([]);
          }
          setLoadedChurch(currentChurch);
          setIsLoadingDeacons(false);
        },
        (err) => {
          console.error("Listener error:", err);
          Alert.alert("Error", "Failed to fetch deacons.");
          setLoadedChurch(currentChurch);
          setIsLoadingDeacons(false);
        }
      );
    return () => { if (deaconsListenerRef.current) { deaconsListenerRef.current(); deaconsListenerRef.current = null; } };
  }, [currentChurch, processDeaconList, ready]);

  // Profile pictures are handled entirely by <Avatar> + avatarCache, primed
  // for free from the batched user docs in processDeaconList.

  const attendanceUids = useMemo(
    () => deacons.map((d) => d.uid).filter(Boolean),
    [deacons]
  );
  /**
   * A stable identity for "which deacons the attendance listeners cover".
   *
   * The effect below used to depend on `deacons` directly, and `setDeacons` hands
   * it a fresh array on every churches/{id} snapshot — so any unrelated write to
   * the church document tore down and re-attached every attendance listener while
   * the mode was open. Depending on the sorted uid list as a string means
   * re-attaching happens only when the membership actually changes. The effect
   * still closes over `attendanceUids`, which is safe precisely because it only
   * re-runs when this key says the contents differ.
   */
  const attendanceUidsKey = useMemo(
    () => attendanceUids.slice().sort().join(","),
    [attendanceUids]
  );

  /**
   * Attendance data listeners — only while the mode is active.
   *
   * This used to attach one `onSnapshot` per deacon, each calling
   * `setAttendanceData` directly. Every one of the N deliveries rebuilt all N
   * objects in `deaconsWithAttendance`, which broke `AttendanceCard`'s memo for
   * every row — so entering attendance mode on a 60-deacon church cost on the
   * order of N² card renders, each mounting three `useState`s and an
   * `Animated.Value` and running the recency filter twice.
   *
   * Now: one listener per chunk of 30 uids (60 deacons → 2 listeners), and
   * deliveries are coalesced into a single `setAttendanceData` per tick using the
   * pending-ref pattern from SundaySchoolAttendance.js:402-441.
   *
   * The rows are already seeded from the batched user docs in `processDeaconList`,
   * so this is purely about staying live — nothing here gates first paint.
   */
  useEffect(() => {
    if (!ready) return;

    attendanceListenersRef.current.forEach((u) => u());
    attendanceListenersRef.current = [];

    if (!attendanceMode || attendanceUids.length === 0) return;
    const uids = attendanceUids;

    const flush = () => {
      pendingAttendanceFlush.current = null;
      const pending = pendingAttendance.current;
      pendingAttendance.current = null;
      if (!pending) return;
      setAttendanceData((prev) => ({ ...prev, ...pending }));
    };

    const unsub = watchDocsByIds("users", uids, {
      onDocs: (docs) => {
        if (docs.length === 0) return;
        const pending = pendingAttendance.current || (pendingAttendance.current = {});
        for (const data of docs) {
          avatarCache.primeFromUser(data);
          pending[data.uid] = {
            unavailableWeeks: data.unavailableWeeks || [],
            switched_weeks: data.switched_weeks || [],
          };
        }
        // One setState per tick no matter how many chunks land together.
        if (!pendingAttendanceFlush.current) {
          pendingAttendanceFlush.current = setTimeout(flush, 0);
        }
      },
    });

    attendanceListenersRef.current = [unsub];
    return () => {
      unsub();
      attendanceListenersRef.current = [];
      if (pendingAttendanceFlush.current) {
        clearTimeout(pendingAttendanceFlush.current);
        pendingAttendanceFlush.current = null;
      }
      pendingAttendance.current = null;
    };
  }, [attendanceMode, attendanceUidsKey, ready]);

  const openEditModal = useCallback((deacon) => {
    if (!deacon?.uid) return;
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setSelectedDeacon(deacon);
    setModalVisible(true);
  }, []);

  const handleCancel = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setModalVisible(false);
    setSelectedDeacon(null);
  };

  const scrollToSection = (letter) => {
    // `activeSections`, not `sections`: in attendance mode the list renders
    // attendanceSections, and AlphabetIndexBar's availableLetters comes from
    // activeSections too. Indexing `sections` happened to agree because both
    // group the same deacons under the same letters, but it was resolving an
    // index against a different array than the one being scrolled.
    const idx = activeSections.findIndex((s) => s.title === letter);
    if (idx < 0 || !sectionListRef.current) return;
    sectionListRef.current.scrollToLocation({
      // itemIndex 0 is the section header's own slot. It used to be 1, which
      // targets data item 0 and only lands on the header because sticky-header
      // handling subtracts the header's height back off — which in turn needed
      // the header's frame to be known. 0 addresses it directly.
      sectionIndex: idx, itemIndex: 0, animated: false, viewPosition: 0, viewOffset: 0,
    });
  };

  /**
   * Row heights differ between the two modes, so the layout is rebuilt when the
   * mode flips. `useMemo` rather than `useCallback` deliberately: the factory
   * instance owns a prefix-table cache, and a fresh instance is what forces that
   * table to be rebuilt with the other mode's row height instead of reused.
   */
  const getItemLayout = useMemo(
    () =>
      makeSectionListGetItemLayout({
        getItemHeight: () => (attendanceMode ? ATT_CARD_H : DEACON_ROW_H),
        getSectionHeaderHeight: () => HDR_H,
      }),
    [attendanceMode]
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (user?.uid) {
        // A manual refresh is the one place we do want to re-read user docs.
        userDocsRef.current = new Map();
        const doc = await firestore().collection("users").doc(user.uid).get();
        if (doc.exists) {
          const church = doc.data()?.church || null;
          if (church !== currentChurch) {
            setCurrentChurch(church);
          } else if (church) {
            const cDoc = await firestore().collection("churches").doc(church).get();
            if (cDoc.exists) await processDeaconList(cDoc.data().deacons || [], cDoc.data());
          }
        }
      }
    } catch { Alert.alert("Error", "Failed to refresh."); }
    finally { setIsRefreshing(false); }
  }, [user?.uid, currentChurch, processDeaconList]);

  /**
   * Merge live attendance data into the deacon objects, and precompute the two
   * "recent" counts the card displays.
   *
   * Two things matter here:
   *
   *  - Rows with no live update keep their *existing object identity*, so
   *    `AttendanceCard`'s memo actually holds for them. The old version spread
   *    every deacon into a new object on every change, which guaranteed a full
   *    re-render of every mounted card.
   *  - The recency filter runs once per deacon here rather than twice per card per
   *    render. The cutoff is computed once per pass — deliberately not at module
   *    scope, which would freeze the 12-week window at app launch and stop it
   *    advancing across midnight in a long-running session.
   */
  const deaconsWithAttendance = useMemo(() => {
    const cutoff = sortableCutoffWeeksAgo(RECENT_WEEKS);
    const countRecent = (dates) => {
      if (!Array.isArray(dates)) return 0;
      let n = 0;
      for (const d of dates) if (dateKeyToSortable(d) >= cutoff) n += 1;
      return n;
    };

    return deacons.map((d) => {
      const live = attendanceData[d.uid];
      const unavailableWeeks = live ? live.unavailableWeeks : d.unavailableWeeks || [];
      const switched_weeks = live ? live.switched_weeks : d.switched_weeks || [];
      return {
        ...d,
        unavailableWeeks,
        switched_weeks,
        recentUnavailableCount: countRecent(unavailableWeeks),
        recentSwitchedCount: countRecent(switched_weeks),
      };
    });
  }, [deacons, attendanceData]);

  // Build sections for attendance mode (same structure, different data)
  const attendanceSections = useMemo(() => {
    const lower = searchQuery.trim().toLowerCase();
    const filtered = lower
      ? deaconsWithAttendance.filter((d) => (d.name || "").toLowerCase().includes(lower))
      : deaconsWithAttendance;
    const grouped = filtered.reduce((acc, d) => {
      const c = (d.name || "").charAt(0).toUpperCase();
      const key = /^[A-Z]$/.test(c) ? c : "#";
      if (!acc[key]) acc[key] = [];
      acc[key].push(d);
      return acc;
    }, {});
    return Object.keys(grouped)
      .sort((a, b) => a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b))
      .map((title) => ({ title, data: grouped[title] }));
  }, [deaconsWithAttendance, searchQuery]);

  const activeSections = attendanceMode ? attendanceSections : sections;

  // AlphabetIndexBar takes this as an array prop, so building it inline in the JSX
  // gave it a new identity every render and defeated its memoization.
  const availableLetters = useMemo(
    () => activeSections.map((s) => s.title),
    [activeSections]
  );

  const renderSectionHeader = useCallback(
    ({ section: { title } }) => <SectionHeader title={title} />,
    []
  );

  const openPillModal = useCallback(
    (type, deacon) => setPillModal({ visible: true, type, deacon }),
    []
  );

  const renderDeacon = useCallback(
    ({ item }) =>
      attendanceMode ? (
        <AttendanceCard
          deacon={item}
          onPillPress={openPillModal}
          onProfilePress={openEditModal}
        />
      ) : (
        <DeaconRow item={item} onPress={openEditModal} />
      ),
    [attendanceMode, openPillModal, openEditModal]
  );

  const keyExtractor = useCallback((item) => item.uid, []);

  // Also hold the skeleton while `currentChurch` is known but its deacon
  // snapshot has not landed yet, otherwise "No deacons found." flashes in the
  // frame between the user doc resolving and the church listener re-attaching.
  if (
    !ready ||
    userDataLoading ||
    isLoadingDeacons ||
    (currentChurch && loadedChurch !== currentChurch)
  ) {
    return (
      <SkeletonScreen
        variant="personCards"
        count={8}
        showHeader={false}
        rowLines={3}
        paddingHorizontal={paddingHorizontal}
        paddingTop={20}
        // Matches listContainer's inset for the alphabet index bar.
        bodyStyle={{ paddingRight: 32 }}
        header={
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>Deacons</Text>
          </View>
        }
      />
    );
  }

  if (!currentChurch) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.errorText, { fontSize: 18 * scale }]}>No Church Selected</Text>
        <Text style={[styles.errorSubtext, { fontSize: 14 * scale }]}>Please select a church in your profile settings.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingHorizontal }]}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Deacons</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={[styles.headerBtn, attendanceMode && styles.headerBtnActive]}
            onPress={() => {
              ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
              setAttendanceMode((v) => !v);
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="bar-chart-outline"
              size={15}
              color={attendanceMode ? "#fff" : "#ff9f0a"}
            />
            <Text style={[styles.headerBtnText, { color: attendanceMode ? "#fff" : "#ff9f0a" }, attendanceMode && { color: "#fff" }]}>
              Attendance
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setSyncModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="sync" size={15} color="#147efb" />
            <Text style={[styles.headerBtnText, { color: "#147efb" }]}>Sync</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Mode label */}
      {attendanceMode && (
        <View style={styles.modeBanner}>
          <Ionicons name="bar-chart-outline" size={13} color="#ff9f0a" />
          <Text style={styles.modeBannerText}>Attendance Monitor — last 12 weeks</Text>
        </View>
      )}

      {activeSections.length === 0 ? (
        <ScrollView
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#147efb" colors={["#147efb"]} />}
          contentContainerStyle={styles.centered}
        >
          <Text style={[styles.noData, { fontSize: 16 * scale }]}>
            {searchQuery.trim() ? "No deacons match your search." : "No deacons found."}
          </Text>
          <Text style={[styles.noDataSubtext, { fontSize: 14 * scale }]}>
            {searchQuery.trim() ? "Try a different name." : "Pull down to refresh"}
          </Text>
        </ScrollView>
      ) : (
        <View style={styles.listWrapper}>
          <SectionList
            ref={sectionListRef}
            sections={activeSections}
            renderItem={renderDeacon}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={true}
            {...LIST_PERF}
            // Deliberately no `removeClippedSubviews`, even on Android: the
            // attendance cards carry Animated transforms and clipping them risks
            // the same blanking class it caused on iOS elsewhere.
            //
            // Also deliberately no `extraData`. It was `[attendanceData,
            // attendanceMode]` — a fresh array literal every render, so
            // SectionList's PureComponent bail-out could never hold — and it had no
            // job either way, since `activeSections` is already a new array
            // whenever the attendance data changes.
            //
            // Both row types are a fixed height, so the offset of any letter is
            // known without having rendered it. This is what makes the A-Z bar
            // land instantly instead of failing: there used to be a no-op
            // onScrollToIndexFailed here, which meant tapping a far letter did
            // nothing at all. That handler is unreachable once getItemLayout is
            // set (VirtualizedList guards the whole failure path on it), so it is
            // gone rather than kept as a silent catch-all.
            getItemLayout={getItemLayout}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#147efb" colors={["#147efb"]} />}
          />
          {!searchQuery.trim() && (
            <View style={{ position: "absolute", top: 100 * scale, right: 0, width: 30 }}>
              <AlphabetIndexBar
                onLetterChange={scrollToSection}
                availableLetters={availableLetters}
              />
            </View>
          )}
        </View>
      )}

      {/* Floating search bar */}
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
                placeholder="Search deacons"
                placeholderTextColor="rgba(255,255,255,0.55)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
          </View>
        </BlurView>
      </Animated.View>

      {/* Standard edit modal */}
      {selectedDeacon && (
        <IndividualProfile
          userId={selectedDeacon.uid}
          show={modalVisible}
          onClose={handleCancel}
          church={currentChurch}
          week=""
          family=""
          url=""
        />
      )}

      <DeaconSyncModal
        visible={syncModalVisible}
        onClose={() => setSyncModalVisible(false)}
        churchId={currentChurch}
      />

      {/* Pill detail modal */}
      <PillModal
        visible={pillModal.visible}
        type={pillModal.type}
        deacon={pillModal.deacon}
        onClose={() => setPillModal({ visible: false, type: null, deacon: null })}
      />
    </View>
  );
};

// ─── Attendance card styles ───────────────────────────────────────────────────
const aStyles = StyleSheet.create({
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  nameBlock: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    lineHeight: CARD_NAME_LINE,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  pillRow: {
    flexDirection: "row",
    gap: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    height: PILL_H,
    paddingHorizontal: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  sliderBlock: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
  },
  sliderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 0,
  },
  sliderLabel: {
    fontSize: 11,
    lineHeight: SLIDER_LABEL_LINE,
    fontWeight: "500",
    color: "rgba(255,255,255,0.45)",
  },
  sliderValue: {
    fontSize: 11,
    lineHeight: SLIDER_LABEL_LINE,
    fontWeight: "600",
    color: "#fff",
  },
  slider: {
    width: "100%",
    height: 28,
    marginBottom: 0,
  },
  // Height pinned rather than derived from padding: this button swaps its Text
  // for an ActivityIndicator while saving, and a "small" spinner is taller than
  // a 13pt line — so the card used to grow a few px mid-save.
  saveBtn: {
    backgroundColor: "#147efb",
    borderRadius: 8,
    height: SAVE_BTN_H,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 13,
    lineHeight: SAVE_BTN_TEXT_LINE,
    fontWeight: "600",
  },
});

// ─── Pill modal styles ────────────────────────────────────────────────────────
const pmStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    height: height * 0.5,
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 17, fontWeight: "600", color: "#fff" },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeX: { color: "rgba(255,255,255,0.6)", fontSize: 20, fontWeight: "300", marginTop: -1 },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6,
  },
  subtitle: { fontSize: 13, color: "rgba(255,255,255,0.4)" },
  countBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countText: { fontSize: 12, fontWeight: "600" },
  list: { flex: 1 },
  // Hoisted out of the JSX, where it was a fresh object literal every render.
  listContent: { paddingBottom: 16 },
  empty: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 40,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 10,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  dateText: { flex: 1, fontSize: 14, color: "rgba(255,255,255,0.85)" },
  dateTextOld: { color: "rgba(255,255,255,0.4)" },
  recentBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  recentText: { fontSize: 11, fontWeight: "600" },
  sep: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginHorizontal: 18,
  },
});

// ─── Main screen styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212", paddingTop: 20 },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  pageTitle: { fontSize: 28, fontWeight: "700", color: "#fff" },
  headerButtons: { flexDirection: "row", gap: 8 },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  headerBtnActive: {
    backgroundColor: "rgba(255,159,10,0.2)",
    borderColor: "rgba(255,159,10,0.35)",
  },
  headerBtnText: { fontSize: 13, fontWeight: "600" },
  modeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,159,10,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,159,10,0.2)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  modeBannerText: { fontSize: 12, fontWeight: "500", color: "#ff9f0a" },
  listWrapper: { flex: 1, position: "relative" },
  listContainer: { paddingBottom: 110, flexGrow: 1, paddingRight: 32 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#121212" },
  errorText: { color: "#ff6b6b", marginBottom: 10, textAlign: "center" },
  errorSubtext: { color: "rgba(255,255,255,0.5)", textAlign: "center", marginBottom: 20 },
  deaconItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 16 * scale,
    marginBottom: 12 * scale,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  deaconImageContainer: { marginRight: 14 * scale },
  deaconImage: { width: 48 * scale, height: 48 * scale, borderRadius: 24 * scale },
  deaconInfo: { flex: 1 },
  deaconName: { fontSize: 17 * scale, lineHeight: NAME_LINE * scale, fontWeight: "600", color: "#fff" },
  deaconDetail: { fontSize: 14 * scale, lineHeight: DETAIL_LINE * scale, color: "rgba(255,255,255,0.5)", marginTop: 4 * scale },
  noData: { textAlign: "center", color: "rgba(255,255,255,0.5)", marginTop: 20 },
  noDataSubtext: { textAlign: "center", color: "rgba(255,255,255,0.4)", marginTop: 10 },
  sectionHeader: { backgroundColor: "transparent", paddingVertical: 8 * scale, paddingHorizontal: 4 },
  sectionHeaderText: { fontSize: 22 * scale, lineHeight: HEADER_LINE * scale, fontWeight: "600", color: "#fff" },
  floatingBarWrapper: {
    position: "absolute",
    left: 12, right: 12,
    bottom: Platform.OS === "ios" ? 28 : 16,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingBlur: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: Platform.OS === "android" ? "rgba(28,28,30,0.92)" : "transparent",
  },
  floatingInner: { paddingHorizontal: 10, paddingVertical: 10 },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: { marginRight: 6 },
  searchBar: { flex: 1, color: "#fff", fontSize: 15, paddingVertical: 0 },
});

export default DeaconEdits;