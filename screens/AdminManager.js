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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import PhotoInput from "../components/photoInput";
import ProfileImageExpander from "../components/ProfileImageExpander";
import AlphabetIndexBar from "../components/AlphabetIndexBar";
import AsyncStorage from '@react-native-async-storage/async-storage';

const defaultProfileImage = require("../assets/default_profile.png");

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Simple cache utilities
const CacheUtils = {
  async get(key) {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Check if cache is still valid (72 hours)
        if (Date.now() - parsed.timestamp < 72 * 60 * 60 * 1000) {
          return parsed.data;
        }
      }
    } catch (error) {
      console.log('Cache read error:', error);
    }
    return null;
  },

  async set(key, data) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.log('Cache write error:', error);
    }
  },

  async remove(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.log('Cache remove error:', error);
    }
  }
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
  { key: "trafficAdmin", label: "Traffic Manager"},
  { key: "isServant", label: "Servants Meeting Tracker" },
];

const AdminManager = () => {
  // Core state
  const [church, setChurch] = useState(null);
  const [users, setUsers] = useState([]);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});

  // UI state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [photoInputVisible, setPhotoInputVisible] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);

  // Refs
  const headerHeightRef = useRef(0);
  const sectionListRef = useRef(null);
  const isMounted = useRef(true);
  const userUnsubscribe = useRef(null);
  const usersUnsubscribe = useRef(null);
  const cacheKeys = useRef({
    church: null,
    users: null,
    profilePics: null
  });

  // Initialize and load cached data immediately
  useEffect(() => {
    isMounted.current = true;

    const initializeApp = async () => {
      const user = auth().currentUser;
      if (!user) {
        setLoading(false);
        Alert.alert("Error", "No user authenticated.");
        return;
      }

      // Set cache keys
      cacheKeys.current = {
        church: `admin_manager_church_${user.uid}`,
        users: `admin_manager_users_${user.uid}`,
        profilePics: `admin_manager_profile_pics_${user.uid}`
      };

      // Load cached data immediately (non-blocking)
      loadCachedData();

      // Set up real-time listeners
      setupUserChurchListener();

      // Mark loading as complete after a short delay
      setTimeout(() => {
        if (isMounted.current) {
          setLoading(false);
        }
      }, 300);
    };

    initializeApp();

    return () => {
      isMounted.current = false;
      if (userUnsubscribe.current) {
        userUnsubscribe.current();
      }
      if (usersUnsubscribe.current) {
        usersUnsubscribe.current();
      }
    };
  }, []);

  // Load cached data without blocking
  const loadCachedData = async () => {
    try {
      // Load all cached data in parallel
      const [cachedChurch, cachedUsers, cachedProfilePics] = await Promise.all([
        CacheUtils.get(cacheKeys.current.church),
        CacheUtils.get(cacheKeys.current.users),
        CacheUtils.get(cacheKeys.current.profilePics)
      ]);

      if (cachedChurch && isMounted.current) {
        setChurch(cachedChurch);
      }

      if (cachedUsers && isMounted.current) {
        setUsers(cachedUsers);
        // Process sections from cached users
        processSections(cachedUsers);
      }

      if (cachedProfilePics && isMounted.current) {
        setProfilePictureUrls(cachedProfilePics);
      }
    } catch (error) {
      console.log('Error loading cached data:', error);
    }
  };

  // Set up user church listener
  const setupUserChurchListener = () => {
    const user = auth().currentUser;

    userUnsubscribe.current = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        async (doc) => {
          if (!isMounted.current) return;

          if (doc.exists) {
            const userChurch = doc.data().church || null;
            setChurch(userChurch);

            // Cache church data
            await CacheUtils.set(cacheKeys.current.church, userChurch);

            // Set up users listener when church is available
            if (userChurch) {
              setupUsersListener(userChurch);
            }
          }
        },
        (error) => {
          if (isMounted.current) {
            Alert.alert("Error", "Failed to fetch church data.");
          }
        }
      );
  };

  // Set up users listener
  const setupUsersListener = (churchId) => {
    // Clear previous listener if exists
    if (usersUnsubscribe.current) {
      usersUnsubscribe.current();
    }

    // Fetch profile pictures periodically
    const fetchProfilePictureUrls = async () => {
      if (!isMounted.current) return;

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

        if (isMounted.current) {
          setProfilePictureUrls(urls);
          // Cache profile picture URLs
          await CacheUtils.set(cacheKeys.current.profilePics, urls);
        }
      } catch (error) {}
    };

    fetchProfilePictureUrls();
    const intervalId = setInterval(fetchProfilePictureUrls, 30000);

    usersUnsubscribe.current = firestore()
      .collection("users")
      .onSnapshot(
        async (querySnapshot) => {
          if (!isMounted.current) return;

          const userList = querySnapshot.docs
            .map((doc) => ({
              id: doc.id,
              name: (doc.data().name || "").trim(),
              ...doc.data(),
            }))
            .sort((a, b) => {
              const nameComparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
              if (nameComparison === 0) {
                return a.id.localeCompare(b.id);
              }
              return nameComparison;
            })
            .map((user) => ({
              ...user,
              name:
                querySnapshot.docs.find((d) => d.id === user.id)?.data().name ||
                "",
            }));

          setUsers(userList);
          processSections(userList);

          // Cache users data
          await CacheUtils.set(cacheKeys.current.users, userList);
        },
        (error) => {
          if (isMounted.current) {
            Alert.alert("Error", "Could not fetch users.");
          }
        }
      );

    // Store interval cleanup
    return () => {
      clearInterval(intervalId);
    };
  };

  // Process sections from users list
  const processSections = (userList) => {
    // Group users by first letter (A-Z or #)
    const grouped = userList.reduce((acc, user) => {
      const firstChar = (user.name || '').charAt(0).toUpperCase();
      const firstLetter = /^[A-Z]$/.test(firstChar) ? firstChar : "#";
      if (!acc[firstLetter]) acc[firstLetter] = [];
      acc[firstLetter].push(user);
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
  };

  // Handle remove photo
  const handleRemovePhoto = async () => {
    if (!selectedUser?.id) return;

    setDeletingPhoto(true);
    try {
      // Delete from Firebase Storage
      const storageRef = storage().ref(`profilePictures/${selectedUser.id}.png`);
      await storageRef.delete();

      // Update local state
      setProfilePictureUrls(prev => ({
        ...prev,
        [selectedUser.id]: null
      }));

      // Clear cache for profile pics
      await CacheUtils.remove(cacheKeys.current.profilePics);

      Alert.alert("Success", "Profile picture deleted successfully");
    } catch (error) {
      // If the file doesn't exist, that's okay - just update local state
      if (error.code === 'storage/object-not-found') {
        setProfilePictureUrls(prev => ({
          ...prev,
          [selectedUser.id]: null
        }));
      } else {
        Alert.alert("Error", "Could not delete profile picture. Please try again.");
      }
    } finally {
      setDeletingPhoto(false);
    }
  };

  // Handle edit profile picture
  const handleEditProfilePicture = () => {
    Alert.alert(
      "Edit Profile Picture",
      "Choose an option",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Change Photo",
          onPress: () => setPhotoInputVisible(true),
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
    // Refresh profile picture after upload
    if (selectedUser?.id) {
      storage()
        .ref(`profilePictures/${selectedUser.id}.png`)
        .getDownloadURL()
        .then(async url => {
          setProfilePictureUrls(prev => ({
            ...prev,
            [selectedUser.id]: url
          }));
          // Clear cache to force refresh
          await CacheUtils.remove(cacheKeys.current.profilePics);
        })
        .catch(() => {
          // Keep existing or null
        });
    }
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

      // Clear users cache to force refresh
      await CacheUtils.remove(cacheKeys.current.users);

      setModalVisible(false);
    } catch (error) {
      Alert.alert("Error", "Could not update roles. Please try again.");
    }
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
      <Text style={[styles.sectionHeaderText, { fontSize: 18 * scale }]}>
        {title}
      </Text>
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
        style={[
          styles.userCard,
          { padding: 16 * scale, marginBottom: 12 * scale },
        ]}
        onPress={() => openEditModal(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.userImageContainer, { marginRight: 12 * scale }]}>
          <Image
            style={[
              styles.userImage,
              {
                width: 48 * scale,
                height: 48 * scale,
                borderRadius: 24 * scale,
              },
            ]}
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
          <Text style={[styles.userName, { fontSize: 18 * scale }]}>
            {item.name}
          </Text>
          <Text
            style={[
              styles.userChurch,
              { fontSize: 14 * scale, marginTop: 4 * scale },
            ]}
          >
            {item.church || "No church assigned"}
          </Text>
          <Text
            style={[
              styles.userRoles,
              { fontSize: 14 * scale, marginTop: 4 * scale },
            ]}
          >
            Roles: {activeRoles}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.editButton,
            { paddingVertical: 8 * scale, paddingHorizontal: 16 * scale },
          ]}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="pencil" size={18 * scale} color="#fff" />
          <Text style={[styles.buttonText, { fontSize: 14 * scale }]}>
            Edit
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // Show minimal loading only on first load
  if (loading && !church && users.length === 0) {
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
          No users found.
        </Text>
      ) : (
        <View style={styles.listWrapper}>
          <SectionList
            ref={sectionListRef}
            sections={sections}
            renderItem={renderUser}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item) => item.id || Math.random().toString()}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={true}
            extraData={profilePictureUrls}
            onScrollToIndexFailed={(info) => {
              // Do nothing when scroll fails - stay in current position
            }}
          />
          {/* Wrap the AlphabetIndexBar in an absolutely positioned View */}
          <View style={{ position: 'absolute', top: 150 * scale, right: 0, width: 30 }}>
            <AlphabetIndexBar 
              onLetterChange={scrollToSection} 
              availableLetters={sections.map(s => s.title)}
            />
          </View>
        </View>
      )}
      {selectedUser && (
        <Modal visible={modalVisible} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContainer,
                {
                  width: isTablet ? "70%" : "90%",
                  maxHeight: isTablet ? "90%" : "80%",
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <View style={styles.headerContent}>
                  <View
                    style={[
                      styles.profileImageContainer,
                      { marginBottom: 12 * scale },
                    ]}
                  >
                    <ProfileImageExpander
                      imageUrl={selectedUser.id && profilePictureUrls[selectedUser.id] ? profilePictureUrls[selectedUser.id] : defaultProfileImage}
                      size={80}
                      finalSize={300}
                      borderRadius={40}
                      style={[
                        styles.profileImage,
                        {
                          width: 80 * scale,
                          height: 80 * scale,
                          borderRadius: 40 * scale,
                        },
                      ]}
                    />
                    <TouchableOpacity
                      style={[
                        styles.editProfilePictureButton,
                        { padding: 6 * scale },
                      ]}
                      onPress={handleEditProfilePicture}
                      disabled={deletingPhoto}
                    >
                      <Ionicons
                        name="pencil"
                        size={16 * scale}
                        color="#147efb"
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.modalTitle, { fontSize: 18 * scale }]}>
                    Edit Roles for {selectedUser?.name}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={closeEditModal}
                >
                  <Ionicons name="close" size={24 * scale} color="#fff" />
                </TouchableOpacity>
              </View>
              <FlatList
                data={adminRoles}
                renderItem={({ item: role }) => (
                  <View
                    style={[
                      styles.roleItem,
                      {
                        paddingVertical: 12 * scale,
                        paddingHorizontal: 8 * scale,
                        marginBottom: 8 * scale,
                      },
                    ]}
                  >
                    <Text style={[styles.roleText, { fontSize: 16 * scale }]}>
                      {role.label}
                    </Text>
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
                contentContainerStyle={[
                  styles.rolesList,
                  { padding: 16 * scale },
                ]}
              />
              <View
                style={[
                  styles.modalButtons,
                  { padding: 16 * scale, gap: 12 * scale },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.cancelButton,
                    { paddingVertical: 12 * scale, borderRadius: 8},
                  ]}
                  onPress={closeEditModal}
                >
                  <Text
                    style={[styles.modalButtonText, { fontSize: 16 * scale }]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.saveButton,
                    { paddingVertical: 12 * scale, borderRadius: 8 },
                  ]}
                  onPress={saveRoles}
                >
                  <Text
                    style={[styles.modalButtonText, { fontSize: 16 * scale }]}
                  >
                    Confirm
                  </Text>
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
    fontWeight: "600",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  listWrapper: {
    flex: 1,
    position: 'relative',
  },
  listContainer: {
    paddingBottom: 20,
    flexGrow: 1,
    paddingRight: 32,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 16 * scale,
    marginBottom: 12 * scale,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  userImageContainer: {
    marginRight: 14 * scale,
  },
  userImage: {
    width: 48 * scale,
    height: 48 * scale,
    borderRadius: 24 * scale,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17 * scale,
    fontWeight: "600",
    color: "#fff",
  },
  userChurch: {
    fontSize: 14 * scale,
    color: "rgba(255,255,255,0.5)",
    marginTop: 4 * scale,
  },
  userRoles: {
    fontSize: 14 * scale,
    color: "rgba(255,255,255,0.5)",
    marginTop: 4 * scale,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10 * scale,
    paddingHorizontal: 16 * scale,
    borderRadius: 14,
  },
  editButton: {
    backgroundColor: "#147efb",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14 * scale,
    fontWeight: "600",
    marginLeft: 6 * scale,
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
  noData: {
    textAlign: "center",
    color: "rgba(255,255,255,0.5)",
    marginTop: 20,
    fontSize: 16 * scale,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16 * scale,
    backgroundColor: "#147EFB",
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  profileImageContainer: {
    position: "relative",
    marginBottom: 12 * scale,
  },
  profileImage: {
    width: 80 * scale,
    height: 80 * scale,
    borderRadius: 40 * scale,
    borderWidth: 2,
    borderColor: "#fff",
  },
  editProfilePictureButton: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 6 * scale,
  },
  modalTitle: {
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  closeButton: {
    position: "absolute",
    top: 16 * scale,
    right: 16 * scale,
    padding: 4 * scale,
  },
  rolesList: {
    padding: 16 * scale,
  },
  roleItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14 * scale,
    paddingHorizontal: 16 * scale,
    borderRadius: 14,
    marginBottom: 8 * scale,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  roleText: {
    color: "#fff",
    fontWeight: "500",
    flex: 1,
  },
  modalButtons: {
    flexDirection: "row",
    padding: 16 * scale,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    justifyContent: "space-between",
    gap: 12 * scale,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14 * scale,
    borderRadius: 14,
    alignItems: "center",
  },
  saveButton: {
    backgroundColor: "#147EFB",
  },
  cancelButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "600",
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
});

export default AdminManager;