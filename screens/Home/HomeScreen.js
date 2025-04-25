import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  TextInput,
  SafeAreaView,
  Animated,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import { initializeApp } from "firebase/app";
import messaging from "@react-native-firebase/messaging";
import auth from "@react-native-firebase/auth";
import * as AppleAuthentication from "expo-apple-authentication";
import { deleteUser } from "@react-native-firebase/auth";
import { callFunction, callDeleteUser, unavailableToServe } from "../../components/functionCalls";
import DateTimePicker from "@react-native-community/datetimepicker";
import { check, request, PERMISSIONS, RESULTS } from "react-native-permissions";

// Initialize Firebase
initializeApp({
  projectId: "taksis-a8ba7",
  apiKey: "AIzaSyBWxEgHXcJx19Rklr7P6HhhweT9_I70WkA",
  authDomain: "taksis-a8ba7.firebaseapp.com",
});

// Create notification channel for Android with fallback
async function createNotificationChannel() {
  if (Platform.OS === "android") {
    try {
      await messaging().registerDeviceForRemoteMessages();
      if (typeof messaging().createChannel === "function") {
        const channelId = "default_channel";
        await messaging().createChannel({
          channelId,
          channelName: "Default Notifications",
          description: "Default channel for app notifications",
          importance: 4, // Importance.HIGH
          soundName: "default",
          enableVibration: true,
        });
      } else {
      }
    } catch (error) {
    }
  }
}

// Request notification permissions for Android
async function requestUserPermissionAndroid() {
  try {
    // Check POST_NOTIFICATIONS permission only for Android 13+ (API 33)
    if (Platform.OS === "android" && Platform.Version >= 33 && PERMISSIONS.ANDROID.POST_NOTIFICATIONS) {
      const permissionStatus = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
      if (permissionStatus !== RESULTS.GRANTED) {
        const result = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
        if (result !== RESULTS.GRANTED) {
          Alert.alert(
            "Notifications Required",
            "Please enable notifications in your device settings to receive important updates.",
            [{ text: "OK", style: "cancel" }]
          );
          return false;
        }
      }
    }

    const authStatus = await messaging().hasPermission();
    if (authStatus === messaging.AuthorizationStatus.AUTHORIZED) {
      await getFCMToken();
      return true;
    }

    const newAuthStatus = await messaging().requestPermission();
    if (newAuthStatus === messaging.AuthorizationStatus.AUTHORIZED) {
      await getFCMToken();
      return true;
    } else {
      Alert.alert(
        "Notifications Required",
        "Please enable notifications for important updates in your device settings.",
        [{ text: "OK", style: "cancel" }]
      );
      return false;
    }
  } catch (error) {
    Alert.alert("Error", "Failed to request notification permission.");
    return false;
  }
}

// Request notification permissions for iOS
async function requestUserPermissionIOS() {
  try {
    const authStatus = await messaging().requestPermission({
      alert: true,
      badge: true,
      sound: true,
    });
    const granted =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (granted) {
      await getFCMToken();
      return true;
    } else {
      Alert.alert(
        "Notifications Required",
        "Please enable notifications for important updates in your device settings.",
        [{ text: "OK", style: "cancel" }]
      );
      return false;
    }
  } catch (error) {
    Alert.alert("Error", "Failed to request notification permission.");
    return false;
  }
}

