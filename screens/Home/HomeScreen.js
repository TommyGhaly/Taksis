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
} from "react-native";

initializeApp({
  projectId: "taksis-a8ba7",
  apiKey: "AIzaSyBWxEgHXcJx19Rklr7P6HhhweT9_I70WkA",
  authDomain: "taksis-a8ba7.firebaseapp.com",
});

/*const { YourNativeModule } = NativeModules;
const eventEmitter = new NativeEventEmitter(YourNativeModule);*/

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

/*async function requestUserPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    console.log("Notification Permission Granted:", authStatus);
    await getFCMToken(); // Get the token after permission is granted
  } else {
    Alert.alert(
      "Notifications Disabled",
      "Please enable notifications in settings."
    );
  }
}

async function getFCMToken() {
  try {
    const token = await messaging().getToken();
    if (token) {
      console.log("FCM Token:", token);
      // Send this token to your backend for push notifications
    } else {
      console.log("Failed to get FCM token");
    }
  } catch (error) {
    console.error("Error getting FCM token:", error);
  }
}
requestUserPermission();*/

async function requestAndroidNotificationPermission() {
  if (Platform.OS === "android" && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );

    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      console.log("Notification permission granted.");
    } else {
      console.log("Notification permission denied.");
    }
  }
}

requestAndroidNotificationPermission();

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

  /*async function requestBackgroundLocation() {
    try {
      let permission;
  
      // **Android Permission Handling**
      if (Platform.OS === "android") {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location Permission",
            message: "This app requires access to your location to track attendance.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK",
          }
        );
  
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log("Location permission denied");
          Alert.alert("Permission Denied", "Location access is required for attendance tracking.");
          return;
        }
        permission = PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
      } 
      
      // **iOS Permission Handling**
      else if (Platform.OS === "ios") {
        permission = PERMISSIONS.IOS.LOCATION_ALWAYS;
      }
  
      // **Check and Request Background Location Permission**
      const status = await check(permission);
  
      if (status === RESULTS.DENIED) {
        const requestStatus = await request(permission);
        if (requestStatus !== RESULTS.GRANTED) {
          Alert.alert("Location Permission Denied", "Please enable location permissions in Settings.");
          return;
        }
      } else if (status !== RESULTS.GRANTED) {
        Alert.alert("Location Permission Denied", "Please enable location permissions in Settings.");
        return;
      }
  
      // **Get Current Location**
      Geolocation.getCurrentPosition(
        async (position) => {
          console.log("Location retrieved:", position.coords);
          
          try {
            // **Send Location to Firestore**
            await firestore().collection("user_locations").doc("your_user_id").set(
              {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                timestamp: firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
            console.log("Location saved to Firestore.");
          } catch (firestoreError) {
            console.error("Error saving location to Firestore:", firestoreError);
          }
        },
        (error) => {
          console.error("Error getting location:", error);
          Alert.alert("Location Error", "Unable to retrieve location. Ensure GPS is enabled.");
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } catch (error) {
      console.error("Error in location request:", error);
      Alert.alert("Unexpected Error", "An error occurred while requesting location.");
    }
  }*/

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

        {/* Request a Week Button */}
        <TouchableOpacity style={styles.requestButton}>
          <Text style={styles.requestButtonText}>Request a Week</Text>
        </TouchableOpacity>
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
