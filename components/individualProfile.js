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
  Linking,
} from "react-native";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import { callFunction } from "./functionCalls";
import Slider from "@react-native-community/slider";
import firestore, { FieldValue } from "@react-native-firebase/firestore";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import PhotoInput from "./photoInput";
import ProfileImageExpander from "./ProfileImageExpander";

const defaultProfileImage = require("../assets/default_profile.png");

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Function to format numbers
const formatNumber = (num) => {
  if (num % 1 === 0) {
    return num.toString();
  } else {
    return num.toFixed(2).replace(/\.?0+$/, "");
  }
};

// Function to format date
const formatDate = (date) => {
  if (!date) return "N/A";
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${month}-${day}-${year}`;
};

// Function to parse and format lastServe date
const formatLastServeDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const [month, day, year] = dateStr.split("-").map(Number);
    if (!month || !day || !year) return null;
    const date = new Date(2000 + year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (error) {
    return null;
  }
};

// Syncs only the frequency for parent and children in user doc and deacons array
const syncChildren = async (
  parentId,
  frequency,
  church,
  batch,
  churchData,
  churchRef
) => {
  if (!parentId) return;

  const parentRef = firestore().collection("users").doc(parentId);
  const parentDoc = await parentRef.get();
  if (!parentDoc.exists) return;

  const parentData = parentDoc.data();
  const updatedChildren = (parentData.children || []).map((child) => ({
    ...child,
    frequency: frequency ?? 0,
  }));

  batch.update(parentRef, {
    frequency: frequency ?? 0,
    children: updatedChildren,
  });

  const deacons = churchData.deacons || [];
  const updatedDeacons = deacons.map((deacon) => {
    if (
      deacon.uid === parentId ||
      updatedChildren.some((child) => child.uid === deacon.uid)
    ) {
      return { ...deacon, frequency: frequency ?? 0 };
    }
    return deacon;
  });

  batch.update(churchRef, { deacons: updatedDeacons });
};

// Updates deacon frequency for a single user
const syncDeaconFrequency = (uid, frequency, churchData, churchRef, batch) => {
  if (!uid) return;

  const deacons = churchData.deacons || [];
  const deaconIndex = deacons.findIndex((deacon) => deacon.uid === uid);
  if (deaconIndex !== -1) {
    deacons[deaconIndex] = {
      ...deacons[deaconIndex],
      frequency: frequency ?? 0,
    };
    batch.update(churchRef, { deacons });
  }
};

const IndividualProfile = ({
  userId,
  show,
  onClose,
  church,
  week,
  currentEditingWeek,
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

  useEffect(() => {
    // Reset state when modal is opened or userId changes
    setImageUrl(null);
    setUserData(null);
    setTempExperience(0);
    setTempFrequency(0);
    setLoading(true);
    setIsChild(false);
    setShowPhotoModal(false);
    setIsDeacon(false);

    if (!show || !userId) {
      setLoading(false);
      return;
    }

    let userUnsubscribe = null;
    let usersQueryUnsubscribe = null;

    const fetchImage = async (childStatus) => {
      try {
        const storagePath = childStatus
          ? `profilePictures/${userId}.png`
          : `profilePictures/${userId}.png`;
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

    const fetchUserData = () => {
      userUnsubscribe = firestore()
        .collection("users")
        .doc(userId)
        .onSnapshot(
          async (userDoc) => {
            if (userDoc.exists) {
              const data = userDoc.data();
              setUserData({
                name: data.name || "N/A",
                age: data.age || "N/A",
                phone: data.phone || data.number || "Not provided",
                nextWeekServe: data.nextWeekServe || "N/A",
                nextRole: data.nextRole || "N/A",
                experience: data.experience ?? 0,
                frequency: data.frequency ?? 0,
                children: data.children || [],
                lastServe: data.lastServe || null,
                lastRole: data.lastRole || null,
              });
              setTempExperience(data.experience ?? 0);
              setTempFrequency(data.frequency ?? 0);
              setIsDeacon(data.isDeacon || false);
              setIsChild(false);
              await fetchImage(false);
              setLoading(false);
            } else {
              usersQueryUnsubscribe = firestore()
                .collection("users")
                .onSnapshot(
                  async (querySnapshot) => {
                    let childData = null;
                    let parentId = null;
                    let parentPhone = "Not provided";

                    for (const doc of querySnapshot.docs) {
                      const userData = doc.data();
                      const children = userData.children || [];
                      const child = children.find((c) => c.uid === userId);
                      if (child) {
                        childData = child;
                        parentId = doc.id;
                        parentPhone =
                          userData.phone || userData.number || "Not provided";
                        break;
                      }
                    }

                    if (childData) {
                      setUserData({
                        name: childData.name || "N/A",
                        age: childData.age || "N/A",
                        phone: parentPhone,
                        nextWeekServe: childData.nextWeekServe || "N/A",
                        nextRole: childData.nextRole || "N/A",
                        experience: childData.experience ?? 0,
                        frequency: childData.frequency ?? 0,
                        parentId,
                        lastServe: childData.lastServe || null,
                        lastRole: childData.lastRole || null,
                      });
                      setTempExperience(childData.experience ?? 0);
                      setTempFrequency(childData.frequency ?? 0);
                      setIsChild(true);
                      setIsDeacon(false);
                      await fetchImage(true);
                      setLoading(false);
                    } else {
                      setLoading(false);
                    }
                  },
                  () => setLoading(false)
                );
            }
          },
          () => setLoading(false)
        );
    };

    fetchUserData();

    // Cleanup listeners when modal is closed or userId changes
    return () => {
      if (userUnsubscribe) userUnsubscribe();
      if (usersQueryUnsubscribe) usersQueryUnsubscribe();
    };
  }, [show, userId]);

  const handleSliderChange = (setter) => (value) => {
    setter(value);
  };

  const handleSaveEdits = async () => {
    ReactNativeHapticFeedback.trigger("impactMedium", hapticOptions);
    try {
      const batch = firestore().batch();
      const churchRef = firestore().collection("churches").doc(church);
      const churchDoc = await churchRef.get();
      if (!churchDoc.exists) {
        throw new Error("Church document not found");
      }
      const churchData = churchDoc.data();
      const deacons = churchData.deacons || [];

      // Helper function to sync a user's frequency in the deacons array
      const syncDeacon = (uid, frequency) => {
        const deaconIndex = deacons.findIndex((d) => d.uid === uid);
        if (deaconIndex !== -1) {
          deacons[deaconIndex] = { ...deacons[deaconIndex], frequency };
        }
      };

      if (isChild) {
        // Handle child user
        const parentRef = firestore()
          .collection("users")
          .doc(userData.parentId);
        const parentDoc = await parentRef.get();
        if (!parentDoc.exists) {
          throw new Error("Parent document not found");
        }
        const parentData = parentDoc.data();

        // Update the child's data in the parent's children array
        const updatedChildren = (parentData.children || []).map((child) =>
          child.uid === userId
            ? {
                ...child,
                experience: tempExperience ?? 0,
                frequency: tempFrequency ?? 0,
              }
            : child
        );

        // If frequency changed, sync it across parent and siblings
        if (userData.frequency !== tempFrequency) {
          const syncedFrequency = tempFrequency ?? 0;
          const syncedChildren = updatedChildren.map((child) => ({
            ...child,
            frequency: syncedFrequency,
          }));
          batch.update(parentRef, {
            frequency: syncedFrequency,
            children: syncedChildren,
          });

          // Sync parent and siblings in deacons array
          syncDeacon(userData.parentId, syncedFrequency);
          syncedChildren.forEach((child) =>
            syncDeacon(child.uid, syncedFrequency)
          );
        } else {
          // Only update the child's data
          batch.update(parentRef, { children: updatedChildren });
        }

        // Update the child's deacon entry
        syncDeacon(userId, tempFrequency ?? 0);
        const childDeaconIndex = deacons.findIndex((d) => d.uid === userId);
        if (childDeaconIndex !== -1) {
          deacons[childDeaconIndex].experience = tempExperience ?? 0;
        }
      } else {
        // Handle parent user
        const userRef = firestore().collection("users").doc(userId);
        batch.update(userRef, {
          experience: tempExperience ?? 0,
          frequency: tempFrequency ?? 0,
        });

        // If the user has children and frequency changed, sync with children
        if (
          userData.children?.length > 0 &&
          userData.frequency !== tempFrequency
        ) {
          const syncedFrequency = tempFrequency ?? 0;
          const updatedChildren = userData.children.map((child) => ({
            ...child,
            frequency: syncedFrequency,
          }));
          batch.update(userRef, { children: updatedChildren });

          // Sync each child in the deacons array
          updatedChildren.forEach((child) =>
            syncDeacon(child.uid, syncedFrequency)
          );
        }

        // Update the parent's deacon entry
        syncDeacon(userId, tempFrequency ?? 0);
        const parentDeaconIndex = deacons.findIndex((d) => d.uid === userId);
        if (parentDeaconIndex !== -1) {
          deacons[parentDeaconIndex].experience = tempExperience ?? 0;
        }
      }

      // Commit all updates to the deacons array
      batch.update(churchRef, { deacons });
      await batch.commit();

      // Update local state and close
      setUserData((prev) => ({
        ...prev,
        experience: tempExperience ?? 0,
        frequency: tempFrequency ?? 0,
      }));
      onClose();
    } catch (error) {
      Alert.alert("Update Error", "Failed to save changes. Please try again.");
    }
  };

  const handleUnavailable = async () => {
    try {
      if (!church || !userId) {
        Alert.alert("Error", "Missing required information.");
        return;
      }

      // Check if user is serving in multiple weeks
      const schedulesRef = firestore()
        .collection("churches")
        .doc(church)
        .collection("schedule");

      const snapshot = await schedulesRef.get();
      const servingWeeks = [];

      snapshot.docs.forEach((doc) => {
        const scheduleData = doc.data();
        const weekId = doc.id;

        // Check if user is serving in this week
        const isServing =
          scheduleData.altar?.some((server) => server.uid === userId) ||
          Object.values(scheduleData).some(
            (reader) =>
              reader && typeof reader === "object" && reader.uid === userId
          );

        if (isServing) {
          servingWeeks.push(weekId);
        }
      });

      // If we're editing a specific week and user is serving in that week, prioritize it
      if (currentEditingWeek && servingWeeks.includes(currentEditingWeek)) {
        if (servingWeeks.length === 1) {
          // User is only serving in the current editing week
          markUnavailableForWeek(currentEditingWeek);
        } else {
          // User is serving in multiple weeks, show selection with current week first
          const sortedWeeks = [
            currentEditingWeek,
            ...servingWeeks.filter((w) => w !== currentEditingWeek),
          ];

          Alert.alert(
            "Multiple Weeks Found",
            "This user is serving in multiple weeks. Which week would you like to mark as unavailable?",
            [
              { text: "Cancel", style: "cancel" },
              ...sortedWeeks.map((weekId) => ({
                text: `${formatWeekDisplay(weekId)}${
                  weekId === currentEditingWeek ? " (Current Week)" : ""
                }`,
                onPress: () => markUnavailableForWeek(weekId),
              })),
            ],
            { cancelable: true }
          );
        }
      } else if (servingWeeks.length > 1) {
        // User is serving in multiple weeks but not in current editing week
        Alert.alert(
          "Multiple Weeks Found",
          "This user is serving in multiple weeks. Which week would you like to mark as unavailable?",
          [
            { text: "Cancel", style: "cancel" },
            ...servingWeeks.map((weekId) => ({
              text: formatWeekDisplay(weekId),
              onPress: () => markUnavailableForWeek(weekId),
            })),
          ],
          { cancelable: true }
        );
      } else if (servingWeeks.length === 1) {
        // User is only serving in one week
        markUnavailableForWeek(servingWeeks[0]);
      } else {
        // User is not serving in any week
        Alert.alert(
          "No Service Found",
          "This user is not currently scheduled to serve in any week.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      Alert.alert(
        "Error",
        "Failed to check user's schedule. Please try again."
      );
    }
  };

  const markUnavailableForWeek = (targetWeek) => {
    Alert.alert(
      "Mark Unavailable",
      `Are you sure you want to mark this user as unavailable for ${formatWeekDisplay(
        targetWeek
      )}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: async () => {
            ReactNativeHapticFeedback.trigger("impactMedium", hapticOptions);
            try {
              const currentUser = auth().currentUser;
              if (!currentUser) {
                Alert.alert(
                  "Error",
                  "You must be logged in to perform this action."
                );
                return;
              }

              if (!isChild) {
                await firestore()
                  .collection("users")
                  .doc(userId)
                  .update({
                    unavailableWeeks: FieldValue.arrayUnion(targetWeek),
                  });
              }

              await callFunction(
                currentUser,
                "https://unavailable-for-week-hy6oofbihq-uc.a.run.app",
                { church, week: targetWeek, uid: userId, family },
                "Failed to mark as unavailable. Please try again."
              );
              onClose();
            } catch (error) {
              console.error("Error marking unavailable:", error);
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

  // Helper function to format week display
  const formatWeekDisplay = (weekStr) => {
    if (!weekStr) return "Unknown Week";
    const [month, day, year] = weekStr.split("-").map(Number);
    const date = new Date(2000 + year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleRemoveDeacon = () => {
    Alert.alert(
      "Remove Deacon",
      "Are you sure you want to remove this user as a deacon? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
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

              const churchDocRef = firestore()
                .collection("churches")
                .doc(church);
              const churchDoc = await churchDocRef.get();
              if (!churchDoc.exists) {
                throw new Error("Church document not found");
              }

              const churchData = churchDoc.data();
              const updatedDeacons = (churchData.deacons || []).filter(
                (deacon) => deacon.uid !== userId
              );

              await churchDocRef.update({ deacons: updatedDeacons });
              await firestore()
                .collection("users")
                .doc(userId)
                .update({ isDeacon: false });

              setIsDeacon(false);
              Alert.alert("Success", "The user has been removed as a deacon.");
              onClose();
            } catch (error) {
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

  const handleEditPhoto = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);

    Alert.alert(
      "Edit Profile Picture",
      "Choose an option",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Change Photo",
          onPress: () => setShowPhotoModal(true),
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

  const handleRemovePhoto = async () => {
    ReactNativeHapticFeedback.trigger("impactMedium", hapticOptions);
    try {
      const storagePath = isChild
        ? `childProfilePictures/${userId}.png`
        : `profilePictures/${userId}.png`;

      // Delete from storage
      await storage().ref(storagePath).delete();

      // Update local state
      setImageUrl(null);

      Alert.alert("Success", "Profile picture removed successfully.");
    } catch (error) {
      // If the file doesn't exist, that's okay
      if (error.code === "storage/object-not-found") {
        setImageUrl(null);
      } else {
        Alert.alert(
          "Error",
          "Failed to remove profile picture. Please try again."
        );
      }
    }
  };

  const handleCancel = () => {
    onClose();
  };

  const handlePhonePress = async () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    const phoneNumber = userData?.phone;
    if (phoneNumber && phoneNumber !== "Not provided") {
      const smsUrl = `sms:${phoneNumber}`;
      try {
        const supported = await Linking.canOpenURL(smsUrl);
        if (supported) {
          await Linking.openURL(smsUrl);
        } else {
          Alert.alert("Error", "Messaging is not supported on this device.");
        }
      } catch (error) {
        Alert.alert("Error", "Failed to open messaging app. Please try again.");
      }
    }
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
            <ProfileImageExpander
              imageUrl={imageUrl || defaultProfileImage}
              size={120}
              finalSize={300}
              borderRadius={60}
              style={styles.image}
            />
            <TouchableOpacity
              style={styles.editIconContainer}
              onPress={handleEditPhoto}
              activeOpacity={0.7}
              accessibilityLabel="Edit Profile Picture"
            >
              <Icon name="pencil" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>{userData?.name || "N/A"}</Text>
          {isChild && <Text style={styles.subtitle}>Child Profile</Text>}
          {currentEditingWeek && (
            <Text style={styles.currentWeekIndicator}>
              Editing: {formatWeekDisplay(currentEditingWeek)}
            </Text>
          )}

          <View style={styles.section}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                {isChild ? "Parent's Phone:" : "Phone:"}
              </Text>
              {userData?.phone && userData.phone !== "Not provided" ? (
                <TouchableOpacity
                  onPress={handlePhonePress}
                  activeOpacity={0.7}
                  accessibilityLabel="Message User"
                >
                  <Text style={styles.phoneText}>{userData.phone}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.detail}>
                  {userData?.phone || "Not provided"}
                </Text>
              )}
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
            {userData?.lastServe && userData?.lastRole && (
              <View style={styles.lastServeRow}>
                <Text style={styles.lastServeText}>
                  Last served on {formatLastServeDate(userData.lastServe)} as{" "}
                  {userData.lastRole}
                </Text>
              </View>
            )}
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
    justifyContent: "center",
    position: "relative",
    width: 120, // Set explicit width to match the ProfileImageExpander size
    height: 120, // Set explicit height to match the ProfileImageExpander size
    alignSelf: "center", // Ensure the container itself is centered
  },
  image: {
    width: 120, // Changed from 100 to match ProfileImageExpander size
    height: 120, // Changed from 100 to match ProfileImageExpander size
    borderRadius: 60, // Half of width/height
    borderWidth: 2,
    borderColor: "#147efb",
  },
  editIconContainer: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#147efb",
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
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
  currentWeekIndicator: {
    fontSize: 12,
    color: "#147efb",
    textAlign: "center",
    marginBottom: 8,
    fontStyle: "italic",
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
    textAlign: "left",
  },
  phoneText: {
    fontSize: 14,
    color: "#bbb",
    flex: 1,
    textAlign: "left",
    textDecorationLine: "underline",
  },
  lastServeRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  lastServeText: {
    fontSize: 13,
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
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
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
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
    textAlign: "center",
  },
});

export default IndividualProfile;
