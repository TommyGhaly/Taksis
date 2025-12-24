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
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import CustomHeader from "../components/customHeader";

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
  backgroundColor: "#252525",
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

// Helper to parse week string (MM-DD-YY) to Date
const parseWeekDate = (weekStr) => {
  if (!weekStr) return null;
  const parts = weekStr.split("-");
  if (parts.length !== 3) return null;
  const [month, day, year] = parts.map((p) => parseInt(p, 10));
  return new Date(2000 + year, month - 1, day);
};

// Helper to check if week is in the past
const isWeekPast = (weekStr) => {
  const weekDate = parseWeekDate(weekStr);
  if (!weekDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return weekDate < today;
};

// Flatten unavailable documents into a queue of requests
const flattenUnavailableRequests = (docs) => {
  const requests = [];

  docs.forEach((doc) => {
    const weekId = doc.id;
    const data = doc.data();

    Object.entries(data).forEach(([key, value]) => {
      if (key === "altar" && typeof value === "object") {
        // Handle altar servers (nested structure)
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
        // Handle single roles
        requests.push({
          weekId,
          role: key,
          original: value.original,
          replacement: value.replacement,
        });
      }
    });
  });

  // Sort by week date (earliest first)
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
            case "Home":
              iconName = "home";
              break;
            case "Learn to Serve":
              iconName = "book";
              break;
            case "Edit Schedule":
              iconName = "pencil";
              break;
            case "Settings":
              iconName = "gear";
              break;
            default:
              iconName = "question";
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
  const shouldShowInDrawer = (screenId) => {
    if (screenId === homeScreenId && homeScreenId !== "schedule") {
      return false;
    }
    if (screenId === "schedule" && homeScreenId !== "schedule") {
      return true;
    }
    switch (screenId) {
      case "sundaySchoolAttendance":
        return userRoles.isSSTeacher;
      case "hymnsClassAttendance":
        return userRoles.isAlhan;
      case "servantsMeetingTracker":
        return userRoles.isServant;
      case "editDeacons":
        return userRoles.admin;
      case "servantsManager":
        return userRoles.ssAdmin;
      case "alhanManager":
        return userRoles.alhanAdmin;
      case "adminManager":
        return userRoles.superAdmin;
      default:
        return false;
    }
  };

  return (
    <Drawer.Navigator
      screenOptions={({ navigation, route }) => ({
        drawerStyle: {
          backgroundColor: "#1e1e1e",
          width: 270,
        },
        headerShown: true,
        headerTitle: route.name === "Home" ? homeTitle : route.name,
        headerLeft: () => <CustomHeader navigation={navigation} />,
        drawerActiveTintColor: "#147efb",
        drawerInactiveTintColor: "#8e8e93",
        headerStyle: consistentHeaderStyle,
        headerTintColor: "#fff",
      })}
    >
      <Drawer.Screen name="Home" options={{ headerShown: false }}>
        {({ navigation }) => (
          <TabNavigator
            userRoles={userRoles}
            setHomeTitle={setHomeTitle}
            showDrawer={true}
            homeScreenId={homeScreenId}
          />
        )}
      </Drawer.Screen>

      {shouldShowInDrawer("schedule") && (
        <Drawer.Screen
          name="Deacon Service Schedule"
          component={HomeScreenNavigation}
        />
      )}

      {shouldShowInDrawer("sundaySchoolAttendance") && (
        <Drawer.Screen
          name={screenConfigs.sundaySchoolAttendance.drawerName}
          component={SundaySchoolNavigator}
        />
      )}
      {shouldShowInDrawer("hymnsClassAttendance") && (
        <Drawer.Screen
          name={screenConfigs.hymnsClassAttendance.drawerName}
          component={AlhanNavigator}
        />
      )}
      {shouldShowInDrawer("servantsMeetingTracker") && (
        <Drawer.Screen
          name={screenConfigs.servantsMeetingTracker.drawerName}
          component={ServantsMeetingNavigator}
        />
      )}
      {shouldShowInDrawer("editDeacons") && (
        <Drawer.Screen
          name={screenConfigs.editDeacons.drawerName}
          component={DeaconEdits}
        />
      )}
      {shouldShowInDrawer("servantsManager") && (
        <Drawer.Screen
          name={screenConfigs.servantsManager.drawerName}
          component={ServantsAdmin}
        />
      )}
      {shouldShowInDrawer("alhanManager") && (
        <Drawer.Screen
          name={screenConfigs.alhanManager.drawerName}
          component={AlhanAdmin}
        />
      )}
      {shouldShowInDrawer("adminManager") && (
        <Drawer.Screen
          name={screenConfigs.adminManager.drawerName}
          component={AdminManager}
        />
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

  // Unavailable request queue state
  const [unavailableQueue, setUnavailableQueue] = useState([]);
  const [currentRequestId, setCurrentRequestId] = useState(null);
  const [showUnavailableModal, setShowUnavailableModal] = useState(false);
  const [skippedAll, setSkippedAll] = useState(false);
  const skippedRequestsRef = useRef(new Set()); // Track skipped requests for this session
  const processedInitialRef = useRef(false); // Track if we've processed initial queue

  // Helper to generate unique request ID
  const getRequestId = (request) => {
    if (!request) return null;
    return `${request.weekId}-${JSON.stringify(request.role)}-${request.original.uid}`;
  };

  // Get current request by ID
  const currentRequest = unavailableQueue.find((r) => getRequestId(r) === currentRequestId);
  const currentIndex = unavailableQueue.findIndex((r) => getRequestId(r) === currentRequestId);
  const remainingCount = currentIndex >= 0 ? unavailableQueue.length - currentIndex : 0;

  // Function to fetch user data
  const fetchUserData = useCallback(async (isRefresh = false) => {
    const user = auth().currentUser;
    if (!user) {
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    }

    try {
      const doc = await firestore().collection("users").doc(user.uid).get();

      if (doc.exists) {
        const data = doc.data();
        setUserRoles(data);
        setChurchId(data.church || null);

        let selectedHomeScreen = data.homeScreen;

        if (!selectedHomeScreen) {
          if (data.isDeacon) {
            selectedHomeScreen = "schedule";
          } else if (data.isSSTeacher) {
            selectedHomeScreen = "sundaySchoolAttendance";
          } else if (data.isAlhan) {
            selectedHomeScreen = "hymnsClassAttendance";
          } else {
            selectedHomeScreen = "schedule";
          }

          firestore()
            .collection("users")
            .doc(user.uid)
            .update({ homeScreen: selectedHomeScreen })
            .catch(() => {});
        }

        setHomeScreenId(selectedHomeScreen);
        const config = screenConfigs[selectedHomeScreen];
        if (config) {
          setHomeTitle(config.name);
        }
      }
    } catch (error) {
      // Silent error handling
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Listen to unavailable requests (admin only)
  useEffect(() => {
    if (!userRoles.admin || !churchId) return;

    const unsubscribe = firestore()
      .collection("churches")
      .doc(churchId)
      .collection("unavailable")
      .onSnapshot(
        async (snapshot) => {
          // Delete past week documents
          const deletePromises = [];
          snapshot.docs.forEach((doc) => {
            if (isWeekPast(doc.id)) {
              deletePromises.push(doc.ref.delete());
            }
          });
          await Promise.all(deletePromises);

          // Filter to only upcoming weeks
          const upcomingDocs = snapshot.docs.filter((doc) => !isWeekPast(doc.id));

          // Flatten into request queue
          const requests = flattenUnavailableRequests(upcomingDocs);

          // Get IDs of new requests
          const previousIds = new Set(unavailableQueue.map(getRequestId));
          const newRequests = requests.filter((r) => {
            const id = getRequestId(r);
            return !previousIds.has(id) && !skippedRequestsRef.current.has(id);
          });

          setUnavailableQueue(requests);

          // If there are genuinely new requests, reset skippedAll and show modal
          if (newRequests.length > 0 && processedInitialRef.current) {
            setSkippedAll(false);
            setCurrentRequestId(getRequestId(newRequests[0]));
            setShowUnavailableModal(true);
          }

          // Initial load - show modal if there are requests
          if (!processedInitialRef.current && requests.length > 0) {
            processedInitialRef.current = true;
            setCurrentRequestId(getRequestId(requests[0]));
            setShowUnavailableModal(true);
          }
        },
        (error) => {
          console.error("Error listening to unavailable requests:", error);
        }
      );

    return () => unsubscribe();
  }, [userRoles.admin, churchId]);

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      setIsLoading(false);
      return;
    }

    let unsubscribe;

    // Initial fetch
    fetchUserData();

    // Set up realtime listener after a short delay
    setTimeout(() => {
      unsubscribe = firestore()
        .collection("users")
        .doc(user.uid)
        .onSnapshot(
          (snapshot) => {
            if (snapshot.exists && !isLoading && !refreshing) {
              const data = snapshot.data();
              setUserRoles(data);
              setChurchId(data.church || null);

              if (data.homeScreen && data.homeScreen !== homeScreenId) {
                setHomeScreenId(data.homeScreen);
                const config = screenConfigs[data.homeScreen];
                if (config) {
                  setHomeTitle(config.name);
                }
              }
            }
          },
          () => {}
        );
    }, 1000);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const onRefresh = useCallback(() => {
    fetchUserData(true);
  }, [fetchUserData]);

  // Helper to move to next request
  const moveToNextRequest = useCallback(() => {
    // Find next non-skipped request after current
    const currentIdx = unavailableQueue.findIndex((r) => getRequestId(r) === currentRequestId);
    
    for (let i = currentIdx + 1; i < unavailableQueue.length; i++) {
      const nextRequest = unavailableQueue[i];
      const nextId = getRequestId(nextRequest);
      if (!skippedRequestsRef.current.has(nextId)) {
        setCurrentRequestId(nextId);
        return true;
      }
    }
    
    // No more requests
    setShowUnavailableModal(false);
    setCurrentRequestId(null);
    return false;
  }, [unavailableQueue, currentRequestId]);

  // Handle request completion (Accept or Choose Someone Else)
  const handleRequestComplete = useCallback(() => {
    // The request will be removed from Firestore, which triggers onSnapshot
    // We need to move to next before the queue updates
    moveToNextRequest();
  }, [moveToNextRequest]);

  // Handle skip (just this one)
  const handleSkip = useCallback(() => {
    if (currentRequestId) {
      skippedRequestsRef.current.add(currentRequestId);
    }
    moveToNextRequest();
  }, [currentRequestId, moveToNextRequest]);

  // Handle skip all
  const handleSkipAll = useCallback(() => {
    // Mark all remaining as skipped
    const currentIdx = unavailableQueue.findIndex((r) => getRequestId(r) === currentRequestId);
    
    for (let i = currentIdx; i < unavailableQueue.length; i++) {
      const id = getRequestId(unavailableQueue[i]);
      skippedRequestsRef.current.add(id);
    }

    setSkippedAll(true);
    setShowUnavailableModal(false);
    setCurrentRequestId(null);
  }, [unavailableQueue, currentRequestId]);

  const shouldShowDrawer =
    userRoles.isAlhan ||
    userRoles.isSSTeacher ||
    userRoles.isServant ||
    userRoles.ssAdmin ||
    userRoles.admin ||
    userRoles.alhanAdmin ||
    userRoles.superAdmin;

  if (isLoading) {
    return (
      <ScrollView
        contentContainerStyle={styles.loadingContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#147efb"
            colors={["#147efb"]}
          />
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

      {/* Unavailable Request Modal */}
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