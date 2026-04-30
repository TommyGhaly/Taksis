import React, { useState, useRef, useMemo, useEffect } from "react";
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
} from "react-native";
import { BlurView } from "expo-blur";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import storage from "@react-native-firebase/storage";
import * as Haptics from "react-native-haptic-feedback";
import { Ionicons } from "@expo/vector-icons";
import AlphabetIndexBar from "../../components/AlphabetIndexBar";
import AsyncStorage from '@react-native-async-storage/async-storage';

const CacheUtils = {
  async get(key) {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 72 * 60 * 60 * 1000) {
          return parsed.data;
        }
      }
    } catch (error) {
      console.log('Cache read error:', error);
    }
    return null;
  },
  async set(key, data) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (error) {
      console.log('Cache write error:', error);
    }
  },
  async remove(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.log('Cache remove error:', error);
    }
  }
};

const { width, height } = Dimensions.get("window");
const isTablet = Platform.isPad || (width >= 768 && height >= 768);
const scale = isTablet ? 1.2 : 1;
const indexBarWidth = isTablet ? 32 : 24;

const ServantsAttendance = () => {
  const navigation = useNavigation();
  const user = auth().currentUser;
  
  const [userData, setUserData] = useState(null);
  const [servants, setServants] = useState([]);
  const [rawServantsData, setRawServantsData] = useState([]);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [availableLetters, setAvailableLetters] = useState([]);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [previousSundays, setPreviousSundays] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const headerHeightRef = useRef(0);
  const sectionListRef = useRef(null);
  const isMounted = useRef(true);
  const servantsUnsubscribe = useRef(null);
  const cacheKeys = useRef({ user: null, servants: null, profilePics: null });
  const searchInputRef = useRef(null);
  const keyboardOffset = useRef(new Animated.Value(0)).current;

  // Lift the floating search bar above the keyboard
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

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardOffset]);

  useEffect(() => {
    isMounted.current = true;
    const initializeApp = async () => {
      if (!user) {
        Alert.alert("Error", "No user found.");
        setLoading(false);
        return;
      }
      cacheKeys.current = {
        user: `servants_user_${user.uid}`,
        servants: `servants_data_${user.uid}`,
        profilePics: `servants_profile_pics_${user.uid}`
      };
      loadCachedData();
      await generatePreviousSundays();
      await setupUserAndServantsListeners();
      setTimeout(() => {
        if (isMounted.current) setLoading(false);
      }, 300);
    };
    initializeApp();
    return () => {
      isMounted.current = false;
      if (servantsUnsubscribe.current) servantsUnsubscribe.current();
    };
  }, [user]);

  const loadCachedData = async () => {
    try {
      const [cachedUser, cachedServants, cachedProfilePics] = await Promise.all([
        CacheUtils.get(cacheKeys.current.user),
        CacheUtils.get(cacheKeys.current.servants),
        CacheUtils.get(cacheKeys.current.profilePics)
      ]);
      if (cachedUser && isMounted.current) setUserData(cachedUser);
      if (cachedServants && isMounted.current) setRawServantsData(cachedServants);
      if (cachedProfilePics && isMounted.current) setProfilePictureUrls(cachedProfilePics);
    } catch (error) {
      console.log('Error loading cached data:', error);
    }
  };

  const getNextSunday = () => {
    const today = new Date();
    const currentDay = today.getDay();
    if (currentDay === 0) return formatDate(today);
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + (7 - currentDay));
    return formatDate(nextSunday);
  };

  const formatDate = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  const generatePreviousSundays = async () => {
    const today = new Date();
    const sundays = [];
    let currentDate = new Date(today);
    const currentYear = today.getFullYear();
    const september11ThisYear = new Date(currentYear, 8, 11);
    const cutoffDate = today < september11ThisYear ? new Date(currentYear - 1, 8, 11) : september11ThisYear;
    const day = currentDate.getDay();
    const diffToSunday = day === 0 ? 0 : day;
    currentDate.setDate(currentDate.getDate() - diffToSunday);
    while (currentDate >= cutoffDate) {
      sundays.push(formatDate(currentDate));
      currentDate.setDate(currentDate.getDate() - 7);
    }
    setPreviousSundays(sundays);
  };

  const setupUserAndServantsListeners = async () => {
    try {
      const userDoc = await firestore().collection("users").doc(user.uid).get();
      if (!isMounted.current) return;
      if (!userDoc.exists) {
        Alert.alert("Error", "User not found.");
        return;
      }
      const localUserData = userDoc.data();
      setUserData(localUserData);
      await CacheUtils.set(cacheKeys.current.user, localUserData);
      if (!localUserData.church) {
        Alert.alert("Error", "No church assigned to user.");
        return;
      }
      const servantsMeetingRef = firestore()
        .collection("churches")
        .doc(localUserData.church)
        .collection("Servants Meeting");
      servantsUnsubscribe.current = servantsMeetingRef.onSnapshot(
        async (snapshot) => {
          if (!isMounted.current) return;
          const servantsData = snapshot.docs.map((doc) => ({ uid: doc.id, ...doc.data() }));
          setRawServantsData(servantsData);
          await CacheUtils.set(cacheKeys.current.servants, servantsData);
          fetchProfilePictureUrls(servantsData);
        },
        (error) => {
          if (isMounted.current) Alert.alert("Error", "Failed to load servants.");
        }
      );
    } catch (error) {
      if (isMounted.current) Alert.alert("Error", error.message);
    }
  };

  const fetchProfilePictureUrls = async (servantsData) => {
    try {
      const urls = { ...profilePictureUrls };
      const servantsToFetch = servantsData.filter((servant) => !urls[servant.uid]);

      // Fetch profile pictures progressively instead of blocking on Promise.all
      const fetchBatch = async (batch) => {
        const batchUrls = {};
        await Promise.all(
          batch.map(async (servant) => {
            try {
              const url = await storage().ref(`profilePictures/${servant.uid}.png`).getDownloadURL();
              batchUrls[servant.uid] = typeof url === "string" && url.trim() ? url : null;
            } catch {
              batchUrls[servant.uid] = null;
            }
          })
        );
        return batchUrls;
      };

      // Fetch in batches of 10 to progressively update UI
      const batchSize = 10;
      for (let i = 0; i < servantsToFetch.length; i += batchSize) {
        const batch = servantsToFetch.slice(i, i + batchSize);
        const batchUrls = await fetchBatch(batch);
        if (isMounted.current) {
          const newUrls = { ...urls, ...batchUrls };
          setProfilePictureUrls(newUrls);
          Object.assign(urls, batchUrls);
        }
      }

      if (isMounted.current) {
        await CacheUtils.set(cacheKeys.current.profilePics, urls);
      }
    } catch (error) {
      console.error("Error fetching profile pictures:", error);
    }
  };

  useEffect(() => {
    if (rawServantsData.length === 0) return;
    const dateKey = selectedDate || getNextSunday();
    const processedServants = rawServantsData.map((servant) => ({
      ...servant,
      attendance: servant[dateKey] !== undefined ? servant[dateKey] : null,
    }));
    processedServants.sort((a, b) => a.name.localeCompare(b.name));

    // Filter by searchQuery before grouping
    const lower = searchQuery.trim().toLowerCase();
    const filteredServants = lower
      ? processedServants.filter((s) => (s.name || "").toLowerCase().includes(lower))
      : processedServants;

    const grouped = filteredServants.reduce((acc, servant) => {
      const firstLetter = servant.name.charAt(0).toUpperCase() || "Other";
      if (!acc[firstLetter]) acc[firstLetter] = [];
      acc[firstLetter].push(servant);
      return acc;
    }, {});
    const sectionData = Object.keys(grouped).sort().map((letter) => ({ title: letter, data: grouped[letter] }));
    setServants(filteredServants);
    setSections(sectionData);
    setAvailableLetters(Object.keys(grouped).sort());
  }, [selectedDate, rawServantsData, searchQuery]);

  const scrollToSection = (letter) => {
    const sectionIndex = sections.findIndex((s) => s.title === letter);
    if (sectionIndex < 0 || !sectionListRef.current) return;
    sectionListRef.current.scrollToLocation({
      sectionIndex,
      itemIndex: 1,
      animated: false,
      viewPosition: 0,
      viewOffset: 0,
    });
  };

  const handleAttendance = (servantID, status) => {
    const dateKey = selectedDate || getNextSunday();
    if (selectedDate && selectedDate !== getNextSunday()) return;
    Haptics.trigger("impactLight");
    firestore()
      .collection("churches")
      .doc(userData?.church)
      .collection("Servants Meeting")
      .doc(servantID)
      .update({ [dateKey]: status })
      .catch((error) => Alert.alert("Error", "Failed to update attendance."));
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setDateModalVisible(false);
  };

  const handleJumpToCurrentWeek = () => {
    setSelectedDate(null);
    setDateModalVisible(false);
  };

  const renderServant = useMemo(
    () =>
      ({ item: servant }) => {
        const dateKey = selectedDate || getNextSunday();
        const isPastDate = selectedDate && selectedDate !== getNextSunday();
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
                  <Text style={styles.servantName}>{servant.name}</Text>
                  <TouchableOpacity
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    onPress={() => {
                      if (!userData) {
                        Alert.alert("Error", "User data not loaded.");
                        return;
                      }
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
                    <View
                      style={[
                        styles.attendanceStatus,
                        {
                          backgroundColor:
                            servant.attendance === true ? "#147EFB" : servant.attendance === false ? "#ff3b30" : "rgba(255,255,255,0.1)",
                        },
                      ]}
                    >
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
    () =>
      ({ section: { title } }) => (
        <View
          style={styles.sectionHeader}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            if (height > 0 && headerHeightRef.current !== height) {
              headerHeightRef.current = height;
              setHeaderHeight(height);
            }
          }}
        >
          <Text style={styles.sectionHeaderText}>{title}</Text>
        </View>
      ),
    []
  );

  const renderDate = useMemo(
    () =>
      ({ item }) => (
        <TouchableOpacity style={styles.dateItem} onPress={() => handleDateSelect(item)} activeOpacity={0.7}>
          <Text style={styles.dateText}>{item}</Text>
        </TouchableOpacity>
      ),
    []
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

      {/* ---------- Week selector (dropdown style) ---------- */}
      <TouchableOpacity
        style={styles.weekSelector}
        onPress={() => setDateModalVisible(true)}
        activeOpacity={0.7}
      >
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
                {searchQuery.trim() ? "No servants match your search" : "Church has no servants"}
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
            <AlphabetIndexBar
              onLetterChange={scrollToSection}
              availableLetters={sections.map((s) => s.title)}
            />
          </View>
        )}
      </View>

      {/* ---------- Floating bottom search bar with system material ---------- */}
      <Animated.View
        style={[
          styles.floatingBarWrapper,
          { transform: [{ translateY: Animated.multiply(keyboardOffset, -1) }] },
        ]}
        pointerEvents="box-none"
      >
        <BlurView
          tint="systemChromeMaterialDark"
          intensity={80}
          style={styles.floatingBlur}
        >
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
          </View>
        </BlurView>
      </Animated.View>

      <Modal visible={dateModalVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Week</Text>
            <Text style={styles.modalSubtitle}>View attendance for a previous week</Text>
            <TouchableOpacity style={styles.modalButton} onPress={handleJumpToCurrentWeek} activeOpacity={0.7}>
              <Text style={styles.modalButtonText}>Jump to This Week</Text>
            </TouchableOpacity>
            <FlatList
              data={previousSundays}
              renderItem={renderDate}
              keyExtractor={(item) => item}
              style={styles.dateList}
              showsVerticalScrollIndicator={false}
            />
            <TouchableOpacity onPress={() => setDateModalVisible(false)} style={styles.cancelTouchable}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: "#121212",
  },

  // ---------- Week selector (dropdown) ----------
  weekSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  weekSelectorLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  weekSelectorTextWrap: {
    marginLeft: 12,
  },
  weekSelectorLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  weekSelectorDate: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
    marginTop: 2,
  },
  weekSelectorRight: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20, 126, 251, 0.15)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  weekSelectorChange: {
    fontSize: 13,
    color: "#147EFB",
    fontWeight: "600",
    marginRight: 4,
  },

  listWrapper: {
    flex: 1,
    position: "relative",
  },
  listContainer: {
    flexGrow: 1,
    paddingRight: 32,
    paddingBottom: 110, // leave room for the floating bar
  },
  servantCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 16,
    paddingRight: 24,
    marginBottom: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  servantInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  servantImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
  },
  servantDetails: {
    flex: 1,
  },
  servantHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  servantName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
  },
  attendanceButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 12,
  },
  attendanceButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  attendanceButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  attendanceStatusContainer: {
    marginTop: 14,
  },
  attendanceStatus: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  attendanceStatusText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },

  // ---------- Floating bottom search ----------
  floatingBarWrapper: {
    position: "absolute",
    left: 12,
    right: 12,
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
  floatingInner: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchBar: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    paddingVertical: 0,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 60,
  },
  noStudentsText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: 16,
  },
  sectionHeader: {
    backgroundColor: "transparent",
    paddingVertical: 8 * scale,
    paddingHorizontal: 4,
  },
  sectionHeaderText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#fff",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalContent: {
    width: "85%",
    maxWidth: 360,
    padding: 28,
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 22,
    color: "#fff",
    fontWeight: "600",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 24,
    textAlign: "center",
  },
  modalButton: {
    width: "100%",
    backgroundColor: "#147EFB",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
  cancelTouchable: {
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#ff3b30",
    fontWeight: "600",
  },
  dateList: {
    width: "100%",
    maxHeight: 280,
    marginBottom: 16,
  },
  dateItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  dateText: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
  },
  navigatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});

export default ServantsAttendance;