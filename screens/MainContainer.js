import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text } from "react-native";
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
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import CustomHeader from "../components/customHeader";

// Import individual screen components for dynamic home screen
import HomeScreen from "./Home/HomeScreen";
import SundaySchoolAttendance from "./SundaySchool/SundaySchoolAttendance";
import AlhanAttendance from "./Alhan/AlhanAttendance";
import ServantsAttendance from "./ServantsMeeting/ServantsAttendance";

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

// Map screen IDs to their components and configurations
const screenConfigs = {
  schedule: {
    component: HomeScreen,
    name: "Deacon Service Schedule",
    drawerName: "Deacon Service Schedule",
  },
  sundaySchoolAttendance: {
    component: SundaySchoolAttendance,
    name: "Sunday School Attendance",
    drawerName: "Sunday School Attendance",
  },
  hymnsClassAttendance: {
    component: AlhanAttendance,
    name: "Hymns Class Attendance",
    drawerName: "Hymns Class Attendance",
  },
  servantsMeetingTracker: {
    component: ServantsAttendance,
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

function TabNavigator({ userRoles, setHomeTitle, showDrawer, homeScreenId }) {
  // Get the home screen configuration
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
  // Determine which screens should be in the drawer based on user's home screen selection
  const shouldShowInDrawer = (screenId) => {
    // If this screen is the home screen, show "Deacon Service Schedule" instead
    if (screenId === homeScreenId && homeScreenId !== "schedule") {
      return false;
    }
    // Always show the schedule if it's not the home screen
    if (screenId === "schedule" && homeScreenId !== "schedule") {
      return true;
    }
    // Check role-based permissions
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
      
      {/* Always show Deacon Service Schedule if it's not the home screen */}
      {shouldShowInDrawer("schedule") && (
        <Drawer.Screen
          name="Deacon Service Schedule"
          component={HomeScreenNavigation}
        />
      )}
      
      {/* Conditionally show other screens based on roles and home screen selection */}
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
  const [homeTitle, setHomeTitle] = useState("Deacon Service Schedule");
  const [homeScreenId, setHomeScreenId] = useState("schedule");
  const [isLoading, setIsLoading] = useState(true);

useEffect(() => {
  const user = auth().currentUser;
  if (user) {
    const unsubscribe = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        async (doc) => {
          if (doc.exists) {
            const data = doc.data();
            setUserRoles(data);
            
            // Determine home screen based on user preference or default logic
            let selectedHomeScreen = data.homeScreen;
            
            if (!selectedHomeScreen) {
              // Apply default logic if no preference is set
              if (data.isDeacon) {
                // Deacon (admin) defaults to schedule
                selectedHomeScreen = "schedule";
              } else if (data.isSSTeacher) {
                // Sunday School servant defaults to Sunday School Attendance
                selectedHomeScreen = "sundaySchoolAttendance";
              } else if (data.isAlhan) {
                // Alhan teacher defaults to Hymns Class Attendance
                selectedHomeScreen = "hymnsClassAttendance";
              } else {
                // Everyone else defaults to schedule
                selectedHomeScreen = "schedule";
              }
              
              // Update the user document with the default home screen
              try {
                await firestore()
                  .collection("users")
                  .doc(user.uid)
                  .update({
                    homeScreen: selectedHomeScreen
                  });
              } catch (error) {
              }
            }
            
            setHomeScreenId(selectedHomeScreen);
            const config = screenConfigs[selectedHomeScreen];
            if (config) {
              setHomeTitle(config.name);
            }
            setIsLoading(false);
          }
        },
        (error) => {
          console.error("Error fetching user data:", error);
          setIsLoading(false);
        }
      );

    return () => unsubscribe();
  }
}, []);

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
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
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