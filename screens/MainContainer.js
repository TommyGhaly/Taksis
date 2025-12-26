import React, { useEffect, useState, useCallback, useRef } from "react";
import { StyleSheet, View, Text, ScrollView, RefreshControl } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createDrawerNavigator } from "@react-navigation/drawer";
import Icon from "react-native-vector-icons/FontAwesome";
import "react-native-gesture-handler";
import HomeScreenNavigation from "./Home/HomeScreenNavigator";
import AlhanNavigator from "./Alhan/AlhanNavigator";
import SundaySchoolNavigator from "./SundaySchool/SundaySchoolNavigator";
import LearnItNavigation from "./LearnIt/LearnItNavigation";
import SettingsNavigation from "./Settings/SettingsNavigation";
import ServantsMeetingNavigator from "./ServantsMeeting/ServantsMeetingNavigator";
import ServantsAdmin from "./ServantsAdmin";
import AlhanAdmin from "./AlhanAdmin";
import AdminManager from "./AdminManager";
import EditSchedule from "./EditSchedule";
import DeaconEdits from "./DeaconEdits";
import UnavailableRequestModal from "../components/unavailableRequestModal";
import CustomDrawerContent from "../components/customDrawer";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import storage from "@react-native-firebase/storage";
import CustomHeader from "../components/customHeader";
import { StorageCache } from "../utils/cacheManager";

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

const myTheme = {
  ...DefaultTheme,
  colors: {
    primary: "#147efb",
    card: "rgb(255, 255, 255)",
    background: "#000",
  },
};

const consistentHeaderStyle = {
  backgroundColor: "#1a1a1a",
};

const screenConfigs = {
  schedule: {
    component: HomeScreenNavigation,
    name: "Deacon Service Schedule",
    drawerName: "Deacon Service Schedule",
  },
  sundaySchoolAttendance: {
    component: SundaySchoolNavigator,
    name: "Sunday School Attendance",
    drawerName: "Sunday School Attendance",
  },
  hymnsClassAttendance: {
    component: AlhanNavigator,
    name: "Hymns Class Attendance",
    drawerName: "Hymns Class Attendance",
  },
  servantsMeetingTracker: {
    component: ServantsMeetingNavigator,
    name: "Servants Meeting Tracker",
    drawerName: "Servants Meeting Attendance",
  },
  editDeacons: {
    component: DeaconEdits,
    name: "Edit Deacons",
    drawerName: "Edit Deacons",
  },
  servantsManager: {
    component: ServantsAdmin,
    name: "Servants Manager",
    drawerName: "Servants Management",
  },
  alhanManager: {
    component: AlhanAdmin,
    name: "Alhan Manager",
    drawerName: "Alhan Management",
  },
  adminManager: {
    component: AdminManager,
    name: "Admin Manager",
    drawerName: "Admin Manager",
  },
};

const parseWeekDate = (weekStr) => {
  if (!weekStr) return null;
  const parts = weekStr.split("-");
  if (parts.length !== 3) return null;
  const [month, day, year] = parts.map((p) => parseInt(p, 10));
  return new Date(2000 + year, month - 1, day);
};

