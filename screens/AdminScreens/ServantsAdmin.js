import React, { useState, useEffect, useRef } from "react";
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
  PanResponder,
  TextInput,
  Keyboard,
  Animated,
} from "react-native";
import { BlurView } from "expo-blur";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import PhotoInput from "../../components/photoInput";
import ProfileImageExpander from "../../components/ProfileImageExpander";
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

const defaultProfileImage = require("../../assets/default_profile.png");

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Grades list
const gradesList = [
  "Pre-School - Age 3",
  "Pre-School - Age 4",
  "Kindergarten",
  "1st Grade",
  "2nd Grade",
  "3rd Grade",
  "4th Grade",
  "5th Grade",
  "6th Grade",
  "7th Grade",
  "8th Grade",
  "9th Grade",
  "10th Grade",
  "11th Grade",
  "12th Grade",
  "College",
];

// Helper function to clean field names
const cleanFieldName = (grade) => {
  // Convert grade names to clean field names
  const fieldMap = {
    "Pre-School - Age 3": "preSchoolAge3",
    "Pre-School - Age 4": "preSchoolAge4",
    "Kindergarten": "kindergarten",
    "1st Grade": "1",
    "2nd Grade": "2",
    "3rd Grade": "3",
    "4th Grade": "4",
    "5th Grade": "5",
    "6th Grade": "6",
    "7th Grade": "7",
    "8th Grade": "8",
    "9th Grade": "9",
    "10th Grade": "10",
    "11th Grade": "11",
    "12th Grade": "12",
    "College": "college"
  };
  return fieldMap[grade] || grade.toLowerCase().replace(/\s+/g, '');
};

// Responsive design helper
const { width, height } = Dimensions.get("window");
const isTablet = Platform.isPad || (width >= 768 && height >= 768);
const scale = isTablet ? 1.2 : 1;
const paddingHorizontal = isTablet ? 32 : 16;
const indexBarWidth = isTablet ? 32 : 24;

