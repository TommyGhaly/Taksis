import React, { useState, useEffect, useRef } from "react";
import {
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
  AppState,
  StyleSheet
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import messaging from "@react-native-firebase/messaging";
import auth from "@react-native-firebase/auth";
import { deleteUser } from "@react-native-firebase/auth";
import { callFunction, callDeleteUser, unavailableToServe } from "../../components/functionCalls";
import DateTimePicker from "@react-native-community/datetimepicker";
import { check, request, PERMISSIONS, RESULTS } from "react-native-permissions";
import HomeScreenNames from "../../components/homescreenNames";

const firebaseConfig = {
  projectId: "taksis-a8ba7",
  apiKey: "AIzaSyBWxEgHXcJx19Rklr7P6HhhweT9_I70WkA",
  authDomain: "taksis-a8ba7.firebaseapp.com",
};

if (!getApps().length) {
  initializeApp(firebaseConfig);
}

async function createNotificationChannel() {
  if (Platform.OS === "android") {
    try {
      await messaging().registerDeviceForRemoteMessages();
      console.log("Device registered for remote messages");
    } catch (error) {
      console.error("Failed to register device for notifications:", error);
    }
  }
}

async function getFCMToken() {
  try {
    const fcmToken = await messaging().getToken();
    return fcmToken || null;
  } catch (error) {
    console.error("Failed to get FCM token:", error);
    return null;
  }
}

async function storeFCMToken(userId, fcmToken) {
  try {
    const userRef = firestore().collection("users").doc(userId);
    await userRef.update({
      fcmTokens: firestore.FieldValue.arrayUnion(fcmToken),
    });
    console.log("FCM token added to array successfully");
  } catch (error) {
    console.error("Failed to add FCM token:", error);
  }
}

async function requestUserPermissionAndroid() {
  try {
    // Only attempt POST_NOTIFICATIONS check on Android 13 (API 33) or higher
    if (Platform.OS === "android" && Platform.Version >= 33) {
      // Verify that POST_NOTIFICATIONS is defined
      if (!PERMISSIONS.ANDROID.POST_NOTIFICATIONS) {
        console.warn("POST_NOTIFICATIONS permission is not supported in this version of react-native-permissions");
        return false;
      }
      const permissionStatus = await check(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
      console.log("Permission Status:", permissionStatus);
      if (permissionStatus !== RESULTS.GRANTED) {
        const result = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
        console.log("Permission Request Result:", result);
        if (result !== RESULTS.GRANTED) {
          console.log("Notification permission denied");
          return false;
        }
      }
    } else {
      console.log("Skipping POST_NOTIFICATIONS check for Android version < 33");
    }
    const authStatus = await messaging().requestPermission();
    const authorized = authStatus === messaging.AuthorizationStatus.AUTHORIZED;
    console.log("FCM Authorization Status:", authStatus);
    return authorized;
  } catch (error) {
    console.error("Failed to request Android permission:", error);
    return false;
  }
}

async function requestUserPermissionIOS() {
  try {
    const authStatus = await messaging().requestPermission({
      alert: true,
      badge: true,
      sound: true,
    });
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  } catch (error) {
    console.error("Failed to request iOS permission:", error);
    return false;
  }
}

async function checkNotificationPermission() {
  try {
    await createNotificationChannel();
    const authStatus = await messaging().hasPermission();
    const isAuthorized =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (isAuthorized) {
      console.log("Notifications already authorized");
      const fcmToken = await getFCMToken();
      if (fcmToken && auth().currentUser) {
        await storeFCMToken(auth().currentUser.uid, fcmToken);
      }
    } else {
      const granted = await (Platform.OS === "android"
        ? requestUserPermissionAndroid()
        : requestUserPermissionIOS());
      if (granted) {
        console.log("Notification permission granted");
        const fcmToken = await getFCMToken();
        if (fcmToken && auth().currentUser) {
          await storeFCMToken(auth().currentUser.uid, fcmToken);
        }
      } else {
        console.log("Notification permission not granted");
        Alert.alert(
          "Notifications Required",
          "Please enable notifications in your device settings to receive important updates.",
          [{ text: "OK", style: "cancel" }]
        );
      }
    }
  } catch (error) {
    console.error("Error handling notifications:", error);
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
  const [currentWeek, setCurrentWeek] = useState(null);
  const [nextWeek, setNextWeek] = useState(null);
  const [nextRole, setNextRole] = useState("N/A");
  const [isDeacon, setIsDeacon] = useState(false);
  const [churchId, setChurchId] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showDOBModal, setShowDOBModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneModalShownThisSession, setPhoneModalShownThisSession] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [userName, setUserName] = useState(null);
  const [date, setDate] = useState(new Date());
  const [tempDate, setTempDate] = useState(date);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedWeeks, setSelectedWeeks] = useState([]);
  const [unavailableWeeks, setUnavailableWeeks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showWeekModal, setShowWeekModal] = useState(false);
  const scaleValue = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    setIsDeacon(true);
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      Alert.alert(
        remoteMessage?.notification?.title || "Notification",
        remoteMessage?.notification?.body || "You have a new message."
      );
    });

    setPhoneModalShownThisSession(false);

    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === "active" && auth().currentUser) {
        checkNotificationPermission();
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    if (auth().currentUser) {
      checkNotificationPermission();
    }

    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, []);

  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log("Background message received:", remoteMessage);
  });

  const formatDate = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const year = String(d.getFullYear()).slice(-2);
    return `${month}-${day}-${year}`;
  };

  const getNextFiveWeeks = () => {
    const weeks = [];
    if (!currentWeek) {
      return weeks;
    }

    const [month, day, year] = currentWeek.split("-").map(Number);
    const baseDate = new Date(2000 + year, month - 1, day);
    baseDate.setHours(0, 0, 0, 0);

    const dayOfWeek = baseDate.getDay();
    if (dayOfWeek !== 0) {
      baseDate.setDate(baseDate.getDate() + (7 - dayOfWeek));
    }

    for (let i = 0; i < 5; i++) {
      const weekDate = new Date(baseDate);
      weekDate.setDate(baseDate.getDate() + (i * 7));
      weeks.push(formatDate(weekDate));
    }

    return weeks;
  };

  const handleDateChange = (event, selectedDate) => {
    if (!event || event.type === "dismissed") {
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
      if (userData?.children?.length > 0) {
        const church = userData.church || null;
        await Promise.all(
          userData.children.map(async (child) => {
            if (child?.uid) {
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
      setShowPhoneModal(true);
    } catch (error) {
      console.error("Error updating DOB:", error);
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
    if (!user) {
      Alert.alert("Error", "User not authenticated.");
      return;
    }

    try {
      const userRef = firestore().collection("users").doc(user.uid);
      await userRef.update({
        name: fullName,
      });
      await callFunction(user, "https://update-user-hy6oofbihq-uc.a.run.app");
      setUserName(fullName);
      setShowNameModal(false);
      setFirstName("");
      setLastName("");
    } catch (error) {
      console.error("Error updating name:", error);
      Alert.alert("Error", "Failed to update name. Please try again.");
    }
  };

  const handlePhoneSubmit = async () => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneNumber.trim() || !phoneRegex.test(phoneNumber.trim())) {
      Alert.alert("Error", "Please enter a valid phone number (e.g., +1234567890).");
      return;
    }

    const user = auth().currentUser;
    if (!user) {
      Alert.alert("Error", "User not authenticated.");
      return;
    }

    try {
      const userRef = firestore().collection("users").doc(user.uid);
      await userRef.update({
        phone: phoneNumber.trim(),
      });
      setShowPhoneModal(false);
      setPhoneModalShownThisSession(true);
    } catch (error) {
      console.error("Error updating phone number:", error);
      Alert.alert("Error", "Failed to update phone number. Please try again.");
    }
  };

  const handlePhoneModalClose = () => {
    setShowPhoneModal(false);
    setPhoneModalShownThisSession(true);
    Alert.alert(
      "Add Phone Number?",
      "Would you like to add your phone number to be contacted when necessary?",
      [
        {
          text: "No",
          style: "cancel",
        },
        {
          text: "Yes",
          onPress: () => setShowPhoneModal(true),
        },
      ]
    );
  };

  const handleUnavailableToServe = async () => {
    const user = auth().currentUser;
    if (!user) {
      Alert.alert("Error", "User not authenticated.");
      return;
    }
    setShowWeekModal(true);
  };

  const handleWeekSelection = async (week) => {
    if (unavailableWeeks.includes(week)) {
      Alert.alert("Cannot Undo", "This week is already marked as unavailable and cannot be changed.");
      return;
    }

    setSelectedWeeks((prev) => {
      if (prev.includes(week)) {
        return prev.filter((w) => w !== week);
      }
      return [...prev, week];
    });
  };

  const confirmWeekSelection = async () => {
    if (selectedWeeks.length === 0) {
      Alert.alert("Error", "Please select at least one week.");
      return;
    }

    Alert.alert(
      "Confirm Unavailability",
      "This action cannot be undone. You and your children will be marked as unavailable for the selected weeks.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: async () => {
            const user = auth().currentUser;
            if (!user) {
              Alert.alert("Error", "User not authenticated.");
              return;
            }

            setIsLoading(true);
            try {
              const userDoc = await firestore()
                .collection("users")
                .doc(user.uid)
                .get();

              if (!userDoc.exists) {
                Alert.alert("Error", "User data not found.");
                return;
              }

              const userData = userDoc.data();
              const churchIdFromData = userData?.church;

              await firestore()
                .collection("users")
                .doc(user.uid)
                .update({
                  unavailableWeeks: firestore.FieldValue.arrayUnion(...selectedWeeks),
                });

              setUnavailableWeeks((prev) => [...prev, ...selectedWeeks]);

              for (const week of selectedWeeks) {
                await unavailableToServe(
                  user,
                  user.uid,
                  churchIdFromData,
                  week,
                  true,
                  "https://unavailable-for-week-hy6oofbihq-uc.a.run.app"
                );
              }

              Alert.alert("Request Sent", `You have been marked as unavailable for the selected weeks.`);
              setSelectedWeeks([]);
              setShowWeekModal(false);
            } catch (error) {
              console.error("Error marking weeks as unavailable:", error);
              Alert.alert("Error", "Failed to mark as unavailable. Please try again.");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      return;
    }

    const userRef = firestore().collection("users").doc(user.uid);

    const unsubscribe = userRef.onSnapshot(
      (doc) => {
        try {
          if (doc.exists) {
            const userData = doc.data();
            const name = userData?.name || null;
            setUserName(name);
            const isNameInvalid =
              !name ||
              name === "null null" ||
              name.trim() === "" ||
              !name.includes(" ");
            const isDOBInvalid = !userData?.DOB || userData.DOB.trim() === "";
            const isPhoneInvalid = !userData?.phone || userData.phone.trim() === "";
            setShowNameModal(isNameInvalid);
            setShowDOBModal(!isNameInvalid && isDOBInvalid);
            setShowPhoneModal(!isNameInvalid && !isDOBInvalid && isPhoneInvalid && !phoneModalShownThisSession);
          } else {
            Alert.alert("Sign up to continue", "Please sign up using this account to continue.");
            deleteUser(user).catch((error) => console.error("Error deleting user:", error));
          }
        } catch (error) {
          console.error("Error processing user document:", error);
        }
      },
      (error) => {
        console.error("Error in user document listener:", error);
      }
    );

    return () => unsubscribe();
  }, [phoneModalShownThisSession]);

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
          try {
            const userData = doc.data();
            if (userData) {
              setIsDeacon(userData.isDeacon || false);
              setNextWeek(userData.nextWeekServe || null);
              setNextRole(userData.nextRole || "N/A");
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
          } catch (error) {
            console.error("Error processing user data:", error);
          }
        },
        (error) => {
          console.error("Error in user document listener:", error);
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

    const unsubscribeSchedules = schedulesRef.onSnapshot((snapshot) => {
      try {
        if (!snapshot || snapshot.empty) {
          setSchedule({
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
          return;
        }

        let closestSchedule = null;
        let closestDate = null;
        let chosenDocId = "";
        const today = new Date().setHours(0, 0, 0, 0);

        const churchRef = firestore().collection("churches").doc(churchId);
        const unsubscribeChurch = churchRef.onSnapshot(
          (churchDoc) => {
            try {
              if (!churchDoc.exists) {
                console.warn("Church document does not exist for churchId:", churchId);
                return;
              }

              const fullDeacon = churchDoc.data()?.fullDeacon || false;

              snapshot.docs.forEach((doc) => {
                const scheduleData = doc.data();
                const scheduleDateStr = doc.id.split("-").slice(-3).join("-");
                const [month, day, year] = scheduleDateStr.split("-").map(Number);
                const scheduleDate = new Date(2000 + year, month - 1, day).setHours(0, 0, 0, 0);

                if (!closestDate || Math.abs(scheduleDate - today) < Math.abs(closestDate - today)) {
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
                if (!fullDeacon && updatedSchedule.wine &&  typeof updatedSchedule.wine === "object") {
                  altarServers.push(updatedSchedule.wine);
                }

                altarServers.push(
                  ...(updatedSchedule.altar || []).filter((server) => server && typeof server === "object")
                );
                updatedSchedule.altar = altarServers;
                setSchedule(updatedSchedule);
              }
            } catch (error) {
              console.error("Error processing church document:", error);
            }
          },
          (error) => {
            console.error("Error in church document listener:", error);
          }
        );

        return () => {
          unsubscribeChurch();
        };
      } catch (error) {
        console.error("Error loading schedules:", error);
      }
    }, (error) => {
      console.error("Error in schedules listener:", error);
    });

    return () => unsubscribeSchedules();
  }, [churchId]);

  useEffect(() => {
    if (showDOBModal || showPhoneModal) {
      try {
        Animated.spring(scaleValue, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();
      } catch (error) {
        console.error("Animation error:", error);
      }
    } else {
      scaleValue.setValue(0.9);
    }
  }, [showDOBModal, showPhoneModal]);

  const readings = [
    { role: "Matins Gospel", user: schedule.matins || { name: "N/A" } },
    { role: "Third Hour Gospel", user: schedule.third || { name: "N/A" } },
    { role: "Sixth Hour Gospel", user: schedule.sixth || { name: "N/A" } },
    { role: "Pauline Epistle", user: schedule.pauline || { name: "N/A" } },
    { role: "Catholic Epistle", user: schedule.catholic || { name: "N/A" } },
    { role: "Praxis", user: schedule.praxis || { name: "N/A" } },
    { role: "Gospel", user: schedule.gospel || { name: "N/A" } },
  ];

  const offerings = [
    { role: "Water", user: schedule.water || { name: "N/A" } },
    { role: "Wine", user: schedule.wine || { name: "N/A" } },
  ];

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
            <TouchableOpacity style={styles.submitButton} onPress={handleNameSubmit}>
              <Text style={styles.buttonText}>Submit</Text>
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
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[styles.modalDOBContainer, { transform: [{ scale: scaleValue }] }]}
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
                    {...(Platform.OS === "ios" ? { textColor: "#F0F0F0" } : {})}
                    accentColor="#147ffb"
                    style={styles.datePicker}
                  />
                </>
              ) : (
                <Pressable onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.dateText}>{formatDate(date)}</Text>
                </Pressable>
              )}
            </View>
            <Pressable style={styles.submitButton} onPress={handleDOBSubmit}>
              <Text style={styles.buttonText}>Submit</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={showPhoneModal}
        transparent={true}
        animationType="none"
        onRequestClose={handlePhoneModalClose}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[styles.modalDOBContainer, { transform: [{ scale: scaleValue }] }]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>We Need Your Phone Number</Text>
              <TouchableOpacity onPress={handlePhoneModalClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Please provide your phone number to continue (e.g., +1234567890).
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              placeholderTextColor="#888"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoFocus={true}
            />
            <Pressable style={styles.submitButton} onPress={handlePhoneSubmit}>
              <Text style={styles.buttonText}>Submit</Text>
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
          <View style={styles.modalOverlay}>
            <Animated.View
              style={[styles.modalDOBContainer, { transform: [{ scale: scaleValue }] }]}
            >
              {(() => {
                try {
                  return (
                    <DateTimePicker
                      value={tempDate}
                      mode="date"
                      display="spinner"
                      onChange={handleDateChange}
                      maximumDate={new Date()}
                      accentColor="#147ffb"
                    />
                  );
                } catch (error) {
                  console.error("DateTimePicker error:", error);
                  return <Text>Error rendering date picker</Text>;
                }
              })()}
            </Animated.View>
          </View>
        </Modal>
      )}

      <Modal
        animationType="none"
        transparent={true}
        visible={showWeekModal}
        onRequestClose={() => setShowWeekModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select Unavailable Weeks</Text>
            <Text style={styles.modalSubtitle}>
              This action cannot be undone.
            </Text>
            {getNextFiveWeeks().map((week, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.weekButton,
                  (selectedWeeks.includes(week) || unavailableWeeks.includes(week)) && styles.weekButtonSelected,
                ]}
                onPress={() => handleWeekSelection(week)}
                disabled={unavailableWeeks.includes(week)}
              >
                <Text style={styles.weekButtonText}>Week of {week}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.submitButton, styles.cancelButton]}
                onPress={() => {
                  setShowWeekModal(false);
                  setSelectedWeeks([]);
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, isLoading && { opacity: 0.6 }]}
                onPress={confirmWeekSelection}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>{isLoading ? "Processing..." : "Confirm"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.homescreen}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>
          Services of Week{"\n"}
          {currentWeek || "N/A"}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Readings</Text>
          {readings.map((item, index) => (
            <HomeScreenNames key={index} role={item.role} user={item.user} />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Offering of the Lamb</Text>
          {offerings.map((item, index) => (
            <HomeScreenNames key={index} role={item.role} user={item.user} />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Altar Servers</Text>
          {(schedule?.altar || []).map((user, index) => (
            <HomeScreenNames key={index} role="Altar" user={user} />
          ))}
        </View>

        {isDeacon && (
          <View style={styles.nextServiceBox}>
            <Text style={styles.nextServiceWeek}>Next Service Week</Text>
            <Text style={styles.nextServiceText}>
              Your next service is on: {nextWeek || "N/A"}
            </Text>
            <Text style={styles.nextRoleText}>{nextRole}</Text>
            <TouchableOpacity style={styles.unavailableButton} onPress={handleUnavailableToServe}>
              <Text style={styles.requestButtonText}>Select Unavailable Weeks</Text>
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
  nextServiceWeek: {
    fontSize: 20,
    color: "#4d9cff",
    textAlign: "center",
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
  nextServiceText: {
    fontSize: 16,
    color: "#e0e0e0",
    textAlign: "center",
    marginBottom: 5,
  },
  nextRoleText: {
    fontSize: 18,
    color: "#e0e0e0",
    textAlign: "center",
    fontWeight: "bold",
    marginBottom: 10,
  },
  unavailableButton: {
    backgroundColor: "#ff3b30",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginVertical: 10,
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
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
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "bold",
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
    backgroundColor: "#333333",
    color: "#e0e0e0",
    borderColor: "#555",
    padding: 10,
    borderRadius: 10,
    marginVertical: 10,
    fontSize: 18,
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
    fontSize: 16,
    color: "#F0FFF0",
    marginBottom: 10,
    textAlign: Platform.OS === "ios" ? "center" : "center",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  datePicker: {
    width: "100%",
  },
  submitButton: {
    backgroundColor: "#2196F3",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 10,
  },
  closeButton: {
    padding: 5,
  },
  buttonText: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "bold",
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  weekButton: {
    backgroundColor: "#2c2c2c",
    paddingVertical: 12,
    borderRadius: 5,
    marginVertical: 5,
    width: "100%",
    alignItems: "center",
  },
  weekButtonSelected: {
    backgroundColor: "#ff3b30",
  },
  weekButtonText: {
    fontSize: 16,
    color: "#e0e0e0",
    fontWeight: "500",
    marginBottom: 5,
  },
  cancelButton: {
    backgroundColor: "#555",
    width: "40%",
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 20,
  },
});

export default HomeScreen;