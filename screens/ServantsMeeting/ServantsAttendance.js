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

const ServantsAttendance = ({ navigation }) => {
  const user = auth().currentUser;
  const [students, setServants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        Alert.alert("Error", "No user found.");
        return;
      }

      try {
        const userDoc = await firestore()
          .collection("users")
          .doc(user.uid)
          .get();
        if (!userDoc.exists) {
          Alert.alert("Error", "User not found.");
          return;
        }

        setUserData(userDoc.data());
      } catch (error) {
        Alert.alert("Error", error.message);
      }
    };

    fetchUserData();
  }, [user]);

  useEffect(() => {
    if (!userData) return;

    const fetchServants = () => {
      const hymnsClassRef = firestore()
        .collection("churches")
        .doc(userData.church)
        .collection("Servants")

      // Listen for real-time updates to the students' collection
      const unsubscribe = hymnsClassRef.onSnapshot(async (snapshot) => {
        let servantsData = snapshot.docs.map((doc) => ({
          uid: doc.id,
          ...doc.data(),
        }));
        servantsData.sort((a, b) => a.name.localeCompare(b.name));

        const dateKey = getNextSunday();
        const servantsWithAttendance = await Promise.all(
          servantsData.map(async (servant) => {
            const attendanceDoc = await firestore()
              .collection("churches")
              .doc(userData.church)
              .collection("Servants")
              .doc(servant.uid)
              .get();

            const attendanceStatus = attendanceDoc.exists
              ? attendanceDoc.data()[dateKey]
              : null;

            return {
              ...servant,
              attendance: attendanceStatus,
            };
          })
        );

        setServants(servantsWithAttendance);
        setLoading(false); // Stop loading after the data is fetched
      });

      // Clean up the listener when the component unmounts
      return () => unsubscribe();
    };

    fetchServants();
  }, [userData]);

  const getNextSunday = () => {
    const today = new Date();
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + (7 - today.getDay()));
    const month = String(nextSunday.getMonth() + 1).padStart(2, "0");
    const day = String(nextSunday.getDate()).padStart(2, "0");
    const year = nextSunday.getFullYear();
    return `${month}-${day}-${year}`;
  };

  const handleAttendance = (servantID, status) => {
    const dateKey = getNextSunday();
    firestore()
      .collection("churches")
      .doc(userData.church)
      .collection("Servants")
      .doc(servantID)
      .update({
        [dateKey]: status,
      })
      .then(() => {
        setServants((prevStudents) =>
          prevStudents.map((servant) =>
            servant.uid === servantID
              ? { ...servant, attendance: status }
              : servant
          )
        );
      });
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
          <Text style={styles.noStudentsText}>Church has no servants</Text>
        ) : (
          students.map((servant) => (
            <View key={servant.uid} style={styles.studentContainer}>
              <View style={styles.studentHeader}>
                <Text style={styles.studentName}>{servant.name}</Text>
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate("IndividualServant", {
                      church: userData.church,
                      servantID: servant.uid,
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
                    servant.attendance === false && styles.absentSelected,
                  ]}
                  onPress={() => handleAttendance(servant.uid, false)}
                >
                  <Text style={styles.attendanceButtonText}>Absent</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.attendanceButton,
                    servant.attendance === true && styles.presentSelected,
                  ]}
                  onPress={() => handleAttendance(servant.uid, true)}
                >
                  <Text style={styles.attendanceButtonText}>Present</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
  icon: { width: 8, height: 15 }, // Adjust size as needed
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

  // Updated Add Button
  addButton: {
    backgroundColor: "#147efb",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    width: "90%",
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5, // Android shadow
  },
  addButtonText: { fontSize: 18, fontWeight: "bold", color: "#FFFFFF" },

  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    width: 320,
    padding: 20,
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    alignItems: "center",
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
    fontSize: 16, // Increase font size for visibility
    color: "#AAA", // Lighter text color for the cancel button
    marginTop: 10,
  },
  changeClassButton: {
    backgroundColor: "#D32F2F",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 20,
    width: "90%",
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  changeClassButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  noStudentsText: {
    fontSize: 18,
    color: "#fff",
    textAlign: "center",
    marginTop: 20,
  },
});

export default ServantsAttendance;