const ServantsAdmin = () => {
  // Core state
  const [church, setChurch] = useState(null);
  const [servants, setServants] = useState([]);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedServant, setSelectedServant] = useState(null);
  const [selectedGrades, setSelectedGrades] = useState([]);
  const [isServantMeeting, setIsServantMeeting] = useState(false);
  const [photoInputVisible, setPhotoInputVisible] = useState(false);
  const [sections, setSections] = useState([]);
  const [availableLetters, setAvailableLetters] = useState([]);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [currentLetter, setCurrentLetter] = useState(null);
  const [indexBarLayout, setIndexBarLayout] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Refs
  const headerHeightRef = useRef(0);
  const sectionListRef = useRef(null);
  const indexBarRef = useRef(null);
  const isMounted = useRef(true);
  const userUnsubscribe = useRef(null);
  const servantsUnsubscribe = useRef(null);
  const cacheKeys = useRef({
    church: null,
    servants: null,
    profilePics: null
  });
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

  // Initialize and load cached data immediately
  useEffect(() => {
    isMounted.current = true;
    
    const initializeApp = async () => {
      const user = auth().currentUser;
      if (!user) {
        setLoading(false);
        Alert.alert("Error", "No user authenticated.");
        return;
      }

      // Set cache keys
      cacheKeys.current = {
        church: `servants_admin_church_${user.uid}`,
        servants: `servants_admin_list_${user.uid}`,
        profilePics: `servants_admin_profile_pics_${user.uid}`
      };

      // Load cached data immediately (non-blocking)
      loadCachedData();
      
      // Set up real-time listeners
      setupUserChurchListener();
      
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
      if (userUnsubscribe.current) {
        userUnsubscribe.current();
      }
      if (servantsUnsubscribe.current) {
        servantsUnsubscribe.current();
      }
    };
  }, []);

  // Load cached data without blocking
  const loadCachedData = async () => {
    try {
      // Load all cached data in parallel
      const [cachedChurch, cachedServants, cachedProfilePics] = await Promise.all([
        CacheUtils.get(cacheKeys.current.church),
        CacheUtils.get(cacheKeys.current.servants),
        CacheUtils.get(cacheKeys.current.profilePics)
      ]);

      if (cachedChurch && isMounted.current) {
        setChurch(cachedChurch);
      }

      if (cachedServants && isMounted.current) {
        setServants(cachedServants);
      }

      if (cachedProfilePics && isMounted.current) {
        setProfilePictureUrls(cachedProfilePics);
      }
    } catch (error) {
      console.log('Error loading cached data:', error);
    }
  };

  // Set up user church listener
  const setupUserChurchListener = () => {
    const user = auth().currentUser;
    
    userUnsubscribe.current = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        async (doc) => {
          if (!isMounted.current) return;
          
          if (doc.exists) {
            const userChurch = doc.data().church || null;
            setChurch(userChurch);
            
            // Cache church data
            await CacheUtils.set(cacheKeys.current.church, userChurch);
            
            // Set up servants listener when church is available
            if (userChurch) {
              setupServantsListener(userChurch);
            }
          }
        },
        (error) => {
          if (isMounted.current) {
            Alert.alert("Error", "Failed to fetch church data.");
          }
        }
      );
  };

  // Set up servants listener
  const setupServantsListener = (churchId) => {
    // Clear previous listener if exists
    if (servantsUnsubscribe.current) {
      servantsUnsubscribe.current();
    }

    // Fetch profile pictures periodically
    const fetchProfilePictureUrls = async () => {
      if (!isMounted.current) return;
      
      try {
        const querySnapshot = await firestore()
          .collection("users")
          .where("church", "==", churchId)
          .where("isSSTeacher", "==", true)
          .get();
        
        const urls = {};
        await Promise.all(
          querySnapshot.docs.map(async (doc) => {
            const uid = doc.id;
            try {
              const url = await storage()
                .ref(`profilePictures/${uid}.png`)
                .getDownloadURL();
              urls[uid] = typeof url === "string" && url.trim() ? url : null;
            } catch (error) {
              urls[uid] = null;
            }
          })
        );
        
        if (isMounted.current) {
          setProfilePictureUrls(urls);
          // Cache profile picture URLs
          await CacheUtils.set(cacheKeys.current.profilePics, urls);
        }
      } catch (error) {}
    };

    fetchProfilePictureUrls();
    const intervalId = setInterval(fetchProfilePictureUrls, 30000);

    servantsUnsubscribe.current = firestore()
      .collection("users")
      .where("church", "==", churchId)
      .where("isSSTeacher", "==", true)
      .onSnapshot(
        async (querySnapshot) => {
          if (!isMounted.current) return;
          
          const servantList = querySnapshot.docs
            .map((doc) => ({
              id: doc.id,
              name: (doc.data().name || "").trim(),
              ...doc.data(),
            }))
            .sort((a, b) => {
              const nameComparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
              if (nameComparison === 0) {
                return a.id.localeCompare(b.id);
              }
              return nameComparison;
            })
            .map((servant) => ({
              ...servant,
              name:
                querySnapshot.docs.find((d) => d.id === servant.id)?.data().name || "",
            }));

          setServants(servantList);
          
          // Cache servants data
          await CacheUtils.set(cacheKeys.current.servants, servantList);
        },
        (error) => {
          if (isMounted.current) {
            Alert.alert("Error", "Could not fetch servants.");
          }
        }
      );

    // Store interval cleanup
    return () => {
      clearInterval(intervalId);
    };
  };

  // Build sections from servants + searchQuery
  useEffect(() => {
    if (servants.length === 0) {
      setSections([]);
      setAvailableLetters([]);
      return;
    }

    const lower = searchQuery.trim().toLowerCase();
    const filtered = lower
      ? servants.filter((s) => (s.name || "").toLowerCase().includes(lower))
      : servants;

    // Group by first letter (A-Z or #)
    const grouped = filtered.reduce((acc, servant) => {
      const firstChar = (servant.name || '').charAt(0).toUpperCase();
      const firstLetter = /^[A-Z]$/.test(firstChar) ? firstChar : "#";
      if (!acc[firstLetter]) acc[firstLetter] = [];
      acc[firstLetter].push(servant);
      return acc;
    }, {});

    // Convert to SectionList format - put # at the end
    const sectionData = Object.keys(grouped)
      .sort((a, b) => {
        if (a === '#') return 1;
        if (b === '#') return -1;
        return a.localeCompare(b);
      })
      .map((letter) => ({
        title: letter,
        data: grouped[letter],
      }));

    // Set available letters
    const letters = sectionData.map((section) => section.title).sort();

    setSections(sectionData);
    setAvailableLetters(letters);
  }, [servants, searchQuery]);

  // Handle remove photo
  const handleRemovePhoto = async () => {
    if (!selectedServant?.id) return;

    setDeletingPhoto(true);
    try {
      // Delete from Firebase Storage
      const storageRef = storage().ref(`profilePictures/${selectedServant.id}.png`);
      await storageRef.delete();

      // Update local state
      setProfilePictureUrls(prev => ({
        ...prev,
        [selectedServant.id]: null
      }));

      // Clear cache for profile pics
      await CacheUtils.remove(cacheKeys.current.profilePics);

      Alert.alert("Success", "Profile picture deleted successfully");
    } catch (error) {
      // If the file doesn't exist, that's okay - just update local state
      if (error.code === 'storage/object-not-found') {
        setProfilePictureUrls(prev => ({
          ...prev,
          [selectedServant.id]: null
        }));
      } else {
        Alert.alert("Error", "Could not delete profile picture. Please try again.");
      }
    } finally {
      setDeletingPhoto(false);
    }
  };

  // Handle edit profile picture
  const handleEditProfilePicture = () => {
    Alert.alert(
      "Edit Profile Picture",
      "Choose an option",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Change Photo",
          onPress: () => setPhotoInputVisible(true),
        },
        {
          text: "Remove Photo",
          style: "destructive",
          onPress: handleRemovePhoto,
        },
      ],
      { cancelable: true }
    );
  };

  // Open edit modal
  const openEditModal = (servant) => {
    if (!servant?.id) return;
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setSelectedServant(servant);
    setSelectedGrades(Array.isArray(servant.ssGrades) ? servant.ssGrades : []);
    setIsServantMeeting(servant.isServant || false);
    setModalVisible(true);
  };

  // Open photo input modal
  const openPhotoInputModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setPhotoInputVisible(true);
  };

  // Close edit modal
  const closeEditModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setModalVisible(false);
    setSelectedServant(null);
    setSelectedGrades([]);
    setIsServantMeeting(false);
  };

  // Close photo input modal
  const closePhotoInputModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setPhotoInputVisible(false);
    // Refresh profile picture after upload
    if (selectedServant?.id) {
      storage()
        .ref(`profilePictures/${selectedServant.id}.png`)
        .getDownloadURL()
        .then(async url => {
          setProfilePictureUrls(prev => ({
            ...prev,
            [selectedServant.id]: url
          }));
          // Clear cache to force refresh
          await CacheUtils.remove(cacheKeys.current.profilePics);
        })
        .catch(() => {
          // Keep existing or null
        });
    }
  };

  // Save classes
  const saveClasses = async () => {
    if (!selectedServant || !church) return;

    try {
      // 1. Update the user document (existing functionality)
      await firestore().collection("users").doc(selectedServant.id).update({
        ssGrades: selectedGrades,
        isServant: isServantMeeting,
      });

      // 2. Create/Update the servant document in the church's Sunday School collection
      const servantData = {
        name: selectedServant.name,
        uid: selectedServant.id,
      };

      // Add all grades as boolean fields
      gradesList.forEach((grade) => {
        const fieldName = cleanFieldName(grade);
        servantData[fieldName] = selectedGrades.includes(grade);
      });

      // Create or update the document
      await firestore()
        .collection("churches")
        .doc(church)
        .collection("Sunday School")
        .doc("Servants")
        .collection("Servants")
        .doc(selectedServant.id)
        .set(servantData, { merge: true });

      // Clear servants cache to force refresh
      await CacheUtils.remove(cacheKeys.current.servants);
      
      closeEditModal();
    } catch (error) {
      console.error("Error saving classes:", error);
      Alert.alert("Error", "Could not save classes. Please try again.");
    }
  };

  // Remove servant
  const removeServant = async (servantId) => {
    if (!church) return;

    try {
      // 1. Update the user document (existing functionality)
      await firestore().collection("users").doc(servantId).update({
        isSSTeacher: false,
        ssGrades: [],
        isServant: false,
      });

      // 2. Delete the servant document from the church's Sunday School collection
      await firestore()
        .collection("churches")
        .doc(church)
        .collection("Sunday School")
        .doc("Servants")
        .collection("Servants")
        .doc(servantId)
        .delete();
      
      // Clear servants cache to force refresh
      await CacheUtils.remove(cacheKeys.current.servants);
        
    } catch (error) {
      console.error("Error removing servant:", error);
      Alert.alert("Error", "Could not remove servant. Please try again.");
    }
  };

  // Scroll to section
  const scrollToSection = (letter) => {
    const sectionIndex = sections.findIndex((s) => s.title === letter);
    if (sectionIndex < 0 || !sectionListRef.current) {
      return;
    }
    sectionListRef.current.scrollToLocation({
      sectionIndex,
      itemIndex: 1,
      animated: false,
      viewPosition: 0,
      viewOffset: 0,
    });
  };

  // Handle index bar touch and drag
  const handleIndexBarTouch = (letter) => {
    if (letter !== currentLetter) {
      setCurrentLetter(letter);
      scrollToSection(letter);
      ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    }
  };

  // Pan responder for sliding through letters
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        if (!indexBarLayout || availableLetters.length === 0) return;
        const { pageY } = evt.nativeEvent;
        const letterHeight = indexBarLayout.height / availableLetters.length;
        const index = Math.floor((pageY - indexBarLayout.y) / letterHeight);
        const clampedIndex = Math.max(0, Math.min(index, availableLetters.length - 1));
        const letter = availableLetters[clampedIndex];
        handleIndexBarTouch(letter);
      },
      onPanResponderMove: (evt) => {
        if (!indexBarLayout || availableLetters.length === 0) return;
        const { pageY } = evt.nativeEvent;
        const letterHeight = indexBarLayout.height / availableLetters.length;
        const index = Math.floor((pageY - indexBarLayout.y) / letterHeight);
        const clampedIndex = Math.max(0, Math.min(index, availableLetters.length - 1));
        const letter = availableLetters[clampedIndex];
        handleIndexBarTouch(letter);
      },
      onPanResponderRelease: () => {
        setCurrentLetter(null);
      },
    })
  ).current;

  // Render section header
  const renderSectionHeader = ({ section: { title } }) => (
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
  );

  // Render servant item
  const renderServant = ({ item }) => (
    <TouchableOpacity
      style={styles.servantCard}
      onPress={() => openEditModal(item)}
      activeOpacity={0.7}
    >
      <View style={styles.servantInfo}>
        <View style={styles.servantImageContainer}>
          <Image
            style={styles.servantImage}
            source={
              item.id && profilePictureUrls[item.id]
                ? { uri: profilePictureUrls[item.id] }
                : require("../../assets/default_profile.png")
            }
            defaultSource={require("../../assets/default_profile.png")}
            onError={() => {
              setProfilePictureUrls((prev) => ({
                ...prev,
                [item.id]: null,
              }));
            }}
          />
        </View>
        <View style={styles.servantTextInfo}>
          <Text style={styles.servantName}>{item.name}</Text>
          <Text style={styles.servantGrades}>
            {Array.isArray(item.ssGrades) && item.ssGrades.length > 0
              ? item.ssGrades.join(", ")
              : "No classes assigned"}
          </Text>
        </View>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => removeServant(item.id)}
        >
          <Ionicons name="trash" size={20 * scale} color="#fff" />
          <Text style={styles.buttonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Show minimal loading only on first load
  if (loading && !church && servants.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator
          size={isTablet ? "large" : "small"}
          color="#147efb"
        />
        <Text style={[styles.loadingText, { fontSize: 16 * scale }]}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingHorizontal }]}>
      <Text style={[styles.header, { fontSize: 24  }]}>
        Manage Sunday School
      </Text>
      {sections.length === 0 ? (
        <Text style={[styles.noData, { fontSize: 16 * scale }]}>
          {searchQuery.trim() ? "No servants match your search." : "No servants found."}
        </Text>
      ) : (
        <View style={styles.listWrapper}>
          <SectionList
            ref={sectionListRef}
            sections={sections}
            renderItem={renderServant}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={true}
            extraData={profilePictureUrls}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScrollToIndexFailed={(info) => {
              // Do nothing when scroll fails - stay in current position
            }}
          />
          {sections.length > 0 && !searchQuery.trim() && (
            <View style={{ position: 'absolute', top: 100 * scale, right: 0, width: 30 }}>
              <AlphabetIndexBar 
                onLetterChange={scrollToSection} 
                availableLetters={sections.map(s => s.title)}
              />
            </View>
          )}
        </View>
      )}

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

      {selectedServant && (
        <Modal visible={modalVisible} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.headerContent}>
                  <View style={styles.profileImageContainer}>
                    <ProfileImageExpander
                      imageUrl={selectedServant.id && profilePictureUrls[selectedServant.id] ? profilePictureUrls[selectedServant.id] : defaultProfileImage}
                      size={80}
                      finalSize={300}
                      borderRadius={40}
                      style={styles.profileImage}
                    />
                    <TouchableOpacity
                      style={styles.editProfilePictureButton}
                      onPress={handleEditProfilePicture}
                      disabled={deletingPhoto}
                    >
                      <Ionicons
                        name="pencil"
                        size={16 * scale}
                        color="#147efb"
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.modalTitle, { fontSize: 18 * scale }]}>
                    Assign Classes for {selectedServant?.name}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={closeEditModal}
                >
                  <Ionicons name="close" size={24 * scale} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.servantTrackerContainer}>
                <Text
                  style={[styles.servantTrackerText, { fontSize: 16 * scale }]}
                >
                  Servant Meeting Tracker
                </Text>
                <Switch
                  value={isServantMeeting}
                  onValueChange={(value) => setIsServantMeeting(value)}
                  trackColor={{ false: "#555", true: "#147efb" }}
                  thumbColor={isServantMeeting ? "#fff" : "#aaa"}
                />
              </View>
              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
              >
                <View style={styles.modalContent}>
                  <FlatList
                    data={gradesList}
                    renderItem={({ item: grade }) => (
                      <TouchableOpacity
                        style={[
                          styles.gradeItem,
                          selectedGrades.includes(grade) &&
                            styles.gradeItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedGrades((prev) => {
                            const toggled = prev.includes(grade)
                              ? prev.filter((g) => g !== grade)
                              : [...prev, grade];
                            return gradesList.filter((g) =>
                              toggled.includes(g)
                            );
                          });
                        }}
                      >
                        <Text
                          style={[styles.gradeText, { fontSize: 16 * scale }]}
                        >
                          {grade}
                        </Text>
                        {selectedGrades.includes(grade) && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20 * scale}
                            color="#147efb"
                          />
                        )}
                      </TouchableOpacity>
                    )}
                    keyExtractor={(item) => item}
                    contentContainerStyle={styles.gradesList}
                    scrollEnabled={false}
                  />
                </View>
              </ScrollView>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={closeEditModal}
                >
                  <Text
                    style={[styles.modalButtonText, { fontSize: 16 * scale }]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveClasses}
                >
                  <Text
                    style={[styles.modalButtonText, { fontSize: 16 * scale }]}
                  >
                    Confirm
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      {selectedServant && (
        <PhotoInput
          visible={photoInputVisible}
          onClose={closePhotoInputModal}
          userId={selectedServant.id}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingTop: 20,
  },
  header: {
    fontWeight: "600",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  listWrapper: {
    flex: 1,
    flexDirection: "row",
  },
  listContainer: {
    paddingBottom: 110, // leave room for the floating bar
    flexGrow: 1,
    paddingRight: 32,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    marginTop: 12,
    color: "rgba(255,255,255,0.6)",
    fontSize: 16 * scale,
  },
  servantCard: {
    flexDirection: "column",
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 16 * scale,
    marginBottom: 12 * scale,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  servantInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12 * scale,
  },
  servantImageContainer: {
    marginRight: 14 * scale,
  },
  servantImage: {
    width: 48 * scale,
    height: 48 * scale,
    borderRadius: 24 * scale,
  },
  servantTextInfo: {
    flex: 1,
  },
  servantName: {
    fontSize: 17 * scale,
    fontWeight: "600",
    color: "#fff",
  },
  servantGrades: {
    fontSize: 14 * scale,
    color: "rgba(255,255,255,0.5)",
    marginTop: 4 * scale,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12 * scale,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10 * scale,
    paddingHorizontal: 16 * scale,
    borderRadius: 14,
  },
  deleteButton: {
    backgroundColor: "#ff3b30",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14 * scale,
    fontWeight: "600",
    marginLeft: 6 * scale,
  },
  noData: {
    textAlign: "center",
    color: "rgba(255,255,255,0.5)",
    marginTop: 20,
    fontSize: 16 * scale,
  },
  sectionHeader: {
    backgroundColor: "transparent",
    paddingVertical: 8 * scale,
    paddingHorizontal: 4,
  },
  sectionHeaderText: {
    fontSize: 22 * scale,
    fontWeight: "600",
    color: "#fff",
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
  indexItem: {
    width: 20,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  indexItemActive: {
    backgroundColor: "#147EFB",
  },
  indexText: {
    color: "#147EFB",
    fontWeight: "500",
    fontSize: 11,
  },
  indexTextActive: {
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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    width: "85%",
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  modalScrollView: {
    flexGrow: 1,
  },
  modalScrollContent: {
    paddingBottom: 16 * scale,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16 * scale,
    backgroundColor: "#147EFB",
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  profileImageContainer: {
    position: "relative",
    marginBottom: 12 * scale,
  },
  profileImage: {
    width: 80 * scale,
    height: 80 * scale,
    borderRadius: 40 * scale,
    borderWidth: 2,
    borderColor: "#fff",
  },
  editProfilePictureButton: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 6 * scale,
  },
  modalTitle: {
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  closeButton: {
    position: "absolute",
    top: 16 * scale,
    right: 16 * scale,
  },
  modalContent: {
    padding: 16 * scale,
  },
  servantTrackerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14 * scale,
    paddingHorizontal: 16 * scale,
    borderRadius: 14,
    margin: 16 * scale,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  servantTrackerText: {
    color: "#fff",
    fontWeight: "600",
  },
  gradesList: {
    paddingHorizontal: 16 * scale,
  },
  gradeItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14 * scale,
    paddingHorizontal: 16 * scale,
    borderRadius: 14,
    marginBottom: 8 * scale,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  gradeItemSelected: {
    backgroundColor: "rgba(20, 126, 251, 0.15)",
    borderColor: "rgba(20, 126, 251, 0.3)",
  },
  gradeText: {
    color: "#fff",
    fontWeight: "500",
  },
  modalButtons: {
    flexDirection: "row",
    padding: 16 * scale,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    justifyContent: "space-between",
    gap: 12 * scale,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14 * scale,
    borderRadius: 14,
    alignItems: "center",
  },
  saveButton: {
    backgroundColor: "#147EFB",
  },
  cancelButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default ServantsAdmin;