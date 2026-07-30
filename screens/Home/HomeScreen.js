import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Platform,
  SafeAreaView,
  Animated,
  AppState,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import firestore, { FieldValue } from "@react-native-firebase/firestore";
import messaging from "@react-native-firebase/messaging";
import auth from "@react-native-firebase/auth";
import { deleteUser } from "@react-native-firebase/auth";
import storage from "@react-native-firebase/storage";
import { check, request, PERMISSIONS, RESULTS } from "react-native-permissions";
import { callFunction } from "../../components/functionCalls";
import HomeScreenNames from "../../components/homescreenNames";
import PhotoInput from "../../components/photoInput";
import ChurchSelectionModal from "../../components/ChurchSelectionModal";
import NameModal from "../../components/NameModal";
import DOBModal from "../../components/DOBModal";
import PhoneModal from "../../components/PhoneModal";
import WeekSelectionModal from "../../components/WeekSelectionModal";
import ProfilePictureModal from "../../components/ProfilePictureModal";
import ChildrenProfilePictureModal from "../../components/ChildrenProfilePictureModal";
import AvailabilityModal from "../../components/AvailabilityModal";
import SkeletonScreen from "../../components/Skeleton";

// Import caching system
import {
  useFirestoreDocument,
  useFirestoreCollection,
} from "../../hooks/useFirebaseCache";
import { FirestoreCache } from "../../utils/cacheManager";

async function createNotificationChannel() {
  if (Platform.OS === "android") {
    try {
      await messaging().registerDeviceForRemoteMessages();
    } catch (error) {
      // Error handling for device registration
    }
  }
}

async function getFCMToken() {
  try {
    const fcmToken = await messaging().getToken();
    return fcmToken || null;
  } catch (error) {
    return null;
  }
}

async function storeFCMToken(userId, fcmToken) {
  try {
    // Update Firestore directly for FCM tokens (real-time requirement)
    const userRef = firestore().collection("users").doc(userId);
    await userRef.update({
      fcmTokens: FieldValue.arrayUnion(fcmToken),
    });

    // Optionally refresh user cache to include new token
    // Note: FCM tokens are typically not displayed in UI, so cache refresh may not be needed
  } catch (error) {
    // Error handling for FCM token storage
  }
}

async function requestUserPermissionAndroid() {
  try {
    if (Platform.OS === "android" && Platform.Version >= 33) {
      if (!PERMISSIONS.ANDROID.POST_NOTIFICATIONS) {
        return false;
      }
      const permissionStatus = await check(
        PERMISSIONS.ANDROID.POST_NOTIFICATIONS
      );
      if (permissionStatus !== RESULTS.GRANTED) {
        const result = await request(PERMISSIONS.ANDROID.POST_NOTIFICATIONS);
        if (result !== RESULTS.GRANTED) {
          return false;
        }
      }
    }
    const authStatus = await messaging().requestPermission();
    const authorized = authStatus === messaging.AuthorizationStatus.AUTHORIZED;
    return authorized;
  } catch (error) {
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
      const fcmToken = await getFCMToken();
      if (fcmToken && auth().currentUser) {
        await storeFCMToken(auth().currentUser.uid, fcmToken);
      }
    } else {
      const granted = await (Platform.OS === "android"
        ? requestUserPermissionAndroid()
        : requestUserPermissionIOS());
      if (granted) {
        const fcmToken = await getFCMToken();
        if (fcmToken && auth().currentUser) {
          await storeFCMToken(auth().currentUser.uid, fcmToken);
        }
      } else {
        Alert.alert(
          "Notifications Required",
          "Please enable notifications in your device settings to receive important updates.",
          [{ text: "OK", style: "cancel" }]
        );
      }
    }
  } catch (error) {
    // Error handling for notification permissions
  }
}

// Stable identity for unassigned slots — a fresh literal here would defeat the
// memoization of readings/offerings below.
const NO_ONE = { name: "N/A" };

