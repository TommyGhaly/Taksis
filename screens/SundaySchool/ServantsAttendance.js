import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Image,
} from "react-native";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import BackArrow from "../../components/backArrow";
import ProfileImageExpander from "../../components/ProfileImageExpander";

const defaultProfileImage = require("../../assets/default_profile.png");

const ServantAttendance = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { church, servantId } = route.params;
  const [servantData, setServantData] = useState({});
  const [loading, setLoading] = useState(true);
  const [profilePictureUrl, setProfilePictureUrl] = useState(null);
  const isMounted = useRef(true);

  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;

      // Reset state when screen is focused
      setServantData({});
      setLoading(true);
      setProfilePictureUrl(null);

      const fetchData = () => {
        if (!servantId) {
          Alert.alert("Error", "Servant ID is missing.");
          navigation.goBack();
          return () => {};
        }

        const servantRef = firestore()
          .collection("churches")
          .doc(church)
          .collection("Sunday School")
          .doc("Servants")
          .collection("Servants")
          .doc(servantId);

        // Fetch profile picture concurrently
        const profilePicturePromise = storage()
          .ref(`profilePictures/${servantId}.png`)
          .getDownloadURL()
          .catch(() => null); // Return null if image fetch fails

        // Set up real-time listener for servant data
        const unsubscribe = servantRef.onSnapshot(
          async (doc) => {
            if (!isMounted.current) return;
            try {
              if (doc.exists) {
                const data = doc.data();
                setServantData(data);
              } else {
                navigation.goBack();
              }

              // Resolve profile picture
              const url = await profilePicturePromise;
              setProfilePictureUrl(url);
              setLoading(false);
            } catch (error) {
              if (isMounted.current) {
                Alert.alert("Error", "Failed to load servant data.");
                setLoading(false);
              }
            }
          },
          (error) => {
            if (isMounted.current) {
              Alert.alert("Error", "Failed to load servant data.");
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
    }, [church, servantId, navigation])
  );

  // Compute attendance data
  const attendanceDataMemo = React.useMemo(() => {
    if (!servantData || Object.keys(servantData).length === 0) return [];
    const attendance = [];
    
    // List of field names to exclude from attendance
    const excludeFields = [
      "name", "uid", "phone", "address", "description", "birthday",
      // Grade fields
      "preSchoolAge3", "preSchoolAge4", "kindergarten", "college",
      "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"
    ];
    
    for (const [key, value] of Object.entries(servantData)) {
      // Check if this field is an attendance date (MM-DD-YYYY format)
      if (!excludeFields.includes(key) && /^\d{2}-\d{2}-\d{4}$/.test(key)) {
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
  }, [servantData]);

  // Get grades the servant teaches
  const getServantGrades = () => {
    if (!servantData) return "";
    
    const gradeMap = {
      "preSchoolAge3": "Pre-School Age 3",
      "preSchoolAge4": "Pre-School Age 4",
      "kindergarten": "Kindergarten",
      "1": "1st Grade",
      "2": "2nd Grade",
      "3": "3rd Grade",
      "4": "4th Grade",
      "5": "5th Grade",
      "6": "6th Grade",
      "7": "7th Grade",
      "8": "8th Grade",
      "9": "9th Grade",
      "10": "10th Grade",
      "11": "11th Grade",
      "12": "12th Grade",
      "college": "College"
    };
    
    const grades = [];
    Object.entries(gradeMap).forEach(([field, gradeName]) => {
      if (servantData[field] === true) {
        grades.push(gradeName);
      }
    });
    
    return grades.length > 0 ? grades.join(", ") : "No grades assigned";
  };

  // Get status style
  const getStatusStyle = (status) => {
    return status === false ? styles.absent : styles.present;
  };

  // Delete servant record only (preserves profile picture)
  const deleteServant = async () => {
    Alert.alert(
      "Delete Servant",
      `Are you sure you want to delete ${
        servantData.name || "this servant's"
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
                .collection("Sunday School")
                .doc("Servants")
                .collection("Servants")
                .doc(servantId)
                .delete();

              Alert.alert(
                "Success",
                `${servantData.name || "Servant"}'s record has been deleted.`,
                [{ text: "OK"}]
              );
            } catch (error) {
              Alert.alert("Error", "Failed to delete servant record.");
            }
          },
        },
      ]
    );
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
        </View>
        <Text style={styles.title}>{`${servantData.name || "Servant"}`}</Text>
        <View style={styles.profileContainer}>
          <ProfileImageExpander
            imageUrl={profilePictureUrl || defaultProfileImage}
            size={80}
            finalSize={300}
            borderRadius={40}
            style={styles.profileImage}
          />
        </View>
        <Text style={styles.subtitle}>{`Teaching: ${getServantGrades()}`}</Text>
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
          onPress={deleteServant}
          style={styles.deleteTextContainer}
          accessible={true}
          accessibilityLabel="Delete servant record"
        >
          <Text style={styles.deleteText}>Delete Servant</Text>
        </TouchableOpacity>
      </View>
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
    justifyContent: "flex-start",
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
  profileContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  subtitle: {
    fontSize: 18,
    color: "#b0b0b0",
    marginBottom: 20,
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

export default ServantAttendance;