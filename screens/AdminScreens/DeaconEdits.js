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
  Image,
  FlatList,
  Dimensions,
  Platform,
  ScrollView,
  RefreshControl,
  TextInput,
  Keyboard,
  Animated,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Slider from "@react-native-community/slider";
import IndividualProfile from "../../components/individualProfile";
import AlphabetIndexBar from "../../components/AlphabetIndexBar";
import DeaconSyncModal from "../../components/DeaconSyncModal";

import { useFirestoreDocument } from "../../hooks/useFirebaseCache";
import { FirestoreCache, StorageCache } from "../../utils/cacheManager";

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const formatNumber = (num) => {
  if (!num && num !== 0) return "N/A";
  if (num % 1 === 0) return num.toString();
  return num.toFixed(2).replace(/\.?0+$/, "");
};

// Parse "MM-DD-YY" date strings into a readable label
const formatDateStr = (str) => {
  if (!str) return str;
  const parts = str.split("-").map(Number);
  if (parts.length !== 3) return str;
  const [month, day, year] = parts;
  const date = new Date(2000 + year, month - 1, day);
  if (isNaN(date.getTime())) return str;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// How many weeks back counts as "recent" (12 weeks ≈ 3 months)
const RECENT_WEEKS = 12;
const filterRecent = (dateStrArray) => {
  if (!Array.isArray(dateStrArray)) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RECENT_WEEKS * 7);
  return dateStrArray.filter((str) => {
    const parts = str.split("-").map(Number);
    if (parts.length !== 3) return false;
    const [month, day, year] = parts;
    const d = new Date(2000 + year, month - 1, day);
    return d >= cutoff;
  });
};

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

// ─── Attendance card ──────────────────────────────────────────────────────────
const AttendanceCard = ({ deacon, profilePictureUrl, onPillPress }) => {
  const [tempExp, setTempExp] = useState(deacon.experience ?? 0);
  const [tempFreq, setTempFreq] = useState(deacon.frequency ?? 0);
  const [saving, setSaving] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const recentUnavailable = filterRecent(deacon.unavailableWeeks);
  const recentSwitched = filterRecent(deacon.switched_weeks);
  const unavailTheme = pillTheme(recentUnavailable.length);
  const switchedTheme = pillTheme(recentSwitched.length);

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
    <View style={aStyles.card}>
      {/* Top row: avatar + name + pills */}
      <View style={aStyles.topRow}>
        <Image
          style={aStyles.avatar}
          source={
            profilePictureUrl
              ? { uri: profilePictureUrl }
              : require("../../assets/default_profile.png")
          }
          defaultSource={require("../../assets/default_profile.png")}
        />
        <View style={aStyles.nameBlock}>
          <Text style={aStyles.name} numberOfLines={1}>{deacon.name || "Unknown"}</Text>
          <View style={aStyles.pillRow}>
            <TouchableOpacity
              style={[aStyles.pill, { backgroundColor: unavailTheme.bg, borderColor: unavailTheme.border }]}
              onPress={() => onPillPress("unavailable", deacon)}
              activeOpacity={0.75}
            >
              <Ionicons name="close-circle-outline" size={12} color={unavailTheme.color} />
              <Text style={[aStyles.pillText, { color: unavailTheme.color }]}>
                {recentUnavailable.length} unavailable
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[aStyles.pill, { backgroundColor: switchedTheme.bg, borderColor: switchedTheme.border }]}
              onPress={() => onPillPress("switched", deacon)}
              activeOpacity={0.75}
            >
              <Ionicons name="swap-horizontal-outline" size={12} color={switchedTheme.color} />
              <Text style={[aStyles.pillText, { color: switchedTheme.color }]}>
                {recentSwitched.length} switched
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
};

