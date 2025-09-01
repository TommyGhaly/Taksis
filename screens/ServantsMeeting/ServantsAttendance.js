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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import storage from "@react-native-firebase/storage";
import * as Haptics from "react-native-haptic-feedback";
import Icon from "react-native-vector-icons/MaterialIcons";
import AlphabetIndexBar from "../../components/AlphabetIndexBar";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Simple cache utilities
const CacheUtils = {
  async get(key) {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Check if cache is still valid (24 hours)
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
      await AsyncStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
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

// Responsive design helper
const { width, height } = Dimensions.get("window");
const isTablet = Platform.isPad || (width >= 768 && height >= 768);
const scale = isTablet ? 1.2 : 1;
const paddingHorizontal = isTablet ? 32 : 16;
const indexBarWidth = isTablet ? 32 : 24;

const ServantsAttendance = () => {
  const navigation = useNavigation();
  const user = auth().currentUser;
  
  // Core state
  const [userData, setUserData] = useState(null);
  const [servants, setServants] = useState([]);
  const [rawServantsData, setRawServantsData] = useState([]); // Store raw Firestore data
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [availableLetters, setAvailableLetters] = useState([]);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [previousSundays, setPreviousSundays] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Refs
  const headerHeightRef = useRef(0);
  const sectionListRef = useRef(null);
  const isMounted = useRef(true);
  const servantsUnsubscribe = useRef(null);
  const cacheKeys = useRef({
    user: null,
    servants: null,
    profilePics: null
  });

  // Initialize and load cached data immediately
  useEffect(() => {
    isMounted.current = true;
    
    const initializeApp = async () => {
      if (!user) {
        Alert.alert("Error", "No user found.");
        setLoading(false);
        return;
      }

      // Set cache keys
      cacheKeys.current = {
        user: `servants_user_${user.uid}`,
        servants: `servants_data_${user.uid}`,
        profilePics: `servants_profile_pics_${user.uid}`
      };

      // Load cached data immediately (non-blocking)
      loadCachedData();
      
      // Generate previous Sundays
      await generatePreviousSundays();
      
      // Set up real-time listeners
      await setupUserAndServantsListeners();
      
      // Mark loading as complete after a short delay
      setTimeout(() => {
        if (isMounted.current) {
          setLoading(false);
        }
      }, 300);
    };

    initializeApp();

    return () => {
      isMounted.current = false;
      if (servantsUnsubscribe.current) {
        servantsUnsubscribe.current();
      }
    };
  }, [user]);

  // Load cached data without blocking
  const loadCachedData = async () => {
    try {
      // Load all cached data in parallel
      const [cachedUser, cachedServants, cachedProfilePics] = await Promise.all([
        CacheUtils.get(cacheKeys.current.user),
        CacheUtils.get(cacheKeys.current.servants),
        CacheUtils.get(cacheKeys.current.profilePics)
      ]);

      if (cachedUser && isMounted.current) {
        setUserData(cachedUser);
      }

      if (cachedServants && isMounted.current) {
        setRawServantsData(cachedServants);
      }

      if (cachedProfilePics && isMounted.current) {
        setProfilePictureUrls(cachedProfilePics);
      }
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
    const cutoffDate =
      today < september11ThisYear
        ? new Date(currentYear - 1, 8, 11)
        : september11ThisYear;

    const day = currentDate.getDay();
    const diffToSunday = day === 0 ? 0 : day;
    currentDate.setDate(currentDate.getDate() - diffToSunday);

    while (currentDate >= cutoffDate) {
      sundays.push(formatDate(currentDate));
      currentDate.setDate(currentDate.getDate() - 7);
    }
    setPreviousSundays(sundays);
  };

  // Set up user and servants listeners
  const setupUserAndServantsListeners = async () => {
    try {
      // First get user data (one-time fetch for faster initial load)
      const userDoc = await firestore()
        .collection("users")
        .doc(user.uid)
        .get();
      
      if (!isMounted.current) return;
      
      if (!userDoc.exists) {
        Alert.alert("Error", "User not found.");
        return;
      }
      
      const localUserData = userDoc.data();
      setUserData(localUserData);
      
      // Cache user data
      await CacheUtils.set(cacheKeys.current.user, localUserData);

      if (!localUserData.church) {
        Alert.alert("Error", "No church assigned to user.");
        return;
      }

      // Set up persistent snapshot listener for Servants Meeting
      const servantsMeetingRef = firestore()
        .collection("churches")
        .doc(localUserData.church)
        .collection("Servants Meeting");

      servantsUnsubscribe.current = servantsMeetingRef.onSnapshot(
        async (snapshot) => {
          if (!isMounted.current) return;

          const servantsData = snapshot.docs.map((doc) => ({
            uid: doc.id,
            ...doc.data(),
          }));

          // Store raw data
          setRawServantsData(servantsData);
          
          // Cache servants data
          await CacheUtils.set(cacheKeys.current.servants, servantsData);

          // Fetch profile pictures only for new servants
          fetchProfilePictureUrls(servantsData);
        },
        (error) => {
          if (isMounted.current) {
            Alert.alert("Error", "Failed to load servants.");
          }
        }
      );
    } catch (error) {
      if (isMounted.current) {
        Alert.alert("Error", error.message);
      }
    }
  };

  // Fetch profile pictures with caching
  const fetchProfilePictureUrls = async (servantsData) => {
    try {
      const urls = { ...profilePictureUrls };
      const servantsToFetch = servantsData.filter(
        (servant) => !urls[servant.uid]
      );

      await Promise.all(
        servantsToFetch.map(async (servant) => {
          try {
            const url = await storage()
              .ref(`profilePictures/${servant.uid}.png`)
              .getDownloadURL();
            urls[servant.uid] = typeof url === "string" && url.trim() ? url : null;
          } catch {
            urls[servant.uid] = null;
          }
        })
      );

      if (isMounted.current) {
        setProfilePictureUrls(urls);
        // Cache profile picture URLs
        await CacheUtils.set(cacheKeys.current.profilePics, urls);
      }
    } catch (error) {
      console.error("Error fetching profile pictures:", error);
    }
  };

  // Process raw data whenever selectedDate or rawServantsData changes
  useEffect(() => {
    if (rawServantsData.length === 0) return;

    const dateKey = selectedDate || getNextSunday();
    
    // Map attendance based on selected date
    const processedServants = rawServantsData.map((servant) => ({
      ...servant,
      attendance: servant[dateKey] !== undefined ? servant[dateKey] : null,
    }));

    processedServants.sort((a, b) => a.name.localeCompare(b.name));

    // Group servants by first letter
    const grouped = processedServants.reduce((acc, servant) => {
      const firstLetter = servant.name.charAt(0).toUpperCase() || "Other";
      if (!acc[firstLetter]) acc[firstLetter] = [];
      acc[firstLetter].push(servant);
      return acc;
    }, {});

    const sectionData = Object.keys(grouped)
      .sort()
      .map((letter) => ({
        title: letter,
        data: grouped[letter],
      }));

    setServants(processedServants);
    setSections(sectionData);
    setAvailableLetters(Object.keys(grouped).sort());
  }, [selectedDate, rawServantsData]);

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

    // Update Firestore immediately without optimistic update
    // The real-time listener will handle the UI update
    firestore()
      .collection("churches")
      .doc(userData?.church)
      .collection("Servants Meeting")
      .doc(servantID)
      .update({
        [dateKey]: status,
      })
      .catch((error) => {
        Alert.alert("Error", "Failed to update attendance.");
      });
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setDateModalVisible(false);
  };

  const handleJumpToCurrentWeek = () => {
    setSelectedDate(null); // null means current week
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
              <View style={styles.servantImageContainer}>
                <Image
                  style={styles.servantImage}
                  source={
                    profilePictureUrls[servant.uid]
                      ? { uri: profilePictureUrls[servant.uid] }
                      : require("../../assets/default_profile.png")
                  }
                  defaultSource={require("../../assets/default_profile.png")}
                  resizeMode="cover"
                  onError={() => {
                    setProfilePictureUrls((prev) => ({
                      ...prev,
                      [servant.uid]: null,
                    }));
                  }}
                />
              </View>
              <View style={styles.servantDetails}>
                <View style={styles.studentHeader}>
                  <Text style={styles.studentName}>{servant.name}</Text>
                  <TouchableOpacity
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    onPress={() => {
                      if (!userData) {
                        Alert.alert("Error", "User data not loaded.");
                        return;
                      }
                      setIsNavigating(true);
                      navigation.navigate("IndividualServant", {
                        church: userData.church,
                        servantID: servant.uid,
                      });
                      setTimeout(() => setIsNavigating(false), 1000);
                    }}
                    disabled={isNavigating}
                  >
                    <Image
                      source={require("../../assets/vector.png")}
                      style={styles.icon}
                    />
                  </TouchableOpacity>
                </View>
                {isPastDate ? (
                  <View style={styles.attendanceStatusContainer}>
                    <View
                      style={[
                        styles.attendanceStatus,
                        {
                          backgroundColor:
                            servant.attendance === true
                              ? "#147efb"
                              : servant.attendance === false
                              ? "#D32F2F"
                              : "#444",
                        },
                      ]}
                    >
                      <Text style={styles.attendanceStatusText}>
                        {servant.attendance === true
                          ? "Present"
                          : servant.attendance === false
                          ? "Absent"
                          : "Not Recorded"}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.attendanceButtons}>
                    <TouchableOpacity
                      style={[
                        styles.attendanceButton,
                        servant.attendance === false && styles.absentSelected,
                      ]}
                      onPress={() => handleAttendance(servant.uid, false)}
                    >
                      <Text style={styles.attendanceButtonText}>Absent</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.attendanceButton,
                        servant.attendance === true && styles.presentSelected,
                      ]}
                      onPress={() => handleAttendance(servant.uid, true)}
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
        <TouchableOpacity
          style={styles.dateItem}
          onPress={() => handleDateSelect(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.dateText}>{item}</Text>
        </TouchableOpacity>
      ),
    []
  );

  // Show minimal loading only on first load
  if (loading && !userData && rawServantsData.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#147efb" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const dateKey = selectedDate || getNextSunday();

  return (
    <View style={styles.container}>
      {isNavigating && (
        <View style={styles.navigatingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Navigating...</Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.headerContainer}
        onPress={() => setDateModalVisible(true)}
        activeOpacity={0.7}
        accessible={true}
        accessibilityLabel="Select previous week"
      >
        <Text style={styles.headerText}>{dateKey}</Text>
        <Icon
          name="calendar-today"
          size={24}
          color="#fff"
          style={styles.calendarIcon}
        />
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
            <Text style={styles.noStudentsText}>Church has no servants</Text>
          }
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={true}
          onScrollToIndexFailed={(info) => {
            // Do nothing when scroll fails - stay in current position
          }}
        />
        {sections.length > 0 && (
          <View style={{ position: "absolute", top: 85 * scale, right: 0, width: 30 }}>
            <AlphabetIndexBar
              onLetterChange={scrollToSection}
              availableLetters={sections.map((s) => s.title)}
            />
          </View>
        )}
      </View>

      <Modal visible={dateModalVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Previous Week</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleJumpToCurrentWeek}
              activeOpacity={0.7}
              accessible={true}
              accessibilityLabel="Jump to current week"
            >
              <Text style={styles.modalButtonText}>Jump to This Week</Text>
            </TouchableOpacity>
            <FlatList
              data={previousSundays}
              renderItem={renderDate}
              keyExtractor={(item) => item}
              style={styles.dateList}
              showsVerticalScrollIndicator={false}
            />
            <TouchableOpacity
              onPress={() => setDateModalVisible(false)}
              accessible={true}
              accessibilityLabel="Close date selector"
            >
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#121212" },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
  },
  headerText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  calendarIcon: {
    marginLeft: 10,
  },
  listWrapper: {
    flex: 1,
    position: "relative",
  },
  listContainer: {
    flexGrow: 1,
    paddingRight: 32,
  },
  indexBar: {
    position: "absolute",
    right: 0,
    top: (Platform.OS === 'ios' ? 140 : 120),
    height: height - (Platform.OS === 'ios' ? 200 : 180),
    width: indexBarWidth,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "space-evenly",
    zIndex: 1,
  },
  servantCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 16,
    paddingRight: 24,
    marginBottom: 15,
    marginRight: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  servantInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  servantImageContainer: {
    marginRight: 12,
  },
  servantImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#333333",
  },
  servantDetails: {
    flex: 1,
  },
  studentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  studentName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  icon: { width: 8, height: 15 },
  attendanceButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  attendanceButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
    marginHorizontal: 5,
    backgroundColor: "#444",
  },
  presentSelected: { backgroundColor: "#147efb" },
  absentSelected: { backgroundColor: "#D32F2F" },
  attendanceButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  attendanceStatusContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  attendanceStatus: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  attendanceStatusText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    color: "#fff",
    marginTop: 10,
  },
  noStudentsText: {
    fontSize: 18,
    color: "#fff",
    textAlign: "center",
    marginTop: 20,
  },
  sectionHeader: {
    backgroundColor: "transparent",
    paddingVertical: 8 * scale,
    paddingHorizontal: 12 * scale,
  },
  sectionHeaderText: {
    fontSize: 18 * scale,
    fontWeight: "600",
    color: "#fff",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  modalContent: {
    width: 340,
    padding: 25,
    backgroundColor: "#1e1e1e",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#333",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 15,
  },
  modalTitle: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  modalButton: {
    width: "100%",
    backgroundColor: "#147efb",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  modalButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#f44336",
    marginTop: 15,
    fontWeight: "600",
  },
  dateList: {
    width: "100%",
    maxHeight: 300,
    marginBottom: 20,
  },
  dateItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
  },
  dateText: {
    fontSize: 18,
    color: "#fff",
    textAlign: "center",
  },
  navigatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default ServantsAttendance;