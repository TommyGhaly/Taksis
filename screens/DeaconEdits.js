import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
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
  const [selectedDeacon, setSelectedDeacon] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});

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
      const unsubscribe = firestore()
        .collection("churches")
        .doc(church)
        .onSnapshot(
          async (doc) => {
            if (doc.exists) {
              const deaconList = doc.data().deacons || [];

              // Fetch profile picture URLs for each deacon
              const urls = {};
              await Promise.all(
                deaconList.map(async (deacon) => {
                  if (deacon.uid) {
                    try {
                      const url = await storage()
                        .ref(`profilePictures/${deacon.uid}.png`)
                        .getDownloadURL();
                      urls[deacon.uid] = url;
                    } catch (error) {
                      urls[deacon.uid] = null; // Fallback to default image
                    }
                  }
                })
              );

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

              setDeacons(sortedDeacons);
              setProfilePictureUrls(urls);
            }
          },
          (error) => {
          }
        );
      return () => unsubscribe();
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

  // Render each deacon item
  const renderDeacon = ({ item }) => (
    <TouchableOpacity
      style={styles.deaconItem}
      onPress={() => openEditModal(item)}
      activeOpacity={0.7}
    >
      <View style={styles.deaconImageContainer}>
        <Image
          source={{
            uri:
              item.uid && profilePictureUrls[item.uid]
                ? profilePictureUrls[item.uid]
                : null,
          }}
          style={styles.deaconImage}
          defaultSource={require("../assets/default_profile.png")}
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
      {deacons.length === 0 ? (
        <Text style={styles.noData}>No deacons found.</Text>
      ) : (
        <FlatList
          data={deacons}
          renderItem={renderDeacon}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
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
  listContainer: {
    paddingBottom: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212 Leila",
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
});

export default DeaconEdits;
