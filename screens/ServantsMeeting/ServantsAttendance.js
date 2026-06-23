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
  const [showPhotoInput, setShowPhotoInput] = useState(false);
  const [addingServant, setAddingServant] = useState(false);

  const isMounted = useRef(true);
  const servantsUnsubscribe = useRef(null);
  const cacheKeys = useRef({ user: null, servants: null, profilePics: null });
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
          fetchProfilePictures(data);
        }, () => { if (isMounted.current) Alert.alert("Error", "Failed to load servants."); });
    } catch (e) { if (isMounted.current) Alert.alert("Error", e.message); }
  };

  const fetchProfilePictures = async (servantsData) => {
    try {
      const urls = { ...profilePictureUrls };
      const toFetch = servantsData.filter((s) => !urls[s.uid]);
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
  };

  // Build sections
  useEffect(() => {
    if (rawServantsData.length === 0) return;
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
    setAddModalVisible(true);
  };

  const handleAddServant = async () => {
    if (!newName.trim()) { Alert.alert("Name required", "Please enter a name."); return; }
    setAddingServant(true);
    try {
      const docId = newPhotoUid; // already has manual_ prefix
      await firestore()
        .collection("churches").doc(userData.church)
        .collection("Servants Meeting").doc(docId)
        .set({ uid: docId, name: newName.trim(), manual: true });
      setAddModalVisible(false);
      setNewName("");
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
        const dateKey = selectedDate || getNextSunday();
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
                  {manual ? (
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
                  ) : (
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
                  )}
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
    [profilePictureUrls, userData, selectedDate, isNavigating, rawServantsData]
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
            <Text style={styles.weekSelectorLabel}>Week of</Text>
            <Text style={styles.weekSelectorDate}>{dateKey}</Text>
          </View>
        </View>
        <View style={styles.weekSelectorRight}>
          <Text style={styles.weekSelectorChange}>Change</Text>
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
      <Modal visible={dateModalVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Week</Text>
            <Text style={styles.modalSubtitle}>View attendance for a previous week</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => { setSelectedDate(null); setDateModalVisible(false); }} activeOpacity={0.7}>
              <Text style={styles.modalButtonText}>Jump to This Week</Text>
            </TouchableOpacity>
            <FlatList
              data={previousSundays}
              keyExtractor={(item) => item}
              style={styles.dateList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.dateItem} onPress={() => { setSelectedDate(item); setDateModalVisible(false); }} activeOpacity={0.7}>
                  <Text style={styles.dateText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setDateModalVisible(false)} style={styles.cancelTouchable}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Add manual servant modal ── */}
      <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetDismiss} activeOpacity={1} onPress={() => setAddModalVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Add Servant Manually</Text>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.sheetCloseX}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Photo */}
              <TouchableOpacity style={styles.photoPickerRow} onPress={() => setShowPhotoInput(true)} activeOpacity={0.8}>
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
              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Full name"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={newName}
                onChangeText={setNewName}
                autoCapitalize="words"
                autoCorrect={false}
              />

              <View style={styles.sheetNote}>
                <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.35)" />
                <Text style={styles.sheetNoteText}>
                  This servant will appear with a Manual badge. Once they join the app you can sync their record to their account.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.sheetFooter}>
              <TouchableOpacity style={styles.sheetCancelBtn} onPress={() => setAddModalVisible(false)} activeOpacity={0.8}>
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

      {/* Photo picker (reuses existing PhotoInput component) */}
      {showPhotoInput && newPhotoUid && (
        <PhotoInput
          visible={showPhotoInput}
          userId={newPhotoUid}
          onClose={async () => {
            setShowPhotoInput(false);
            // Refresh photo URL for this manual uid
            try {
              const url = await storage().ref(`profilePictures/${newPhotoUid}.png`).getDownloadURL();
              if (url) setProfilePictureUrls((prev) => ({ ...prev, [newPhotoUid]: url }));
            } catch {}
          }}
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

  // Date modal
  modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.7)" },
  modalContent: { width: "85%", maxWidth: 360, padding: 28, backgroundColor: "#1a1a1a", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", alignItems: "center" },
  modalTitle: { fontSize: 22, color: "#fff", fontWeight: "600", marginBottom: 8 },
  modalSubtitle: { fontSize: 15, color: "rgba(255,255,255,0.6)", marginBottom: 24, textAlign: "center" },
  modalButton: { width: "100%", backgroundColor: "#147EFB", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginBottom: 12 },
  modalButtonText: { fontSize: 17, fontWeight: "600", color: "#fff" },
  cancelTouchable: { paddingVertical: 8 },
  cancelButtonText: { fontSize: 16, color: "#ff3b30", fontWeight: "600" },
  dateList: { width: "100%", maxHeight: 280, marginBottom: 16 },
  dateItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  dateText: { fontSize: 16, color: "#fff", textAlign: "center" },

  // Bottom sheet (shared by add + sync)
  sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheetDismiss: { flex: 1 },
  sheet: {
    backgroundColor: "#1a1a1a", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    maxHeight: height * 0.82,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginTop: 10, marginBottom: 4 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  sheetSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 2 },
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

  // Sync modal
  syncSearchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 12, marginHorizontal: 16, marginVertical: 12, paddingHorizontal: 12, height: 42, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  syncSearchInput: { flex: 1, color: "#fff", fontSize: 15, paddingVertical: 0 },
  syncLoading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  syncLoadingText: { color: "rgba(255,255,255,0.4)", fontSize: 14 },
  syncEmpty: { color: "rgba(255,255,255,0.35)", textAlign: "center", fontSize: 14, paddingVertical: 32 },
  syncUserRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  syncUserAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(20,126,251,0.15)", alignItems: "center", justifyContent: "center" },
  syncUserAvatarText: { color: "#147efb", fontSize: 16, fontWeight: "700" },
  syncUserName: { color: "#fff", fontSize: 15, fontWeight: "600" },
  syncUserPhone: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 },
  syncSep: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.06)", marginHorizontal: 16 },
});

export default ServantsAttendance;