const HomeScreen = () => {
  const user = auth().currentUser;

  // Use cached Firebase hooks for user data
  const {
    data: userDoc,
    loading: userLoading,
    error: userError,
    refresh: refreshUser,
    updateDocument: updateUserDoc,
  } = useFirestoreDocument("users", user?.uid);

  // Use cached hook for church data when churchId is available
  const {
    data: churchDoc,
    loading: churchLoading,
    refresh: refreshChurch,
  } = useFirestoreDocument("churches", userDoc?.church);

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
  // `schedule` starts as all-"N/A", which is indistinguishable from a real
  // empty schedule — so we need an explicit flag to know the read finished.
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(null);
  const [nextWeek, setNextWeek] = useState(null);
  const [nextRole, setNextRole] = useState("N/A");
  const [isDeacon, setIsDeacon] = useState(false);
  const [isSSTeacher, setIsSSTeacher] = useState(false);
  const [churchId, setChurchId] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showDOBModal, setShowDOBModal] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneModalShownThisSession, setPhoneModalShownThisSession] =
    useState(false);
  const [showProfilePicModal, setShowProfilePicModal] = useState(false);
  const [showChildrenProfilePicModal, setShowChildrenProfilePicModal] =
    useState(false);
  const [childrenWithoutPfp, setChildrenWithoutPfp] = useState([]);
  const [showPhotoInputModal, setShowPhotoInputModal] = useState(false);
  const [isSelectingPhoto, setIsSelectingPhoto] = useState(false);
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
  const [showChurchModal, setShowChurchModal] = useState(false);
  const [selectedChurch, setSelectedChurch] = useState(null);
  const [isSubmittingChurch, setIsSubmittingChurch] = useState(false);
  const scaleValue = useRef(new Animated.Value(0.9)).current;
  const [lastServe, setLastServe] = useState(null);
  const [lastRole, setLastRole] = useState(null);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [userCurrentWeekRole, setUserCurrentWeekRole] = useState(null);
  const [userCurrentWeekRoleKey, setUserCurrentWeekRoleKey] = useState(null);
  const [userAvailabilityStatus, setUserAvailabilityStatus] = useState(null);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [availabilityModalStep, setAvailabilityModalStep] = useState('initial'); // 'initial' or 'unavailable-options'

  // Real-time listener for church parameter specifically
  const userRealtimeListenerRef = useRef(null);
  // Holds the nested churches/{id} listener so it can be torn down properly.
  const churchUnsubRef = useRef(null);

  // Derive state from cached data
  const derivedUserName = userDoc?.name || userName;
  const derivedIsDeacon = userDoc?.isDeacon || isDeacon;
  const derivedIsSSTeacher = userDoc?.isSSTeacher || isSSTeacher;

  // Set up real-time listener for church parameter
  useEffect(() => {
    if (!user) return;

    // Set up real-time listener specifically for church parameter
    userRealtimeListenerRef.current = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        (doc) => {
          if (doc.exists) {
            const userData = doc.data();
            const hasChurch = userData?.church && userData.church.trim() !== "";

            console.log(
              "Church realtime check - hasChurch:",
              hasChurch,
              "church value:",
              userData?.church
            );

            // Update church modal visibility based on real-time data
            setShowChurchModal(!hasChurch);

            // If church was just set, update the cached data
            if (hasChurch && showChurchModal) {
              refreshUser();
            }
          }
        },
        (error) => {
          console.error("Error in church realtime listener:", error);
        }
      );

    return () => {
      if (userRealtimeListenerRef.current) {
        userRealtimeListenerRef.current();
      }
    };
  }, [user, showChurchModal, refreshUser]);

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

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    if (auth().currentUser) {
      checkNotificationPermission();
    }

    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, []);

  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    // Background message handling
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
      weekDate.setDate(baseDate.getDate() + i * 7);
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
      Alert.alert("Error", "User not authenticated. Please sign in again.");
      return;
    }

    try {
      const formattedDOB = formatDate(date);

      await updateUserDoc({
        DOB: formattedDOB,
        ssGrades: [],
        alhanGrades: [],
      });

      await callFunction(
        user,
        "https://update-user-hy6oofbihq-uc.a.run.app",
        {},
        "Failed to update user."
      );

      await refreshUser();

      const userData =
        userDoc ||
        (await firestore().collection("users").doc(user.uid).get()).data();
      if (userData?.children?.length > 0) {
        const church = userData.church || null;
        await Promise.all(
          userData.children.map(async (child) => {
            if (child?.uid) {
              await callFunction(
                user,
                "https://delete-child-hy6oofbihq-uc.a.run.app",
                { church, uid: child.uid },
                "Failed to delete child"
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
      console.error("DOB submit error:", error);
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
      Alert.alert("Error", "User not authenticated. Please sign in again.");
      return;
    }

    try {
      await updateUserDoc({ name: fullName });
      await callFunction(
        user,
        "https://update-user-hy6oofbihq-uc.a.run.app",
        {},
        "Failed to update user."
      );
      setUserName(fullName);
      setShowNameModal(false);
      setFirstName("");
      setLastName("");
    } catch (error) {
      console.error("Name submit error:", error);
      Alert.alert("Error", "Failed to update name. Please try again.");
    }
  };

  const handlePhoneSubmit = async () => {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneNumber.trim() || !phoneRegex.test(phoneNumber.trim())) {
      Alert.alert(
        "Error",
        "Please enter a valid phone number (e.g., +1234567890)."
      );
      return;
    }

    const user = auth().currentUser;
    if (!user) {
      Alert.alert("Error", "User not authenticated.");
      return;
    }

    try {
      // Update using cached system for immediate UI updates
      await updateUserDoc({
        phone: phoneNumber.trim(),
      });
      setShowPhoneModal(false);
      setPhoneModalShownThisSession(true);
    } catch (error) {
      Alert.alert("Error", "Failed to update phone number. Please try again.");
    }
  };

  const handleChurchSelection = async (churchTitle) => {
    setSelectedChurch(churchTitle);
  };

  const handleChurchSubmit = async () => {
    if (!selectedChurch) {
      Alert.alert("Error", "Please select a church to continue.");
      return;
    }

    const user = auth().currentUser;
    if (!user) {
      Alert.alert("Error", "User not authenticated. Please sign in again.");
      return;
    }

    setIsSubmittingChurch(true);
    try {
      const churchId = selectedChurch;

      if (!churchId) {
        Alert.alert("Error", "Invalid church selection.");
        return;
      }

      await updateUserDoc({ church: churchId });
      await callFunction(
        user,
        "https://update-user-hy6oofbihq-uc.a.run.app",
        {},
        "Failed to update user."
      );
      await refreshUser();

      setShowChurchModal(false);
    } catch (error) {
      console.error("Church submit error:", error);
      Alert.alert("Error", "Failed to update church. Please try again.");
    } finally {
      setIsSubmittingChurch(false);
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

  const handleAvailabilityResponse = async (status) => {
    if (status === 'unavailable') {
      // Transition to unavailable options step
      setAvailabilityModalStep('unavailable-options');
      return;
    }

    // Handle confirmed or unsure
    setIsSubmittingStatus(true);
    try {
      const user = auth().currentUser;
      if (!user || !churchId || !currentWeek || !userCurrentWeekRoleKey) {
        Alert.alert("Error", "Missing required information.");
        setIsSubmittingStatus(false);
        return;
      }

      const scheduleDocRef = firestore()
        .collection("churches")
        .doc(churchId)
        .collection("schedule")
        .doc(currentWeek);

      // Get current schedule data
      const scheduleDoc = await scheduleDocRef.get();
      if (!scheduleDoc.exists) {
        Alert.alert("Error", "Schedule not found.");
        setIsSubmittingStatus(false);
        return;
      }

      const scheduleData = scheduleDoc.data();

      // Update the status for the specific role
      if (userCurrentWeekRoleKey === 'altar') {
        // Handle altar array
        const altarArray = scheduleData.altar || [];
        const updatedAltar = altarArray.map(server => {
          if (server && server.uid === user.uid) {
            return { ...server, status };
          }
          return server;
        });
        await scheduleDocRef.update({ altar: updatedAltar });
      } else {
        // Handle single role
        const roleData = scheduleData[userCurrentWeekRoleKey];
        if (roleData && roleData.uid === user.uid) {
          await scheduleDocRef.update({
            [userCurrentWeekRoleKey]: { ...roleData, status }
          });
        }
      }

      // Update local state
      setUserAvailabilityStatus(status);
      setShowAvailabilityModal(false);
      setAvailabilityModalStep('initial');

      // Show appropriate message
      if (status === 'confirmed') {
        Alert.alert("Thank you!", "Your availability has been confirmed.");
      } else if (status === 'unsure') {
        Alert.alert(
          "Response Saved",
          "You can change your availability status later. Please confirm as soon as possible - it's urgent to know!",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Error updating availability status:", error);
      Alert.alert("Error", "Failed to update availability. Please try again.");
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const handleRemoveSelfFromRole = async () => {
    setIsSubmittingStatus(true);
    try {
      const user = auth().currentUser;
      if (!user || !churchId || !currentWeek) {
        Alert.alert("Error", "Missing required information.");
        setIsSubmittingStatus(false);
        return;
      }

      await callFunction(
        user,
        "https://unavailable-for-week-hy6oofbihq-uc.a.run.app",
        {
          church: churchId,
          week: currentWeek,
          uid: user.uid,
          family: false,
        },
        "Failed to remove from role. Please try again."
      );

      // Update local state
      setUserCurrentWeekRole(null);
      setUserCurrentWeekRoleKey(null);
      setUserAvailabilityStatus(null);
      setShowAvailabilityModal(false);
      setAvailabilityModalStep('initial');

      Alert.alert(
        "Removed Successfully",
        "You have been removed from this role. An admin will need to assign the next person.",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Error removing from role:", error);
      Alert.alert("Error", "Failed to remove from role. Please try again.");
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const handleKeepButMarkUnavailable = async () => {
    setIsSubmittingStatus(true);
    try {
      const user = auth().currentUser;
      if (!user || !churchId || !currentWeek || !userCurrentWeekRoleKey) {
        Alert.alert("Error", "Missing required information.");
        setIsSubmittingStatus(false);
        return;
      }

      const scheduleDocRef = firestore()
        .collection("churches")
        .doc(churchId)
        .collection("schedule")
        .doc(currentWeek);

      // Get current schedule data
      const scheduleDoc = await scheduleDocRef.get();
      if (!scheduleDoc.exists) {
        Alert.alert("Error", "Schedule not found.");
        setIsSubmittingStatus(false);
        return;
      }

      const scheduleData = scheduleDoc.data();

      // Update the status to unavailable
      if (userCurrentWeekRoleKey === 'altar') {
        // Handle altar array
        const altarArray = scheduleData.altar || [];
        const updatedAltar = altarArray.map(server => {
          if (server && server.uid === user.uid) {
            return { ...server, status: 'unavailable' };
          }
          return server;
        });
        await scheduleDocRef.update({ altar: updatedAltar });
      } else {
        // Handle single role
        const roleData = scheduleData[userCurrentWeekRoleKey];
        if (roleData && roleData.uid === user.uid) {
          await scheduleDocRef.update({
            [userCurrentWeekRoleKey]: { ...roleData, status: 'unavailable' }
          });
        }
      }

      // Update local state
      setUserAvailabilityStatus('unavailable');
      setShowAvailabilityModal(false);
      setAvailabilityModalStep('initial');

      Alert.alert(
        "Status Updated",
        "You have been marked as unavailable but remain scheduled for this role.",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Error updating availability status:", error);
      Alert.alert("Error", "Failed to update availability. Please try again.");
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  const handleOpenPhotoInput = () => {
    setIsSelectingPhoto(true);
    setShowProfilePicModal(false);
    setTimeout(() => {
      setShowPhotoInputModal(true);
    }, 50);
  };

  const handleClosePhotoInput = async () => {
    setShowPhotoInputModal(false);

    try {
      await storage()
        .ref(`profilePictures/${auth().currentUser.uid}.png`)
        .getDownloadURL();
      setShowProfilePicModal(false);
      setIsSelectingPhoto(false);
    } catch (error) {
      if (error.code === "storage/object-not-found") {
        if (!isSelectingPhoto) {
          setShowProfilePicModal(true);
        }
      }
      setIsSelectingPhoto(false);
    }
  };

  const handleRemoveChildren = async () => {
    const user = auth().currentUser;
    if (!user) {
      Alert.alert("Error", "User not authenticated. Please sign in again.");
      return;
    }

    try {
      const userRef = firestore().collection("users").doc(user.uid);
      const userDocSnap = await userRef.get();
      const userData = userDocSnap.data();
      const church = userData?.church || null;

      await Promise.all(
        childrenWithoutPfp.map(async (childId) => {
          await callFunction(
            user,
            "https://delete-child-hy6oofbihq-uc.a.run.app",
            { church, uid: childId },
            "Failed to delete child"
          );
        })
      );

      await userRef.update({
        children: FieldValue.arrayRemove(
          ...userData.children.filter((c) => childrenWithoutPfp.includes(c.uid))
        ),
      });

      Alert.alert(
        "Success",
        "Children without profile pictures have been removed. Please reregister them with profile pictures."
      );
      setShowChildrenProfilePicModal(false);
      setChildrenWithoutPfp([]);
    } catch (error) {
      console.error("Remove children error:", error);
      Alert.alert("Error", "Failed to remove children. Please try again.");
    }
  };

  const handleCloseChildrenModal = () => {
    setShowChildrenProfilePicModal(false);
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
      Alert.alert(
        "Cannot Undo",
        "This week is already marked as unavailable and cannot be changed."
      );
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
              Alert.alert(
                "Error",
                "User not authenticated. Please sign in again."
              );
              return;
            }

            setIsLoading(true);
            try {
              const userDocSnap = await firestore()
                .collection("users")
                .doc(user.uid)
                .get();

              if (!userDocSnap.exists) {
                Alert.alert("Error", "User data not found.");
                return;
              }

              const userData = userDocSnap.data();
              const churchIdFromData = userData?.church;

              await firestore()
                .collection("users")
                .doc(user.uid)
                .update({
                  unavailableWeeks: FieldValue.arrayUnion(...selectedWeeks),
                });

              setUnavailableWeeks((prev) => [...prev, ...selectedWeeks]);

              for (const week of selectedWeeks) {
                await callFunction(
                  user,
                  "https://unavailable-for-week-hy6oofbihq-uc.a.run.app",
                  {
                    church: churchIdFromData,
                    week,
                    uid: user.uid,
                    family: true,
                  },
                  "Failed to mark as unavailable. Please try again."
                );
              }

              Alert.alert(
                "Request Sent",
                "You have been marked as unavailable for the selected weeks."
              );
              setSelectedWeeks([]);
              setShowWeekModal(false);
            } catch (error) {
              console.error("Unavailable weeks error:", error);
              Alert.alert(
                "Error",
                "Failed to mark as unavailable. Please try again."
              );
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
    if (!user || isSelectingPhoto) return;

    const checkProfilePictures = async () => {
      try {
        const userRef = firestore().collection("users").doc(user.uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) return;

        const userData = userDoc.data();
        const isDeaconUser = userData?.isDeacon || false;
        const isSSTeacherUser = userData?.isSSTeacher || false;
        setIsSSTeacher(isSSTeacherUser);

        if (isDeaconUser || isSSTeacherUser) {
          try {
            await storage()
              .ref(`profilePictures/${user.uid}.png`)
              .getDownloadURL();
          } catch (error) {
            if (
              error.code === "storage/object-not-found" &&
              !isSelectingPhoto
            ) {
              setShowProfilePicModal(true);
            } else {
              // Error handling for profile picture check
            }
          }
        }

        const children = userData?.children || [];
        if (children.length > 0) {
          const missingPfpChildren = [];
          for (const child of children) {
            if (child?.uid) {
              try {
                await storage()
                  .ref(`profilePictures/${child.uid}.png`)
                  .getDownloadURL();
              } catch (error) {
                if (error.code === "storage/object-not-found") {
                  missingPfpChildren.push(child.uid);
                } else {
                  // Error handling for child profile picture check
                }
              }
            }
          }
          if (missingPfpChildren.length > 0) {
            setChildrenWithoutPfp(missingPfpChildren);
            setShowChildrenProfilePicModal(true);
          }
        }
      } catch (error) {
        // Error handling for profile pictures check
      }
    };

    checkProfilePictures();
  }, [isSelectingPhoto]);

  // Handle cached user data changes
  useEffect(() => {
    if (!user) {
      return;
    }

    // Handle user data from cache
    if (userDoc) {
      const name = userDoc?.name || null;
      setUserName(name);

      // Check for required fields and show modals accordingly
      const isNameInvalid =
        !name ||
        name === "null null" ||
        name.trim() === "" ||
        !name.includes(" ");
      const isDOBInvalid = !userDoc?.DOB || userDoc.DOB.trim() === "";
      const isPhoneInvalid = !userDoc?.phone || userDoc.phone.trim() === "";
      const hasChurch = userDoc?.church && userDoc.church.trim() !== "";

      setShowNameModal(isNameInvalid);
      setShowDOBModal(!isNameInvalid && isDOBInvalid);
      setShowPhoneModal(
        !isNameInvalid &&
          !isDOBInvalid &&
          isPhoneInvalid &&
          !phoneModalShownThisSession
      );

      // Church modal is controlled by real-time listener
    } else if (userError) {
      // Handle case where user document doesn't exist
      Alert.alert(
        "Sign up to continue",
        "Please sign up using this account to continue."
      );
      deleteUser(user).catch(() => {
        // Error handling for user deletion
      });
    }
  }, [userDoc, userError, user, phoneModalShownThisSession]);

  // Publishes churchId for the schedule listener below. The duplicate
  // schedule-collection subscription that used to live here was removed: it
  // streamed the same collection and ran the same closest-week scan as the
  // listener further down, then raced it writing setSchedule/setCurrentWeek.
  useEffect(() => {
    if (!user || !userDoc?.church) return;
    setChurchId(userDoc.church);
  }, [user, userDoc?.church]);

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
              // This logic is now handled by cached user data effect above
              // Keeping this as backup for real-time updates if needed
              setIsDeacon(userData.isDeacon || false);
              setNextWeek(userData.nextWeekServe || null);
              setNextRole(userData.nextRole || "N/A");
              setLastServe(userData.lastServe || null);
              setLastRole(userData.lastRole || null);
              if (userData.church && userData.church !== churchId) {
                setChurchId(userData.church);
              }
              setUnavailableWeeks(
                Array.isArray(userData.unavailableWeeks)
                  ? userData.unavailableWeeks
                  : []
              );
              setIsSSTeacher(userData.isSSTeacher || false);

              // Data validation for grades
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
            // Error handling for user data processing
          }
        },
        (error) => {
          // Error handling for user document listener
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

    const unsubscribeSchedules = schedulesRef.onSnapshot(
      (snapshot) => {
        try {
          if (!snapshot || snapshot.empty) {
            setScheduleLoaded(true);
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
          // Tear down the previous church listener before opening another.
          // Returning a cleanup from inside an onSnapshot callback does nothing
          // (Firestore discards it), which used to leak one listener per
          // schedule change for the lifetime of the app.
          churchUnsubRef.current?.();
          churchUnsubRef.current = churchRef.onSnapshot(
            (churchDoc) => {
              try {
                if (!churchDoc.exists) {
                  return;
                }

                const fullDeacon = churchDoc.data()?.fullDeacon || false;

                snapshot.docs.forEach((doc) => {
                  const scheduleData = doc.data();
                  const scheduleDateStr = doc.id.split("-").slice(-3).join("-");
                  const [month, day, year] = scheduleDateStr
                    .split("-")
                    .map(Number);
                  const scheduleDate = new Date(
                    2000 + year,
                    month - 1,
                    day
                  ).setHours(0, 0, 0, 0);

                  if (
                    !closestDate ||
                    Math.abs(scheduleDate - today) <
                      Math.abs(closestDate - today)
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
                  if (
                    updatedSchedule.water &&
                    typeof updatedSchedule.water === "object"
                  ) {
                    altarServers.push(updatedSchedule.water);
                  }
                  if (
                    !fullDeacon &&
                    updatedSchedule.wine &&
                    typeof updatedSchedule.wine === "object"
                  ) {
                    altarServers.push(updatedSchedule.wine);
                  }

                  altarServers.push(
                    ...(updatedSchedule.altar || []).filter(
                      (server) => server && typeof server === "object"
                    )
                  );
                  updatedSchedule.altar = altarServers;
                  setScheduleLoaded(true);
                  setSchedule(updatedSchedule);
                }
              } catch (error) {
                // Error handling for church document processing
              }
            },
            (error) => {
              setScheduleLoaded(true);
              // Error handling for church document listener
            }
          );

        } catch (error) {
          // Error handling for schedules loading
        }
      },
      (error) => {
        setScheduleLoaded(true);
        // Error handling for schedules listener
      }
    );

    return () => {
      unsubscribeSchedules();
      churchUnsubRef.current?.();
      churchUnsubRef.current = null;
    };
  }, [churchId]);

  // Check if user is scheduled for current week and needs to confirm availability
  useEffect(() => {
    const user = auth().currentUser;
    if (!user || !schedule || !currentWeek) {
      return;
    }

    // All possible roles to check
    const rolesToCheck = [
      { key: 'matins', label: 'Matins Gospel' },
      { key: 'third', label: 'Third Hour Gospel' },
      { key: 'sixth', label: 'Sixth Hour Gospel' },
      { key: 'pauline', label: 'Pauline Epistle' },
      { key: 'catholic', label: 'Catholic Epistle' },
      { key: 'praxis', label: 'Praxis' },
      { key: 'gospel', label: 'Gospel' },
      { key: 'water', label: 'Water' },
      { key: 'wine', label: 'Wine' },
    ];

    // Check single roles
    for (const role of rolesToCheck) {
      const roleData = schedule[role.key];
      if (roleData && roleData.uid === user.uid) {
        // User is scheduled for this role
        if (!roleData.status) {
          // No status set yet, show the modal
          setUserCurrentWeekRole(role.label);
          setUserCurrentWeekRoleKey(role.key);
          setUserAvailabilityStatus(null);
          setAvailabilityModalStep('initial');
          setShowAvailabilityModal(true);
          return;
        } else {
          // Status already set, just track it
          setUserCurrentWeekRole(role.label);
          setUserCurrentWeekRoleKey(role.key);
          setUserAvailabilityStatus(roleData.status);
          return;
        }
      }
    }

    // Check altar array
    if (Array.isArray(schedule.altar)) {
      for (let i = 0; i < schedule.altar.length; i++) {
        const altarServer = schedule.altar[i];
        if (altarServer && altarServer.uid === user.uid) {
          if (!altarServer.status) {
            // No status set yet, show the modal
            setUserCurrentWeekRole('Altar Server');
            setUserCurrentWeekRoleKey('altar');
            setUserAvailabilityStatus(null);
            setAvailabilityModalStep('initial');
            setShowAvailabilityModal(true);
            return;
          } else {
            // Status already set, just track it
            setUserCurrentWeekRole('Altar Server');
            setUserCurrentWeekRoleKey('altar');
            setUserAvailabilityStatus(altarServer.status);
            return;
          }
        }
      }
    }

    // User not scheduled or already responded
    setUserCurrentWeekRole(null);
    setUserCurrentWeekRoleKey(null);
    setUserAvailabilityStatus(null);
  }, [schedule, currentWeek]);

  useEffect(() => {
    if (
      showDOBModal ||
      showPhoneModal ||
      showProfilePicModal ||
      showChildrenProfilePicModal ||
      showChurchModal ||
      showAvailabilityModal
    ) {
      try {
        Animated.spring(scaleValue, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }).start();
      } catch (error) {
        // Error handling for animation
      }
    } else {
      scaleValue.setValue(0.9);
    }
  }, [
    showDOBModal,
    showPhoneModal,
    showProfilePicModal,
    showChildrenProfilePicModal,
    showChurchModal,
    showAvailabilityModal,
  ]);

  // Memoized: these feed HomeScreenNames, and a fresh object identity on every
  // render used to remount all ~12-25 rows (each of which refetched its photo).
  const readings = useMemo(() => [
    { role: "Matins Gospel", user: schedule.matins || NO_ONE },
    { role: "Third Hour Gospel", user: schedule.third || NO_ONE },
    { role: "Sixth Hour Gospel", user: schedule.sixth || NO_ONE },
    { role: "Pauline Epistle", user: schedule.pauline || NO_ONE },
    { role: "Catholic Epistle", user: schedule.catholic || NO_ONE },
    { role: "Praxis", user: schedule.praxis || NO_ONE },
    { role: "Gospel", user: schedule.gospel || NO_ONE },
  ], [
    schedule.matins, schedule.third, schedule.sixth, schedule.pauline,
    schedule.catholic, schedule.praxis, schedule.gospel,
  ]);

  const offerings = useMemo(() => [
    { role: "Water", user: schedule.water || NO_ONE },
    { role: "Wine", user: schedule.wine || NO_ONE },
  ], [schedule.water, schedule.wine]);

  // Show a skeleton of the readings/offerings cards while user data loads, so
  // the layout is already in place when the real rows land.
  // Hold the skeleton until BOTH the user doc and the schedule have actually
  // been read. Gating on userLoading alone used to reveal a full grid of "N/A"
  // rows while the schedule request was still in flight.
  const scheduleStillLoading = !!userDoc?.church && !scheduleLoaded;
  if (userLoading || scheduleStillLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <SkeletonScreen variant="cards" count={7} />
      </SafeAreaView>
    );
  }

  // Show error state if user data failed to load
  if (userError && !userDoc) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text style={{ fontSize: 18, color: "#ff6b6b", marginBottom: 10 }}>
          Connection Error
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: "#888",
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          Unable to load your data. Check your internet connection.
        </Text>
        <TouchableOpacity
          onPress={refreshUser}
          style={{
            backgroundColor: "#007AFF",
            padding: 12,
            borderRadius: 8,
            minWidth: 120,
          }}
        >
          <Text
            style={{ color: "white", textAlign: "center", fontWeight: "600" }}
          >
            Retry
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* PhotoInput Component - Placed first, outside of any Modal */}
      <PhotoInput
        visible={showPhotoInputModal}
        onClose={handleClosePhotoInput}
        userId={auth().currentUser?.uid || ""}
      />

      {/* Church Selection Modal */}
      <ChurchSelectionModal
        visible={showChurchModal}
        scaleValue={scaleValue}
        selectedChurch={selectedChurch}
        isSubmitting={isSubmittingChurch}
        onSelectChurch={handleChurchSelection}
        onSubmit={handleChurchSubmit}
      />

      {/* Name Modal */}
      <NameModal
        visible={showNameModal}
        firstName={firstName}
        lastName={lastName}
        onChangeFirstName={setFirstName}
        onChangeLastName={setLastName}
        onSubmit={handleNameSubmit}
      />

      {/* DOB Modal */}
      <DOBModal
        visible={showDOBModal}
        scaleValue={scaleValue}
        date={date}
        tempDate={tempDate}
        showDatePicker={showDatePicker}
        formatDate={formatDate}
        onDateChange={handleDateChange}
        onShowDatePicker={() => setShowDatePicker(true)}
        onSubmit={handleDOBSubmit}
      />

      {/* Phone Modal */}
      <PhoneModal
        visible={showPhoneModal}
        scaleValue={scaleValue}
        phoneNumber={phoneNumber}
        onChangePhoneNumber={setPhoneNumber}
        onSubmit={handlePhoneSubmit}
        onClose={handlePhoneModalClose}
      />

      {/* Week Selection Modal */}
      <WeekSelectionModal
        visible={showWeekModal}
        weeks={getNextFiveWeeks()}
        selectedWeeks={selectedWeeks}
        unavailableWeeks={unavailableWeeks}
        isLoading={isLoading}
        onWeekSelection={handleWeekSelection}
        onConfirm={confirmWeekSelection}
        onCancel={() => {
          setShowWeekModal(false);
          setSelectedWeeks([]);
        }}
      />

      {/* Profile Picture Modal */}
      <ProfilePictureModal
        visible={showProfilePicModal}
        scaleValue={scaleValue}
        isDeacon={isDeacon}
        onAddPhoto={handleOpenPhotoInput}
      />

      {/* Children Profile Picture Modal */}
      <ChildrenProfilePictureModal
        visible={showChildrenProfilePicModal}
        scaleValue={scaleValue}
        onRemoveChildren={handleRemoveChildren}
        onClose={handleCloseChildrenModal}
      />

      {/* Availability Confirmation Modal */}
      <AvailabilityModal
        visible={showAvailabilityModal}
        scaleValue={scaleValue}
        currentWeek={currentWeek}
        userCurrentWeekRole={userCurrentWeekRole}
        availabilityModalStep={availabilityModalStep}
        isSubmittingStatus={isSubmittingStatus}
        onAvailabilityResponse={handleAvailabilityResponse}
        onKeepButMarkUnavailable={handleKeepButMarkUnavailable}
        onRemoveSelfFromRole={handleRemoveSelfFromRole}
        onGoBack={() => setAvailabilityModalStep("initial")}
      />

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

            {userCurrentWeekRole && userAvailabilityStatus && (
              <TouchableOpacity
                style={[
                  styles.statusPill,
                  userAvailabilityStatus === 'confirmed' && styles.statusPillConfirmed,
                  userAvailabilityStatus === 'unsure' && styles.statusPillUnsure,
                  userAvailabilityStatus === 'unavailable' && styles.statusPillUnavailable,
                ]}
                onPress={() => {
                  setAvailabilityModalStep('initial');
                  setShowAvailabilityModal(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={
                    userAvailabilityStatus === 'confirmed' ? 'checkmark-circle' :
                    userAvailabilityStatus === 'unsure' ? 'help-circle' :
                    'close-circle'
                  }
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.statusPillText}>
                  {userAvailabilityStatus === 'confirmed' ? 'Confirmed' :
                   userAvailabilityStatus === 'unsure' ? 'Unsure' :
                   'Unavailable'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.unavailableButton}
              onPress={handleUnavailableToServe}
            >
              <Text style={styles.requestButtonText}>
                Select Unavailable Weeks
              </Text>
            </TouchableOpacity>
            {lastServe && lastRole && (
              <Text style={styles.lastServeText}>
                Last served on {lastServe} as {lastRole}
              </Text>
            )}
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
    paddingBottom: 40,
  },
  homescreen: {
    flex: 1,
    width: "100%",
  },
  header: {
    fontSize: 36,
    color: "#fff",
    textAlign: "center",
    marginTop: 20,
    marginBottom: 8,
    fontWeight: "300",
    letterSpacing: 1,
  },
  headerDivider: {
    width: 60,
    height: 2,
    backgroundColor: "#333",
    alignSelf: "center",
    marginBottom: 30,
    borderRadius: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    color: "#4d9cff",
    marginBottom: 14,
    fontWeight: "600",
  },
  nextServiceWeek: {
    fontSize: 20,
    color: "#4d9cff",
    textAlign: "center",
    marginBottom: 12,
    fontWeight: "600",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  icon: {
    marginRight: 14,
  },
  name: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
  },
  nextServiceBox: {
    backgroundColor: "#1a1a1a",
    padding: 20,
    borderRadius: 14,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  nextServiceText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: 8,
  },
  nextRoleText: {
    fontSize: 18,
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 16,
  },
  unavailableButton: {
    backgroundColor: "#ff3b30",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginVertical: 12,
    alignSelf: "center",
  },
  requestButtonText: {
    fontSize: 16,
    color: "#ffffff",
    fontWeight: "600",
    textAlign: "center",
  },
  blackspace: {
    height: 0,
    backgroundColor: "#121212",
  },
  lastServeText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    marginTop: 12,
    fontStyle: "italic",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginTop: 6,
    marginBottom: 8,
    gap: 6,
  },
  statusPillConfirmed: {
    backgroundColor: "#28A745",
  },
  statusPillUnsure: {
    backgroundColor: "#E68A00",
  },
  statusPillUnavailable: {
    backgroundColor: "#ff3b30",
  },
  statusPillText: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
});

export default HomeScreen;
