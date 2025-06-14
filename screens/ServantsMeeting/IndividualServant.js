import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import BackArrow from "../../components/backArrow";

const IndividualServant = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { church, category, servantID } = route.params;
  const [attendanceData, setAttendanceData] = useState([]);
  const [servantName, setServantName] = useState("");
  const [profilePicture, setProfilePicture] = useState(null);

  useEffect(() => {
    const fetchAttendanceAndProfile = async () => {
      try {
        // Fetch servant data from Firestore
        const studentRef = firestore()
          .collection("churches")
          .doc(church)
          .collection("Servants Meeting")
          .doc(servantID);

        const servantDoc = await studentRef.get();
        if (servantDoc.exists) {
          const servantData = servantDoc.data();
          setServantName(servantData.name);

          const attendance = [];
          for (const [key, value] of Object.entries(servantData)) {
            if (key !== "name" && key !== "uid") {
              attendance.push({ date: key, status: value });
            }
          }
          attendance.sort((a, b) => new Date(b.date) - new Date(a.date));
          setAttendanceData(attendance);
        }

        // Fetch profile picture from Firebase Storage
        try {
          const url = await storage()
            .ref(`profilePictures/${servantID}.png`)
            .getDownloadURL();
          setProfilePicture(url);
        } catch (error) {
          setProfilePicture(null); // Set to null if image doesn't exist
        }
      } catch (error) {
        Alert.alert("Error", "Failed to fetch data. Please try again.");
      }
    };

    fetchAttendanceAndProfile();
  }, [church, servantID]);

  const getStatusStyle = (status) => {
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
              await firestore()
                .collection("churches")
                .doc(church)
                .collection("Servants Meeting")
                .doc(servantID)
                .delete();

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
      <View style={styles.headerContainer}>
        <Text style={styles.title}>{`Attendance for ${servantName}`}</Text>
        <Image
          source={{ uri: profilePicture }}
          style={styles.profilePicture}
          defaultSource={require("../../assets/default_profile.png")}
          onError={() => setProfilePicture(null)}
        />
        <Text style={styles.subtitle}>{`Category: Servants Meeting`}</Text>
      </View>
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
    backgroundColor: "#121212",
    padding: 20,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginVertical: 15, // Adjusted for spacing above and below
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    color: "#b0b0b0",
    textAlign: "center",
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
    color: "#D32F2F",
  },
});

export default IndividualServant;