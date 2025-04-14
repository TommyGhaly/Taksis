import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

const AlhanAttendance = ({ navigation }) => {
  const user = auth().currentUser;
  const [studentsByGrade, setStudentsByGrade] = useState({});
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentGrade, setNewStudentGrade] = useState("");

  // Fetch user data
  useEffect(() => {
    if (!user) {
      Alert.alert("Error", "No user found.");
      return;
    }

    const unsubscribe = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        (doc) => {
          if (!doc.exists) {
            Alert.alert("Error", "User not found.");
            return;
          }
          setUserData(doc.data());
        },
        (error) => {
          Alert.alert("Error", error.message);
        }
      );

    return () => unsubscribe();
  }, [user]);

  // Redirect if Hymns Class not set up
  useEffect(() => {
    if (!userData) return;
    if (!userData.alhanSetUp) {
      navigation.navigate("AlhanGrades");
    }
  }, [userData]);

  // Fetch students from all selected grades
  useEffect(() => {
    if (!userData || !userData.alhanGrades || userData.alhanGrades.length === 0) return;

    const unsubscribeFunctions = [];

    userData.alhanGrades.forEach((grade) => {
      const studentsRef = firestore()
        .collection("churches")
        .doc(userData.church)
        .collection("Hymns Class")
        .doc(grade)
        .collection("students");

      const unsubscribe = studentsRef.onSnapshot((snapshot) => {
        const gradeStudents = snapshot.docs.map((doc) => ({
          uid: doc.id,
          grade: grade,
          ...doc.data(),
        }));
        gradeStudents.sort((a, b) => a.name.localeCompare(b.name));
        setStudentsByGrade((prev) => ({
          ...prev,
          [grade]: gradeStudents,
        }));
        setLoading(false);
      });
      unsubscribeFunctions.push(unsubscribe);
    });

    setNewStudentGrade(userData.alhanGrades[0] || "");
    return () => unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
  }, [userData]);

  const getNextSaturday = () => {
    const today = new Date();
    const currentDay = today.getDay();
    if (currentDay === 6) return formatDate(today); // If today is Saturday, return today
    const nextSaturday = new Date(today);
    nextSaturday.setDate(today.getDate() + (6 - currentDay));
    return formatDate(nextSaturday);
  };
  

  const formatDate = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  const formatGrade = (grade) => {
    const num = parseInt(grade);
    const suffix = num === 1 ? "st" : num === 2 ? "nd" : num === 3 ? "rd" : "th";
    return `${num}${suffix} Grade`;
  };

  const handleAttendance = (student, status) => {
    const dateKey = getNextSaturday();
    firestore()
      .collection("churches")
      .doc(userData.church)
      .collection("Hymns Class")
      .doc(student.grade)
      .collection("students")
      .doc(student.uid)
      .update({
        [dateKey]: status,
      });
  };

  const addStudent = async () => {
    if (!newStudentName.trim()) {
      Alert.alert("Error", "Please enter a student name");
      return;
    }
    if (!newStudentGrade) {
      Alert.alert("Error", "Please select a grade");
      return;
    }

    const newStudentRef = firestore()
      .collection("churches")
      .doc(userData.church)
      .collection("Hymns Class")
      .doc(newStudentGrade)
      .collection("students")
      .doc();

    try {
      await newStudentRef.set({
        name: newStudentName,
        uid: newStudentRef.id,
        phone: "",
        address: "",
        description: "",
        birthday: "",
      });
      setModalVisible(false);
      setNewStudentName("");
      setNewStudentGrade(userData.alhanGrades[0] || "");
    } catch (error) {
      console.error("Error adding student:", error);
      Alert.alert("Error", "Failed to add student");
    }
  };

  const confirmClassChange = () => {
    Alert.alert(
      "Are you sure you want to change Hymns Class?",
      `You are currently teaching grade(s): ${userData.alhanGrades.map(formatGrade).join(", ")}. Changing classes will revoke access to any students in your current class(es).`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: handleClassChange },
      ]
    );
  };

  const handleClassChange = async () => {
    try {
      const churchRef = firestore().collection("churches").doc(userData.church);
      const hymnsClassRef = churchRef.collection("Hymns Class");

      for (const grade of userData.alhanGrades) {
        const gradeRef = hymnsClassRef.doc(grade);
        await gradeRef.update({
          servants: firestore.FieldValue.arrayRemove({ uid: user.uid }),
        });
      }

      await firestore().collection("users").doc(user.uid).update({
        alhanGrades: [],
        alhanSetUp: false,
      });

      navigation.navigate("AlhanGrades");
    } catch (error) {
      console.error("Error changing Hymns Class:", error);
      Alert.alert("Error", "Failed to change Hymns Class.");
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

  const dateKey = getNextSaturday();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Week of {dateKey}</Text>
      <Text style={styles.subtitle}>Grades: {userData.alhanGrades.map(formatGrade).join(", ")}</Text>
      <ScrollView contentContainerStyle={styles.studentsContainer} showsVerticalScrollIndicator={false}>
        {userData.alhanGrades.map((grade) => (
          <View key={grade}>
            <Text style={styles.gradeHeader}>{formatGrade(grade)}</Text>
            {studentsByGrade[grade] && studentsByGrade[grade].length > 0 ? (
              studentsByGrade[grade].map((student) => (
                <View key={student.uid} style={styles.studentContainer}>
                  <View style={styles.studentHeader}>
                    <Text style={styles.studentName}>
                      {student.name} - {formatGrade(student.grade)}
                    </Text>
                    <TouchableOpacity
                      hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                      onPress={() =>
                        navigation.navigate("IndividualAttendance", {
                          church: userData.church,
                          category: "Hymns Class",
                          grade: student.grade,
                          studentId: student.uid,
                        })
                      }
                    >
                      <Image source={require("../../assets/vector.png")} style={styles.icon} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.attendanceButtons}>
                    <TouchableOpacity
                      style={[
                        styles.attendanceButton,
                        { backgroundColor: student[dateKey] === false ? "#D32F2F" : "#444" },
                      ]}
                      onPress={() => handleAttendance(student, false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.attendanceButtonText}>Absent</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.attendanceButton,
                        { backgroundColor: student[dateKey] === true ? "#147EFB" : "#444" },
                      ]}
                      onPress={() => handleAttendance(student, true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.attendanceButtonText}>Present</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noStudentsText}>No students in this grade</Text>
            )}
          </View>
        ))}
        <TouchableOpacity onPress={confirmClassChange} style={styles.changeClassContainer}>
          <Text style={styles.changeClassText}>Change Hymns Class</Text>
        </TouchableOpacity>
      </ScrollView>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.addButtonText}>Add Student</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Student</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                autoCapitalize="words"
                placeholder="Enter student name"
                placeholderTextColor="#888"
                value={newStudentName}
                onChangeText={setNewStudentName}
                accessible={true}
                accessibilityLabel="Enter student name"
              />
              <Picker
                selectedValue={newStudentGrade}
                onValueChange={(itemValue) => setNewStudentGrade(itemValue)}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {userData.alhanGrades.map((grade) => (
                  <Picker.Item key={grade} label={formatGrade(grade)} value={grade} />
                ))}
              </Picker>
            </View>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={addStudent}
              activeOpacity={0.7}
              accessible={true}
              accessibilityLabel="Add student"
            >
              <Text style={styles.modalButtonText}>Add Student</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              accessible={true}
              accessibilityLabel="Cancel adding student"
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#121212" },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: "#b0b0b0",
    textAlign: "center",
    marginBottom: 20,
  },
  gradeHeader: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ccc",
    marginTop: 20,
    marginBottom: 10,
  },
  studentContainer: {
    backgroundColor: "#1E1E1E",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  studentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  studentName: { fontSize: 20, color: "#FFFFFF", fontWeight: "600" },
  icon: { width: 8, height: 15 },
  attendanceButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 25,
  },
  attendanceButton: {
    flex: 1,
    borderRadius: 10,
    marginHorizontal: 5,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  attendanceButtonText: { fontSize: 16, fontWeight: "bold", color: "#FFFFFF" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  addButton: {
    backgroundColor: "#147EFB",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: 20,
    width: "90%",
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  addButtonText: { fontSize: 18, fontWeight: "bold", color: "#FFFFFF" },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  modalContent: {
    width: 340,
    padding: 25,
    backgroundColor: "#1E1E1E",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#333",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 15,
  },
  modalTitle: {
    fontSize: 24,
    color: "#FFF",
    fontWeight: "bold",
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 20,
  },
  picker: {
    width: "100%",
    backgroundColor: "#2a2a2a",
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#444",
  },
  pickerItem: {
    color: "#e0e0e0",
    fontSize: 18,
    fontWeight: "700",
  },
  input: {
    width: "100%",
    padding: 12,
    backgroundColor: "#2a2a2a",
    color: "#FFF",
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
  modalButton: {
    width: "100%",
    backgroundColor: "#147EFB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  modalButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#F44336",
    marginTop: 15,
    fontWeight: "600",
  },
  changeClassContainer: {
    alignItems: "center",
    paddingTop: 30,
  },
  changeClassText: {
    color: "#F44336",
    fontSize: 16,
    fontWeight: "600",
  },
  noStudentsText: {
    fontSize: 18,
    color: "#b0b0b0",
    textAlign: "center",
    marginVertical: 10,
  },
});

export default AlhanAttendance;