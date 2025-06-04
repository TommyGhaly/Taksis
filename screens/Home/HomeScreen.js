import React, { useState, useEffect, useRef } from "react";
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
import firestore, { Timestamp } from "@react-native-firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import messaging from "@react-native-firebase/messaging";
import auth from "@react-native-firebase/auth";
import { deleteUser } from "@react-native-firebase/auth";
import { callFunction, callDeleteUser, unavailableToServe } from "../../components/functionCalls";
import DateTimePicker from "@react-native-community/datetimepicker";
import { check, request, PERMISSIONS, RESULTS } from "react-native-permissions";
import * as ImagePicker from "expo-image-picker";
import { Camera, Constants } from "expo-camera";
import * as FileSystem from "expo-file-system";

// Firebase configuration
const firebaseConfig = {
  projectId: "taksis-a8ba7",
  apiKey: "AIzaSyBWxEgHXcJx19Rklr7P6HhhweT9_I70WkA",
  authDomain: "taksis-a8ba7.firebaseapp.com",
};

// Initialize Firebase only if not already initialized
if (!getApps().length) {
  initializeApp(firebaseConfig);
}

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
          importance: 4,
          soundName: "default",
          enableVibration: true,
        });
      }
    } catch (error) {
      Alert.alert("Error", "Failed to create notification channel.");
    }
  }
}

// Request notification permissions for Android
async function requestUserPermissionAndroid() {
  try {
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
    Alert.alert("Error", "Failed to get FCM token.");
  }
  return null;
}

// Check notification permissions
async function checkNotificationPermission() {
  try {
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
    Alert.alert("Error", "Failed to check notification permission.");
  }
}

