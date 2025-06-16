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
  Dimensions,
  Platform,
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

// Responsive design helper
const { width, height } = Dimensions.get("window");
const isTablet = Platform.isPad || (width >= 768 && height >= 768);
const scale = isTablet ? 1.2 : 1;
const paddingHorizontal = isTablet ? 32 : 16;
const indexBarWidth = isTablet ? 32 : 24;

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
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerHeightRef = useRef(0);
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
      } catch (error) {}
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

  // Corrected scroll function to match DeaconEdits
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
      <Text style={[styles.sectionHeaderText, { fontSize: 18 * scale }]}>{title}</Text>
    </View>
  );

  const renderUser = ({ item }) => {
    const activeRoles =
      adminRoles
        .filter((role) => item[role.key])
        .map((role) => role.label)
        .join(", ") || "No roles assigned";

    return (
      <TouchableOpacity
        style={[styles.userCard, { padding: 16 * scale, marginBottom: 12 * scale }]}
        onPress={() => openEditModal(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.userImageContainer, { marginRight: 12 * scale }]}>
          <Image
            style={[styles.userImage, { width: 48 * scale, height: 48 * scale, borderRadius: 24 * scale }]}
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
          <Text style={[styles.userName, { fontSize: 18 * scale }]}>{item.name}</Text>
          <Text style={[styles.userChurch, { fontSize: 14 * scale, marginTop: 4 * scale }]}>
            {item.church || "No church assigned"}
          </Text>
          <Text style={[styles.userRoles, { fontSize: 14 * scale, marginTop: 4 * scale }]}>
            Roles: {activeRoles}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton, { paddingVertical: 8 * scale, paddingHorizontal: 16 * scale }]}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="pencil" size={18 * scale} color="#fff" />
          <Text style={[styles.buttonText, { fontSize: 14 * scale }]}>Edit</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size={isTablet ? "large" : "small"} color="#147efb" />
        <Text style={[styles.loadingText, { fontSize: 16 * scale }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingHorizontal }]}>
      <Text style={[styles.header, { fontSize: 24 * scale }]}>Manage Admin Privileges</Text>
      <View style={[styles.listWrapper, { paddingRight: indexBarWidth }]}>
        <SectionList
          ref={sectionListRef}
          sections={sections}
          renderItem={renderUser}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={[styles.emptyText, { fontSize: 16 * scale }]}>No users found.</Text>
          }
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={true}
          extraData={profilePictureUrls}
        />
        <View style={[styles.indexBar, { width: indexBarWidth }]}>
          {availableLetters.map((letter) => (
            <View
              key={letter}
              style={[styles.indexItem, { paddingVertical: 2 * scale }]}
              onTouchStart={() => {
                scrollToSection(letter);
                ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
              }}
            >
              <Text style={[styles.indexText, { fontSize: 18 * scale }]}>{letter}</Text>
            </View>
          ))}
        </View>
      </View>
      {selectedUser && (
        <Modal visible={modalVisible} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContainer, { width: isTablet ? "70%" : "90%", maxHeight: isTablet ? "90%" : "80%" }]}>
              <View style={styles.modalHeader}>
                <View style={styles.headerContent}>
                  <View style={[styles.profileImageContainer, { marginBottom: 12 * scale }]}>
                    <Image
                      style={[styles.profileImage, { width: 80 * scale, height: 80 * scale, borderRadius: 40 * scale }]}
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
                      style={[styles.editProfilePictureButton, { padding: 6 * scale }]}
                      onPress={openPhotoInputModal}
                    >
                      <Ionicons name="pencil" size={16 * scale} color="#147efb" />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.modalTitle, { fontSize: 18 * scale }]}>
                    Edit Roles for {selectedUser?.name}
                  </Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={closeEditModal}>
                  <Ionicons name="close" size={24 * scale} color="#fff" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={adminRoles}
                renderItem={({ item: role }) => (
                  <View style={[styles.roleItem, { paddingVertical: 12 * scale, paddingHorizontal: 8 * scale, marginBottom: 8 * scale }]}>
                    <Text style={[styles.roleText, { fontSize: 16 * scale }]}>{role.label}</Text>
                    <Switch
                      value={selectedRoles.includes(role.key)}
                      onValueChange={() => toggleRole(role.key)}
                      trackColor={{ false: "#555", true: "#147efb" }}
                      thumbColor={selectedRoles.includes(role.key) ? "#fff" : "#aaa"}
                    />
                  </View>
                )}
                keyExtractor={(item) => item.key}
                contentContainerStyle={[styles.rolesList, { padding: 16 * scale }]}
              />
              <View style={[styles.modalButtons, { padding: 16 * scale, gap: 12 * scale }]}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton, { paddingVertical: 12 * scale }]}
                  onPress={closeEditModal}
                >
                  <Text style={[styles.modalButtonText, { fontSize: 16 * scale }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton, { paddingVertical: 12 * scale }]}
                  onPress={saveRoles}
                >
                  <Text style={[styles.modalButtonText, { fontSize: 16 * scale }]}>Confirm</Text>
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
    paddingTop: 20,
  },
  header: {
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20 * scale,
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
    shadowColor: "#000",
    marginRight: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: "row",
    alignItems: "center",
  },
  userImageContainer: {
    marginRight: 12 * scale,
  },
  userImage: {
    borderWidth: 1,
    borderColor: "#333333",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontWeight: "600",
    color: "#fff",
  },
  userChurch: {
    color: "#aaa",
  },
  userRoles: {
    color: "#aaa",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
  },
  editButton: {
    backgroundColor: "#147efb",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "500",
    marginLeft: 6 * scale,
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
  emptyText: {
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
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16 * scale,
    backgroundColor: "#147efb",
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  profileImageContainer: {
    position: "relative",
  },
  profileImage: {
    borderWidth: 2,
    borderColor: "#fff",
  },
  editProfilePictureButton: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  modalTitle: {
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  closeButton: {
    padding: 4 * scale,
  },
  rolesList: {
    padding: 16 * scale,
  },
  roleItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
  },
  roleText: {
    color: "#fff",
    flex: 1,
  },
  modalButtons: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#333",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
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
    fontWeight: "500",
  },
  sectionHeader: {
    backgroundColor: "transparent",
    paddingVertical: 8 * scale,
    paddingHorizontal: 12 * scale,
  },
  sectionHeaderText: {
    fontWeight: "600",
    color: "#fff",
  },
  indexBar: {
    width: indexBarWidth,
    alignItems: "center",
    justifyContent: "flex-start", // Changed from "center" to move letters higher
    paddingVertical: 0,
    position: "absolute",
    right: 0,
    top: 50 * scale, // Added top padding to shift letters up
    bottom: 0,
  },
  indexItem: {
    backgroundColor: "#121212",
    borderRadius: 4,
  },
  indexText: {
    color: "#147efb",
    fontWeight: "600",
  },
});

export default AdminManager;