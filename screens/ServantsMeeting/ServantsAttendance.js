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
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

const ServantsAttendance = ({ navigation }) => {
  const user = auth().currentUser;
  const [students, setServants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    // Fetch user data in real-time
    const unsubscribeUserData = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot((userDoc) => {
        if (userDoc.exists) {
          setUserData(userDoc.data());
        } else {
          Alert.alert("Error", "User not found.");
        }
      });

    // Clean up real-time listener when component unmounts
    return () => unsubscribeUserData();
  }, [user.uid]);

  useEffect(() => {
    if (!userData) return;

    // Fetch servants data in real-time
    const servantsMeetingRef = firestore()
      .collection("churches")
      .doc(userData.church)
      .collection("Servants Meeting");

    const unsubscribeServants = servantsMeetingRef.onSnapshot(async (snapshot) => {
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
            .collection("Servants Meeting")
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
      setLoading(false); // Stop loading after data is fetched
    });

    // Clean up listener when component unmounts
    return () => unsubscribeServants();
  }, [userData]); // Re-fetch servants when userData changes

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

  const handleAttendance = (servantID, status) => {
    const dateKey = getNextSunday();
    firestore()
      .collection("churches")
      .doc(userData.church)
      .collection("Servants Meeting")
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
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }} // Added for larger touch area
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
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 30,
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
  studentName: { fontSize: 20, color: "#FFFFFF" },
  icon: { width: 8, height: 15 }, // Adjust size as needed
  attendanceButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20, // Increased from 10 to 20
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
  noStudentsText: {
    fontSize: 18,
    color: "#fff",
    textAlign: "center",
    marginTop: 20,
  },
});

export default ServantsAttendance;