import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  AsyncStorage,
  NativeEventEmitter,
  NativeModules,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import { initializeApp } from "firebase/app";
import messaging from "@react-native-firebase/messaging";
import auth from "@react-native-firebase/auth";
import * as Location from "expo-location";
import { unavailableToServe, frequencyUpdate } from "../../components/functionCalls";
import { registerBackgroundFetchAsync } from "../../components/backgroundTasks"; // adjust path

// Initialize Firebase
initializeApp({
  projectId: "taksis-a8ba7",
  apiKey: "AIzaSyBWxEgHXcJx19Rklr7P6HhhweT9_I70WkA",
  authDomain: "taksis-a8ba7.firebaseapp.com",
});

// Setup native module event emitter (if needed)
const { YourNativeModule } = NativeModules;
const eventEmitter = YourNativeModule
  ? new NativeEventEmitter(YourNativeModule)
  : null;

// Notification & FCM token logic for Android
async function requestUserPermissionAndroid() {
  try {
    let permissionGranted = false;
    while (!permissionGranted) {
      const authStatus = await messaging().hasPermission();
      permissionGranted =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED;
      if (!permissionGranted) {
        await messaging().requestPermission();
        permissionGranted =
          (await messaging().hasPermission()) ===
          messaging.AuthorizationStatus.AUTHORIZED;
      }
      if (permissionGranted) {
        console.log("Android Notification Permission Granted");
        await AsyncStorage.setItem("notification_permission", "granted");
        await getFCMToken();
      } else {
        Alert.alert(
          "Notifications Required",
          "You need to enable notifications for important updates. Please grant permission.",
          [
            { text: "Retry", onPress: requestUserPermissionAndroid },
            { text: "Cancel", style: "cancel" },
          ]
        );
      }
    }
  } catch (error) {
    console.error("Error requesting Android notification permission:", error);
  }
}

// Notification & FCM token logic for iOS
async function requestUserPermissionIOS() {
  try {
    let permissionGranted = false;
    while (!permissionGranted) {
      const authStatus = await messaging().requestPermission();
      permissionGranted =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      if (permissionGranted) {
        console.log("iOS Notification Permission Granted:", authStatus);
        await AsyncStorage.setItem("notification_permission", "granted");
        await getFCMToken();
      } else {
        Alert.alert(
          "Notifications Required",
          "You need to enable notifications for important updates. Please grant permission.",
          [
            { text: "Retry", onPress: requestUserPermissionIOS },
            { text: "Cancel", style: "cancel" },
          ]
        );
      }
    }
  } catch (error) {
    console.error("Error requesting iOS notification permission:", error);
  }
}

// Get the Firebase Cloud Messaging token
async function getFCMToken() {
  try {
    const fcmToken = await messaging().getToken();
    if (fcmToken) {
      console.log("FCM Token:", fcmToken);
      await AsyncStorage.setItem("fcm_token", fcmToken);
    } else {
      console.warn("Failed to get FCM token");
    }
  } catch (error) {
    console.error("Error getting FCM token:", error);
  }
}

// Check and request notification permissions
async function checkNotificationPermission() {
  const storedPermission = await AsyncStorage.getItem(
    "notification_permission"
  );
  if (!storedPermission) {
    if (Platform.OS === "ios") {
      await requestUserPermissionIOS();
    } else {
      await requestUserPermissionAndroid();
    }
  }
}

// Revised function to request location permission (foreground and background)
async function requestLocationPermission() {
  try {
    // First, ensure foreground location permission is granted
    let { status: fgStatus } = await Location.getForegroundPermissionsAsync();
    console.log(`Current foreground status: ${fgStatus}`);
    if (fgStatus !== "granted") {
      const { status } = await Location.requestForegroundPermissionsAsync();
      fgStatus = status;
      console.log(`Updated foreground status: ${fgStatus}`);
    }

    console.log("Foreground location permission granted.");

    // Next, check for background location permission
    let { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
    console.log(`Current background status: ${bgStatus}`);
    if (bgStatus !== "granted") {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      bgStatus = status;
      console.log(`Updated background status: ${bgStatus}`);
    }
    console.log("Background location permission granted.");
    return true;
  } catch (error) {
    console.error("Error requesting location permissions:", error);
    return false;
  }
}

// Get the current location and save it to Firestore for the authenticated user
export async function getCurrentLocation() {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") {
      console.log("Location permission not granted.");
      return;
    }
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    if (location) {
      console.log("Location retrieved:", location.coords);
      const userId = auth().currentUser?.uid;
      if (!userId) {
        console.log("No authenticated user found.");
        return;
      }
      const user = auth().currentUser
      await frequencyUpdate(user , 
        "https://update-user-frequency-hy6oofbihq-uc.a.run.app"
      )
      await firestore()
        .collection("users")
        .doc(userId)
        .set(
          {
            location: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            },
          },
          { merge: true }
        );
      console.log("Location saved to Firestore.");
    }
  } catch (error) {
    console.error("Error getting location:", error);
    Alert.alert("Location Error", "Unable to retrieve location.");
  }
}

