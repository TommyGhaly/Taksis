import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import BackArrow from "../components/backArrow"; // Importing the custom back arrow component

const IndividualAttendance = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { church, category, servantID } = route.params;
  const [attendanceData, setAttendanceData] = useState([]);
  const [studentName, setStudentName] = useState("");

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const studentRef = firestore()
          .collection("churches")
          .doc(church)
          .collection(category)
          .doc(servantID)

        const studentDoc = await studentRef.get();
        if (studentDoc.exists) {
          setStudentName(studentDoc.data().name);

          const studentData = studentDoc.data();
          const attendance = [];

          for (const [key, value] of Object.entries(studentData)) {
            if (key !== "name" && key !== "uid") {
              attendance.push({ date: key, status: value });
            }
          }

          attendance.sort((a, b) => new Date(b.date) - new Date(a.date));
          console.log(attendance)
          setAttendanceData(attendance);
        }
      } catch (error) {
        console.error("Error fetching attendance data:", error);
      }
    };

    fetchAttendance();
  }, [church, studentId]);

  const getStatusStyle = (status) => {
    // Adjusted to handle true/false for Present/Absent
    return status === false ? styles.absent : styles.present;
  };

  return (
    <View style={styles.container}>
      <BackArrow style={styles.backArrow} onPress={() => navigation.goBack()} />
      <Text style={styles.title}>{`Attendance for ${studentName}`}</Text>
      <Text
        style={styles.subtitle}
      >{`Category: ${category}`}</Text>
      <ScrollView contentContainerStyle={styles.attendanceContainer}>
        {attendanceData.map((attendance, index) => (
          <View key={index} style={styles.attendanceItem}>
            <Text style={styles.dateText}>{attendance.date}</Text>
            <View
              style={[
                styles.statusContainer,
                getStatusStyle(attendance.status),
              ]}
            >
              <Text style={styles.statusText}>
                {/* Display "Present" or "Absent" based on the status */}
                {attendance.status === false ? "Absent" : attendance.status === true ? "Present" : "No Status"}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212", // Dark background color
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#ffffff", // White text for contrast
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: "#b0b0b0", // Lighter text color for subtitle
    marginBottom: 25,
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
    marginBottom: 15, // Increased margin for spacing
    borderBottomWidth: 1,
    borderBottomColor: "#444",
  },
  dateText: {
    fontSize: 18,
    color: "#ffffff", // White text for date
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: "center",
    minWidth: 120,
    marginLeft: 20,
    height: 40, // Make the status box taller
  },
  statusText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff", // White text for status
  },
  present: {
    backgroundColor: "#147efb", // Blue for Present
    borderColor: "#0f64d2", // Darker blue for the border
    borderWidth: 1,
  },
  absent: {
    backgroundColor: "#F44336", // Red for Absent
    borderColor: "#D32F2F", // Darker red for the border
    borderWidth: 1,
  },
  backArrow: {
    position: "absolute",
    top: 50,
    left: 16,
  },
});

export default IndividualAttendance;
