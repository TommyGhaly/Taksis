import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  Image,
} from "react-native";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import { LinearGradient } from "expo-linear-gradient";
import BackArrow from "../components/backArrow";
import PhotoInput from "../components/photoInput";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const IndividualAttendance = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { church, category, grade, studentId } = route.params;
  const [studentData, setStudentData] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [photoInputVisible, setPhotoInputVisible] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState(null);
  const [editData, setEditData] = useState({
    name: "",
    phone: "",
    address: "",
    description: "",
    birthday: "",
  });
  const isMounted = useRef(true);

  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;

      // Reset state when screen is focused
      setStudentData({});
      setLoading(true);
      setModalVisible(false);
      setEditMode(false);
      setPhotoInputVisible(false);
      setProfilePictureUrl(null);
      setEditData({
        name: "",
        phone: "",
        address: "",
        description: "",
        birthday: "",
      });

      const fetchData = () => {
        if (!studentId) {
          Alert.alert("Error", "Student ID is missing.");
          navigation.goBack();
          return () => {};
        }

        const studentRef = firestore()
          .collection("churches")
          .doc(church)
          .collection(category)
          .doc(grade)
          .collection("students")
          .doc(studentId);

        // Fetch profile picture concurrently
        const profilePicturePromise = storage()
          .ref(`profilePictures/${studentId}.png`)
          .getDownloadURL()
          .catch(() => null); // Return null if image fetch fails

        // Set up real-time listener for student data
        const unsubscribe = studentRef.onSnapshot(
          async (doc) => {
            if (!isMounted.current) return;
            try {
              if (doc.exists) {
                const data = doc.data();
                setStudentData(data);
                setEditData({
                  name: data.name || "",
                  phone: data.phone || "",
                  address: data.address || "",
                  description: data.description || "",
                  birthday: data.birthday || "",
                });
              } else {
                navigation.goBack();
              }

              // Resolve profile picture
              const url = await profilePicturePromise;
              setProfilePictureUrl(url);
              setLoading(false);
            } catch (error) {
              if (isMounted.current) {
                Alert.alert("Error", "Failed to load student data.");
                setLoading(false);
              }
            }
          },
          (error) => {
            if (isMounted.current) {
              Alert.alert("Error", "Failed to load student data.");
              setLoading(false);
            }
          }
        );

        return unsubscribe;
      };

      const unsubscribe = fetchData();

      // Cleanup listener when screen is unfocused
      return () => {
        isMounted.current = false;
        if (unsubscribe) unsubscribe();
      };
    }, [church, category, grade, studentId, navigation])
  );

  // Compute attendance data
  const attendanceDataMemo = React.useMemo(() => {
    if (!studentData || Object.keys(studentData).length === 0) return [];
    const attendance = [];
    for (const [key, value] of Object.entries(studentData)) {
      if (
        key !== "name" &&
        key !== "uid" &&
        key !== "phone" &&
        key !== "address" &&
        key !== "description" &&
        key !== "birthday"
      ) {
        attendance.push({ date: key, status: value });
      }
    }
    return attendance.sort((a, b) => {
      const [aMonth, aDay, aYear] = a.date.split("-").map(Number);
      const [bMonth, bDay, bYear] = b.date.split("-").map(Number);
      return (
        new Date(bYear, bMonth - 1, bDay) - new Date(aYear, aMonth - 1, aDay)
      );
    });
  }, [studentData]);

  // Handle photo upload
  const handlePhotoUpload = async (imageUri) => {
    if (!studentId || studentId === "undefined") {
      Alert.alert("Error", "Invalid or missing Student ID.");
      return;
    }
    try {
      setLoading(true);
      const ref = storage().ref(`profilePictures/${studentId}.png`);
      await ref.putFile(imageUri);
      const url = await ref.getDownloadURL();
      setProfilePictureUrl(url);
      setPhotoInputVisible(false);
      Alert.alert("Success", "Profile picture updated successfully.");
    } catch (error) {
      Alert.alert("Error", "Failed to upload profile picture.");
    } finally {
      setLoading(false);
    }
  };

  // Format grade
  const formatGrade = (grade) => {
    const num = parseInt(grade);
    if (isNaN(num)) return grade;
    const suffix =
      num === 1 ? "st" : num === 2 ? "nd" : num === 3 ? "rd" : "th";
    return `${num}${suffix} Grade`;
  };

  // Get status style
  const getStatusStyle = (status) => {
    return status === false ? styles.absent : styles.present;
  };

  // Save edited student data
  const saveEdits = async () => {
    if (!editData.name.trim()) {
      Alert.alert("Error", "Student name is required.");
      return;
    }
    try {
      setLoading(true);
      await firestore()
        .collection("churches")
        .doc(church)
        .collection(category)
        .doc(grade)
        .collection("students")
        .doc(studentId)
        .update({
          name: editData.name.trim(),
          phone: editData.phone.trim(),
          address: editData.address.trim(),
          description: editData.description.trim(),
          birthday: editData.birthday.trim(),
        });
      setEditMode(false);
      setModalVisible(false);
      Alert.alert("Success", "Student information updated successfully.");
    } catch (error) {
      Alert.alert("Error", "Failed to update student information.");
    } finally {
      setLoading(false);
    }
  };

  // Delete student and profile picture
  const deleteStudent = async () => {
    Alert.alert(
      "Delete Student",
      `Are you sure you want to delete ${
        studentData.name || "this student's"
      } record? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await firestore()
                .collection("churches")
                .doc(church)
                .collection(category)
                .doc(grade)
                .collection("students")
                .doc(studentId)
                .delete();

              try {
                await storage().ref(`profilePictures/${studentId}.png`).delete();
              } catch (error) {
                if (error.code !== "storage/object-not-found") {
                  console.warn("Error deleting profile picture:", error);
                }
              }

              Alert.alert(
                "Success",
                `${studentData.name || "Student"}'s record has been deleted.`,
                [{ text: "OK", onPress: () => navigation.goBack() }]
              );
            } catch (error) {
              Alert.alert("Error", "Failed to delete student record.");
            }
          },
        },
      ]
    );
  };

  // Handle modal close
  const handleModalClose = () => {
    if (editMode) {
      Alert.alert(
        "Discard Changes?",
        "You have unsaved changes. Are you sure you want to cancel?",
        [
          { text: "Continue Editing", style: "cancel" },
          {
            text: "Discard",
            onPress: () => {
              setEditMode(false);
              setModalVisible(false);
              setEditData({
                name: studentData.name || "",
                phone: studentData.phone || "",
                address: studentData.address || "",
                description: studentData.description || "",
                birthday: studentData.birthday || "",
              });
            },
          },
        ]
      );
    } else {
      setModalVisible(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const screenWidth = Dimensions.get("window").width;
  const isTablet = screenWidth >= 768;
  const containerWidth = isTablet
    ? { maxWidth: 600, alignSelf: "center", width: "100%" }
    : { width: "100%" };

  return (
    <View style={styles.container}>
      <View style={[styles.contentContainer, containerWidth]}>
        <View style={styles.buttonRow}>
          <BackArrow />
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            style={styles.infoButton}
            accessible={true}
            accessibilityLabel="View student information"
          >
            <Text style={styles.infoButtonText}>i</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>{`${studentData.name || "Student"}`}</Text>
        <Image
          style={styles.profilePicture}
          source={
            profilePictureUrl
              ? { uri: profilePictureUrl }
              : require("../assets/default_profile.png")
          }
          defaultSource={require("../assets/default_profile.png")}
          onError={() => setProfilePictureUrl(null)}
        />
        <Text style={styles.subtitle}>{`Grade: ${formatGrade(
          grade
        )} - Category: ${category}`}</Text>
        <FlatList
          data={attendanceDataMemo}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item }) => (
            <View style={styles.attendanceItem}>
              <Text style={styles.dateText}>{item.date}</Text>
              <View
                style={[styles.statusContainer, getStatusStyle(item.status)]}
              >
                <Text style={styles.statusText}>
                  {item.status === false
                    ? "Absent"
                    : item.status === true
                    ? "Present"
                    : "No Status"}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.noAttendanceContainer}>
              <Text style={styles.noAttendanceText}>
                No attendance records available.
              </Text>
              <Text style={styles.noAttendanceSubtext}>
                Attendance will appear here once recorded.
              </Text>
            </View>
          }
          contentContainerStyle={styles.attendanceContainer}
          showsVerticalScrollIndicator={false}
        />
        <TouchableOpacity
          onPress={deleteStudent}
          style={styles.deleteTextContainer}
          accessible={true}
          accessibilityLabel="Delete student record"
        >
          <Text style={styles.deleteText}>Delete Student</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <LinearGradient
            colors={["#1E1E1E", "#151515"]}
            style={[styles.modalContent, containerWidth]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.modalTitle}>Student Information</Text>
            <View style={styles.infoContainer}>
              {editMode ? (
                <>
                  <View style={styles.profilePictureContainer}>
                    <Image
                      style={styles.modalProfilePicture}
                      source={
                        profilePictureUrl
                          ? { uri: profilePictureUrl }
                          : require("../assets/default_profile.png")
                      }
                      defaultSource={require("../assets/default_profile.png")}
                      onError={() => setProfilePictureUrl(null)}
                    />
                    <TouchableOpacity
                      style={styles.editPhotoIcon}
                      onPress={() => setPhotoInputVisible(true)}
                      accessible={true}
                      accessibilityLabel="Edit profile picture"
                    >
                      <Icon name="pencil" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={editData.name}
                    onChangeText={(text) =>
                      setEditData({ ...editData, name: text })
                    }
                    placeholder="Name"
                    placeholderTextColor="#888"
                    autoCapitalize="words"
                    accessible={true}
                    accessibilityLabel="Edit student name"
                  />
                  <TextInput
                    style={styles.input}
                    value={editData.birthday}
                    onChangeText={(text) =>
                      setEditData({ ...editData, birthday: text })
                    }
                    placeholder="Birthday (e.g., MM-DD-YYYY)"
                    placeholderTextColor="#888"
                    accessible={true}
                    accessibilityLabel="Edit student birthday"
                  />
                  <TextInput
                    style={styles.input}
                    value={editData.phone}
                    onChangeText={(text) =>
                      setEditData({ ...editData, phone: text })
                    }
                    placeholder="Phone (optional)"
                    placeholderTextColor="#888"
                    keyboardType="phone-pad"
                    accessible={true}
                    accessibilityLabel="Edit student phone number"
                  />
                  <TextInput
                    style={styles.input}
                    value={editData.address}
                    onChangeText={(text) =>
                      setEditData({ ...editData, address: text })
                    }
                    placeholder="Address (optional)"
                    placeholderTextColor="#888"
                    accessible={true}
                    accessibilityLabel="Edit student address"
                  />
                  <TextInput
                    style={[styles.input, styles.descriptionInput]}
                    value={editData.description}
                    onChangeText={(text) =>
                      setEditData({ ...editData, description: text })
                    }
                    placeholder="Description (optional)"
                    placeholderTextColor="#888"
                    multiline
                    numberOfLines={4}
                    accessible={true}
                    accessibilityLabel="Edit student description"
                  />
                  <LinearGradient
                    colors={["#147efb", "#0f64d2"]}
                    style={styles.modalButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <TouchableOpacity
                      onPress={saveEdits}
                      style={styles.buttonInner}
                      accessible={true}
                      accessibilityLabel="Save student information"
                    >
                      <Text style={styles.modalButtonText}>Save</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                  <TouchableOpacity
                    onPress={handleModalClose}
                    accessible={true}
                    accessibilityLabel="Cancel editing"
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.profilePictureContainer}>
                    <Image
                      style={styles.modalProfilePicture}
                      source={
                        profilePictureUrl
                          ? { uri: profilePictureUrl }
                          : require("../assets/default_profile.png")
                      }
                      defaultSource={require("../assets/default_profile.png")}
                      onError={() => setProfilePictureUrl(null)}
                    />
                  </View>
                  <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Name</Text>
                      <Text style={styles.infoValue}>
                        {studentData.name || "N/A"}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Grade</Text>
                      <Text style={styles.infoValue}>{formatGrade(grade)}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Birthday</Text>
                      <Text style={styles.infoValue}>
                        {studentData.birthday || "N/A"}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Phone</Text>
                      <Text style={styles.infoValue}>
                        {studentData.phone || "N/A"}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Address</Text>
                      <Text style={styles.infoValue}>
                        {studentData.address || "N/A"}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Description</Text>
                      <Text style={styles.infoValue}>
                        {studentData.description || "N/A"}
                      </Text>
                    </View>
                  </View>
                  <LinearGradient
                    colors={["#147efb", "#0f64d2"]}
                    style={styles.modalButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <TouchableOpacity
                      onPress={() => setEditMode(true)}
                      style={styles.buttonInner}
                      accessible={true}
                      accessibilityLabel="Edit student information"
                    >
                      <Text style={styles.modalButtonText}>Edit</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                  <TouchableOpacity
                    onPress={handleModalClose}
                    accessible={true}
                    accessibilityLabel="Close student information"
                  >
                    <Text style={styles.cancelButtonText}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </LinearGradient>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={photoInputVisible} transparent animationType="fade">
        <PhotoInput
          visible={photoInputVisible}
          onClose={() => setPhotoInputVisible(false)}
          onSave={handlePhotoUpload}
          userId={studentId}
        />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
  },
  contentContainer: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
    textAlign: "center",
  },
  profilePicture: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#ffffff",
    alignSelf: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: "#b0b0b0",
    marginBottom: 20,
    textAlign: "center",
  },
  infoButton: {
    backgroundColor: "#333",
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  infoButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  attendanceContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  attendanceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
  },
  dateText: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "600",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: "center",
    minWidth: 120,
    minHeight: 44,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    lineHeight: 24,
    textAlign: "center",
  },
  present: {
    backgroundColor: "#147efb",
    borderColor: "#0f64d2",
    borderWidth: 1,
  },
  absent: {
    backgroundColor: "#F44336",
    borderColor: "#D32F2F",
    borderWidth: 1,
  },
  deleteTextContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  deleteText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#F44336",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  modalContent: {
    padding: 25,
    paddingHorizontal: 35,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 15,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  infoContainer: {
    width: "100%",
    marginBottom: 20,
  },
  profilePictureContainer: {
    position: "relative",
    alignSelf: "center",
    marginBottom: 20,
  },
  modalProfilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  editPhotoIcon: {
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
  infoCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    paddingVertical: 5,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    width: 100,
  },
  infoValue: {
    fontSize: 16,
    color: "#ffffff",
    flex: 1,
    flexWrap: "wrap",
  },
  input: {
    width: "100%",
    padding: 12,
    backgroundColor: "#2a2a2a",
    color: "#fff",
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#444",
    fontSize: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  modalButton: {
    width: "100%",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  buttonInner: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F44336",
    marginTop: 10,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    color: "#fff",
    fontSize: 18,
    marginTop: 10,
  },
  noAttendanceContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  noAttendanceText: {
    fontSize: 18,
    color: "#b0b0b0",
    textAlign: "center",
    marginBottom: 10,
  },
  noAttendanceSubtext: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
  },
});

export default IndividualAttendance;