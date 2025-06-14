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
  FlatList
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import PhotoInput from "../components/photoInput";

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const adminRoles = [
  { key: "admin", label: "Schedule Admin" },
  { key: "ssAdmin", label: "Servants Manager" },
  { key: "alhanAdmin", label: "Alhan Manager" },
  { key: "isServant", label: "Servants Meeting Tracker" },
  { key: "deaconAdmin", label: "Deacon Trackers Manager" },
  { key: "paschaAdmin", label: "Pascha Organizer" },
];

const AdminManager = () => {
  const [users, setUsers] = useState([]);
  const [church, setChurch] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  const [photoInputVisible, setPhotoInputVisible] = useState(false);
  const [isListReady, setIsListReady] = useState(false);
  const sectionListRef = useRef(null);

  // Alphabet for index bar (only letters with data)
  const [availableLetters, setAvailableLetters] = useState([]);

  // Fetch current user's church
  useEffect(() => {
    const user = auth().currentUser;
    if (user) {
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
    } else {
      setLoading(false);
      Alert.alert("Error", "No user authenticated.");
    }
  }, []);

  // Fetch users and profile pictures
  useEffect(() => {
    if (!church) return;

    const fetchProfilePictureUrls = async () => {
      try {
        const querySnapshot = await firestore().collection("users").get();
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
        setProfilePictureUrls(urls);
      } catch (error) {
      }
    };

    fetchProfilePictureUrls();
    const intervalId = setInterval(fetchProfilePictureUrls, 30000);

    const unsubscribe = firestore()
      .collection("users")
      .onSnapshot(
        (querySnapshot) => {
          const userList = querySnapshot.docs
            .map((doc) => ({
              id: doc.id,
              name: (doc.data().name || "").trim().toLowerCase(),
              ...doc.data(),
            }))
            .sort((a, b) => {
              const nameComparison = a.name.localeCompare(b.name);
              if (nameComparison === 0) {
                return a.id.localeCompare(b.id);
              }
              return nameComparison;
            })
            .map((user) => ({
              ...user,
              name: querySnapshot.docs
                .find((d) => d.id === user.id)
                ?.data().name || "",
            }));

          // Group users by first letter
          const grouped = userList.reduce((acc, user) => {
            const firstLetter = user.name.charAt(0).toUpperCase() || "Other";
            if (!acc[firstLetter]) acc[firstLetter] = [];
            acc[firstLetter].push(user);
            return acc;
          }, {});

          // Convert to SectionList format
          const sectionData = Object.keys(grouped)
            .sort()
            .map((letter) => ({
              title: letter,
              data: grouped[letter],
            }));

          // Set available letters
          const letters = sectionData.map((section) => section.title).sort();

          setUsers(userList);
          setSections(sectionData);
          setAvailableLetters(letters);
        },
        (error) => {
          Alert.alert("Error", "Could not fetch users.");
        }
      );

    return () => {
      clearInterval(intervalId);
      unsubscribe();
    };
  }, [church]);

  const openEditModal = (user) => {
    if (!user?.id) return;
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setSelectedUser(user);
    const initialRoles = adminRoles
      .filter((role) => user[role.key])
      .map((role) => role.key);
    setSelectedRoles(initialRoles);
    setModalVisible(true);
  };

  const openPhotoInputModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setPhotoInputVisible(true);
  };

  const closeEditModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setModalVisible(false);
    setSelectedUser(null);
    setSelectedRoles([]);
  };

  const closePhotoInputModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setPhotoInputVisible(false);
  };

  const toggleRole = (roleKey) => {
    setSelectedRoles((prev) =>
      prev.includes(roleKey)
        ? prev.filter((r) => r !== roleKey)
        : [...prev, roleKey]
    );
  };

  const saveRoles = async () => {
    if (!selectedUser) return;

    try {
      const roleUpdates = {};
      adminRoles.forEach((role) => {
        roleUpdates[role.key] = selectedRoles.includes(role.key);
      });
      await firestore()
        .collection("users")
        .doc(selectedUser.id)
        .update(roleUpdates);
      setModalVisible(false);
    } catch (error) {
      Alert.alert("Error", "Could not update roles. Please try again.");
    }
  };

  const scrollToSection = (letter) => {
    if (!sectionListRef.current || !availableLetters.includes(letter) || !isListReady) {
      return;
    }

    const sectionIndex = sections.findIndex(
      (section) => section.title.toUpperCase() === letter.toUpperCase()
    );


    if (sectionIndex >= 0) {
      setTimeout(() => {
        try {
          sectionListRef.current.scrollToLocation({
            sectionIndex,
            itemIndex: 0,
            animated: true,
            viewPosition: 0,
            viewOffset: 0,
          });
          ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
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
              animated: true,
              viewPosition: 0,
            });
          } catch (fallbackError) {
          }
        }
      }, 0);
    } else {
    }
  };

  const renderUser = ({ item }) => {
    const activeRoles =
      adminRoles
        .filter((role) => item[role.key])
        .map((role) => role.label)
        .join(", ") || "No roles assigned";

    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => openEditModal(item)}
        activeOpacity={0.7}
      >
        <View style={styles.userImageContainer}>
          <Image
            style={styles.userImage}
            source={
              item.id && profilePictureUrls[item.id]
                ? { uri: profilePictureUrls[item.id] }
                : require("../assets/default_profile.png")
            }
            defaultSource={require("../assets/default_profile.png")}
            onError={() => {
              setProfilePictureUrls((prev) => ({
                ...prev,
                [item.id]: null,
              }));
            }}
          />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userChurch}>{item.church || "No church assigned"}</Text>
          <Text style={styles.userRoles}>Roles: {activeRoles}</Text>
        </View>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="pencil" size={18} color="#fff" />
          <Text style={styles.buttonText}>Edit</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section: { title } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#147efb" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Manage Admin Privileges</Text>
      <View style={styles.listWrapper}>
        <SectionList
          ref={sectionListRef}
          sections={sections}
          renderItem={renderUser}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No users found.</Text>
          }
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
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
              onPress={() => scrollToSection(letter)}
            >
              <Text style={styles.indexText}>{letter}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {selectedUser && (
        <Modal visible={modalVisible} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.headerContent}>
                  <View style={styles.profileImageContainer}>
                    <Image
                      style={styles.profileImage}
                      source={
                        selectedUser.id && profilePictureUrls[selectedUser.id]
                          ? { uri: profilePictureUrls[selectedUser.id] }
                          : require("../assets/default_profile.png")
                      }
                      defaultSource={require("../assets/default_profile.png")}
                      onError={() => {
                        setProfilePictureUrls((prev) => ({
                          ...prev,
                          [selectedUser.id]: null,
                        }));
                      }}
                    />
                    <TouchableOpacity
                      style={styles.editProfilePictureButton}
                      onPress={openPhotoInputModal}
                    >
                      <Ionicons name="pencil" size={16} color="#147efb" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.modalTitle}>
                    Edit Roles for {selectedUser?.name}
                  </Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={closeEditModal}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={adminRoles}
                renderItem={({ item: role }) => (
                  <View style={styles.roleItem}>
                    <Text style={styles.roleText}>{role.label}</Text>
                    <Switch
                      value={selectedRoles.includes(role.key)}
                      onValueChange={() => toggleRole(role.key)}
                      trackColor={{ false: "#555", true: "#147efb" }}
                      thumbColor={
                        selectedRoles.includes(role.key) ? "#fff" : "#aaa"
                      }
                    />
                  </View>
                )}
                keyExtractor={(item) => item.key}
                contentContainerStyle={styles.rolesList}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={closeEditModal}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveRoles}
                >
                  <Text style={styles.modalButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      {selectedUser && (
        <PhotoInput
          visible={photoInputVisible}
          onClose={closePhotoInputModal}
          userId={selectedUser.id}
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
    marginBottom: 20,
    textAlign: "center",
  },
  listWrapper: {
    flex: 1,
    flexDirection: "row",
  },
  listContainer: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  userCard: {
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: "row",
    alignItems: "center",
  },
  userImageContainer: {
    marginRight: 12,
  },
  userImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#333333",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  userChurch: {
    fontSize: 14,
    color: "#aaa",
    marginTop: 4,
  },
  userRoles: {
    fontSize: 14,
    color: "#aaa",
    marginTop: 4,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  editButton: {
    backgroundColor: "#147efb",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#fff",
  },
  emptyText: {
    fontSize: 16,
    color: "#aaa",
    textAlign: "center",
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    width: "90%",
    maxHeight: "80%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#147efb",
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  profileImageContainer: {
    position: "relative",
    marginBottom: 12,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#fff",
  },
  editProfilePictureButton: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  closeButton: {
    padding: 4,
  },
  rolesList: {
    padding: 16,
  },
  roleItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: "#2a2a2a",
  },
  roleText: {
    fontSize: 16,
    color: "#fff",
    flex: 1,
  },
  modalButtons: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#333",
    justifyContent: "space-between",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButton: {
    backgroundColor: "#147efb",
  },
  cancelButton: {
    backgroundColor: "#ff4444",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
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

export default AdminManager;