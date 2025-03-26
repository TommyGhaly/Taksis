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
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

const SundaySchoolAttendance = ({ navigation }) => {
  const user = auth().currentUser;
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");

  // Real-time listener for user's document
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
  useEffect(() => {
    if (!userData) return;
      if (!userData.ssSetUp) {
        navigation.navigate("SundaySchoolGrades");
      }
  }, [userData]);
  // Fetch students whenever userData updates (including changes to ssGrades)
  useEffect(() => {
    if (!userData) return;

    const fetchStudents = () => {
      const sundaySchoolRef = firestore()
        .collection("churches")
        .doc(userData.church)
        .collection("Sunday School")
        .doc(userData.ssGrades)
        .collection("students");

      // Listen for real-time updates to the students' collection
      const unsubscribe = sundaySchoolRef.onSnapshot(async (snapshot) => {
        let studentsData = snapshot.docs.map((doc) => ({
          uid: doc.id,
          ...doc.data(),
        }));
        studentsData.sort((a, b) => a.name.localeCompare(b.name));

        const dateKey = getNextSunday();
        const studentsWithAttendance = await Promise.all(
          studentsData.map(async (student) => {
            const attendanceDoc = await firestore()
              .collection("churches")
              .doc(userData.church)
              .collection("Sunday School")
              .doc(userData.ssGrades)
              .collection("students")
              .doc(student.uid)
              .get();

            const attendanceStatus = attendanceDoc.exists
              ? attendanceDoc.data()[dateKey]
              : null;

            return {
              ...student,
              attendance: attendanceStatus,
            };
          })
        );

        setStudents(studentsWithAttendance);
        setLoading(false); // Stop loading after the data is fetched
      });

      // Clean up the listener when the component unmounts
      return () => unsubscribe();
    };

    fetchStudents();
  }, [userData]);

  const getNextSunday = () => {
    const today = new Date();
    const currentDay = today.getDay(); // Get the current day of the week (0 is Sunday)

    // If today is Sunday, return the current date
    if (currentDay === 0) {
      return formatDate(today);
    }

    // If not Sunday, find the next Sunday
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + (7 - currentDay));
    return formatDate(nextSunday);
  };

  // Helper function to format the date as MM-DD-YYYY
  const formatDate = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  const handleAttendance = (studentId, status) => {
    const dateKey = getNextSunday();
    firestore()
      .collection("churches")
      .doc(userData.church)
      .collection("Sunday School")
      .doc(userData.ssGrades)
      .collection("students")
      .doc(studentId)
      .update({
        [dateKey]: status,
      })
      .then(() => {
        setStudents((prevStudents) =>
          prevStudents.map((student) =>
            student.uid === studentId
              ? { ...student, attendance: status }
              : student
          )
        );
      });
  };

  const addStudent = async () => {
    if (!newStudentName.trim()) {
      Alert.alert("Error", "Please enter a student name");
      return;
    }

    const newStudentRef = firestore()
      .collection("churches")
      .doc(userData.church)
      .collection("Sunday School")
      .doc(userData.ssGrades)
      .collection("students")
      .doc();

    try {
      await newStudentRef.set({
        name: newStudentName,
        uid: newStudentRef.id,
      });

      setModalVisible(false);
      setNewStudentName("");
    } catch (error) {
      Alert.alert("Error", "Failed to add student");
    }
  };

  const confirmClassChange = () => {
    Alert.alert(
      "Are you sure you want to change Sunday School?",
      `You are currently teaching grade(s): ${userData.ssGrades}. Changing classes will revoke access to any students in your current class.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => handleClassChange() },
      ]
    );
  };

  const handleClassChange = async () => {
    try {
      const sundaySchoolRef = firestore()
        .collection("churches")
        .doc(userData.church)
        .collection("Sunday School")
        .doc(userData.ssGrades);

      const hymnsClassDoc = await sundaySchoolRef.get();
      if (!hymnsClassDoc.exists) {
        throw new Error("Sunday School not found");
      }

      const newServants = hymnsClassDoc
        .get("servants")
        .filter((servant) => servant.uid !== user.uid);

      console.log(newServants);
      console.log(user.uid);
      await sundaySchoolRef.update({
        servants: newServants,
      });

      await firestore().collection("users").doc(user.uid).update({
        alhanGrades: null,
        alhanSetUp: false,
      });

      navigation.navigate("SundaySchoolGrades");
    } catch (error) {
      console.error("Error changing Sunday School class:", error);
      Alert.alert(
        "Error",
        "Failed to change Sunday School class. Please try again."
      );
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

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>
        Attendance for the week of {getNextSunday()}
      </Text>

      <ScrollView
        contentContainerStyle={styles.studentsContainer}
        showsVerticalScrollIndicator={false}
      >
        {students.length === 0 ? (
          <Text style={styles.noStudentsText}>Class has no students</Text>
        ) : (
          students.map((student) => (
            <View key={student.uid} style={styles.studentContainer}>
              <View style={styles.studentHeader}>
                <Text style={styles.studentName}>{student.name}</Text>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate("IndividualAttendance", {
                      church: userData.church,
                      category: "Sunday School",
                      grade: userData.ssGrades,
                      studentId: student.uid,
                    })
                  }
                >
                  <Image
                    source={require("../../assets/vector.png")}
                    style={styles.icon}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.attendanceButtons}>
                <TouchableOpacity
                  style={[
                    styles.attendanceButton,
                    student.attendance === false && styles.absentSelected,
                  ]}
                  onPress={() => handleAttendance(student.uid, false)}
                >
                  <Text style={styles.attendanceButtonText}>Absent</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.attendanceButton,
                    student.attendance === true && styles.presentSelected,
                  ]}
                  onPress={() => handleAttendance(student.uid, true)}
                >
                  <Text style={styles.attendanceButtonText}>Present</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
        <TouchableOpacity
          onPress={() => confirmClassChange()}
          style={styles.changeClassContainer}
        >
          <Text style={styles.changeClassText}>Change Sunday School Class</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Change Class Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.addButtonText}>Add Student</Text>
      </TouchableOpacity>

      {/* Add Student Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Student</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="words"
              placeholder="Enter student name"
              placeholderTextColor="#888"
              value={newStudentName}
              onChangeText={setNewStudentName}
            />
            <TouchableOpacity style={styles.addButton} onPress={addStudent}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#121212" },
  headerText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 20,
  },
  studentContainer: {
    backgroundColor: "#1E1E1E",
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  studentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  studentName: { fontSize: 18, color: "#FFFFFF" },
  icon: { width: 8, height: 15 },
  attendanceButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  attendanceButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
    marginHorizontal: 5,
    backgroundColor: "#444",
  },
  presentSelected: { backgroundColor: "#147efb" },
  absentSelected: { backgroundColor: "#D32F2F" },
  attendanceButtonText: { fontSize: 16, fontWeight: "bold", color: "#FFFFFF" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  addButton: {
    backgroundColor: "#147efb",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    width: "90%",
    alignSelf: "center",
  },
  addButtonText: { fontSize: 18, fontWeight: "bold", color: "#FFFFFF" },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalContent: {
    width: 320,
    padding: 20,
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    alignItems: "center",
    elevation: 10,
  },
  modalTitle: { fontSize: 18, color: "#FFF", marginBottom: 15 },
  input: {
    width: "100%",
    padding: 12,
    backgroundColor: "#333",
    color: "#FFF",
    borderRadius: 5,
    marginBottom: 10,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#AAA",
    marginTop: 10,
  },
  changeClassContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 30,
  },
  changeClassText: {
    color: "red",
    fontSize: 16,
  },
  noStudentsText: {
    fontSize: 18,
    color: "#fff",
    textAlign: "center",
    marginTop: 20,
  },
});

export default SundaySchoolAttendance;
