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
import IndividualProfile from "../../components/individualProfile";
import AlphabetIndexBar from "../../components/AlphabetIndexBar";
import DeaconSyncModal from "../../components/DeaconSyncModal";

// Import caching system
import { useFirestoreDocument } from "../../hooks/useFirebaseCache";
import { FirestoreCache, StorageCache } from "../../utils/cacheManager";

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
  
  // State for managing church and user data
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
  
  const sectionListRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerHeightRef = useRef(0);
  const deaconsListenerRef = useRef(null);
  const userListenerRef = useRef(null);
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

  // Set up real-time listener for user document to detect church changes
  useEffect(() => {
    if (!user?.uid) {
      setUserDataLoading(false);
      return;
    }

    console.log('Setting up user listener for:', user.uid);
    
    // Clean up any existing listener
    if (userListenerRef.current) {
      userListenerRef.current();
      userListenerRef.current = null;
    }

    // Set up real-time listener for user document
    userListenerRef.current = firestore()
      .collection('users')
      .doc(user.uid)
      .onSnapshot(
        (doc) => {
          console.log('User document updated');
          if (doc.exists) {
            const userData = doc.data();
            const newChurch = userData?.church || null;
            console.log('User church:', newChurch, 'Current church:', currentChurch);
            
            // Update church if it changed
            if (newChurch !== currentChurch) {
              console.log('Church changed from', currentChurch, 'to', newChurch);
              setCurrentChurch(newChurch);
            }
          }
          setUserDataLoading(false);
        },
        (error) => {
          console.error('Error listening to user document:', error);
          setUserDataLoading(false);
        }
      );

    return () => {
      if (userListenerRef.current) {
        userListenerRef.current();
        userListenerRef.current = null;
      }
    };
  }, [user?.uid]);

  // Process deacon list
  const processDeaconList = useCallback(async (deaconList, churchData) => {
    try {
      console.log('Processing', deaconList.length, 'deacons');
      
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
                
                // Cache the fetched data
                if (userData) {
                  setTimeout(() => {
                    FirestoreCache.setDocument('users', deacon.uid, userData).catch(() => {});
                  }, 50);
                }
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

      setDeacons(sortedDeacons);
    } catch (error) {
      console.error('Error processing deacon list:', error);
    }
  }, []);

  // Build sections from deacons + searchQuery
  useEffect(() => {
    if (deacons.length === 0) {
      setSections([]);
      return;
    }

    const lower = searchQuery.trim().toLowerCase();
    const filtered = lower
      ? deacons.filter((d) => (d.name || "").toLowerCase().includes(lower))
      : deacons;

    // Group by first letter - categorize non-alphabet characters as #
    const grouped = filtered.reduce((acc, deacon) => {
      const firstChar = (deacon.name || "").charAt(0).toUpperCase();
      const firstLetter = /^[A-Z]$/.test(firstChar) ? firstChar : "#";
      if (!acc[firstLetter]) acc[firstLetter] = [];
      acc[firstLetter].push(deacon);
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

    setSections(sectionData);
  }, [deacons, searchQuery]);

  // Subscribe to deacons when church changes
  useEffect(() => {
    // Clean up previous listener
    if (deaconsListenerRef.current) {
      console.log('Cleaning up previous deacons listener');
      deaconsListenerRef.current();
      deaconsListenerRef.current = null;
    }

    if (!currentChurch) {
      console.log('No church set, clearing deacons');
      setDeacons([]);
      setSections([]);
      setProfilePictureUrls({});
      setIsLoadingDeacons(false);
      return;
    }

    console.log('Setting up deacons listener for church:', currentChurch);
    setIsLoadingDeacons(true);

    // Set up real-time listener for church deacons
    deaconsListenerRef.current = firestore()
      .collection("churches")
      .doc(currentChurch)
      .onSnapshot(
        async (doc) => {
          console.log('Church document updated, exists:', doc.exists);
          if (doc.exists) {
            const churchData = doc.data();
            const deaconData = churchData.deacons || [];
            console.log('Found', deaconData.length, 'deacons');
            
            await processDeaconList(deaconData, churchData);
            
            // Lazy cache update after processing
            setTimeout(async () => {
              try {
                await FirestoreCache.setDocument('churches', currentChurch, churchData);
              } catch (error) {
                console.log('Cache update error (non-critical):', error);
              }
            }, 100);
          } else {
            console.log('Church document does not exist');
            setDeacons([]);
            setSections([]);
          }
          setIsLoadingDeacons(false);
        },
        (error) => {
          console.error('Firestore listener error:', error);
          Alert.alert("Error", "Failed to fetch deacons.");
          setIsLoadingDeacons(false);
        }
      );

    return () => {
      if (deaconsListenerRef.current) {
        deaconsListenerRef.current();
        deaconsListenerRef.current = null;
      }
    };
  }, [currentChurch, processDeaconList]);

  // Fetch profile pictures
  useEffect(() => {
    if (!currentChurch || deacons.length === 0) {
      setProfilePictureUrls({});
      return;
    }

    const fetchProfilePictureUrls = async () => {
      const urls = {};
      const profilePromises = deacons.map(async (deacon) => {
        if (deacon.uid) {
          try {
            const storagePath = `profilePictures/${deacon.uid}.png`;
            // Try cache first
            const cachedUrl = await StorageCache.getDownloadURL(storagePath);
            urls[deacon.uid] = typeof cachedUrl === "string" && cachedUrl.trim() ? cachedUrl : null;
            setProfilePictureUrls(prev => ({ ...prev, [deacon.uid]: urls[deacon.uid] }));
          } catch (error) {
            // Cache failed, try direct fetch
            try {
              const url = await storage()
                .ref(`profilePictures/${deacon.uid}.png`)
                .getDownloadURL();
              urls[deacon.uid] = typeof url === "string" && url.trim() ? url : null;
              setProfilePictureUrls(prev => ({ ...prev, [deacon.uid]: urls[deacon.uid] }));
              
              // Store in cache for next time
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
      
      await Promise.all(profilePromises);
    };

    fetchProfilePictureUrls();
  }, [currentChurch, deacons]);

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    console.log('Pull to refresh triggered');
    setIsRefreshing(true);
    
    try {
      // Force refresh user data to get latest church
      if (user?.uid) {
        const userDoc = await firestore()
          .collection('users')
          .doc(user.uid)
          .get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          const latestChurch = userData?.church || null;
          console.log('Refreshed church:', latestChurch);
          
          // Update church if different
          if (latestChurch !== currentChurch) {
            setCurrentChurch(latestChurch);
          } else if (latestChurch) {
            // If church is same, force refresh the deacons data
            const churchDoc = await firestore()
              .collection('churches')
              .doc(latestChurch)
              .get();
              
            if (churchDoc.exists) {
              const churchData = churchDoc.data();
              const deaconData = churchData.deacons || [];
              await processDeaconList(deaconData, churchData);
            }
          }
          
          // Clear caches to ensure fresh data
          if (latestChurch) {
            await FirestoreCache.clearDocument('churches', latestChurch);
            await FirestoreCache.clearDocument('users', user.uid);
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
      Alert.alert("Error", "Failed to refresh data. Please try again.");
    } finally {
      setIsRefreshing(false);
    }
  }, [user?.uid, currentChurch, processDeaconList]);

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
                : require("../../assets/default_profile.png")
            }
            defaultSource={require("../../assets/default_profile.png")}
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

  // Show loading state
  if (userDataLoading || isLoadingDeacons) {
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
          {userDataLoading ? "Getting your data ready" : "Loading deacons..."}
        </Text>
      </View>
    );
  }

  // Show no church state
  if (!currentChurch) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.errorText, { fontSize: 18 * scale }]}>No Church Selected</Text>
        <Text style={[styles.errorSubtext, { fontSize: 14 * scale }]}>
          Please select a church in your profile settings.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingHorizontal }]}>
      {/* Header with Sync button */}
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Deacons</Text>
        <TouchableOpacity
          style={styles.syncButton}
          onPress={() => setSyncModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="sync" size={16} color="#147efb" />
          <Text style={styles.syncButtonText}>Sync</Text>
        </TouchableOpacity>
      </View>

      {sections.length === 0 ? (
        <ScrollView
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#147efb"
              colors={["#147efb"]}
            />
          }
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
            sections={sections}
            renderItem={renderDeacon}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item) => item.uid || Math.random().toString()}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={true}
            extraData={profilePictureUrls}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            onScrollToIndexFailed={() => {
              // Do nothing when scroll fails - stay in current position
            }}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={onRefresh}
                tintColor="#147efb"
                colors={["#147efb"]}
              />
            }
          />
          {/* Wrap the AlphabetIndexBar in an absolutely positioned View */}
          {!searchQuery.trim() && (
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingTop: 20,
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(20,126,251,0.1)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(20,126,251,0.2)",
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#147efb",
  },
  listWrapper: {
    flex: 1,
    position: 'relative',
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
  loadingSubtext: {
    marginTop: 6,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    fontSize: 14 * scale,
  },
  errorText: {
    color: "#ff6b6b",
    marginBottom: 10,
    textAlign: "center",
    fontSize: 18 * scale,
  },
  errorSubtext: {
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginBottom: 20,
    fontSize: 14 * scale,
  },
  retryButton: {
    backgroundColor: "#147EFB",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    minWidth: 120,
  },
  retryButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 16,
  },
  deaconItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 16 * scale,
    marginBottom: 12 * scale,
    marginRight: 0,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  deaconImageContainer: {
    marginRight: 14 * scale,
  },
  deaconImage: {
    width: 48 * scale,
    height: 48 * scale,
    borderRadius: 24 * scale,
  },
  deaconInfo: {
    flex: 1,
  },
  deaconName: {
    fontSize: 17 * scale,
    fontWeight: "600",
    color: "#fff",
  },
  deaconDetail: {
    fontSize: 14 * scale,
    color: "rgba(255,255,255,0.5)",
    marginTop: 4 * scale,
  },
  noData: {
    textAlign: "center",
    color: "rgba(255,255,255,0.5)",
    marginTop: 20,
    fontSize: 16 * scale,
  },
  noDataSubtext: {
    textAlign: "center",
    color: "rgba(255,255,255,0.4)",
    marginTop: 10,
    fontSize: 14 * scale,
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
});

export default DeaconEdits;