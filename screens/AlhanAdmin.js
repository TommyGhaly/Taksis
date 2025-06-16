import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  Image,
  FlatList,
  Dimensions,
  Platform,
  ScrollView,
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

// Grades list
const gradesList = [
  "Pre-School - Age 3",
  "Pre-School - Age 4",
  "Kindergarten",
  "1st Grade",
  "2nd Grade",
  "3rd Grade",
  "4th Grade",
  "5th Grade",
  "6th Grade",
  "7th Grade",
  "8th Grade",
  "9th Grade",
  "10th Grade",
  "11th Grade",
  "12th Grade",
  "College",
];

// Responsive design helper
const { width, height } = Dimensions.get("window");
const isTablet = Platform.isPad || (width >= 768 && height >= 768);
const scale = isTablet ? 1.2 : 1;
const paddingHorizontal = isTablet ? 32 : 16;
const indexBarWidth = isTablet ? 32 : 24;

const AlhanAdmin = () => {
  const [teachers, setTeachers] = useState([]);
  const [church, setChurch] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedGrades, setSelectedGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  const [photoInputVisible, setPhotoInputVisible] = useState(false);
  const [availableLetters, setAvailableLetters] = useState([]);
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerHeightRef = useRef(0);
  const sectionListRef = useRef(null);

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

  // Fetch teachers and profile pictures
  useEffect(() => {
    if (!church) return;

    const fetchProfilePictureUrls = async () => {
      try {
        const querySnapshot = await firestore()
          .collection("users")
          .where("church", "==", church)
          .where("isAlhan", "==", true)
          .get();
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
              console.warn(
                `Failed to fetch profile picture for ${uid}:`,
                error
              );
              urls[uid] = null;
            }
          })
        );
        setProfilePictureUrls(urls);
      } catch (error) {
        console.warn("Error fetching profile pictures:", error);
      }
    };

    fetchProfilePictureUrls();
    const intervalId = setInterval(fetchProfilePictureUrls, 30000);

    const unsubscribe = firestore()
      .collection("users")
      .where("church", "==", church)
      .where("isAlhan", "==", true)
      .onSnapshot(
        (querySnapshot) => {
          const teacherList = querySnapshot.docs
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
            .map((teacher) => ({
              ...teacher,
              name:
                querySnapshot.docs.find((d) => d.id === teacher.id)?.data()
                  .name || "",
            }));

          // Group teachers by first letter
          const grouped = teacherList.reduce((acc, teacher) => {
            const firstLetter = teacher.name.charAt(0).toUpperCase() || "Other";
            if (!acc[firstLetter]) acc[firstLetter] = [];
            acc[firstLetter].push(teacher);
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

          setTeachers(teacherList);
          setSections(sectionData);
          setAvailableLetters(letters);
        },
        (error) => {
          Alert.alert("Error", "Could not fetch teachers.");
        }
      );

    return () => {
      clearInterval(intervalId);
      unsubscribe();
    };
  }, [church]);

  // Open edit modal
  const openEditModal = (teacher) => {
    if (!teacher?.id) return;
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setSelectedTeacher(teacher);
    setSelectedGrades(
      Array.isArray(teacher.alhanGrades) ? teacher.alhanGrades : []
    );
    setModalVisible(true);
  };

  // Open photo input modal
  const openPhotoInputModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setPhotoInputVisible(true);
  };

  // Close edit modal
  const closeEditModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setModalVisible(false);
    setSelectedTeacher(null);
    setSelectedGrades([]);
  };

  // Close photo input modal
  const closePhotoInputModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setPhotoInputVisible(false);
  };

  // Save classes
  const saveClasses = async () => {
    if (!selectedTeacher) return;

    try {
      await firestore().collection("users").doc(selectedTeacher.id).update({
        alhanGrades: selectedGrades,
      });
      closeEditModal();
    } catch (error) {
      Alert.alert("Error", "Could not save classes. Please try again.");
    }
  };

  // Remove teacher
  const removeTeacher = async (teacherId) => {
    try {
      await firestore().collection("users").doc(teacherId).update({
        isAlhan: false,
        alhanGrades: [],
      });
    } catch (error) {
      Alert.alert("Error", "Could not remove teacher. Please try again.");
    }
  };

  // Scroll to section
  const scrollToSection = (letter) => {
    const sectionIndex = sections.findIndex((s) => s.title === letter);
    if (sectionIndex < 0 || !sectionListRef.current) return;

    sectionListRef.current.scrollToLocation({
      sectionIndex,
      itemIndex: 1,
      animated: false,
      viewPosition: 0,
      viewOffset: 0,
    });
  };

  // Render section header
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

  // Render teacher item
  const renderTeacher = ({ item }) => (
    <TouchableOpacity
      style={styles.teacherCard}
      onPress={() => openEditModal(item)}
      activeOpacity={0.7}
    >
      <View style={styles.teacherInfo}>
        <View style={styles.teacherImageContainer}>
          <Image
            style={styles.teacherImage}
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
        <View style={styles.teacherTextInfo}>
          <Text style={styles.teacherName}>{item.name || "Unknown"}</Text>
          <Text style={styles.teacherGrades}>
            {Array.isArray(item.alhanGrades) && item.alhanGrades.length > 0
              ? item.alhanGrades.join(", ")
              : "No classes assigned"}
          </Text>
        </View>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => removeTeacher(item.id)}
        >
          <Ionicons name="trash" size={20 * scale} color="#fff" />
          <Text style={styles.buttonText}>Delete</Text>
        </TouchableOpacity>
      </View>
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
      <Text style={[styles.header, { fontSize: 24 * scale }]}>
        Manage Alhan Teachers
      </Text>
      {sections.length === 0 ? (
        <Text style={[styles.noData, { fontSize: 16 * scale }]}>
          No teachers found.
        </Text>
      ) : (
        <View style={[styles.listWrapper, { paddingRight: indexBarWidth }]}>
          <SectionList
            ref={sectionListRef}
            sections={sections}
            renderItem={renderTeacher}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item) => item.id || Math.random().toString()}
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
      {selectedTeacher && (
        <Modal visible={modalVisible} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.headerContent}>
                  <View style={styles.profileImageContainer}>
                    <Image
                      style={styles.profileImage}
                      source={
                        selectedTeacher.id &&
                        profilePictureUrls[selectedTeacher.id]
                          ? { uri: profilePictureUrls[selectedTeacher.id] }
                          : require("../assets/default_profile.png")
                      }
                      defaultSource={require("../assets/default_profile.png")}
                      onError={() => {
                        setProfilePictureUrls((prev) => ({
                          ...prev,
                          [selectedTeacher.id]: null,
                        }));
                      }}
                    />
                    <TouchableOpacity
                      style={styles.editProfilePictureButton}
                      onPress={openPhotoInputModal}
                    >
                      <Ionicons
                        name="pencil"
                        size={16 * scale}
                        color="#147efb"
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.modalTitle, { fontSize: 18 * scale }]}>
                    Assign Classes for {selectedTeacher?.name}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={closeEditModal}
                >
                  <Ionicons name="close" size={24 * scale} color="#fff" />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
              >
                <View style={styles.modalContent}>
                  <FlatList
                    data={gradesList}
                    renderItem={({ item: grade }) => (
                      <TouchableOpacity
                        style={[
                          styles.gradeItem,
                          selectedGrades.includes(grade) &&
                            styles.gradeItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedGrades((prev) => {
                            const toggled = prev.includes(grade)
                              ? prev.filter((g) => g !== grade)
                              : [...prev, grade];
                            return gradesList.filter((g) =>
                              toggled.includes(g)
                            );
                          });
                        }}
                      >
                        <Text
                          style={[styles.gradeText, { fontSize: 16 * scale }]}
                        >
                          {grade}
                        </Text>
                        {selectedGrades.includes(grade) && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20 * scale}
                            color="#147efb"
                          />
                        )}
                      </TouchableOpacity>
                    )}
                    keyExtractor={(item) => item}
                    contentContainerStyle={styles.gradesList}
                    scrollEnabled={false}
                  />
                </View>
              </ScrollView>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={closeEditModal}
                >
                  <Text
                    style={[styles.modalButtonText, { fontSize: 16 * scale }]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveClasses}
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
      {selectedTeacher && (
        <PhotoInput
          visible={photoInputVisible}
          onClose={closePhotoInputModal}
          userId={selectedTeacher.id}
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
    marginBottom: 20,
    textAlign: "center",
  },
  listWrapper: {
    flex: 1,
    flexDirection: "row",
  },
  listContainer: {
    paddingBottom: 0,
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
  teacherCard: {
    flexDirection: "column",
    backgroundColor: "#1e1e1e",
    borderRadius: 12,
    padding: 16 * scale,
    marginBottom: 12 * scale,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  teacherInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12 * scale,
  },
  teacherImageContainer: {
    marginRight: 12 * scale,
  },
  teacherImage: {
    width: 48 * scale,
    height: 48 * scale,
    borderRadius: 24 * scale,
    borderWidth: 1,
    borderColor: "#333333",
  },
  teacherTextInfo: {
    flex: 1,
  },
  teacherName: {
    fontSize: 18 * scale,
    fontWeight: "600",
    color: "#fff",
  },
  teacherGrades: {
    fontSize: 14 * scale,
    color: "#aaa",
    marginTop: 4 * scale,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12 * scale,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8 * scale,
    paddingHorizontal: 16 * scale,
    borderRadius: 8,
  },
  deleteButton: {
    backgroundColor: "#ff4444",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14 * scale,
    fontWeight: "500",
    marginLeft: 6 * scale,
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
    paddingVertical: 2 * scale,
    backgroundColor: "#121212",
    borderRadius: 4,
    marginVertical: 2 * scale,
  },
  indexText: {
    color: "#147efb",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#1e1e1e",
    borderRadius: 20,
    width: "80%",
    maxHeight: "80%",
  },
  modalScrollView: {
    flexGrow: 1,
  },
  modalScrollContent: {
    paddingBottom: 16 * scale,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16 * scale,
    backgroundColor: "#147efb",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    backgroundColor: "#1e1e1e",
    borderRadius: 12 * scale,
    padding: 6 * scale,
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
  modalContent: {
    padding: 16 * scale,
  },
  closeButton: {
    padding: 4 * scale,
  },
  gradesList: {
    paddingHorizontal: 16 * scale,
  },
  gradeItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12 * scale,
    paddingHorizontal: 8 * scale,
    borderRadius: 8,
    marginBottom: 8 * scale,
    backgroundColor: "#2a2a2a",
  },
  gradeItemSelected: {
    backgroundColor: "#3a3a3a",
  },
  gradeText: {
    color: "#fff",
  },
  modalButtons: {
    flexDirection: "row",
    padding: 16 * scale,
    borderTopWidth: 1,
    borderTopColor: "#333",
    justifyContent: "space-between",
    gap: 12 * scale,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12 * scale,
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
    fontWeight: "500",
  },
});

export default AlhanAdmin;
