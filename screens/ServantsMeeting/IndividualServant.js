import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, ActivityIndicator } from "react-native";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import BackArrow from "../../components/backArrow";
import ProfileImageExpander from "../../components/ProfileImageExpander";

const IndividualServant = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { church, category, servantID } = route.params;
  const [attendanceData, setAttendanceData] = useState([]);
  const [servantName, setServantName] = useState("");
  const [profilePicture, setProfilePicture] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      // Reset state when screen is focused
      setAttendanceData([]);
      setServantName("");
      setProfilePicture(null);
      setLoading(true);

      let servantUnsubscribe = null;

      const fetchAttendanceAndProfile = () => {
        // Set up real-time listener for servant data
        servantUnsubscribe = firestore()
          .collection("churches")
          .doc(church)
          .collection("Servants Meeting")
          .doc(servantID)
          .onSnapshot(
            async (servantDoc) => {
              try {
                if (servantDoc.exists) {
                  const servantData = servantDoc.data();
                  setServantName(servantData.name || "");

                  const attendance = [];
                  for (const [key, value] of Object.entries(servantData)) {
                    if (key !== "name" && key !== "uid") {
                      attendance.push({ date: key, status: value });
                    }
                  }
                  setAttendanceData(attendance);

                  // Fetch profile picture (not real-time, as Storage doesn't support onSnapshot)
                  try {
                    const profileUrl = await storage()
                      .ref(`profilePictures/${servantID}.png`)
                      .getDownloadURL();
                    setProfilePicture(profileUrl);
                  } catch (error) {
                    setProfilePicture(null);
                  }
                } else {
                  setServantName("");
                  setAttendanceData([]);
                  setProfilePicture(null);
                }
                setLoading(false);
              } catch (error) {
                Alert.alert("Error", "Failed to fetch data. Please try again.");
                setLoading(false);
              }
            },
            (error) => {
              Alert.alert("Error", "Failed to fetch data. Please try again.");
              setLoading(false);
            }
          );
      };

      fetchAttendanceAndProfile();

      // Cleanup listener when screen is unfocused
      return () => {
        if (servantUnsubscribe) servantUnsubscribe();
      };
    }, [church, servantID])
  );

  // Memoize sorted attendance data
  const sortedAttendanceData = React.useMemo(() => {
    return [...attendanceData].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [attendanceData]);

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

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#147efb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackArrow style={styles.backArrow} onPress={() => navigation.goBack()} />
      
      {/* Header Section */}
      <View style={styles.headerSection}>
        <Text style={styles.title}>{`${servantName}`}</Text>
        <View style={styles.profileContainer}>
          <ProfileImageExpander
            imageUrl={profilePicture}
            size={100}
            finalSize={300}
            borderRadius={50}
            style={styles.profilePicture}
          />
        </View>
        <Text style={styles.subtitle}>{`Category: Servants Meeting`}</Text>
      </View>
      
      {/* Attendance Section */}
      <ScrollView contentContainerStyle={styles.attendanceContainer}>
        {sortedAttendanceData.map((attendance, index) => (
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
      
      {/* Action Button */}
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
    paddingBottom: 40, // Add extra bottom padding
    justifyContent: "center", // Center loading indicator
  },
  headerSection: {
    alignItems: "center",
    marginBottom: 20,
    marginTop: 10,
    width: "100%",
    paddingHorizontal: 20,
  },
  profileContainer: {
    alignItems: "center",
    marginVertical: 10,
  },
  profilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  subtitle: {
    fontSize: 18,
    color: "#b0b0b0",
    textAlign: "center",
    marginTop: 5,
    paddingHorizontal: 10,
  },
  attendanceContainer: {
    flexGrow: 1,
    paddingBottom: 15,
  },
  attendanceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    marginBottom: 10,
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