const isWeekPast = (weekStr) => {
  const weekDate = parseWeekDate(weekStr);
  if (!weekDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return weekDate < today;
};

const flattenUnavailableRequests = (docs) => {
  const requests = [];
  docs.forEach((doc) => {
    const weekId = doc.id;
    const data = doc.data();
    Object.entries(data).forEach(([key, value]) => {
      if (key === "altar" && typeof value === "object") {
        Object.entries(value).forEach(([index, entry]) => {
          if (entry.original && entry.replacement) {
            requests.push({
              weekId,
              role: ["altar", parseInt(index, 10)],
              original: entry.original,
              replacement: entry.replacement,
            });
          }
        });
      } else if (value.original && value.replacement) {
        requests.push({
          weekId,
          role: key,
          original: value.original,
          replacement: value.replacement,
        });
      }
    });
  });
  requests.sort((a, b) => {
    const dateA = parseWeekDate(a.weekId);
    const dateB = parseWeekDate(b.weekId);
    if (!dateA || !dateB) return 0;
    return dateA - dateB;
  });
  return requests;
};

function TabNavigator({ userRoles, setHomeTitle, showDrawer, homeScreenId }) {
  const homeConfig = screenConfigs[homeScreenId] || screenConfigs.schedule;
  const HomeComponent = homeConfig.component;

  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        headerStyle: consistentHeaderStyle,
        headerTintColor: "#fff",
        tabBarStyle: {
          height: 90,
          backgroundColor: "rgba(34,36,40,1)",
          borderTopWidth: 0,
        },
        tabBarLabel: () => null,
        headerLeft: showDrawer
          ? () => <CustomHeader navigation={navigation} />
          : undefined,
        tabBarIcon: ({ color, size }) => {
          let iconName;
          switch (route.name) {
            case "Home": iconName = "home"; break;
            case "Learn to Serve": iconName = "book"; break;
            case "Edit Schedule": iconName = "pencil"; break;
            case "Settings": iconName = "gear"; break;
            default: iconName = "question";
          }
          return <Icon name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeComponent}
        options={{ headerTitle: homeConfig.name }}
        listeners={{ focus: () => setHomeTitle(homeConfig.name) }}
      />
      <Tab.Screen
        name="Learn to Serve"
        component={LearnItNavigation}
        listeners={{ focus: () => setHomeTitle("Learn to Serve") }}
      />
      {userRoles.admin && (
        <Tab.Screen
          name="Edit Schedule"
          component={EditSchedule}
          listeners={{ focus: () => setHomeTitle("Edit Schedule") }}
        />
      )}
      <Tab.Screen
        name="Settings"
        component={SettingsNavigation}
        listeners={{ focus: () => setHomeTitle("Settings") }}
      />
    </Tab.Navigator>
  );
}

function DrawerNavigator({ userRoles, homeTitle, setHomeTitle, homeScreenId }) {
  const shouldShowInDrawer = useCallback((screenId) => {
    if (screenId === homeScreenId && homeScreenId !== "schedule") return false;
    if (screenId === "schedule" && homeScreenId !== "schedule") return true;
    switch (screenId) {
      case "sundaySchoolAttendance": return userRoles.isSSTeacher;
      case "hymnsClassAttendance": return userRoles.isAlhan;
      case "servantsMeetingTracker": return userRoles.isServant;
      case "editDeacons": return userRoles.admin;
      case "servantsManager": return userRoles.ssAdmin;
      case "alhanManager": return userRoles.alhanAdmin;
      case "adminManager": return userRoles.superAdmin;
      default: return false;
    }
  }, [userRoles, homeScreenId]);

  return (
    <Drawer.Navigator
      drawerContent={(props) => (
        <CustomDrawerContent
          {...props}
          userRoles={userRoles}
          shouldShowInDrawer={shouldShowInDrawer}
        />
      )}
      screenOptions={({ navigation, route }) => ({
        drawerStyle: {
          backgroundColor: "transparent",
          width: 280,
        },
        headerShown: true,
        headerTitle: route.name === "Home" ? homeTitle : route.name,
        headerLeft: () => <CustomHeader navigation={navigation} />,
        headerStyle: consistentHeaderStyle,
        headerTintColor: "#fff",
      })}
    >
      <Drawer.Screen name="Home" options={{ headerShown: false }}>
        {() => (
          <TabNavigator
            userRoles={userRoles}
            setHomeTitle={setHomeTitle}
            showDrawer={true}
            homeScreenId={homeScreenId}
          />
        )}
      </Drawer.Screen>

      {shouldShowInDrawer("schedule") && (
        <Drawer.Screen name="Deacon Service Schedule" component={HomeScreenNavigation} />
      )}
      {shouldShowInDrawer("sundaySchoolAttendance") && (
        <Drawer.Screen name="Sunday School Attendance" component={SundaySchoolNavigator} />
      )}
      {shouldShowInDrawer("hymnsClassAttendance") && (
        <Drawer.Screen name="Hymns Class Attendance" component={AlhanNavigator} />
      )}
      {shouldShowInDrawer("servantsMeetingTracker") && (
        <Drawer.Screen name="Servants Meeting Attendance" component={ServantsMeetingNavigator} />
      )}
      {shouldShowInDrawer("editDeacons") && (
        <Drawer.Screen name="Edit Deacons" component={DeaconEdits} />
      )}
      {shouldShowInDrawer("servantsManager") && (
        <Drawer.Screen name="Servants Management" component={ServantsAdmin} />
      )}
      {shouldShowInDrawer("alhanManager") && (
        <Drawer.Screen name="Alhan Management" component={AlhanAdmin} />
      )}
      {shouldShowInDrawer("adminManager") && (
        <Drawer.Screen name="Admin Manager" component={AdminManager} />
      )}
    </Drawer.Navigator>
  );
}

