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

const DeaconEdits = () => {
  const [church, setChurch] = useState(null);
  const [deacons, setDeacons] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedDeacon, setSelectedDeacon] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  const sectionListRef = useRef(null);
  const [isListReady, setIsListReady] = useState(false);

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
                  urls[deacon.uid] = typeof url === "string" && url.trim() ? url : null;
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
                name: doc.data().deacons.find((d) => d.uid === deacon.uid)?.name || "",
              }));

            // Group by first letter
            const grouped = sortedDeacons.reduce((acc, deacon) => {
              const firstLetter = deacon.name.charAt(0).toUpperCase() || "Other";
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

  // Jump to section
  const scrollToSection = (letter) => {
    if (!sectionListRef.current || !availableLetters.includes(letter) || !isListReady) {
      return;
    }

    const sectionIndex = sections.findIndex(
      (section) => section.title.toUpperCase() === letter.toUpperCase()
    );

    if (sectionIndex >= 0) {
      try {
        sectionListRef.current.scrollToLocation({
          sectionIndex,
          itemIndex: 0,
          animated: false, // No animation to jump directly
          viewPosition: 0,
          viewOffset: 0,
        });
      } catch (error) {
        // Fallback: Calculate item index
        let itemIndex = 0;
        for (let i = 0; i < sectionIndex; i++) {
          itemIndex += sections[i].data.length; // Items only
          itemIndex += 1; // Section header
        }
        try {
          sectionListRef.current.scrollToIndex({
            index: itemIndex,
            animated: false, // No animation to jump directly
            viewPosition: 0,
          });
        } catch (fallbackError) {}
      }
    }
  };

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
      {sections.length === 0 ? (
        <Text style={styles.noData}>No deacons found.</Text>
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
            stickySectionHeadersEnabled={false} // Enable sticky headers
            extraData={profilePictureUrls}
            onLayout={() => {
              setIsListReady(true);
            }}
          />
          <View style={styles.indexBar}>
            {availableLetters.map((letter) => (
              <TouchableOpacity
                key={letter}
                style={styles.indexItem}
                onPressIn={() => {
                  scrollToSection(letter);
                  ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
                }}
              >
                <Text style={styles.indexText}>{letter}</Text>
              </TouchableOpacity>
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
    paddingHorizontal: 16,
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
    fontSize: 16,
    color: "#147efb",
    fontWeight: "600",
  },
});

export default DeaconEdits;