const HomeScreen = () => {
  // State initialization
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
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showWeekModal, setShowWeekModal] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [userName, setUserName] = useState(null);
  const [date, setDate] = useState(new Date());
  const [tempDate, setTempDate] = useState(date);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedWeeks, setSelectedWeeks] = useState([]);
  const [unavailableWeeks, setUnavailableWeeks] = useState([]);
  const scaleValue = useRef(new Animated.Value(0.9)).current;
  const cameraRef = useRef(null);

  // Handle foreground notifications
  useEffect(() => {
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      Alert.alert(
        remoteMessage?.notification?.title || "Notification",
        remoteMessage?.notification?.body || "You have a new message."
      );
    });

    return unsubscribe;
  }, []);

  // Handle background notifications
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {});

  // Date formatting utility
  const formatDate = (date) => {
    if (!date) return "N/A";
    return `${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}-${date.getFullYear()}`;
  };

  // Get the next five weeks based on current week
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

  // Handle date picker change
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

  // Handle date of birth submission
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
      Alert.alert("Error", "Failed to update date of birth. Please try again.");
    }
  };

  // Handle name submission
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
        await callFunction(user, "https://update-user-hy6oofbihq-uc.a.run.app");
        setUserName(fullName);
        setShowNameModal(false);
        setFirstName("");
        setLastName("");
      } catch (error) {
        Alert.alert("Error", "Failed to update name. Please try again.");
      }
    }
  };

  // Handle phone number submission
  const handlePhoneSubmit = async () => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneNumber.trim() || !phoneRegex.test(phoneNumber.trim())) {
      Alert.alert("Error", "Please enter a valid phone number (e.g., +1234567890).");
      return;
    }

    const user = auth().currentUser;
    if (user) {
      try {
        const userRef = firestore().collection("users").doc(user.uid);
        await userRef.update({
          phone: phoneNumber.trim(),
        });
        await callFunction(user, "https://update-user-hy6oofbihq-uc.a.run.app");
        setShowPhoneModal(false);
        setShowPhotoModal(true);
      } catch (error) {
        Alert.alert("Error", "Failed to update phone number. Please try again.");
      }
    }
  };

  // Request camera permission
  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Error", "Camera permission is required to take a photo.");
      return false;
    }
    return true;
  };

  // Request gallery permission
  const requestGalleryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Error", "Gallery permission is required to select a photo.");
      return false;
    }
    return true;
  };

  // Handle taking a photo
  const handleTakePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;
    setShowCamera(true);
  };

  // Capture photo from camera
  const handleCapturePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
        if (photo?.uri) {
          await uploadPhoto(photo.uri);
          setShowCamera(false);
        }
      } catch (error) {
        Alert.alert("Error", "Failed to capture photo. Please try again.");
      }
    }
  };

  // Handle selecting a photo from gallery
  const handleSelectPhoto = async () => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  // Upload photo to Firestore
  const uploadPhoto = async (uri) => {
    const user = auth().currentUser;
    if (!user) {
      Alert.alert("Error", "User not authenticated.");
      return;
    }

    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const photoUrl = `data:image/jpeg;base64,${base64}`;

      const pictureRef = firestore().collection("pictures").doc();
      await pictureRef.set({
        userId: user.uid,
        photoUrl,
        createdAt: Timestamp.fromDate(new Date()),
      });

      const userRef = firestore().collection("users").doc(user.uid);
      await userRef.update({
        photoUrl,
        pictureId: pictureRef.id,
      });

      await callFunction(user, "https://update-user-hy6oofbihq-uc.a.run.app");
      setShowPhotoModal(false);
    } catch (error) {
      Alert.alert("Error", "Failed to save photo. Please try again.");
    }
  };

  // Handle unavailable to serve selection
  const handleUnavailableToServe = async () => {
    const user = auth().currentUser;
    if (!user) return;

    setShowWeekModal(true);
  };

  // Handle week selection for unavailability
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

  // Confirm unavailable weeks
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
              return;
            }

            try {
              const userDoc = await firestore()
                .collection("users")
                .doc(user.uid)
                .get();

              if (!userDoc.exists) {
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
                  churchIdFromData,
                  week,
                  true,
                  "https://unavailable-for-week-hy6oofbihq-uc.a.run.app"
                );
              }

              Alert.alert("Request Sent", `You have been marked as unavailable for the selected weeks.`);
              setShowWeekModal(false);
              setSelectedWeeks([]);
            } catch (error) {
              Alert.alert("Error", "Failed to mark as unavailable. Please try again.");
            }
          },
        },
      ]
    );
  };

  // Check notification permissions on mount
  useEffect(() => {
    checkNotificationPermission();
  }, []);

  // Listen for user document updates
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
          const name = userData?.name || null;
          setUserName(name);
          const isNameInvalid =
            !name ||
            name === "null null" ||
            name.trim() === "" ||
            !name.includes(" ");
          const isDOBInvalid = !userData?.DOB || userData.DOB.trim() === "";
          const isPhoneInvalid = !userData?.phone || userData.phone.trim() === "";
          const isPhotoInvalid = !userData?.photoUrl || userData.photoUrl.trim() === "";
          setShowNameModal(isNameInvalid);
          setShowDOBModal(!isNameInvalid && isDOBInvalid);
          setShowPhoneModal(!isNameInvalid && !isDOBInvalid && isPhoneInvalid);
          setShowPhotoModal(!isNameInvalid && !isDOBInvalid && !isPhoneInvalid && isPhotoInvalid);
          setUnavailableWeeks(userData?.unavailableWeeks || []);
        } else {
          Alert.alert("Sign up to continue", "Please sign up using this account to continue.");
          deleteUser(user).catch(() => {});
        }
      },
      (error) => {
        console.error("Error in user document listener:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Listen for user role and church updates
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
        },
        (error) => {
          console.error("Error in user document listener:", error);
        }
      );
    return () => unsubscribeUser();
  }, [churchId]);

  // Listen for schedule updates
  useEffect(() => {
    if (!churchId) {
      return;
    }

    const schedulesRef = firestore()
      .collection("churches")
      .doc(churchId)
      .collection("schedule");

    const unsubscribeSchedules = schedulesRef.onSnapshot((snapshot) => {
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
            if (!fullDeacon && updatedSchedule.wine && typeof updatedSchedule.wine === "object") {
              altarServers.push(updatedSchedule.wine);
            }

            altarServers.push(
              ...(updatedSchedule.altar || []).filter((server) => server && typeof server === "object")
            );
            updatedSchedule.altar = altarServers;
            setSchedule(updatedSchedule);
          }
        },
        (error) => {
          console.error("Error in church document listener:", error);
        }
      );

      return () => {
        unsubscribeChurch();
      };
    }, (error) => {
      console.error("Error loading schedules: ", error);
    });

    return () => unsubscribeSchedules();
  }, [churchId]);

  // Animate modal scale
  useEffect(() => {
    if (showDOBModal || showPhoneModal || showPhotoModal) {
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      scaleValue.setValue(0.9);
    }
  }, [showDOBModal, showPhoneModal, showPhotoModal]);

  // Render the component
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
                    textColor="#F0F0F0"
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
        onRequestClose={() => {
          Alert.alert("Required", "You must provide a valid phone number to continue.");
        }}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[styles.modalDOBContainer, { transform: [{ scale: scaleValue }] }]}
          >
            <Text style={styles.modalTitle}>We Need Your Phone Number</Text>
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

      <Modal
        visible={showPhotoModal}
        transparent={true}
        animationType="none"
        onRequestClose={() => {
          Alert.alert("Required", "You must provide a photo to continue.");
        }}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[styles.modalDOBContainer, { transform: [{ scale: scaleValue }] }]}
          >
            <Text style={styles.modalTitle}>We Need Your Photo</Text>
            <Text style={styles.modalSubtitle}>
              Please take a photo or select one from your gallery.
            </Text>
            <View style={styles.photoButtonContainer}>
              <Pressable style={styles.photoButton} onPress={handleTakePhoto}>
                <Ionicons name="camera" size={24} color="#ffffff" />
              </Pressable>
              <Pressable style={styles.photoButton} onPress={handleSelectPhoto}>
                <Ionicons name="image" size={24} color="#ffffff" />
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={showCamera} transparent={true} animationType="slide">
        <View style={styles.cameraContainer}>
          <Camera
            style={styles.camera}
            ref={cameraRef}
          >
            <View style={styles.cameraOverlay}>
              <View style={styles.faceOutline} />
            </View>
            <View style={styles.cameraControls}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setShowCamera(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.submitButton} onPress={handleCapturePhoto}>
                <Text style={styles.buttonText}>Capture</Text>
              </Pressable>
            </View>
          </Camera>
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
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={new Date()}
                textColor="#F0F0F0"
                accentColor="#147ffb"
              />
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
              <TouchableOpacity style={styles.submitButton} onPress={confirmWeekSelection}>
                <Text style={styles.buttonText}>Confirm</Text>
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
          {[
            { title: "Matins Gospel", value: schedule?.matins?.name || "N/A" },
            { title: "Third Hour Gospel", value: schedule?.third?.name || "N/A" },
            { title: "Sixth Hour Gospel", value: schedule?.sixth?.name || "N/A" },
            { title: "Pauline Epistle", value: schedule?.pauline?.name || "N/A" },
            { title: "Catholic Epistle", value: schedule?.catholic?.name || "N/A" },
            { title: "Praxis", value: schedule?.praxis?.name || "N/A" },
            { title: "Gospel", value: schedule?.gospel?.name || "N/A" },
          ].map((item, index) => (
            <View key={index} style={styles.card}>
              <Ionicons name="book" size={24} color="#fff" style={styles.icon} />
              <Text style={styles.name}>
                {item.title}: {item.value}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Offering of the Lamb</Text>
          {[
            { title: "Water", value: schedule?.water?.name || "N/A" },
            { title: "Wine", value: schedule?.wine?.name || "N/A" },
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
          {(schedule?.altar || []).map((server, index) => (
            <View key={index} style={styles.card}>
              <Ionicons name="people" size={24} color="#fff" style={styles.icon} />
              <Text style={styles.name}>Altar: {server?.name || "Unknown"}</Text>
            </View>
          ))}
        </View>

        {isDeacon && (
          <View style={styles.nextServiceBox}>
            <Text style={styles.sectionTitle}>Next Service Week</Text>
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

// Styles for the component
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
  modalTitle: {
    fontSize: 20,
    color: "#fff",
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
  buttonText: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "bold",
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  photoButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  photoButton: {
    backgroundColor: "#2196F3",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
    justifyContent: "flex-end",
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  faceOutline: {
    width: 200,
    height: 280,
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 140,
    backgroundColor: "transparent",
  },
  cameraControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  cancelButton: {
    backgroundColor: "#666",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
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
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 20,
  },
});

export default HomeScreen;