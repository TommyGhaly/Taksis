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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import IndividualProfile from "../components/individualProfile"; // Adjust the import path as needed

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Function to format numbers, removing unnecessary decimal places
const formatNumber = (num) => {
  if (num % 1 === 0) {
    return num.toString();
  } else {
    return num.toFixed(2).replace(/\.?0+$/, "");
  }
};

const DeaconEdits = () => {
  const [church, setChurch] = useState(null);
  const [deacons, setDeacons] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedDeacon, setSelectedDeacon] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  const sectionListRef = useRef(null);

  // Alphabet for index bar
  const alphabet = Array.from({ length: 26 }, (_, i) =>
    String.fromCharCode(65 + i)
  );

  // Fetch the user's church on mount with real-time updates
  useEffect(() => {
    const user = auth().currentUser;
    if (user) {
      const unsubscribe = firestore()
        .collection("users")
        .doc(user.uid)
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              setChurch(doc.data().church);
            }
            setLoading(false);
          },
          (error) => {
            setLoading(false);
            Alert.alert("Error", "Failed to fetch church data.");
          }
        );
      return () => unsubscribe();
    }
  }, []);

  // Subscribe to deacons array updates and fetch profile picture URLs
  useEffect(() => {
    if (church) {
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
                    if (typeof url === "string" && url.trim() !== "") {
                      urls[deacon.uid] = url;
                    } else {
                      urls[deacon.uid] = null;
                    }
                  } catch (error) {
                    urls[deacon.uid] = null; // Fallback to default image
                  }
                }
              })
            );
            setProfilePictureUrls(urls);
          }
        } catch (error) {
          console.warn("Failed to fetch profile picture URLs:", error);
        }
      };

      // Fetch profile pictures immediately
      fetchProfilePictureUrls();

      // Set up interval to check for updates every 30 seconds
      const intervalId = setInterval(fetchProfilePictureUrls, 10000);

      const unsubscribe = firestore()
        .collection("churches")
        .doc(church)
        .onSnapshot(
          async (doc) => {
            if (doc.exists) {
              const deaconList = doc.data().deacons || [];

              // Sort and group deacons by first letter
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
                  name: doc.data().deacons.find((d) => d.uid === deacon.uid)
                    .name,
                }));

              // Group deacons by first letter
              const grouped = sortedDeacons.reduce((acc, deacon) => {
                const firstLetter = deacon.name.charAt(0).toUpperCase();
                if (!acc[firstLetter]) {
                  acc[firstLetter] = [];
                }
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

              setDeacons(sortedDeacons);
              setSections(sectionData);
            }
          },
          (error) => {
            Alert.alert("Error", "Failed to fetch deacons.");
          }
        );

      // Cleanup interval and Firestore listener
      return () => {
        clearInterval(intervalId);
        unsubscribe();
      };
    }
  }, [church]);

  // Open the edit modal
  const openEditModal = (deacon) => {
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
    const sectionIndex = sections.findIndex(
      (section) => section.title === letter
    );
    if (sectionIndex !== -1 && sectionListRef.current) {
      sectionListRef.current.scrollToLocation({
        sectionIndex,
        itemIndex: 0,
        animated: true,
      });
      ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    }
  };

  // Render each deacon item
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
            item.uid &&
            profilePictureUrls[item.uid] &&
            typeof profilePictureUrls[item.uid] === "string" &&
            profilePictureUrls[item.uid].trim() !== ""
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
        <Text style={styles.deaconName}>{item.name}</Text>
        <Text style={styles.deaconDetail}>Age: {item.age}</Text>
        {item.number ? (
          <Text style={styles.deaconDetail}>Phone: {item.number}</Text>
        ) : (
          <Text style={styles.deaconDetail}>Phone: Not provided</Text>
        )}
        <Text style={styles.deaconDetail}>
          Experience: {formatNumber(item.experience)}
        </Text>
        <Text style={styles.deaconDetail}>
          Frequency: {formatNumber(item.frequency)}
        </Text>
      </View>
      <Ionicons name="pencil" size={20} color="#147efb" />
    </TouchableOpacity>
  );

  // Render section header
  const renderSectionHeader = ({ section: { title } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#147efb" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Edit Deacons</Text>
      {sections.length === 0 ? (
        <Text style={styles.noData}>No deacons found.</Text>
      ) : (
        <View style={styles.listWrapper}>
          <SectionList
            ref={sectionListRef}
            sections={sections}
            renderItem={renderDeacon}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item) => item.uid}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={true}
          />
          <View style={styles.indexBar}>
            {alphabet.map((letter) => (
              <TouchableOpacity
                key={letter}
                style={styles.indexItem}
                onPress={() => scrollToSection(letter)}
              >
                <Text style={styles.indexText}>{letter}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* IndividualProfile Modal */}
      {selectedDeacon && (
        <IndividualProfile
          userId={selectedDeacon.uid}
          show={modalVisible}
          onClose={handleCancel}
          church={church}
          week="" // Placeholder; replace with actual value if available
          family="" // Placeholder; replace with actual value if available
          url="" // Placeholder; replace with actual Firebase function URL
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 20,
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
    fontSize: 16,
    color: "#aaa",
  },
  deaconItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  deaconImageContainer: {
    marginRight: 12,
  },
  deaconImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#333333",
  },
  deaconInfo: {
    flex: 1,
  },
  deaconName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  deaconDetail: {
    fontSize: 14,
    color: "#aaa",
    marginTop: 4,
  },
  noData: {
    textAlign: "center",
    fontSize: 16,
    color: "#aaa",
    marginTop: 20,
  },
  sectionHeader: {
    backgroundColor: "#2a2a2a",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  indexBar: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
  },
  indexItem: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  indexText: {
    fontSize: 12,
    color: "#147efb",
    fontWeight: "600",
  },
});

export default DeaconEdits;