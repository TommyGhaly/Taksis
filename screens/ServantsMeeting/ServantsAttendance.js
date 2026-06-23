import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Image,
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
} from "react-native";
import { BlurView } from "expo-blur";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import storage from "@react-native-firebase/storage";
import * as Haptics from "react-native-haptic-feedback";
import { Ionicons } from "@expo/vector-icons";
import AlphabetIndexBar from "../../components/AlphabetIndexBar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import PhotoInput from "../../components/photoInput"; // reuse existing photo picker

// ── Cache ─────────────────────────────────────────────────────────────────────

const CacheUtils = {
  async get(key) {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 72 * 60 * 60 * 1000) return parsed.data;
      }
    } catch {}
    return null;
  },
  async set(key, data) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {}
  },
};

// ── Constants ─────────────────────────────────────────────────────────────────

const { width, height } = Dimensions.get("window");
const isTablet = Platform.isPad || (width >= 768 && height >= 768);
const scale = isTablet ? 1.2 : 1;

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

// Pretty label for a MM-DD-YYYY date string (e.g. "Sun, Jun 22")
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const prettyDate = (dateStr) => {
  if (!dateStr) return "";
  const [mm, dd, yyyy] = dateStr.split("-").map((n) => parseInt(n, 10));
  const d = new Date(yyyy, mm - 1, dd);
  return `${DAYS[d.getDay()]}, ${MONTHS[mm - 1]} ${dd}`;
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

const ServantsAttendance = () => {
  const navigation = useNavigation();
  const user = auth().currentUser;

  const [userData, setUserData] = useState(null);
  const [rawServantsData, setRawServantsData] = useState([]);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sections, setSections] = useState([]);
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
  const cacheKeys = useRef({ user: null, servants: null, profilePics: null });
  const searchInputRef = useRef(null);
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  // Tracks which UID sets we've already fetched photos for, so a re-render
  // with the same roster doesn't refetch.
  const fetchedUidKey = useRef("");

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
    isMounted.current = true;
    const init = async () => {
      if (!user) { Alert.alert("Error", "No user found."); setLoading(false); return; }
      cacheKeys.current = {
        user: `servants_user_${user.uid}`,
        servants: `servants_data_${user.uid}`,
        profilePics: `servants_profile_pics_${user.uid}`,
      };
      loadCachedData();
      await generatePreviousSundays();
      await setupListeners();
      setTimeout(() => { if (isMounted.current) setLoading(false); }, 300);
    };
    init();
    return () => {
      isMounted.current = false;
      if (servantsUnsubscribe.current) servantsUnsubscribe.current();
    };
  }, [user]);

  const loadCachedData = async () => {
    try {
      const [cu, cs, cp] = await Promise.all([
        CacheUtils.get(cacheKeys.current.user),
        CacheUtils.get(cacheKeys.current.servants),
        CacheUtils.get(cacheKeys.current.profilePics),
      ]);
      if (cu && isMounted.current) setUserData(cu);
      if (cs && isMounted.current) setRawServantsData(cs);
      if (cp && isMounted.current) setProfilePictureUrls(cp);
    } catch {}
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
    try {
      const userDoc = await firestore().collection("users").doc(user.uid).get();
      if (!isMounted.current || !userDoc.exists) return;
      const localUserData = userDoc.data();
      setUserData(localUserData);
      await CacheUtils.set(cacheKeys.current.user, localUserData);
      if (!localUserData.church) { Alert.alert("Error", "No church assigned."); return; }

      servantsUnsubscribe.current = firestore()
        .collection("churches")
        .doc(localUserData.church)
        .collection("Servants Meeting")
        .onSnapshot(async (snapshot) => {
          if (!isMounted.current) return;
          const data = snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
          setRawServantsData(data);
          await CacheUtils.set(cacheKeys.current.servants, data);
          // NOTE: profile picture fetching is intentionally NOT called here.
          // Attendance toggles mutate docs and fire this snapshot constantly;
          // photos are fetched by a separate effect keyed on the UID set so
          // they don't reload on every present/absent tap.
        }, () => { if (isMounted.current) Alert.alert("Error", "Failed to load servants."); });
    } catch (e) { if (isMounted.current) Alert.alert("Error", e.message); }
  };

  // Stable key representing exactly which servants exist (order-independent).
  // Changes only when someone is added/removed — NOT when attendance changes.
  const uidKey = useMemo(
    () => rawServantsData.map((s) => s.uid).sort().join(","),
    [rawServantsData]
  );

  // Fetch photos for any UID we don't already have a url cached for.
  // `force` re-checks storage for every servant (used by pull-to-refresh).
  const fetchProfilePictures = useCallback(async (servantsData, force = false) => {
    try {
      const urls = { ...profilePictureUrls };
      const toFetch = force
        ? servantsData
        : servantsData.filter((s) => urls[s.uid] === undefined);
      if (toFetch.length === 0) return;
      const batchSize = 10;
      for (let i = 0; i < toFetch.length; i += batchSize) {
        const batch = toFetch.slice(i, i + batchSize);
        const batchUrls = {};
        await Promise.all(batch.map(async (s) => {
          try {
            const url = await storage().ref(`profilePictures/${s.uid}.png`).getDownloadURL();
            batchUrls[s.uid] = typeof url === "string" && url.trim() ? url : null;
          } catch { batchUrls[s.uid] = null; }
        }));
        if (isMounted.current) {
          Object.assign(urls, batchUrls);
          setProfilePictureUrls({ ...urls });
        }
      }
      if (isMounted.current) await CacheUtils.set(cacheKeys.current.profilePics, urls);
    } catch {}
  }, [profilePictureUrls]);

  // Mount + roster-change photo fetch. Only runs when the UID set changes,
  // so present/absent toggles never trigger a photo reload.
  useEffect(() => {
    if (rawServantsData.length === 0) return;
    if (fetchedUidKey.current === uidKey) return;
    fetchedUidKey.current = uidKey;
    fetchProfilePictures(rawServantsData, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uidKey]);

  // Pull-to-refresh: force re-check storage for every servant in case a
  // photo changed server-side, plus re-pull the roster from cache/listener.
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchProfilePictures(rawServantsData, true);
    } finally {
      if (isMounted.current) setRefreshing(false);
    }
  }, [rawServantsData, fetchProfilePictures]);

  // Build sections
  useEffect(() => {
    if (rawServantsData.length === 0) { setSections([]); return; }
    const dateKey = selectedDate || getNextSunday();
    const processed = rawServantsData
      .map((s) => ({ ...s, attendance: s[dateKey] !== undefined ? s[dateKey] : null }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const lower = searchQuery.trim().toLowerCase();
    const filtered = lower ? processed.filter((s) => (s.name || "").toLowerCase().includes(lower)) : processed;
    const grouped = filtered.reduce((acc, s) => {
      const key = (s.name || "").charAt(0).toUpperCase() || "#";
      if (!acc[key]) acc[key] = [];
      acc[key].push(s);
      return acc;
    }, {});
    setSections(Object.keys(grouped).sort().map((k) => ({ title: k, data: grouped[k] })));
  }, [selectedDate, rawServantsData, searchQuery]);

  const scrollToSection = (letter) => {
    const idx = sections.findIndex((s) => s.title === letter);
    if (idx < 0 || !sectionListRef.current) return;
    sectionListRef.current.scrollToLocation({ sectionIndex: idx, itemIndex: 1, animated: false, viewPosition: 0, viewOffset: 0 });
  };
  const sectionListRef = useRef(null);

  const handleAttendance = (servantID, status) => {
    const dateKey = selectedDate || getNextSunday();
    if (selectedDate && selectedDate !== getNextSunday()) return;
    Haptics.trigger("impactLight");
    firestore()
      .collection("churches").doc(userData?.church)
      .collection("Servants Meeting").doc(servantID)
      .update({ [dateKey]: status })
      .catch(() => Alert.alert("Error", "Failed to update attendance."));
  };

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
      try {
        await storage().ref(`profilePictures/${uid}.png`).delete();
      } catch {}
      if (isMounted.current) {
        setProfilePictureUrls((prev) => {
          const next = { ...prev };
          delete next[uid];
          return next;
        });
      }
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

  const renderServant = useMemo(
    () =>
      ({ item: servant }) => {
        const isPastDate = selectedDate && selectedDate !== getNextSunday();
        const manual = isManual(servant.uid);

        return (
          <View style={styles.servantCard}>
            <View style={styles.servantInfo}>
              <Image
                style={styles.servantImage}
                source={profilePictureUrls[servant.uid] ? { uri: profilePictureUrls[servant.uid] } : require("../../assets/default_profile.png")}
                resizeMode="cover"
                defaultSource={require("../../assets/default_profile.png")}
                onError={() => setProfilePictureUrls((prev) => ({ ...prev, [servant.uid]: null }))}
              />
              <View style={styles.servantDetails}>
                <View style={styles.servantHeader}>
                  <View style={styles.servantNameRow}>
                    <Text style={styles.servantName}>{servant.name}</Text>
                    {manual && (
                      <View style={styles.manualBadge}>
                        <Text style={styles.manualBadgeText}>Manual</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    onPress={() => {
                      if (!userData) return;
                      setIsNavigating(true);
                      navigation.navigate("IndividualServant", { church: userData.church, servantID: servant.uid });
                      setTimeout(() => setIsNavigating(false), 1000);
                    }}
                    disabled={isNavigating}
                  >
                    <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
                  </TouchableOpacity>
                </View>

                {isPastDate ? (
                  <View style={styles.attendanceStatusContainer}>
                    <View style={[styles.attendanceStatus, {
                      backgroundColor: servant.attendance === true ? "#147EFB" : servant.attendance === false ? "#ff3b30" : "rgba(255,255,255,0.1)",
                    }]}>
                      <Text style={styles.attendanceStatusText}>
                        {servant.attendance === true ? "Present" : servant.attendance === false ? "Absent" : "Not Recorded"}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.attendanceButtons}>
                    <TouchableOpacity
                      style={[styles.attendanceButton, { backgroundColor: servant.attendance === false ? "#ff3b30" : "rgba(255,255,255,0.08)" }]}
                      onPress={() => handleAttendance(servant.uid, false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.attendanceButtonText}>Absent</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.attendanceButton, { backgroundColor: servant.attendance === true ? "#147EFB" : "rgba(255,255,255,0.08)" }]}
                      onPress={() => handleAttendance(servant.uid, true)}
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
      },
    [profilePictureUrls, userData, selectedDate, isNavigating]
  );

  const renderSectionHeader = useMemo(
    () => ({ section: { title } }) => (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>{title}</Text>
      </View>
    ), []
  );

  if (loading && !userData && rawServantsData.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#147EFB" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
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
            <Text style={styles.weekSelectorDate}>{prettyDate(dateKey)}</Text>
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
          keyExtractor={(item) => item.uid}
          contentContainerStyle={[styles.listContainer, { paddingRight: 30 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#147EFB"
              colors={["#147EFB"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color="rgba(255,255,255,0.3)" />
              <Text style={styles.noStudentsText}>
                {searchQuery.trim() ? "No servants match your search" : "No servants yet"}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={true}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onScrollToIndexFailed={() => {}}
        />
        {sections.length > 0 && !searchQuery.trim() && (
          <View style={{ position: "absolute", top: 85 * scale, right: 0, width: 30 }}>
            <AlphabetIndexBar onLetterChange={scrollToSection} availableLetters={sections.map((s) => s.title)} />
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
                <Text style={styles.thisWeekDate}>{prettyDate(getNextSunday())}</Text>
              </View>
              {isCurrentWeek && <Ionicons name="checkmark-circle" size={20} color="#147EFB" />}
            </TouchableOpacity>

            <View style={styles.weekModalDivider}>
              <Text style={styles.weekModalDividerText}>Previous weeks</Text>
            </View>

            {/* Scrollable list with fade hint */}
            <View style={styles.weekListWrap}>
              <FlatList
                data={previousSundays}
                keyExtractor={(item) => item}
                style={styles.dateList}
                showsVerticalScrollIndicator={true}
                indicatorStyle="white"
                renderItem={({ item }) => {
                  const selected = selectedDate === item;
                  return (
                    <TouchableOpacity
                      style={[styles.weekRow, selected && styles.weekRowSelected]}
                      onPress={() => { setSelectedDate(item); setDateModalVisible(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.weekRowText, selected && styles.weekRowTextSelected]}>
                        {prettyDate(item)}
                      </Text>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={20} color="#147EFB" />
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.25)" />
                      )}
                    </TouchableOpacity>
                  );
                }}
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
                  {profilePictureUrls[newPhotoUid] ? (
                    <Image source={{ uri: profilePictureUrls[newPhotoUid] }} style={styles.photoPickerImage} />
                  ) : (
                    <Ionicons name="camera-outline" size={28} color="rgba(255,255,255,0.4)" />
                  )}
                </View>
                <Text style={styles.photoPickerLabel}>
                  {profilePictureUrls[newPhotoUid] ? "Change photo" : "Add photo (optional)"}
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
          onUploadSuccess={(url) => {
            setTempPhotoUploaded(true);
            if (url) setProfilePictureUrls((prev) => ({ ...prev, [newPhotoUid]: url }));
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
  servantHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  servantNameRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  servantName: { fontSize: 17, fontWeight: "600", color: "#fff" },

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
  attendanceButtonText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  attendanceStatusContainer: { marginTop: 14 },
  attendanceStatus: { borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  attendanceStatusText: { fontSize: 15, fontWeight: "600", color: "#fff" },

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
  sectionHeaderText: { fontSize: 22, fontWeight: "600", color: "#fff" },

  // Loading / empty
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#121212" },
  loadingText: { fontSize: 16, color: "rgba(255,255,255,0.6)", marginTop: 12 },
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