import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  Modal,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import { unavailableToServe } from "./functionCalls";
import Slider from "@react-native-community/slider";
import firestore from "@react-native-firebase/firestore";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import PhotoInput from "./photoInput";

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

// Function to format date to mm-dd-yy
const formatDate = (date) => {
  if (!date) return "N/A";
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${month}-${day}-${year}`;
};

const IndividualProfile = ({
  userId,
  show,
  onClose,
  church,
  week,
  family,
  url,
}) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [userData, setUserData] = useState(null);
  const [tempExperience, setTempExperience] = useState(0);
  const [tempFrequency, setTempFrequency] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isChild, setIsChild] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [isDeacon, setIsDeacon] = useState(false);

  // Fetch image and user data with real-time updates
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Fetch profile picture URL
    const fetchImage = async () => {
      try {
        const storagePath = isChild `profilePictures/${userId}.png`;
        const url = await storage().ref(storagePath).getDownloadURL();
        if (typeof url === "string" && url.trim() !== "") {
          setImageUrl(url);
        } else {
          setImageUrl(null);
        }
      } catch (error) {
        setImageUrl(null);
      }
    };

    fetchImage();
    const intervalId = setInterval(fetchImage, 10000);

    // Fetch user data with real-time listener
    const fetchUserData = () => {
      const userUnsubscribe = firestore()
        .collection("users")
        .doc(userId)
        .onSnapshot(
          async (userDoc) => {
            if (userDoc.exists) {
              const data = userDoc.data();
              setUserData({
                name: data.name || "N/A",
                age: data.age || "N/A",
                phone: data.number || data.phone || "Not provided",
                nextWeekServe: data.nextWeekServe || "N/A",
                nextRole: data.nextRole || "N/A",
                experience: data.experience || 0,
                frequency: data.frequency || 0,
              });
              setTempExperience(data.experience || 0);
              setTempFrequency(data.frequency || 0);
              setIsDeacon(data.isDeacon || false);
              setIsChild(false);
              setLoading(false);
            } else {
              const usersQueryUnsubscribe = firestore()
                .collection("users")
                .onSnapshot(
                  async (querySnapshot) => {
                    let childData = null;
                    let parentId = null;

                    for (const doc of querySnapshot.docs) {
                      const userData = doc.data();
                      const children = userData.children || [];
                      const child = children.find(
                        (child) => child.uid === userId
                      );
                      if (child) {
                        childData = child;
                        parentId = doc.id;
                        break;
                      }
                    }

                    if (childData) {
                      let parentPhone = "Not provided";
                      try {
                        const parentDoc = await firestore()
                          .collection("users")
                          .doc(parentId)
                          .get();
                        if (parentDoc.exists) {
                          const parentData = parentDoc.data();
                          parentPhone =
                            parentData.number ||
                            parentData.phone ||
                            "Not provided";
                        }
                      } catch (error) {
                        console.warn("Failed to fetch parent phone:", error);
                      }

                      setUserData({
                        name: childData.name || "N/A",
                        age: childData.age || "N/A",
                        phone: parentPhone,
                        nextWeekServe: childData.nextWeekServe || "N/A",
                        nextRole: childData.nextRole || "N/A",
                        experience: childData.experience || 0,
                        frequency: childData.frequency || 0,
                        parentId,
                      });
                      setTempExperience(childData.experience || 0);
                      setTempFrequency(childData.frequency || 0);
                      setIsChild(true);
                      setIsDeacon(false); // Children are typically not deacons
                      setLoading(false);
                    } else {
                      setLoading(false);
                    }
                  },
                  (error) => {
                    setLoading(false);
                  }
                );

              return usersQueryUnsubscribe;
            }
          },
          (error) => {
            setLoading(false);
          }
        );

      return userUnsubscribe;
    };

    const unsubscribeUserData = fetchUserData();

    return () => {
      clearInterval(intervalId);
      if (unsubscribeUserData) {
        unsubscribeUserData();
      }
    };
  }, [userId, isChild]);

  // Handle slider value change
  const handleSliderChange = (setter) => (value) => {
    setter(value);
  };

  // Handle save edits to Firestore
  const handleSaveEdits = async () => {
    ReactNativeHapticFeedback.trigger("impactMedium", hapticOptions);

    try {
      const batch = firestore().batch();
      const userRef = isChild
        ? firestore().collection("users").doc(userData.parentId)
        : firestore().collection("users").doc(userId);

      if (isChild) {
        const parentDoc = await userRef.get();
        if (parentDoc.exists) {
          const parentData = parentDoc.data();
          const updatedChildren = parentData.children.map((child) =>
            child.uid === userId
              ? {
                  ...child,
                  experience: tempExperience,
                  frequency: tempFrequency,
                }
              : child
          );
          batch.update(userRef, { children: updatedChildren });
        }
      } else {
        batch.update(userRef, {
          experience: tempExperience,
          frequency: tempFrequency,
        });
      }

      // Update church document if user is a deacon
      if (isDeacon && !isChild) {
        const churchRef = firestore().collection("churches").doc(church);
        const churchDoc = await churchRef.get();

        if (churchDoc.exists) {
          const churchData = churchDoc.data();
          const updatedDeacons = (churchData.deacons || []).map((deacon) =>
            deacon.uid === userId
              ? {
                  ...deacon,
                  experience: tempExperience,
                  frequency: tempFrequency,
                }
              : deacon
          );

          batch.update(churchRef, { deacons: updatedDeacons });
        }
      }

      // Commit all updates as a single batch
      await batch.commit();

      // Update local state
      setUserData((prev) => ({
        ...prev,
        experience: tempExperience,
        frequency: tempFrequency,
      }));

      onClose();
    } catch (error) {
      console.error("Update failed:", error);
      Alert.alert("Update Error", "Failed to save changes. Please try again.");
    }
  };

  // Handle unavailable to serve
const handleUnavailable = () => {
  Alert.alert(
    "Mark Unavailable",
    "Are you sure you want to mark this user as unavailable to serve?",
    [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Confirm",
        style: "destructive",
        onPress: async () => {
          ReactNativeHapticFeedback.trigger("impactMedium", hapticOptions);
          try {
            const currentUser = auth().currentUser;
            if (!currentUser) {
              throw new Error("No authenticated user found");
            }

            const weekToMark = userData.nextWeekServe;

            // Only update unavailableWeeks for users with their own user document
            if (!isChild) {
              await firestore()
                .collection("users")
                .doc(userId)
                .update({
                  unavailableWeeks:
                    firestore.FieldValue.arrayUnion(weekToMark),
                });
            }

            // Call unavailableToServe with nextWeekServe
            await unavailableToServe(
              currentUser,
              userId,
              church,
              userData.nextWeekServe,
              family,
              "https://unavailable-for-week-hy6oofbihq-uc.a.run.app"
            );
            onClose();
          } catch (error) {
            Alert.alert(
              "Error",
              "Failed to mark as unavailable. Please try again."
            );
          }
        },
      },
    ],
    { cancelable: true }
  );
};

  // Handle remove deacon
  const handleRemoveDeacon = () => {
    Alert.alert(
      "Remove Deacon",
      "Are you sure you want to remove this user as a deacon? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Confirm",
          style: "destructive",
          onPress: async () => {
            ReactNativeHapticFeedback.trigger("impactHeavy", hapticOptions);
            try {
              const currentUser = auth().currentUser;
              if (!currentUser) {
                throw new Error("No authenticated user found");
              }

              // Fetch church document
              const churchDocRef = firestore()
                .collection("churches")
                .doc(church);
              const churchDoc = await churchDocRef.get();
              if (!churchDoc.exists) {
                throw new Error("Church document not found");
              }

              const churchData = churchDoc.data();
              const deacons = churchData.deacons || [];
              // Filter out the deacon with matching userId
              const updatedDeacons = deacons.filter(
                (deacon) => deacon.uid !== userId
              );

              // Update church document
              await churchDocRef.update({
                deacons: updatedDeacons,
              });

              // Update user document
              await firestore().collection("users").doc(userId).update({
                isDeacon: false,
              });

              setIsDeacon(false);
              Alert.alert("Success", "The user has been removed as a deacon.");
              onClose();
            } catch (error) {
              console.error("Error removing deacon:", error);
              Alert.alert(
                "Error",
                "Failed to remove deacon. Please try again."
              );
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Handle photo upload completion
  const handlePhotoUpload = async () => {
    setShowPhotoModal(false);
    try {
      const storagePath = isChild
        ? `childProfilePictures/${userId}.png`
        : `profilePictures/${userId}.png`;
      const newUrl = await storage().ref(storagePath).getDownloadURL();
      if (typeof newUrl === "string" && newUrl.trim() !== "") {
        setImageUrl(newUrl);
      } else {
        setImageUrl(null);
      }
    } catch (error) {
      setImageUrl(null);
    }
  };

  // Handle edit icon press
  const handleEditPhoto = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setShowPhotoModal(true);
  };

  // Handle cancel
  const handleCancel = () => {
    onClose();
  };

  if (loading) {
    return (
      <Modal visible={show} animationType="none" transparent={true}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#147efb" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={show}
      animationType="none"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.headerButtons}>
            {!isChild && isDeacon && (
              <TouchableOpacity
                style={styles.removeDeaconButton}
                onPress={handleRemoveDeacon}
                activeOpacity={0.7}
                accessibilityLabel="Remove Deacon"
              >
                <Icon name="delete" size={16} color="#fff" />
              </TouchableOpacity>
            )}
            <View style={styles.spacer} />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleCancel}
              activeOpacity={0.7}
              accessibilityLabel="Close"
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.profileImageContainer}>
            <Image
              style={styles.image}
              source={
                typeof imageUrl === "string" && imageUrl.trim() !== ""
                  ? { uri: imageUrl }
                  : require("../assets/default_profile.png")
              }
              defaultSource={require("../assets/default_profile.png")}
              onError={() => setImageUrl(null)}
            />
            <TouchableOpacity
              style={styles.editIconContainer}
              onPress={handleEditPhoto}
              activeOpacity={0.7}
              accessibilityLabel="Edit Profile Picture"
            >
              <Icon name="pencil" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{userData?.name || "N/A"}</Text>
          {isChild && <Text style={styles.subtitle}>Child Profile</Text>}

          <View style={styles.section}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                {isChild ? "Parent's Phone:" : "Phone:"}
              </Text>
              <Text style={styles.detail}>
                {userData?.phone || "Not provided"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Age:</Text>
              <Text style={styles.detail}>{userData?.age || "N/A"}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Next Week Serve:</Text>
              <Text style={styles.detail}>
                {userData?.nextWeekServe || "N/A"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Next Role:</Text>
              <Text style={styles.detail}>{userData?.nextRole || "N/A"}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>
              Experience: {formatNumber(tempExperience)}
            </Text>
            <Slider
              value={tempExperience}
              onValueChange={handleSliderChange(setTempExperience)}
              minimumValue={0}
              maximumValue={10}
              step={0.25}
              thumbTintColor="#147efb"
              minimumTrackTintColor="#147efb"
              maximumTrackTintColor="#333"
              style={styles.slider}
              accessibilityLabel="Experience"
            />

            <Text style={styles.label}>
              Frequency: {formatNumber(tempFrequency)}
            </Text>
            <Slider
              value={tempFrequency}
              onValueChange={handleSliderChange(setTempFrequency)}
              minimumValue={0}
              maximumValue={10}
              step={0.25}
              thumbTintColor="#147efb"
              minimumTrackTintColor="#147efb"
              maximumTrackTintColor="#333"
              style={styles.slider}
              accessibilityLabel="Frequency"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.unavailableButton]}
            onPress={handleUnavailable}
            activeOpacity={0.7}
            accessibilityLabel="Mark User as Unavailable to Serve"
          >
            <Text style={styles.buttonText}>Mark as Unavailable</Text>
          </TouchableOpacity>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              activeOpacity={0.7}
              accessibilityLabel="Cancel"
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleSaveEdits}
              activeOpacity={0.7}
              accessibilityLabel="Save"
            >
              <Text style={styles.buttonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <PhotoInput
        visible={showPhotoModal}
        onClose={handlePhotoUpload}
        userId={userId}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalContent: {
    width: "90%",
    maxWidth: 340,
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    padding: 16,
    paddingBottom: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 8,
  },
  removeDeaconButton: {
    padding: 6,
    backgroundColor: "#ff3b30",
    borderRadius: 8,
  },
  spacer: {
    flex: 1,
  },
  closeButton: {
    padding: 6,
    backgroundColor: "#333",
    borderRadius: 8,
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#147efb",
  },
  profileImageContainer: {
    marginBottom: 8,
    alignItems: "center",
    position: "relative",
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#147efb",
  },
  editIconContainer: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#147efb",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fff",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#bbb",
    textAlign: "center",
    marginBottom: 8,
  },
  section: {
    backgroundColor: "#222",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    width: "100%",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#bbb",
    width: 160,
  },
  detail: {
    fontSize: 14,
    color: "#bbb",
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 6,
  },
  slider: {
    width: "100%",
    height: 36,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    width: "100%",
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  unavailableButton: {
    backgroundColor: "#ff3b30",
    marginBottom: 12,
    width: "100%",
  },
  cancelButton: {
    backgroundColor: "#333",
  },
  confirmButton: {
    backgroundColor: "#147efb",
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 15,
    color: "#bbb",
    fontWeight: "500",
  },
});

export default IndividualProfile;