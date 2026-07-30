import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  AppState,
} from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createDrawerNavigator } from "@react-navigation/drawer";
import Icon from "react-native-vector-icons/FontAwesome";
import IconMCI from "react-native-vector-icons/MaterialCommunityIcons";
let Updates = null;
try { Updates = require("expo-updates"); } catch {}
import Constants from "expo-constants";
import HomeScreenNavigation from "./Home/HomeScreenNavigator";
import AlhanNavigator from "./Alhan/AlhanNavigator";
import SundaySchoolNavigator from "./SundaySchool/SundaySchoolNavigator";
import LearnItNavigation from "./LearnIt/LearnItNavigation";
import SettingsNavigation from "./Settings/SettingsNavigation";
import ServantsMeetingNavigator from "./ServantsMeeting/ServantsMeetingNavigator";
import ServantsAdmin from "./AdminScreens/ServantsAdmin";
import AlhanAdmin from "./AdminScreens/AlhanAdmin";
import AdminManager from "./AdminScreens/AdminManager";
import EditSchedule from "./AdminScreens/EditSchedule";
import DeaconEdits from "./AdminScreens/DeaconEdits";
import TrafficManager from "./AdminScreens/TrafficManager";
import PaschaManager from "./AdminScreens/PaschaManager";
import PaschaHomePage from "./Pascha/PaschaHomePage";
import DatabaseManager from "./AdminScreens/DatabaseManager";
import UnavailableRequestModal from "../components/unavailableRequestModal";
import CustomDrawerContent from "../components/customDrawer";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import CustomHeader from "../components/customHeader";
import SkeletonScreen from "../components/Skeleton";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as avatarCache from "../utils/avatarCache";

// Last known roles, so a cold start can render the tab bar without waiting on
// the network.
const ROLES_CACHE_KEY = "mainContainer_roles_v1";

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

// ── Version helpers ──────────────────────────────────────────────────────────

const STORE_URLS = {
  ios: "https://apps.apple.com/app/taksis/id6504739738", // Replace with your actual App Store ID
  android: "https://play.google.com/store/apps/details?id=com.taksis", // Replace with your actual package name
};

function compareVersions(current, minimum) {
  const c = current.split(".").map(Number);
  const m = minimum.split(".").map(Number);
  for (let i = 0; i < Math.max(c.length, m.length); i++) {
    const cv = c[i] || 0;
    const mv = m[i] || 0;
    if (cv < mv) return -1;
    if (cv > mv) return 1;
  }
  return 0;
}

