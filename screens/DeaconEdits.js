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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import IndividualProfile from "../components/individualProfile";
import AlphabetIndexBar from "../components/AlphabetIndexBar";

// Import caching system
import { useFirestoreDocument } from "../hooks/useFirebaseCache";
import { FirestoreCache, StorageCache } from "../utils/cacheManager";

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Function to format numbers
const formatNumber = (num) => {
  if (!num && num !== 0) return "N/A";
  if (num % 1 === 0) {
    return num.toString();
  }
  return num.toFixed(2).replace(/\.?0+$/, "");
};

// Responsive design helper
const { width, height } = Dimensions.get("window");
const isTablet = Platform.isPad || (width >= 768 && height >= 768);
const scale = isTablet ? 1.2 : 1;
const paddingHorizontal = isTablet ? 32 : 16;
const indexBarWidth = isTablet ? 32 : 24;

const DeaconEdits = () => {
  const user = auth().currentUser;
  
  // Use cached Firebase hooks for user data
  const { 
    data: userDoc, 
    loading: userLoading, 
    error: userError, 
    refresh: refreshUser 
  } = useFirestoreDocument('users', user?.uid);

  // Use cached hook for church data when churchId is available
  const { 
    data: churchDoc, 
    loading: churchLoading, 
    refresh: refreshChurch 
  } = useFirestoreDocument('churches', userDoc?.church);

  const [deacons, setDeacons] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedDeacon, setSelectedDeacon] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  const sectionListRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerHeightRef = useRef(0);

  // Derive church from cached data
  const church = userDoc?.church || null;

  // Subscribe to deacons array updates with lazy caching
  useEffect(() => {
    if (!church) return;

    const fetchDeaconsWithLazyCache = async () => {
      try {
        // First, try to get from cache for instant loading
        let cachedChurchDoc = null;
        
        try {
          // Attempt to get cached church data (non-blocking)
          cachedChurchDoc = await FirestoreCache.getDocument(
            'churches', 
            church, 
            { forceRefresh: false }
          );
        } catch (cacheError) {
          // Cache failed, continue with direct fetch
        }

        // If we have cached data, use it immediately for UI
        if (cachedChurchDoc?.deacons) {
          await processDeaconList(cachedChurchDoc.deacons, cachedChurchDoc);
        }

        // Always set up real-time listener for updates (parallel to cache)
        const unsubscribe = firestore()
          .collection("churches")
          .doc(church)
          .onSnapshot(
            async (doc) => {
              if (doc.exists) {
                await processDeaconList(doc.data().deacons || [], doc.data());
                
                // Background caching: Update cache with fresh data (non-blocking)
                setTimeout(async () => {
                  try {
                    await FirestoreCache.getDocument(
                      'churches',
                      church,
                      { forceRefresh: true }
                    );
                  } catch (error) {
                    // Ignore cache errors - don't affect UI
                  }
                }, 100);
              }
            },
            (error) => {
              Alert.alert("Error", "Failed to fetch deacons.");
            }
          );

        return unsubscribe;
      } catch (error) {
        Alert.alert("Error", "Failed to load deacons data.");
      }
    };

    const processDeaconList = async (deaconList, churchData) => {
      try {
        // Fetch phone numbers from users collection with lazy caching
        const deaconListWithPhone = await Promise.all(
          deaconList.map(async (deacon) => {
            if (deacon.uid) {
              try {
                // Try cache first for user data
                let userData = null;
                try {
                  userData = await FirestoreCache.getDocument(
                    'users', 
                    deacon.uid, 
                    { forceRefresh: false }
                  );
                } catch (cacheError) {
                  // Fallback to direct fetch
                  const userDoc = await firestore()
                    .collection("users")
                    .doc(deacon.uid)
                    .get();
                  userData = userDoc.exists ? userDoc.data() : null;
                }

                return {
                  ...deacon,
                  phone: userData
                    ? userData.phone || userData.number || "Not provided"
                    : "Not provided",
                };
              } catch (error) {
                return { ...deacon, phone: "Not provided" };
              }
            }
            return { ...deacon, phone: "Not provided" };
          })
        );

        // Sort and group deacons
        const sortedDeacons = deaconListWithPhone
          .map((deacon) => ({
            ...deacon,
            name: (deacon.name || "").trim().toLowerCase(),
          }))
          .sort((a, b) => {
            const nameComparison = a.name.localeCompare(b.name);
            if (nameComparison === 0) {
              return a.uid.localeCompare(b.uid);
            }
            return nameComparison;
          })
          .map((deacon) => ({
            ...deacon,
            name:
              deaconList.find((d) => d.uid === deacon.uid)?.name || "",
          }));

        // Group by first letter - categorize non-alphabet characters as #
        const grouped = sortedDeacons.reduce((acc, deacon) => {
          const firstChar = deacon.name.charAt(0).toUpperCase();
          const firstLetter = /^[A-Z]$/.test(firstChar) ? firstChar : "#";
          if (!acc[firstLetter]) acc[firstLetter] = [];
          acc[firstLetter].push(deacon);
          return acc;
        }, {});

        // Convert to SectionList format - put # at the end
        const sectionData = Object.keys(grouped)
          .sort((a, b) => {
            // Put # at the end, sort other letters alphabetically
            if (a === '#') return 1;
            if (b === '#') return -1;
            return a.localeCompare(b);
          })
          .map((letter) => ({
            title: letter,
            data: grouped[letter],
          }));

        setDeacons(sortedDeacons);
        setSections(sectionData);
      } catch (error) {
        // Error handling for deacon processing
      }
    };

    let unsubscribePromise = fetchDeaconsWithLazyCache();
    
    return () => {
      unsubscribePromise.then(unsubscribe => {
        if (unsubscribe && typeof unsubscribe === 'function') {
          unsubscribe();
        }
      }).catch(() => {
        // Handle cleanup error
      });
    };
  }, [church]);

  // Fetch profile pictures with lazy caching
  useEffect(() => {
    if (!church) return;

    const fetchProfilePictureUrlsWithCache = async () => {
      try {
        // Get all deacons from the church document (use cache if available)
        let churchData = null;
        try {
          churchData = await FirestoreCache.getDocument(
            'churches', 
            church, 
            { forceRefresh: false }
          );
        } catch (cacheError) {
          // Fallback to direct fetch
          const doc = await firestore().collection("churches").doc(church).get();
          churchData = doc.exists ? doc.data() : null;
        }
        
        if (churchData) {
          const deaconList = churchData.deacons || [];
          
          // Fetch profile pictures with caching, immediate loading
          const urls = {};
          const profilePromises = deaconList.map(async (deacon) => {
            if (deacon.uid) {
              try {
                const storagePath = `profilePictures/${deacon.uid}.png`;
                const cachedUrl = await StorageCache.getDownloadURL(storagePath);
                urls[deacon.uid] = typeof cachedUrl === "string" && cachedUrl.trim() ? cachedUrl : null;
                setProfilePictureUrls(prev => ({ ...prev, [deacon.uid]: urls[deacon.uid] }));
              } catch (error) {
                // Cache failed, try direct fetch immediately
                try {
                  const url = await storage()
                    .ref(`profilePictures/${deacon.uid}.png`)
                    .getDownloadURL();
                  urls[deacon.uid] = typeof url === "string" && url.trim() ? url : null;
                  setProfilePictureUrls(prev => ({ ...prev, [deacon.uid]: urls[deacon.uid] }));
                  
                  // Store in cache for next time (background)
                  setTimeout(() => {
                    StorageCache.getDownloadURL(`profilePictures/${deacon.uid}.png`, { forceRefresh: true }).catch(() => {});
                  }, 50);
                } catch (storageError) {
                  urls[deacon.uid] = null;
                  setProfilePictureUrls(prev => ({ ...prev, [deacon.uid]: null }));
                }
              }
            }
          });
          
          // Wait for all profile pictures to load
          await Promise.all(profilePromises);
        }
      } catch (error) {
        // Silent error handling
      }
    };

    fetchProfilePictureUrlsWithCache();
    const intervalId = setInterval(fetchProfilePictureUrlsWithCache, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [church]);

  // Open edit modal
  const openEditModal = (deacon) => {
    if (!deacon?.uid) return;
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setSelectedDeacon(deacon);
    setModalVisible(true);
  };

  // Handle cancel
  const handleCancel = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setModalVisible(false);
    setSelectedDeacon(null);
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



  // Measure section header height
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

  // Render deacon item
  const renderDeacon = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.deaconItem}
        onPress={() => openEditModal(item)}
        activeOpacity={0.7}
      >
        <View style={styles.deaconImageContainer}>
          <Image
            style={styles.deaconImage}
            source={
              item.uid && profilePictureUrls[item.uid]
                ? { uri: profilePictureUrls[item.uid] }
                : require("../assets/default_profile.png")
            }
            defaultSource={require("../assets/default_profile.png")}
            onError={() => {
              setProfilePictureUrls((prev) => ({
                ...prev,
                [item.uid]: null,
              }));
            }}
          />
        </View>
        <View style={styles.deaconInfo}>
          <Text style={styles.deaconName}>{item.name || "Unknown"}</Text>
          <Text style={styles.deaconDetail}>Age: {formatNumber(item.age)}</Text>
          <Text style={styles.deaconDetail}>
            Phone: {item.phone !== undefined && item.phone !== null ? item.phone : "Not provided"}
          </Text>
          <Text style={styles.deaconDetail}>
            Experience: {formatNumber(item.experience)}
          </Text>
          <Text style={styles.deaconDetail}>
            Frequency: {formatNumber(item.frequency)}
          </Text>
        </View>
        <Ionicons name="pencil" size={20 * scale} color="#147efb" />
      </TouchableOpacity>
    );
  };

  // Show loading state while user data is loading
  if (userLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator
          size={isTablet ? "large" : "small"}
          color="#147efb"
        />
        <Text style={[styles.loadingText, { fontSize: 16 * scale }]}>
          Loading...
        </Text>
        <Text style={[styles.loadingSubtext, { fontSize: 14 * scale }]}>
          Getting your data ready
        </Text>
      </View>
    );
  }

  // Show error state if user data failed to load
  if (userError && !userDoc) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.errorText, { fontSize: 18 * scale }]}>Connection Error</Text>
        <Text style={[styles.errorSubtext, { fontSize: 14 * scale }]}>
          Unable to load your data. Check your internet connection.
        </Text>
        <TouchableOpacity 
          onPress={refreshUser} 
          style={[styles.retryButton, { marginTop: 20 }]}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingHorizontal }]}>
      {sections.length === 0 ? (
        <Text style={[styles.noData, { fontSize: 16 * scale }]}>
          No deacons found.
        </Text>
      ) : (
        <View style={styles.listWrapper}>
          <SectionList
            ref={sectionListRef}
            sections={sections}
            renderItem={renderDeacon}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item) => item.uid || Math.random().toString()}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={true}
            extraData={profilePictureUrls}
            onScrollToIndexFailed={() => {
              // Do nothing when scroll fails - stay in current position
            }}
          />
          {/* Wrap the AlphabetIndexBar in an absolutely positioned View */}
          <View style={{ position: 'absolute', top: 150 * scale, right: 0, width: 30 }}>
            <AlphabetIndexBar 
              onLetterChange={scrollToSection} 
              availableLetters={sections.map(s => s.title)}
            />
          </View>
        </View>
      )}

      {selectedDeacon && (
        <IndividualProfile
          userId={selectedDeacon.uid}
          show={modalVisible}
          onClose={handleCancel}
          church={church}
          week=""
          family=""
          url=""
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
  listWrapper: {
    flex: 1,
    position: 'relative',
  },
  listContainer: {
    paddingBottom: 20,
    flexGrow: 1,
    paddingRight: 32, // Add space for index bar
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    marginTop: 10,
    color: "#aaa",
  },
  loadingSubtext: {
    marginTop: 5,
    color: "#666",
    textAlign: "center",
  },
  errorText: {
    color: "#ff6b6b",
    marginBottom: 10,
    textAlign: "center",
  },
  errorSubtext: {
    color: "#888",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 8,
    minWidth: 120,
  },
  retryButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600",
  },
  deaconItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    padding: 16 * scale,
    marginBottom: 12 * scale,
    marginRight: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  deaconImageContainer: {
    marginRight: 12 * scale,
  },
  deaconImage: {
    width: 48 * scale,
    height: 48 * scale,
    borderRadius: 24 * scale,
    borderWidth: 1,
    borderColor: "#333333",
  },
  deaconInfo: {
    flex: 1,
  },
  deaconName: {
    fontSize: 18 * scale,
    fontWeight: "600",
    color: "#fff",
  },
  deaconDetail: {
    fontSize: 14 * scale,
    color: "#aaa",
    marginTop: 4 * scale,
  },
  noData: {
    textAlign: "center",
    color: "#aaa",
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
});

export default DeaconEdits;