export default function MainContainer() {
  const [userRoles, setUserRoles] = useState({
    isAlhan: false,
    isSSTeacher: false,
    isServant: false,
    admin: false,
    ssAdmin: false,
    alhanAdmin: false,
    superAdmin: false,
  });
  const [churchId, setChurchId] = useState(null);
  const [homeTitle, setHomeTitle] = useState("Deacon Service Schedule");
  const [homeScreenId, setHomeScreenId] = useState("schedule");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [unavailableQueue, setUnavailableQueue] = useState([]);
  const [currentRequestId, setCurrentRequestId] = useState(null);
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [skippedAll, setSkippedAll] = useState(false);
  const skippedRequestsRef = useRef(new Set());
  const processedInitialRef = useRef(false);

  // New state for server data (matching EditSchedule pattern)
  const [availableServers, setAvailableServers] = useState([]);
  const [imageUrls, setImageUrls] = useState({});
  const [lastServeData, setLastServeData] = useState({});
  const [nextServeData, setNextServeData] = useState({});
  const userListenersRef = useRef([]);

  const getRequestId = (request) => {
    if (!request) return null;
    return `${request.weekId}-${JSON.stringify(request.role)}-${request.original.uid}`;
  };

  const currentRequest = unavailableQueue.find((r) => getRequestId(r) === currentRequestId);
  const currentIndex = unavailableQueue.findIndex((r) => getRequestId(r) === currentRequestId);
  const remainingCount = currentIndex >= 0 ? unavailableQueue.length - currentIndex : 0;

  const cleanupUserListeners = useCallback(() => {
    userListenersRef.current.forEach((unsub) => {
      if (typeof unsub === "function") unsub();
    });
    userListenersRef.current = [];
  }, []);

  const setupUserListeners = useCallback((servers) => {
    cleanupUserListeners();
    const newListeners = [];

    servers.forEach((server, idx) => {
      // Fetch profile picture
      const storagePath = `profilePictures/${server.uid}.png`;
      setTimeout(
        async () => {
          try {
            const url = await StorageCache.getDownloadURL(storagePath);
            setImageUrls((prev) => ({ ...prev, [server.uid]: url }));
          } catch {
            storage()
              .ref(storagePath)
              .getDownloadURL()
              .then((url) =>
                setImageUrls((prev) => ({ ...prev, [server.uid]: url }))
              )
              .catch(() => {});
          }
        },
        idx === 0 ? 0 : Math.random() * 500
      );

      // Listen to user data for lastServe and nextWeekServe
      const unsub = firestore()
        .collection("users")
        .doc(server.uid)
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              const userData = doc.data();
              setLastServeData((prev) =>
                userData.lastServe
                  ? { ...prev, [server.uid]: userData.lastServe }
                  : (({ [server.uid]: _, ...rest }) => rest)(prev)
              );
              setNextServeData((prev) =>
                userData.nextWeekServe
                  ? { ...prev, [server.uid]: userData.nextWeekServe }
                  : (({ [server.uid]: _, ...rest }) => rest)(prev)
              );
            }
          },
          (err) => console.error("Error listening to user:", server.uid, err)
        );

      newListeners.push(unsub);
    });

    userListenersRef.current = newListeners;
  }, [cleanupUserListeners]);

  const fetchUserData = useCallback(async (isRefresh = false) => {
    const user = auth().currentUser;
    if (!user) {
      setIsLoading(false);
      setRefreshing(false);
      return;
    }
    if (isRefresh) setRefreshing(true);

    try {
      const doc = await firestore().collection("users").doc(user.uid).get();
      if (doc.exists) {
        const data = doc.data();
        setUserRoles(data);
        setChurchId(data.church || null);

        let selectedHomeScreen = data.homeScreen;
        if (!selectedHomeScreen) {
          if (data.isDeacon) selectedHomeScreen = "schedule";
          else if (data.isSSTeacher) selectedHomeScreen = "sundaySchoolAttendance";
          else if (data.isAlhan) selectedHomeScreen = "hymnsClassAttendance";
          else selectedHomeScreen = "schedule";

          firestore().collection("users").doc(user.uid)
            .update({ homeScreen: selectedHomeScreen }).catch(() => {});
        }
        setHomeScreenId(selectedHomeScreen);
        const config = screenConfigs[selectedHomeScreen];
        if (config) setHomeTitle(config.name);
      }
    } catch (error) {
      // Silent error handling
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch schedule data for the current request's week to get available servers
  useEffect(() => {
    if (!churchId || !currentRequest?.weekId) {
      setAvailableServers([]);
      cleanupUserListeners();
      return;
    }

    const unsubscribe = firestore()
      .collection("churches")
      .doc(churchId)
      .collection("schedule")
      .doc(currentRequest.weekId)
      .onSnapshot(
        (doc) => {
          if (doc.exists) {
            const data = doc.data();
            const extraServers = (data.extra || [])
              .filter((s) => s.name !== "N/A" && s.uid)
              .sort((a, b) =>
                a.name
                  .split(" ")[0]
                  .toLowerCase()
                  .localeCompare(b.name.split(" ")[0].toLowerCase())
              );
            setAvailableServers(extraServers);
            setupUserListeners(extraServers);
          } else {
            setAvailableServers([]);
            cleanupUserListeners();
          }
        },
        (error) => {
          console.error("Error fetching schedule for modal:", error);
          setAvailableServers([]);
        }
      );

    return () => {
      unsubscribe();
      cleanupUserListeners();
    };
  }, [churchId, currentRequest?.weekId, setupUserListeners, cleanupUserListeners]);

  useEffect(() => {
    if (!userRoles.admin || !churchId) return;

    const unsubscribe = firestore()
      .collection("churches").doc(churchId).collection("unavailable")
      .onSnapshot(
        async (snapshot) => {
          const deletePromises = [];
          snapshot.docs.forEach((doc) => {
            if (isWeekPast(doc.id)) deletePromises.push(doc.ref.delete());
          });
          await Promise.all(deletePromises);

          const upcomingDocs = snapshot.docs.filter((doc) => !isWeekPast(doc.id));
          const requests = flattenUnavailableRequests(upcomingDocs);

          const previousIds = new Set(unavailableQueue.map(getRequestId));
          const newRequests = requests.filter((r) => {
            const id = getRequestId(r);
            return !previousIds.has(id) && !skippedRequestsRef.current.has(id);
          });

          setUnavailableQueue(requests);

          if (newRequests.length > 0 && processedInitialRef.current) {
            setSkippedAll(false);
            setCurrentRequestId(getRequestId(newRequests[0]));
            setShowUnavailableModal(true);
          }

          if (!processedInitialRef.current && requests.length > 0) {
            processedInitialRef.current = true;
            setCurrentRequestId(getRequestId(requests[0]));
            setShowUnavailableModal(true);
          }
        },
        (error) => console.error("Error listening to unavailable requests:", error)
      );

    return () => unsubscribe();
  }, [userRoles.admin, churchId]);

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      setIsLoading(false);
      return;
    }

    fetchUserData();

    // Set up realtime listener for user data changes
    const unsubscribe = firestore().collection("users").doc(user.uid)
      .onSnapshot(
        (snapshot) => {
          if (snapshot.exists) {
            const data = snapshot.data();
            setUserRoles(data);
            setChurchId(data.church || null);

            if (data.homeScreen) {
              setHomeScreenId((prev) => {
                if (data.homeScreen !== prev) {
                  const config = screenConfigs[data.homeScreen];
                  if (config) setHomeTitle(config.name);
                  return data.homeScreen;
                }
                return prev;
              });
            }
          }
        },
        (error) => console.error("Error listening to user data:", error)
      );

    return () => unsubscribe();
  }, [fetchUserData]);

  // Cleanup user listeners on unmount
  useEffect(() => {
    return () => cleanupUserListeners();
  }, [cleanupUserListeners]);

  const onRefresh = useCallback(() => fetchUserData(true), [fetchUserData]);

  const moveToNextRequest = useCallback(() => {
    const currentIdx = unavailableQueue.findIndex((r) => getRequestId(r) === currentRequestId);
    for (let i = currentIdx + 1; i < unavailableQueue.length; i++) {
      const nextRequest = unavailableQueue[i];
      const nextId = getRequestId(nextRequest);
      if (!skippedRequestsRef.current.has(nextId)) {
        setCurrentRequestId(nextId);
        return true;
      }
    }
    setShowUnavailableModal(false);
    setCurrentRequestId(null);
    return false;
  }, [unavailableQueue, currentRequestId]);

  const handleRequestComplete = useCallback(() => moveToNextRequest(), [moveToNextRequest]);

  const handleSkip = useCallback(() => {
    if (currentRequestId) skippedRequestsRef.current.add(currentRequestId);
    moveToNextRequest();
  }, [currentRequestId, moveToNextRequest]);

  const handleSkipAll = useCallback(() => {
    const currentIdx = unavailableQueue.findIndex((r) => getRequestId(r) === currentRequestId);
    for (let i = currentIdx; i < unavailableQueue.length; i++) {
      skippedRequestsRef.current.add(getRequestId(unavailableQueue[i]));
    }
    setSkippedAll(true);
    setShowUnavailableModal(false);
    setCurrentRequestId(null);
  }, [unavailableQueue, currentRequestId]);

  const shouldShowDrawer =
    userRoles.isAlhan || userRoles.isSSTeacher || userRoles.isServant ||
    userRoles.ssAdmin || userRoles.admin || userRoles.alhanAdmin || userRoles.superAdmin;

  if (isLoading) {
    return (
      <ScrollView
        contentContainerStyle={styles.loadingContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
            tintColor="#147efb" colors={["#147efb"]} />
        }
      >
        <Text style={styles.loadingText}>Loading...</Text>
      </ScrollView>
    );
  }

  return (
    <>
      <NavigationContainer independent={true} theme={myTheme}>
        {shouldShowDrawer ? (
          <DrawerNavigator
            userRoles={userRoles}
            homeTitle={homeTitle}
            setHomeTitle={setHomeTitle}
            homeScreenId={homeScreenId}
          />
        ) : (
          <TabNavigator
            userRoles={userRoles}
            setHomeTitle={setHomeTitle}
            showDrawer={false}
            homeScreenId={homeScreenId}
          />
        )}
      </NavigationContainer>

      {showUnavailableModal && currentRequest && (
        <UnavailableRequestModal
          visible={showUnavailableModal}
          onClose={handleRequestComplete}
          churchId={churchId}
          week={currentRequest.weekId}
          role={currentRequest.role}
          original={currentRequest.original}
          replacement={currentRequest.replacement}
          onSkip={handleSkip}
          onSkipAll={handleSkipAll}
          showSkipAll={remainingCount > 1}
          // New props for server selection with weeks until serve
          availableServers={availableServers}
          imageUrls={imageUrls}
          lastServeData={lastServeData}
          nextServeData={nextServeData}
          selectedWeek={currentRequest.weekId}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 60,
    backgroundColor: "#121212",
  },
  header: {
    backgroundColor: "#1e1e1e",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
  },
});