// ─── Pill detail modal ────────────────────────────────────────────────────────
const PillModal = ({ visible, type, deacon, onClose }) => {
  if (!deacon) return null;
  const isUnavail = type === "unavailable";
  const dates = isUnavail ? (deacon.unavailableWeeks || []) : (deacon.switched_weeks || []);
  const accentColor = isUnavail ? pillTheme(filterRecent(dates).length).color : pillTheme(filterRecent(dates).length).color;

  const sorted = [...dates].sort((a, b) => {
    const parse = (s) => {
      const [m, d, y] = s.split("-").map(Number);
      return new Date(2000 + y, m - 1, d).getTime();
    };
    return parse(b) - parse(a);
  });

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
              data={sorted}
              keyExtractor={(item, i) => `${item}-${i}`}
              showsVerticalScrollIndicator={true}
              bounces={true}
              style={pmStyles.list}
              contentContainerStyle={{ paddingBottom: 16 }}
              renderItem={({ item }) => {
                const isRecent = filterRecent([item]).length > 0;
                const dotColor = isRecent ? accentColor : "rgba(255,255,255,0.2)";
                return (
                  <View style={pmStyles.dateRow}>
                    <View style={[pmStyles.dot, { backgroundColor: dotColor }]} />
                    <Text style={[pmStyles.dateText, !isRecent && pmStyles.dateTextOld]}>
                      {formatDateStr(item)}
                    </Text>
                    {isRecent && (
                      <View style={[pmStyles.recentBadge, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}35` }]}>
                        <Text style={[pmStyles.recentText, { color: accentColor }]}>recent</Text>
                      </View>
                    )}
                  </View>
                );
              }}
              ItemSeparatorComponent={() => <View style={pmStyles.sep} />}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────
const DeaconEdits = () => {
  const user = auth().currentUser;

  const [currentChurch, setCurrentChurch] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deacons, setDeacons] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedDeacon, setSelectedDeacon] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  const [isLoadingDeacons, setIsLoadingDeacons] = useState(true);
  const [userDataLoading, setUserDataLoading] = useState(true);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Attendance mode
  const [attendanceMode, setAttendanceMode] = useState(false);
  const [attendanceData, setAttendanceData] = useState({}); // uid -> { unavailableWeeks, switched_weeks }
  const [pillModal, setPillModal] = useState({ visible: false, type: null, deacon: null });

  const sectionListRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerHeightRef = useRef(0);
  const deaconsListenerRef = useRef(null);
  const userListenerRef = useRef(null);
  const attendanceListenersRef = useRef([]);
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
  }, [user?.uid]);

  // Process deacon list
  const processDeaconList = useCallback(async (deaconList, churchData) => {
    try {
      const withPhone = await Promise.all(
        deaconList.map(async (deacon) => {
          if (!deacon.uid) return { ...deacon, phone: "Not provided" };
          try {
            let userData = null;
            try {
              userData = await FirestoreCache.getDocument("users", deacon.uid, { forceRefresh: false });
            } catch {
              const doc = await firestore().collection("users").doc(deacon.uid).get();
              userData = doc.exists ? doc.data() : null;
              if (userData) setTimeout(() => FirestoreCache.setDocument("users", deacon.uid, userData).catch(() => {}), 50);
            }
            return {
              ...deacon,
              phone: userData ? userData.phone || userData.number || "Not provided" : "Not provided",
            };
          } catch {
            return { ...deacon, phone: "Not provided" };
          }
        })
      );

      const sorted = withPhone
        .map((d) => ({ ...d, name: (d.name || "").trim().toLowerCase() }))
        .sort((a, b) => {
          const c = a.name.localeCompare(b.name);
          return c !== 0 ? c : a.uid.localeCompare(b.uid);
        })
        .map((d) => ({ ...d, name: deaconList.find((x) => x.uid === d.uid)?.name || "" }));

      setDeacons(sorted);
    } catch (err) {
      console.error("Error processing deacons:", err);
    }
  }, []);

  // Build sections
  useEffect(() => {
    if (deacons.length === 0) { setSections([]); return; }
    const lower = searchQuery.trim().toLowerCase();
    const filtered = lower ? deacons.filter((d) => (d.name || "").toLowerCase().includes(lower)) : deacons;
    const grouped = filtered.reduce((acc, d) => {
      const c = (d.name || "").charAt(0).toUpperCase();
      const key = /^[A-Z]$/.test(c) ? c : "#";
      if (!acc[key]) acc[key] = [];
      acc[key].push(d);
      return acc;
    }, {});
    setSections(
      Object.keys(grouped)
        .sort((a, b) => a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b))
        .map((title) => ({ title, data: grouped[title] }))
    );
  }, [deacons, searchQuery]);

  // Church / deacons listener
  useEffect(() => {
    if (deaconsListenerRef.current) { deaconsListenerRef.current(); deaconsListenerRef.current = null; }
    if (!currentChurch) { setDeacons([]); setSections([]); setProfilePictureUrls({}); setIsLoadingDeacons(false); return; }
    setIsLoadingDeacons(true);
    deaconsListenerRef.current = firestore()
      .collection("churches").doc(currentChurch)
      .onSnapshot(
        async (doc) => {
          if (doc.exists) {
            const churchData = doc.data();
            const deaconData = (churchData.deacons || []).map((d) => ({ ...d, churchId: currentChurch }));
            await processDeaconList(deaconData, churchData);
            setTimeout(async () => {
              try { await FirestoreCache.setDocument("churches", currentChurch, churchData); } catch {}
            }, 100);
          } else {
            setDeacons([]); setSections([]);
          }
          setIsLoadingDeacons(false);
        },
        (err) => {
          console.error("Listener error:", err);
          Alert.alert("Error", "Failed to fetch deacons.");
          setIsLoadingDeacons(false);
        }
      );
    return () => { if (deaconsListenerRef.current) { deaconsListenerRef.current(); deaconsListenerRef.current = null; } };
  }, [currentChurch, processDeaconList]);

  // Profile pictures
  useEffect(() => {
    if (!currentChurch || deacons.length === 0) { setProfilePictureUrls({}); return; }
    const fetch = async () => {
      await Promise.all(
        deacons.map(async (d) => {
          if (!d.uid) return;
          const path = `profilePictures/${d.uid}.png`;
          try {
            const url = await StorageCache.getDownloadURL(path);
            if (typeof url === "string" && url.trim())
              setProfilePictureUrls((prev) => ({ ...prev, [d.uid]: url }));
          } catch {
            try {
              const url = await storage().ref(path).getDownloadURL();
              if (typeof url === "string" && url.trim())
                setProfilePictureUrls((prev) => ({ ...prev, [d.uid]: url }));
            } catch {
              setProfilePictureUrls((prev) => ({ ...prev, [d.uid]: null }));
            }
          }
        })
      );
    };
    fetch();
  }, [currentChurch, deacons]);

  // Attendance data listeners — only when mode is active
  useEffect(() => {
    // Clean up previous listeners
    attendanceListenersRef.current.forEach((u) => u());
    attendanceListenersRef.current = [];

    if (!attendanceMode || deacons.length === 0) return;

    const unsubs = deacons.map((d) => {
      if (!d.uid) return () => {};
      return firestore()
        .collection("users").doc(d.uid)
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              const data = doc.data();
              setAttendanceData((prev) => ({
                ...prev,
                [d.uid]: {
                  unavailableWeeks: data.unavailableWeeks || [],
                  switched_weeks: data.switched_weeks || [],
                },
              }));
            }
          },
          () => {}
        );
    });
    attendanceListenersRef.current = unsubs;
    return () => { unsubs.forEach((u) => u()); attendanceListenersRef.current = []; };
  }, [attendanceMode, deacons]);

  const openEditModal = (deacon) => {
    if (!deacon?.uid) return;
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setSelectedDeacon(deacon);
    setModalVisible(true);
  };

  const handleCancel = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setModalVisible(false);
    setSelectedDeacon(null);
  };

  const scrollToSection = (letter) => {
    const idx = sections.findIndex((s) => s.title === letter);
    if (idx < 0 || !sectionListRef.current) return;
    sectionListRef.current.scrollToLocation({
      sectionIndex: idx, itemIndex: 1, animated: false, viewPosition: 0, viewOffset: 0,
    });
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (user?.uid) {
        const doc = await firestore().collection("users").doc(user.uid).get();
        if (doc.exists) {
          const church = doc.data()?.church || null;
          if (church !== currentChurch) {
            setCurrentChurch(church);
          } else if (church) {
            const cDoc = await firestore().collection("churches").doc(church).get();
            if (cDoc.exists) await processDeaconList(cDoc.data().deacons || [], cDoc.data());
          }
          if (church) {
            await FirestoreCache.clearDocument("churches", church);
            await FirestoreCache.clearDocument("users", user.uid);
          }
        }
      }
    } catch { Alert.alert("Error", "Failed to refresh."); }
    finally { setIsRefreshing(false); }
  }, [user?.uid, currentChurch, processDeaconList]);

  // Merge attendance data into deacon objects for the attendance view
  const deaconsWithAttendance = useMemo(() => {
    return deacons.map((d) => ({
      ...d,
      unavailableWeeks: attendanceData[d.uid]?.unavailableWeeks || [],
      switched_weeks: attendanceData[d.uid]?.switched_weeks || [],
    }));
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

  const renderSectionHeader = ({ section: { title } }) => (
    <View
      style={styles.sectionHeader}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && headerHeightRef.current !== h) { headerHeightRef.current = h; setHeaderHeight(h); }
      }}
    >
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const renderDeacon = ({ item }) => {
    if (attendanceMode) {
      return (
        <AttendanceCard
          deacon={item}
          profilePictureUrl={profilePictureUrls[item.uid]}
          onPillPress={(type, deacon) => setPillModal({ visible: true, type, deacon })}
        />
      );
    }
    return (
      <TouchableOpacity style={styles.deaconItem} onPress={() => openEditModal(item)} activeOpacity={0.7}>
        <View style={styles.deaconImageContainer}>
          <Image
            style={styles.deaconImage}
            source={
              item.uid && profilePictureUrls[item.uid]
                ? { uri: profilePictureUrls[item.uid] }
                : require("../../assets/default_profile.png")
            }
            defaultSource={require("../../assets/default_profile.png")}
            onError={() => setProfilePictureUrls((prev) => ({ ...prev, [item.uid]: null }))}
          />
        </View>
        <View style={styles.deaconInfo}>
          <Text style={styles.deaconName}>{item.name || "Unknown"}</Text>
          <Text style={styles.deaconDetail}>Age: {formatNumber(item.age)}</Text>
          <Text style={styles.deaconDetail}>Phone: {item.phone !== undefined && item.phone !== null ? item.phone : "Not provided"}</Text>
          <Text style={styles.deaconDetail}>Experience: {formatNumber(item.experience)}</Text>
          <Text style={styles.deaconDetail}>Frequency: {formatNumber(item.frequency)}</Text>
        </View>
        <Ionicons name="pencil" size={20 * scale} color="#147efb" />
      </TouchableOpacity>
    );
  };

  if (userDataLoading || isLoadingDeacons) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size={isTablet ? "large" : "small"} color="#147efb" />
        <Text style={[styles.loadingText, { fontSize: 16 * scale }]}>Loading...</Text>
        <Text style={[styles.loadingSubtext, { fontSize: 14 * scale }]}>
          {userDataLoading ? "Getting your data ready" : "Loading deacons..."}
        </Text>
      </View>
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
            keyExtractor={(item) => item.uid || Math.random().toString()}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={true}
            extraData={[profilePictureUrls, attendanceData, attendanceMode]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScrollToIndexFailed={() => {}}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#147efb" colors={["#147efb"]} />}
          />
          {!searchQuery.trim() && (
            <View style={{ position: "absolute", top: 100 * scale, right: 0, width: 30 }}>
              <AlphabetIndexBar
                onLetterChange={scrollToSection}
                availableLetters={activeSections.map((s) => s.title)}
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
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
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
    fontWeight: "500",
    color: "rgba(255,255,255,0.45)",
  },
  sliderValue: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  slider: {
    width: "100%",
    height: 28,
    marginBottom: 0,
  },
  saveBtn: {
    backgroundColor: "#147efb",
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 13,
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
  loadingText: { marginTop: 12, color: "rgba(255,255,255,0.6)" },
  loadingSubtext: { marginTop: 6, color: "rgba(255,255,255,0.4)", textAlign: "center" },
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
  deaconName: { fontSize: 17 * scale, fontWeight: "600", color: "#fff" },
  deaconDetail: { fontSize: 14 * scale, color: "rgba(255,255,255,0.5)", marginTop: 4 * scale },
  noData: { textAlign: "center", color: "rgba(255,255,255,0.5)", marginTop: 20 },
  noDataSubtext: { textAlign: "center", color: "rgba(255,255,255,0.4)", marginTop: 10 },
  sectionHeader: { backgroundColor: "transparent", paddingVertical: 8 * scale, paddingHorizontal: 4 },
  sectionHeaderText: { fontSize: 22 * scale, fontWeight: "600", color: "#fff" },
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