// Get the Firebase Cloud Messaging token with retry
async function getFCMToken(retries = 3, delay = 1000) {
  try {
    for (let i = 0; i < retries; i++) {
      const fcmToken = await messaging().getToken();
      if (fcmToken) {
        return fcmToken;
      }
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  } catch (error) {
  }
}

// Check and request notification permissions
async function checkNotificationPermission() {
  try {
    // Create notification channel for Android
    await createNotificationChannel();

    const authStatus = await messaging().hasPermission();
    const isAuthorized =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (isAuthorized) {
      await getFCMToken();
    } else if (Platform.OS === "ios") {
      await requestUserPermissionIOS();
    } else {
      await requestUserPermissionAndroid();
    }
  } catch (error) {
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
  const [churchId, setChurchId] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showDOBModal, setShowDOBModal] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [userName, setUserName] = useState(null);
  const [date, setDate] = useState(new Date());
  const [tempDate, setTempDate] = useState(date);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const scaleValue = React.useRef(new Animated.Value(0.9)).current;

  // Handle foreground notifications
  useEffect(() => {
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      Alert.alert(
        remoteMessage.notification?.title || "Notification",
        remoteMessage.notification?.body || "You have a new message."
      );
    });

    return unsubscribe;
  }, []);

  // Handle background notifications
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  });

  const formatDate = (date) => {
    return `${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}-${date.getFullYear()}`;
  };

  const handleDateChange = (event, selectedDate) => {
    if (event.type === "dismissed") {
      setShowDatePicker(false);
      return;
    }
    const currentDate = selectedDate || tempDate;
    setTempDate(currentDate);
    setDate(currentDate);
    if (Platform.OS === "android" && event.type === "set") {
      setShowDatePicker(false);
    }
  };

  const handleDOBSubmit = async () => {
    const user = auth().currentUser;
    if (!user) {
      Alert.alert("Error", "User not authenticated.");
      return;
    }

    try {
      const formattedDOB = formatDate(date);
      const userRef = firestore().collection("users").doc(user.uid);

      await userRef.update({
        DOB: formattedDOB,
        ssGrades: [],
        alhanGrades: [],
      });

      await callFunction(user, "https://update-user-hy6oofbihq-uc.a.run.app");

      const userDoc = await userRef.get();
      const userData = userDoc.data();
      if (userData.children && userData.children.length > 0) {
        const church = userData.church || null;
        await Promise.all(
          userData.children.map(async (child) => {
            if (child.uid) {
              await callDeleteUser(
                user,
                church,
                child.uid,
                "https://delete-child-hy6oofbihq-uc.a.run.app"
              );
            }
          })
        );
        Alert.alert(
          "Children Removed",
          "We have removed your children from the schedules. Please reregister them with their birthdays."
        );
      }

      setShowDOBModal(false);
    } catch (error) {
      Alert.alert("Error", "Failed to update date of birth. Please try again.");
    }
  };

  const handleNameSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Error", "Please enter both first and last names.");
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const user = auth().currentUser;
    if (user) {
      try {
        const userRef = firestore().collection("users").doc(user.uid);
        await userRef.update({
          name: fullName,
        });
        await callFunction(
          user,
          "https://update-user-hy6oofbihq-uc.a.run.app"
        );
        setUserName(fullName);
        setShowNameModal(false);
        setFirstName("");
        setLastName("");
      } catch (error) {
        Alert.alert("Error", "Failed to update name. Please try again.");
      }
    }
  };

  useEffect(() => {
    checkNotificationPermission();
  }, []);

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      return;
    }

    const userRef = firestore().collection("users").doc(user.uid);

    const unsubscribe = userRef.onSnapshot(
      (doc) => {
        if (doc.exists) {
          const userData = doc.data();
          const name = userData.name;
          setUserName(name);
          const isNameInvalid =
            !name ||
            name === "null null" ||
            name.trim() === "" ||
            !name.includes(" ");
          const isDOBInvalid = !userData.DOB || userData.DOB.trim() === "";
          setShowNameModal(isNameInvalid);
          setShowDOBModal(!isNameInvalid && isDOBInvalid);
        } else {
          Alert.alert(
            "Sign up to continue",
            "Please sign up using this account to continue."
          );
          deleteUser(user);
        }
      },
      (error) => {
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
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
            }
            if (userData.church && userData.church !== churchId) {
              setChurchId(userData.church);
            }
            if (
              userData.alhanGrades &&
              !(
                Array.isArray(userData.alhanGrades) ||
                userData.alhanGrades === "" ||
                userData.alhanGrades === null
              )
            ) {
              userData.alhanGrades = null;
            }
            if (
              userData.ssGrades &&
              !(
                Array.isArray(userData.ssGrades) ||
                userData.ssGrades === "" ||
                userData.ssGrades === null
              )
            ) {
              userData.ssGrades = null;
            }
          }
        },
        (error) => {
        }
      );
    return () => unsubscribeUser();
  }, [churchId]);

  useEffect(() => {
    if (!churchId) {
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
      const today = new Date().setHours(0, 0, 0, 0);

      snapshot.docs.forEach((doc) => {
        const scheduleData = doc.data();
        const scheduleDateStr = doc.id.split("-").slice(-3).join("-");
        const [month, day, year] = scheduleDateStr.split("-").map(Number);
        const scheduleDate = new Date(2000 + year, month - 1, day).setHours(
          0,
          0,
          0,
          0
        );

        if (
          !closestDate ||
          Math.abs(scheduleDate - today) < Math.abs(closestDate - today)
        ) {
          closestDate = scheduleDate;
          closestSchedule = scheduleData;
          chosenDocId = doc.id;
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
        if (updatedSchedule.water && typeof updatedSchedule.water === "object") {
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
      } else {
      }
    });

    return () => unsubscribe();
  }, [churchId]);

  const handleUnavailableToServe = async () => {
    const user = auth().currentUser;
    if (!user) {
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

  useEffect(() => {
    if (showDOBModal) {
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      scaleValue.setValue(0.9);
    }
  }, [showDOBModal]);

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        animationType="slide"
        transparent={true}
        visible={showNameModal}
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>We Need Your Name</Text>
            <Text style={styles.modalSubtitle}>
              Please provide your first and last name to continue.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="First Name"
              placeholderTextColor="#888"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              placeholder="Last Name"
              placeholderTextColor="#888"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={handleNameSubmit}
            >
              <Text style={styles.confirmButtonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDOBModal}
        transparent={true}
        animationType="none"
        onRequestClose={() => {}}
      >
        <View
          style={[
            styles.modalOverlay,
            Platform.OS === "ios" && styles.modalOverlayIOS,
          ]}
        >
          <Animated.View
            style={[
              styles.modalDOBContainer,
              { transform: [{ scale: scaleValue }] },
            ]}
          >
            <Text style={styles.modalTitle}>We Need Your Date of Birth</Text>
            <Text style={styles.modalSubtitle}>
              Please provide your date of birth to continue.
            </Text>
            <View style={styles.datePickerContainer}>
              {Platform.OS === "ios" ? (
                <>
                  <Text style={styles.dateText}>{formatDate(date)}</Text>
                  <DateTimePicker
                    value={tempDate}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                    textColor="#F0F0F0"
                    accentColor="#147efb"
                    style={styles.datePicker}
                  />
                </>
              ) : (
                <Pressable onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.dateText}>{formatDate(date)}</Text>
                </Pressable>
              )}
            </View>
            <Pressable
              style={styles.confirmButton}
              onPress={handleDOBSubmit}
            >
              <Text style={styles.confirmButtonText}>Submit</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      {Platform.OS === "android" && showDatePicker && (
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="none"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View
            style={[
              styles.modalOverlay,
              Platform.OS === "ios" && styles.modalOverlayIOS,
            ]}
          >
            <Animated.View
              style={[
                styles.modalDOBContainer,
                { transform: [{ scale: scaleValue }] },
              ]}
            >
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={new Date()}
                textColor="#F0F0F0"
                accentColor="#147efb"
                style={styles.datePicker}
              />
            </Animated.View>
          </View>
        </Modal>
      )}

      <ScrollView
        style={styles.homescreen}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>
          Services of Week{"\n"}
          {currentWeek}
        </Text>

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

        {isDeacon && (
          <View style={styles.nextServiceBox}>
            <Text style={styles.nextServiceHeader}>Next Service Week</Text>
            <Text style={styles.nextServiceText}>
              Your next service is on: {nextWeek}
            </Text>
            <TouchableOpacity
              style={styles.unavailableButton}
              onPress={handleUnavailableToServe}
            >
              <Text style={styles.requestButtonText}>Unavailable</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      <View style={styles.blackspace} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  scrollContainer: {
    paddingBottom: 20,
  },
  homescreen: {
    flex: 1,
    width: "100%",
  },
  header: {
    fontSize: 28,
    color: "#e0e0e0",
    textAlign: "center",
    marginVertical: 20,
    fontWeight: "bold",
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
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
  icon: {
    marginRight: 10,
  },
  name: {
    fontSize: 18,
    color: "#e0e0e0",
  },
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
  blackspace: {
    height: 0,
    backgroundColor: "#1a1a1a",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlayIOS: {
    justifyContent: "center",
  },
  modalContainer: {
    backgroundColor: "#1e1e1e",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    alignItems: "center",
    position: "relative",
  },
  modalDOBContainer: {
    backgroundColor: "#252525",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#333",
    position: "relative",
  },
  modalTitle: {
    fontSize: 24,
    color: "#e0e0e0",
    fontWeight: "bold",
    marginBottom: 10,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  modalSubtitle: {
    fontSize: 16,
    color: "#e0e0e0",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  input: {
    width: "100%",
    backgroundColor: "#3c3c3c",
    color: "#e0e0e0",
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
    fontSize: 16,
  },
  datePickerContainer: {
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  dateText: {
    fontSize: 18,
    color: "#F0F0F0",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    textAlign: "center",
    marginBottom: 10,
  },
  datePicker: {
    width: "100%",
  },
  confirmButton: {
    backgroundColor: "#147efb",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginTop: 10,
  },
  confirmButtonText: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "bold",
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
});

export default HomeScreen;