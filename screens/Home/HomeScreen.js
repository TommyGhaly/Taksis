import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons"; // Using Ionicons for icons
import firestore from "@react-native-firebase/firestore";
import { initializeApp } from "firebase/app";
import messaging from "@react-native-firebase/messaging";
import {
  PermissionsAndroid,
  Platform,
  Alert,
  NativeEventEmitter,
  NativeModules,
  AsyncStorage,
  Linking,
} from "react-native";
import auth from "@react-native-firebase/auth";
import * as Location from "expo-location" ;

initializeApp({
  projectId: "taksis-a8ba7",
  apiKey: "AIzaSyBWxEgHXcJx19Rklr7P6HhhweT9_I70WkA",
  authDomain: "taksis-a8ba7.firebaseapp.com",
});

const { YourNativeModule } = NativeModules;
const eventEmitter = YourNativeModule
  ? new NativeEventEmitter(YourNativeModule)
  : null;

// Format date as MM-DD-YY
const formatDate = (date) => {
  let day = date.getDate();
  let month = date.getMonth() + 1;
  let year = date.getFullYear() % 100;

  return `${month < 10 ? `0${month}` : month}-${
    day < 10 ? `0${day}` : day
  }-${year}`;
};

// Get the next upcoming Sunday
const getNextSunday = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // Sunday = 0, Monday = 1, ..., Saturday = 6
  const daysUntilSunday = (7 - dayOfWeek) % 7; // Days until the next Sunday
  const nextSunday = new Date(
    today.getTime() + daysUntilSunday * 24 * 60 * 60 * 1000
  );
  return formatDate(nextSunday);
};

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

async function requestLocationPermission() {
  try {
    // Check the current status of location permissions
    const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
    console.log(`Current Foreground Permission Status: ${foregroundStatus}`);

    // If permission is already granted, do nothing
    if (foregroundStatus === 'granted') {
      console.log('Location permission already granted.');
      return;
    }

    // Request foreground location permission if not granted
    console.log('Requesting location permission...');
    const { status: newForegroundStatus } = await Location.requestForegroundPermissionsAsync();
    console.log(`New Foreground Permission Status: ${newForegroundStatus}`);

    if (newForegroundStatus === 'granted') {
      console.log('Foreground location permission granted.');
    } else {
      console.log('Foreground location permission denied.');
      // Ask user to enable permissions manually if denied
      Alert.alert(
        'Permission Required',
        'Please enable location permissions in your settings.',
        [
          { text: 'Cancel' },
          { text: 'Share Location', onPress: () => requestLocationPermission() },
        ]
      );
      return;
    }

    // Optionally request background location permission if foreground permission is granted
    if (newForegroundStatus === 'granted') {
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      console.log(`Background Permission Status: ${backgroundStatus}`);

      if (backgroundStatus === 'granted') {
        console.log('Background location permission granted.');
      } else {
        console.log('Background location permission denied.');
      }
    }
  } catch (error) {
    console.error('Error requesting location permissions:', error);
  }
}
async function getCurrentLocation() {
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

async function checkLocationPermission() {
  const { status } = await Location.getForegroundPermissionsAsync(); // Check current permission status
  console.log("Current Permission Status:", status);

  if (status !== "granted") {
    console.log("Requesting location permission...");
    await requestLocationPermission(); // Call the request function
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

  const [currentWeek, setCurrentWeek] = useState(getNextSunday());
  const [nextWeek, setNextWeek] = useState(
    formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  );

  useEffect(() => {
    checkNotificationPermission();
    checkLocationPermission();
  }, []);

  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const schedulesRef = firestore().collection("schedules");
        schedulesRef.onSnapshot((snapshot) => {
          let closestSchedule = null;
          let closestDate = null;

          snapshot.docs.forEach((doc) => {
            const scheduleData = doc.data();
            const scheduleDateStr = doc.id.split("-").slice(-3).join("-");
            const [month, day, year] = scheduleDateStr.split("-").map(Number);
            const scheduleDate = new Date(2000 + year, month - 1, day);

            if (scheduleDate > new Date()) {
              if (!closestDate || scheduleDate < closestDate) {
                closestDate = scheduleDate;
                closestSchedule = scheduleData;
              }
            }
          });

          if (closestSchedule) {
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

            setSchedule({ ...defaultSchedule, ...closestSchedule });
            console.log("Schedule updated:", closestSchedule);
          }
        });
      } catch (error) {
        console.error("Error fetching schedule:", error);
      }
    };

    fetchSchedule();
  }, []);
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
              <Text style={styles.name}>Altar: {deacon.name || "Unknown"}</Text>
            </View>
          ))}
        </View>

        {/* Box for Next Service Week */}
        <View style={styles.nextServiceBox}>
          <Text style={styles.nextServiceHeader}>Next Service Week</Text>
          <Text style={styles.nextServiceText}>
            Your next service is on: {nextWeek}
          </Text>
          <TouchableOpacity style={styles.unavailableButton}>
            <Text style={styles.requestButtonText}>Unavailable</Text>
          </TouchableOpacity>
        </View>
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
  requestButton: {
    backgroundColor: "#147efb",
    paddingVertical: 15,
    paddingHorizontal: 100,
    borderRadius: 30,
    marginVertical: 20,
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