// ── Screen configs (unchanged) ───────────────────────────────────────────────

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
  trafficManager: {
    component: TrafficManager,
    name: "Traffic Manager",
    drawerName: "Traffic Manager",
  },
  paschaManager: {
    component: PaschaManager,
    name: "Pascha Manager",
    drawerName: "Pascha Manager",
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
  databaseManager: {
    component: DatabaseManager,
    name: "Database Manager",
    drawerName: "Database Manager",
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

const docHasRequests = (doc) => {
  const data = doc.data();
  return Object.entries(data).some(([key, value]) => {
    if (key === "altar" && typeof value === "object") {
      return Object.values(value).some(
        (entry) => entry.original && entry.replacement
      );
    }
    return value.original && value.replacement;
  });
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

function TabNavigator({ userRoles, setHomeTitle, showDrawer, homeScreenId, showPaschaTab }) {
  const homeConfig = screenConfigs[homeScreenId] || screenConfigs.schedule;
  const HomeComponent = homeConfig.component;

  return (
    <Tab.Navigator
      detachInactiveScreens
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        headerStyle: consistentHeaderStyle,
        headerTintColor: "#fff",
        // Inactive tabs shouldn't re-render behind the active one.
        freezeOnBlur: true,
        lazy: true,
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
          switch (route.name) {
            case "Home":
              return <Icon name="home" size={size} color={color} />;
            case "Learn to Serve":
              return <Icon name="book" size={size} color={color} />;
            case "Pascha":
              return <IconMCI name="cross" size={size} color={color} />;
            case "Edit Schedule":
              return <Icon name="pencil" size={size} color={color} />;
            case "Settings":
              return <Icon name="gear" size={size} color={color} />;
            default:
              return <Icon name="question" size={size} color={color} />;
          }
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
      {showPaschaTab && (
        <Tab.Screen
          name="Pascha"
          component={PaschaHomePage}
          options={{ headerTitle: "Holy Week · Pascha" }}
          listeners={{ focus: () => setHomeTitle("Holy Week · Pascha") }}
        />
      )}
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

function DrawerNavigator({ userRoles, homeTitle, setHomeTitle, homeScreenId, showPaschaTab }) {
  const shouldShowInDrawer = useCallback(
    (screenId) => {
      if (screenId === homeScreenId && homeScreenId !== "schedule") return false;
      if (screenId === "schedule" && homeScreenId !== "schedule") return true;
      switch (screenId) {
        case "sundaySchoolAttendance":  return userRoles.isSSTeacher;
        case "hymnsClassAttendance":    return userRoles.isAlhan;
        case "servantsMeetingTracker":  return userRoles.isServant;
        case "editDeacons":             return userRoles.admin;
        case "trafficManager":          return userRoles.trafficAdmin;
        case "paschaManager":           return userRoles.paschaAdmin;
        case "servantsManager":         return userRoles.ssAdmin;
        case "alhanManager":            return userRoles.alhanAdmin;
        case "databaseManager":         return userRoles.superAdmin;
        case "adminManager":            return userRoles.superAdmin;
        default:                        return false;
      }
    },
    [userRoles, homeScreenId],
  );

  return (
    <Drawer.Navigator
      drawerContent={(props) => (
        <CustomDrawerContent
          {...props}
          userRoles={userRoles}
          shouldShowInDrawer={shouldShowInDrawer}
        />
      )}
      detachInactiveScreens
      screenOptions={({ navigation, route }) => ({
        drawerStyle: { backgroundColor: "transparent", width: 280 },
        headerShown: true,
        headerTitle: route.name === "Home" ? homeTitle : route.name,
        headerLeft: () => <CustomHeader navigation={navigation} />,
        headerStyle: consistentHeaderStyle,
        headerTintColor: "#fff",
        // Keep background screens from re-rendering while the drawer animates.
        freezeOnBlur: true,
        lazy: true,
      })}
    >
      <Drawer.Screen name="Home" options={{ headerShown: false }}>
        {() => (
          <TabNavigator
            userRoles={userRoles}
            setHomeTitle={setHomeTitle}
            showDrawer={true}
            homeScreenId={homeScreenId}
            showPaschaTab={showPaschaTab}
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
      {shouldShowInDrawer("trafficManager") && (
        <Drawer.Screen name="Traffic Manager" component={TrafficManager} />
      )}
      {shouldShowInDrawer("paschaManager") && (
        <Drawer.Screen name="Pascha Manager" component={PaschaManager} />
      )}
      {shouldShowInDrawer("servantsManager") && (
        <Drawer.Screen name="Servants Management" component={ServantsAdmin} />
      )}
      {shouldShowInDrawer("alhanManager") && (
        <Drawer.Screen name="Alhan Management" component={AlhanAdmin} />
      )}
      {shouldShowInDrawer("databaseManager") && (
        <Drawer.Screen name="Database Manager" component={DatabaseManager} />
      )}
      {shouldShowInDrawer("adminManager") && (
        <Drawer.Screen name="Admin Manager" component={AdminManager} />
      )}
    </Drawer.Navigator>
  );
}

// ── Update blocker modal ─────────────────────────────────────────────────────

function ForceUpdateModal({ visible }) {
  const storeUrl = Platform.OS === "ios" ? STORE_URLS.ios : STORE_URLS.android;

  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <View style={updateStyles.container}>
        <View style={updateStyles.card}>
          <View style={updateStyles.iconWrap}>
            <IconMCI name="update" size={40} color="#147efb" />
          </View>
          <Text style={updateStyles.title}>Update Required</Text>
          <Text style={updateStyles.message}>
            A new version of Ⲧⲁⲝⲓⲥ is available. Please update to continue using the app.
          </Text>
          <TouchableOpacity
            style={updateStyles.button}
            onPress={() => Linking.openURL(storeUrl)}
            activeOpacity={0.8}
          >
            <Text style={updateStyles.buttonText}>Update Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Main container ───────────────────────────────────────────────────────────

export default function MainContainer() {
  const [userRoles, setUserRoles] = useState({
    isAlhan: false,
    isSSTeacher: false,
    isServant: false,
    admin: false,
    ssAdmin: false,
    alhanAdmin: false,
    superAdmin: false,
    trafficAdmin: false,
    paschaAdmin: false,
  });
  const [churchId, setChurchId] = useState(null);
  const [homeTitle, setHomeTitle] = useState("Deacon Service Schedule");
  const [homeScreenId, setHomeScreenId] = useState("schedule");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);

  // ── Pascha tab visibility ─────────────────────────────────────────────────
  const [showPaschaTab, setShowPaschaTab] = useState(false);

  const [unavailableQueue, setUnavailableQueue] = useState([]);
  const [currentRequestId, setCurrentRequestId] = useState(null);
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [skippedAll, setSkippedAll] = useState(false);
  const skippedRequestsRef = useRef(new Set());
  const processedInitialRef = useRef(false);
  const deletedDocsRef = useRef(new Set());

  const [availableServers, setAvailableServers] = useState([]);
  const [lastServeData, setLastServeData] = useState({});
  const [nextServeData, setNextServeData] = useState({});
  const userListenersRef = useRef([]);

  // ── Update checks ─────────────────────────────────────────────────────────

  // 1. OTA updates (JS-only changes via EAS Update)
  //    expo-updates native module is not available in dev builds,
  //    so we guard both on __DEV__ and module availability.
  useEffect(() => {
    if (__DEV__) return;
    if (!Updates || !Updates.isEnabled) return;

    const checkOTA = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {}
    };

    checkOTA();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") checkOTA();
    });

    return () => sub.remove();
  }, []);

  // 2. Minimum version enforcement (native build updates via Firestore)
  //    Set config/app.minVersion in Firestore to block old builds
  useEffect(() => {
    const unsub = firestore()
      .collection("config")
      .doc("app")
      .onSnapshot(
        (doc) => {
          if (!doc.exists) return;
          const data = doc.data();
          const minVersion = data?.minVersion;
          if (!minVersion) return;

          const currentVersion =
            Constants.expoConfig?.version ||
            Constants.manifest?.version ||
            "0.0.0";

          if (compareVersions(currentVersion, minVersion) < 0) {
            setForceUpdate(true);
          } else {
            setForceUpdate(false);
          }
        },
        () => {},
      );

    return () => unsub();
  }, []);

  // ── Everything below is unchanged ─────────────────────────────────────────

  const getRequestId = (request) => {
    if (!request) return null;
    return `${request.weekId}-${JSON.stringify(request.role)}-${request.original.uid}`;
  };

  const currentRequest = unavailableQueue.find(
    (r) => getRequestId(r) === currentRequestId,
  );
  const currentIndex = unavailableQueue.findIndex(
    (r) => getRequestId(r) === currentRequestId,
  );
  const remainingCount =
    currentIndex >= 0 ? unavailableQueue.length - currentIndex : 0;

  const cleanupUserListeners = useCallback(() => {
    userListenersRef.current.forEach((unsub) => {
      if (typeof unsub === "function") unsub();
    });
    userListenersRef.current = [];
  }, []);

  const setupUserListeners = useCallback(
    (servers) => {
      cleanupUserListeners();
      const newListeners = [];

      // Avatars are resolved by <Avatar>/avatarCache now — the staggered
      // per-server Storage fetch that used to live here fed an `imageUrls`
      // prop that UnavailableRequestModal no longer reads.
      servers.forEach((server) => {
        const unsub = firestore()
          .collection("users")
          .doc(server.uid)
          .onSnapshot(
            (doc) => {
              if (doc.exists) {
                const userData = doc.data();
                // Free — this doc is already being read for serve dates.
                avatarCache.primeFromUser({ uid: server.uid, ...userData });
                setLastServeData((prev) =>
                  userData.lastServe
                    ? { ...prev, [server.uid]: userData.lastServe }
                    : (({ [server.uid]: _, ...rest }) => rest)(prev),
                );
                setNextServeData((prev) =>
                  userData.nextWeekServe
                    ? { ...prev, [server.uid]: userData.nextWeekServe }
                    : (({ [server.uid]: _, ...rest }) => rest)(prev),
                );
              }
            },
            () => {},
          );

        newListeners.push(unsub);
      });

      userListenersRef.current = newListeners;
    },
    [cleanupUserListeners],
  );

  // ── Listen for pascha visibility flags ────────────────────────────────────
  useEffect(() => {
    if (!churchId) return;
    const unsub = firestore()
      .collection("churches").doc(churchId)
      .collection("pascha").doc("config")
      .onSnapshot(doc => {
        if (!doc.exists) { setShowPaschaTab(false); return; }
        const d = doc.data();
        setShowPaschaTab(!!(d.myReadingsVisible || d.fullScheduleVisible));
      }, () => setShowPaschaTab(false));
    return () => unsub();
  }, [churchId]);

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
        avatarCache.primeFromUser({ uid: user.uid, ...data });
        // Persist roles so the next cold start can render the tab bar
        // immediately instead of blocking on this network read.
        AsyncStorage.setItem(
          ROLES_CACHE_KEY,
          JSON.stringify({ roles: data, homeScreen: data.homeScreen })
        ).catch(() => {});

        let selectedHomeScreen = data.homeScreen;
        if (!selectedHomeScreen) {
          if (data.isDeacon)           selectedHomeScreen = "schedule";
          else if (data.isSSTeacher)   selectedHomeScreen = "sundaySchoolAttendance";
          else if (data.isAlhan)       selectedHomeScreen = "hymnsClassAttendance";
          else                         selectedHomeScreen = "schedule";

          firestore()
            .collection("users")
            .doc(user.uid)
            .update({ homeScreen: selectedHomeScreen })
            .catch(() => {});
        }
        setHomeScreenId(selectedHomeScreen);
        const config = screenConfigs[selectedHomeScreen];
        if (config) setHomeTitle(config.name);
      }
    } catch {
      // Silent error handling
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

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
                a.name.split(" ")[0].toLowerCase()
                  .localeCompare(b.name.split(" ")[0].toLowerCase()),
              );
            setAvailableServers(extraServers);
            setupUserListeners(extraServers);
          } else {
            setAvailableServers([]);
            cleanupUserListeners();
          }
        },
        () => { setAvailableServers([]); },
      );

    return () => {
      unsubscribe();
      cleanupUserListeners();
    };
  }, [churchId, currentRequest?.weekId, setupUserListeners, cleanupUserListeners]);

  useEffect(() => {
    if (!userRoles.admin || !churchId) return;

    const unsubscribe = firestore()
      .collection("churches")
      .doc(churchId)
      .collection("unavailable")
      .onSnapshot(
        async (snapshot) => {
          const scheduleSnapshot = await firestore()
            .collection("churches")
            .doc(churchId)
            .collection("schedule")
            .get();

          const validWeeks = new Set(scheduleSnapshot.docs.map((doc) => doc.id));
          const validDocs = [];

          snapshot.docs.forEach((doc) => {
            if (isWeekPast(doc.id) || !validWeeks.has(doc.id) || !docHasRequests(doc)) {
              if (!deletedDocsRef.current.has(doc.id)) {
                deletedDocsRef.current.add(doc.id);
                doc.ref.delete().catch(() => {});
              }
            } else {
              validDocs.push(doc);
            }
          });

          const requests = flattenUnavailableRequests(validDocs);

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

          if (!processedInitialRef.current) {
            processedInitialRef.current = true;
            if (requests.length > 0) {
              setCurrentRequestId(getRequestId(requests[0]));
              setShowUnavailableModal(true);
            }
          }
        },
        () => {},
      );

    return () => unsubscribe();
  }, [userRoles.admin, churchId]);

  // Paint the tab bar from the last known roles while the fresh read is in
  // flight. Previously the whole navigation tree sat behind "Loading..." until
  // a network round-trip finished, on every single launch.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(ROLES_CACHE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const cached = JSON.parse(raw);
        if (!cached?.roles) return;
        setUserRoles((prev) => (prev && prev.church ? prev : cached.roles));
        if (cached.homeScreen) {
          setHomeScreenId(cached.homeScreen);
          const config = screenConfigs[cached.homeScreen];
          if (config) setHomeTitle(config.name);
        }
        setIsLoading(false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      setIsLoading(false);
      return;
    }

    fetchUserData();

    const unsubscribe = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        (snapshot) => {
          if (snapshot.exists) {
            const data = snapshot.data();
            setUserRoles(data);
            setChurchId(data.church || null);
            avatarCache.primeFromUser({ uid: user.uid, ...data });

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
        () => {},
      );

    return () => unsubscribe();
  }, [fetchUserData]);

  useEffect(() => {
    return () => cleanupUserListeners();
  }, [cleanupUserListeners]);

  const onRefresh = useCallback(() => fetchUserData(true), [fetchUserData]);

  const moveToNextRequest = useCallback(() => {
    const currentIdx = unavailableQueue.findIndex(
      (r) => getRequestId(r) === currentRequestId,
    );
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
    const currentIdx = unavailableQueue.findIndex(
      (r) => getRequestId(r) === currentRequestId,
    );
    for (let i = currentIdx; i < unavailableQueue.length; i++) {
      skippedRequestsRef.current.add(getRequestId(unavailableQueue[i]));
    }
    setSkippedAll(true);
    setShowUnavailableModal(false);
    setCurrentRequestId(null);
  }, [unavailableQueue, currentRequestId]);

  const shouldShowDrawer =
    userRoles.isAlhan      ||
    userRoles.isSSTeacher  ||
    userRoles.isServant    ||
    userRoles.ssAdmin      ||
    userRoles.admin        ||
    userRoles.alhanAdmin   ||
    userRoles.superAdmin   ||
    userRoles.trafficAdmin ||
    userRoles.paschaAdmin;

  // The shell can render any screen, so a shaped skeleton here would just be
  // guessing at a layout that won't match. One full-screen block instead.
  if (isLoading) {
    return <SkeletonScreen variant="block" />;
  }

  return (
    <>
      <ForceUpdateModal visible={forceUpdate} />

      <NavigationContainer independent={true} theme={myTheme}>
        {shouldShowDrawer ? (
          <DrawerNavigator
            userRoles={userRoles}
            homeTitle={homeTitle}
            setHomeTitle={setHomeTitle}
            homeScreenId={homeScreenId}
            showPaschaTab={showPaschaTab}
          />
        ) : (
          <TabNavigator
            userRoles={userRoles}
            setHomeTitle={setHomeTitle}
            showDrawer={false}
            homeScreenId={homeScreenId}
            showPaschaTab={showPaschaTab}
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
          availableServers={availableServers}
          lastServeData={lastServeData}
          nextServeData={nextServeData}
          selectedWeek={currentRequest.weekId}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
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

const updateStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#1a1a1a",
    borderRadius: 24,
    padding: 32,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(20,126,251,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 15,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  button: {
    backgroundColor: "#147efb",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});