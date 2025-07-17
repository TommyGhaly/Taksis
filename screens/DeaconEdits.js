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
  const [church, setChurch] = useState(null);
  const [deacons, setDeacons] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedDeacon, setSelectedDeacon] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  const sectionListRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerHeightRef = useRef(0);

  // Fetch user's church with real-time updates
  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      setLoading(false);
      Alert.alert("Error", "No user authenticated.");
      return;
    }

    const unsubscribe = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        (doc) => {
          if (doc.exists) {
            setChurch(doc.data().church || null);
          }
          setLoading(false);
        },
        (error) => {
          setLoading(false);
          Alert.alert("Error", "Failed to fetch church data.");
        }
      );

    return () => unsubscribe();
  }, []);

  // Subscribe to deacons array updates and profile pictures
  useEffect(() => {
    if (!church) return;

    const fetchProfilePictureUrls = async () => {
      try {
        const doc = await firestore().collection("churches").doc(church).get();
        if (doc.exists) {
          const deaconList = doc.data().deacons || [];
          const urls = {};
          await Promise.all(
            deaconList.map(async (deacon) => {
              if (deacon.uid) {
                try {
                  const url = await storage()
                    .ref(`profilePictures/${deacon.uid}.png`)
                    .getDownloadURL();
                  urls[deacon.uid] =
                    typeof url === "string" && url.trim() ? url : null;
                } catch (error) {
                  urls[deacon.uid] = null;
                }
              }
            })
          );
          setProfilePictureUrls(urls);
        }
      } catch (error) {
        }
    };

    fetchProfilePictureUrls();
    const intervalId = setInterval(fetchProfilePictureUrls, 30000);

    const unsubscribe = firestore()
      .collection("churches")
      .doc(church)
      .onSnapshot(
        async (doc) => {
          if (doc.exists) {
            const deaconList = doc.data().deacons || [];

            // Fetch phone numbers from users collection
            const deaconListWithPhone = await Promise.all(
              deaconList.map(async (deacon) => {
                if (deacon.uid) {
                  const userDoc = await firestore()
                    .collection("users")
                    .doc(deacon.uid)
                    .get();
                  return {
                    ...deacon,
                    phone: userDoc.exists
                      ? userDoc.data().phone || userDoc.data().number || "Not provided"
                      : "Not provided",
                  };
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
                  return a.uid.localeCompare(b.uid); // Fixed typo from uidJones
                }
                return nameComparison;
              })
              .map((deacon) => ({
                ...deacon,
                name:
                  doc.data().deacons.find((d) => d.uid === deacon.uid)?.name ||
                  "",
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
          }
        },
        (error) => {
          Alert.alert("Error", "Failed to fetch deacons.");
        }
      );

    return () => {
      clearInterval(intervalId);
      unsubscribe();
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
    console.log('Scrolling to letter:', letter); // Debug log
    console.log('Available sections:', sections.map(s => s.title)); // Debug log
    
    const sectionIndex = sections.findIndex((s) => s.title === letter);
    console.log('Found section index:', sectionIndex); // Debug log
    
    if (sectionIndex < 0 || !sectionListRef.current) {
      console.log('Section not found or ref not available'); // Debug log
      return;
    }

    console.log('About to scroll to section:', sectionIndex); // Debug log
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

  if (loading) {
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
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                if (sectionListRef.current) {
                  sectionListRef.current.scrollToLocation({
                    sectionIndex: 0,
                    itemIndex: 0,
                    animated: false,
                    viewPosition: 0,
                  });
                }
              }, 500);
            }}
          />
          {/* Wrap the AlphabetIndexBar in an absolutely positioned View at top: 200 */}
          <View style={{ position: 'absolute', top: 150, right: 0, width: 30 }}>
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