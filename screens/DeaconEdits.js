import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import IndividualProfile from "../components/individualProfile";

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

  // Alphabet for index bar (only letters with data)
  const [availableLetters, setAvailableLetters] = useState([]);

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
      } catch (error) {}
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

            // Sort and group deacons
            const sortedDeacons = deaconList
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
                  doc.data().deacons.find((d) => d.uid === deacon.uid)?.name ||
                  "",
              }));

            // Group by first letter
            const grouped = sortedDeacons.reduce((acc, deacon) => {
              const firstLetter =
                deacon.name.charAt(0).toUpperCase() || "Other";
              if (!acc[firstLetter]) acc[firstLetter] = [];
              acc[firstLetter].push(deacon);
              return acc;
            }, {});

            // Convert to SectionList format
            const sectionData = Object.keys(grouped)
              .sort()
              .map((letter) => ({
                title: letter,
                data: grouped[letter],
              }));

            // Ensure availableLetters matches sectionData titles
            const letters = sectionData.map((section) => section.title).sort();

            setDeacons(sortedDeacons);
            setSections(sectionData);
            setAvailableLetters(letters);
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

  // Corrected scroll function using scrollToLocation
  const scrollToSection = (letter) => {
    const sectionIndex = sections.findIndex((s) => s.title === letter);
    if (sectionIndex < 0 || !sectionListRef.current) return;

    sectionListRef.current.scrollToLocation({
      sectionIndex,
      itemIndex: 1,
      animated: false,
      viewPosition: 0,
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
  const renderDeacon = ({ item }) => (
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
          Phone: {item.number || "Not provided"}
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
        <View style={[styles.listWrapper, { paddingRight: indexBarWidth }]}>
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
          />
          <View style={[styles.indexBar, { width: indexBarWidth }]}>
            {availableLetters.map((letter) => (
              <View
                key={letter}
                style={styles.indexItem}
                onTouchStart={() => {
                  scrollToSection(letter);
                  ReactNativeHapticFeedback.trigger(
                    "impactLight",
                    hapticOptions
                  );
                }}
              >
                <Text style={[styles.indexText, { fontSize: 18 * scale }]}>
                  {letter}
                </Text>
              </View>
            ))}
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
    flexDirection: "row",
  },
  listContainer: {
    paddingBottom: 20,
    flexGrow: 1,
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
    marginRight: 10,
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
  indexBar: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
  },
  indexItem: {
    paddingVertical: 2 * scale, // Reduced vertical padding
    backgroundColor: "#121212",
    borderRadius: 4,
    marginVertical: 2 * scale,
  },
  indexText: {
    color: "#147efb",
    fontWeight: "600",
    fontSize: 18 * scale, // Increased font size
  },
});

export default DeaconEdits;