// Check for location permissions
async function checkLocationPermission() {
  const { status } = await Location.getForegroundPermissionsAsync();
  console.log("Current Permission Status:", status);
  if (status !== "granted") {
    console.log("Requesting location permission...");
    await requestLocationPermission();
  } else {
    console.log("Location permission already granted.");
  }
}

const HomeScreen = () => {
  const [schedule, setSchedule] = useState({
    matins: { name: "N/A" },
    third: { name: "N/A" },
    sixth: { name: "N/A" },
    pauline: { name: "N/A" },
    catholic: { name: "N/A" },
    praxis: { name: "N/A" },
    gospel: { name: "N/A" },
    water: { name: "N/A" },
    wine: { name: "N/A" },
    altar: [],
  });
  const [currentWeek, setCurrentWeek] = useState();
  const [nextWeek, setNextWeek] = useState();
  const [isDeacon, setIsDeacon] = useState(false);
  const [churchId, setChurchId] = useState(null); // new state for church id

  const handleUnavailebleToServe = async () => {
    const user = auth().currentUser;
    if (!user) {
      console.log("No authenticated user found.");
      return;
    }

    Alert.alert(
      "Confirm Unavailability",
      "Are you sure you are unavailable? This action cannot be undone, and your children will be marked as unavailable too.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            const userDoc = await firestore()
              .collection("users")
              .doc(user.uid)
              .get();
            if (!userDoc.exists) {
              console.log("User not found.");
              return;
            }
            const userData = userDoc.data();
            const churchIdFromDoc = userData.church;
            await unavailableToServe(
              user,
              churchIdFromDoc,
              nextWeek,
              true,
              "https://unavailable-for-week-hy6oofbihq-uc.a.run.app"
            );
            Alert.alert(
              "Request Sent",
              "You have been marked as unavailable for this service, and the schedule will update accordingly."
            );
          },
        },
      ]
    );
  };

  // Check notification and location permissions on mount
  useEffect(() => {
    checkNotificationPermission();
    checkLocationPermission();
    const now = new Date()
    if (now.getDay() === 0 && now.getHours() === 9) {
      getCurrentLocation()
    }
    // Register background task for Sunday at 9 AM
    registerBackgroundFetchAsync()
      .then(() => console.log("Background fetch task registered"))
      .catch((err) =>
        console.error("Failed to register background fetch task:", err)
      );
  }, []);

  // Real-time listener on the user document to update nextWeek, isDeacon and churchId
  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      console.log("No authenticated user found for realtime user updates.");
      return;
    }
    const unsubscribeUser = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        (doc) => {
          const userData = doc.data();
          if (userData) {
            setIsDeacon(userData.isDeacon);
            if (userData.nextWeekServe) {
              setNextWeek(userData.nextWeekServe);
              console.log("Next week serve updated:", userData.nextWeekServe);
            }
            if (userData.church && userData.church !== churchId) {
              setChurchId(userData.church);
              console.log("Church updated:", userData.church);
            }
          }
        },
        (error) => {
          console.error("Error listening to user document:", error);
        }
      );
    return () => unsubscribeUser();
  }, [churchId]);

  // Realtime listener for the church schedule that depends on the churchId
  useEffect(() => {
    if (!churchId) {
      console.log("No church selected. Waiting for churchId...");
      return;
    }

    const schedulesRef = firestore()
      .collection("churches")
      .doc(churchId)
      .collection("schedule");

    const unsubscribe = schedulesRef.onSnapshot((snapshot) => {
      let closestSchedule = null;
      let closestDate = null;
      let chosenDocId = "";
      const today = new Date().setHours(0, 0, 0, 0); // Normalize today's date

      snapshot.docs.forEach((doc) => {
        const scheduleData = doc.data();
        const scheduleDateStr = doc.id.split("-").slice(-3).join("-");
        const [month, day, year] = scheduleDateStr.split("-").map(Number);
        const scheduleDate = new Date(2000 + year, month - 1, day).setHours(
          0,
          0,
          0,
          0
        ); // Normalize schedule date

        if (scheduleDate >= today) {
          // Include today as valid
          if (!closestDate || scheduleDate < closestDate) {
            closestDate = scheduleDate;
            closestSchedule = scheduleData;
            chosenDocId = doc.id;
          }
        }
      });

      if (closestSchedule) {
        setCurrentWeek(chosenDocId);
        const defaultSchedule = {
          matins: { name: "N/A" },
          third: { name: "N/A" },
          sixth: { name: "N/A" },
          pauline: { name: "N/A" },
          catholic: { name: "N/A" },
          praxis: { name: "N/A" },
          gospel: { name: "N/A" },
          water: { name: "N/A" },
          wine: { name: "N/A" },
          altar: [],
        };

        const updatedSchedule = {
          ...defaultSchedule,
          ...closestSchedule,
        };

        if (!Array.isArray(updatedSchedule.altar)) {
          updatedSchedule.altar = [];
        }

        const altarServers = [];
        if (
          updatedSchedule.water &&
          typeof updatedSchedule.water === "object"
        ) {
          altarServers.push(updatedSchedule.water);
        }
        if (updatedSchedule.wine && typeof updatedSchedule.wine === "object") {
          altarServers.push(updatedSchedule.wine);
        }

        altarServers.push(
          ...updatedSchedule.altar.filter(
            (server) => server && typeof server === "object"
          )
        );
        updatedSchedule.altar = altarServers;
        setSchedule(updatedSchedule);
        console.log("Real-time schedule updated:", updatedSchedule);
      } else {
        console.log("No upcoming schedule found.");
      }
    });

    return () => unsubscribe();
  }, [churchId]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.homescreen}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.header}>
          Services of Week{"\n"}
          {currentWeek}
        </Text>

        {/* Section for Readings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Readings</Text>
          {[
            { title: "Matins Gospel", value: schedule.matins.name },
            { title: "Third Hour Gospel", value: schedule.third.name },
            { title: "Sixth Hour Gospel", value: schedule.sixth.name },
            { title: "Pauline Epistle", value: schedule.pauline.name },
            { title: "Catholic Epistle", value: schedule.catholic.name },
            { title: "Praxis", value: schedule.praxis.name },
            { title: "Gospel", value: schedule.gospel.name },
          ].map((item, index) => (
            <View key={index} style={styles.card}>
              <Ionicons
                name="book"
                size={24}
                color="#fff"
                style={styles.icon}
              />
              <Text style={styles.name}>
                {item.title}: {item.value}
              </Text>
            </View>
          ))}
        </View>

        {/* Section for Offerings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Offering of the Lamb</Text>
          {[
            { title: "Water", value: schedule.water.name },
            { title: "Wine", value: schedule.wine.name },
          ].map((item, index) => (
            <View key={index} style={styles.card}>
              <Ionicons
                name={item.title === "Water" ? "water" : "wine"}
                size={24}
                color="#fff"
                style={styles.icon}
              />
              <Text style={styles.name}>
                {item.title}: {item.value}
              </Text>
            </View>
          ))}
        </View>

        {/* Section for Altar Servers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Altar Servers</Text>
          {schedule.altar.map((deacon, index) => (
            <View key={index} style={styles.card}>
              <Ionicons
                name="people"
                size={24}
                color="#fff"
                style={styles.icon}
              />
              <Text style={styles.name}>
                Altar: {deacon?.name || "Unknown"}
              </Text>
            </View>
          ))}
        </View>

        {/* Conditionally render Next Service Week box if the user is a deacon */}
        {isDeacon && (
          <View style={styles.nextServiceBox}>
            <Text style={styles.nextServiceHeader}>Next Service Week</Text>
            <Text style={styles.nextServiceText}>
              Your next service is on: {nextWeek}
            </Text>
            <TouchableOpacity
              style={styles.unavailableButton}
              onPress={handleUnavailebleToServe}
            >
              <Text style={styles.requestButtonText}>Unavailable</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      <View style={styles.blackspace} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  scrollContainer: { paddingBottom: 20 },
  homescreen: { flex: 1, width: "100%" },
  header: {
    fontSize: 28,
    color: "#e0e0e0",
    textAlign: "center",
    marginVertical: 20,
    fontWeight: "bold",
  },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: {
    fontSize: 22,
    color: "#4d9cff",
    marginBottom: 10,
    fontWeight: "bold",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2c2c2c",
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  icon: { marginRight: 10 },
  name: { fontSize: 18, color: "#e0e0e0" },
  nextServiceBox: {
    backgroundColor: "#333333",
    padding: 16,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  nextServiceHeader: {
    fontSize: 20,
    color: "#4d9cff",
    marginBottom: 10,
    textAlign: "center",
    fontWeight: "bold",
  },
  nextServiceText: {
    fontSize: 16,
    color: "#e0e0e0",
    textAlign: "center",
    marginBottom: 5,
  },
  unavailableButton: {
    backgroundColor: "#ff3b30",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginVertical: 10,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  requestButtonText: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "bold",
    textAlign: "center",
  },
  blackspace: { height: 0, backgroundColor: "#1a1a1a" },
});

export default HomeScreen;
