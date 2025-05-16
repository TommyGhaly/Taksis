import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import BackArrow from "../../components/backArrow"; // Importing the custom back arrow component

const IndividualServant = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { church, category, servantID } = route.params;
  const [attendanceData, setAttendanceData] = useState([]);
  const [servantName, setServantName] = useState("");

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const studentRef = firestore()
          .collection("churches")
          .doc(church)
          .collection("Servants Meeting")
          .doc(servantID);

        const servantDoc = await studentRef.get();
        if (servantDoc.exists) {
          setServantName(servantDoc.data().name);

          const servatnData = servantDoc.data();
          const attendance = [];

          for (const [key, value] of Object.entries(servatnData)) {
            if (key !== "name" && key !== "uid") {
              attendance.push({ date: key, status: value });
            }
          }

          attendance.sort((a, b) => new Date(b.date) - new Date(a.date));
          setAttendanceData(attendance);
        }
      } catch (error) {
        Alert.alert("Error", "Failed to fetch attendance data. Please try again.");
      }
    };

    fetchAttendance();
  }, [church, servantID]);

  const getStatusStyle = (status) => {
    // Adjusted to handle true/false for Present/Absent
    return status === false ? styles.absent : styles.present;
  };

  const handleDeleteServant = () => {
    Alert.alert(
      "Confirm Removal",
      `Are you sure you want to remove ${servantName} from Servants Meeting?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              // Delete servant's document from Servants Meeting
              await firestore()
                .collection("churches")
                .doc(church)
                .collection("Servants Meeting")
                .doc(servantID)
                .delete();

              // Prompt user about revoking Sunday School Teacher role
              Alert.alert(
                "Revoke Role",
                `Would you also like to revoke ${servantName}'s Sunday School Teacher role?`,
                [
                  {
                    text: "No, Keep Role",
                    style: "cancel",
                    onPress: () => {
                      Alert.alert(
                        "Success",
                        `${servantName} has been removed from Servants Meeting.`,
                        [
                          {
                            text: "OK",
                            onPress: () => navigation.goBack(),
                          },
                        ]
                      );
                    },
                  },
                  {
                    text: "Yes, Revoke Role",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        // Update user's document to set isSSTeacher to false
                        await firestore()
                          .collection("users")
                          .doc(servantID)
                          .update({
                            isSSTeacher: false,
                          });

                        Alert.alert(
                          "Success",
                          `${servantName} has been removed from Servants Meeting and their Sunday School Teacher role has been revoked.`,
                          [
                            {
                              text: "OK",
                              onPress: () => navigation.goBack(),
                            },
                          ]
                        );
                      } catch (error) {
                        Alert.alert("Error", "Failed to update teacher role. Please try again.");
                      }
                    },
                  },
                ]
              );
            } catch (error) {
              Alert.alert("Error", "Failed to remove servant. Please try again.");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <BackArrow style={styles.backArrow} onPress={() => navigation.goBack()} />
      <Text style={styles.title}>{`Attendance for ${servantName}`}</Text>
      <Text style={styles.subtitle}>{`Category: Servants Meeting`}</Text>
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
                {attendance.status === false
                  ? "Absent"
                  : attendance.status === true
                  ? "Present"
                  : "No Status"}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <TouchableOpacity onPress={handleDeleteServant} style={styles.removeButton}>
        <Text style={styles.removeButtonText}>Remove Servant</Text>
      </TouchableOpacity>
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
    paddingTop: 16,
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
    paddingVertical: 12, // Increased padding for more vertical space
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: "center",
    minWidth: 120,
    minHeight: 44, // Replaced height with minHeight for flexibility
  },
  statusText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    lineHeight: 24, // Added lineHeight to ensure consistent text rendering
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
  backArrow: {
    position: "absolute",
    top: 50,
    left: 16,
  },
  removeButton: {
    paddingVertical: 15,
    alignItems: "center",
  },
  removeButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#D32F2F", // Red text to match absent styling
  },
});

export default IndividualServant;