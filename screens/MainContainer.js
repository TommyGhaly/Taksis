import React, { useEffect, useState } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createDrawerNavigator } from "@react-navigation/drawer";
import HomeScreen from "./HomeScreen";
import AlhanAttendance from "./AlhanAttendance";
import SundaySchoolAttendance from "./SundaySchoolAttendance";
import ServantsMeetingAttendance from "./ServantsMeetingAttendance";
import LearnItNavigation from "./LearnIt/LearnItNavigation";
import SettingsNavigation from "./Settings/SettingsNavigation";
import EditSchedule from "./EditSchedule";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

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

// Tab Navigator containing the main screens
function TabNavigator({ userRoles }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: "horizontal",
        tabBarStyle: {
          height: 90,
          backgroundColor: "rgba(34,36,40,1)",
          borderTopWidth: 0,
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Learn It" component={LearnItNavigation} />
      {userRoles.admin && (
        <Tab.Screen name="Edit Schedule" component={EditSchedule} />
      )}
      <Tab.Screen name="Settings" component={SettingsNavigation} />
    </Tab.Navigator>
  );
}

export default function MainContainer() {
  const [userRoles, setUserRoles] = useState({
    isAlhan: false,
    isSSTeacher: false,
    isServant: false,
    admin: false,
  });

  useEffect(() => {
    const user = auth().currentUser;
    if (user) {
      const unsubscribe = firestore()
        .collection("users")
        .doc(user.uid)
        .onSnapshot((doc) => {
          if (doc.exists) {
            setUserRoles(doc.data());
          }
        }, (error) => {
          console.error("Error fetching user roles: ", error);
        });

      // Cleanup the subscription on unmount
      return () => unsubscribe();
    }
  }, []);

  // Determine if the drawer should be shown
  const shouldShowDrawer =
    userRoles.isAlhan || userRoles.isSSTeacher || userRoles.isServant;

  return (
    <NavigationContainer independent={true} theme={myTheme}>
      {shouldShowDrawer ? (
        <Drawer.Navigator
          screenOptions={{
            drawerStyle: {
              backgroundColor: "#1e1e1e",
              width: 270,
            },
            headerShown: false,
            drawerActiveTintColor: "#147efb",
            drawerInactiveTintColor: "#8e8e93"
          }}
        >
          {/* Add the TabNavigator as the main content */}
          <Drawer.Screen
            name="Home"
            options={{ headerShown: false }}
          >
            {() => <TabNavigator userRoles={userRoles} />}
          </Drawer.Screen>
          {/* Conditionally render attendance screens in the drawer */}
          {userRoles.isAlhan && (
            <Drawer.Screen name="Alhan Attendance" component={AlhanAttendance} />
          )}
          {userRoles.isSSTeacher && (
            <Drawer.Screen
              name="Sunday School Attendance"
              component={SundaySchoolAttendance}
            />
          )}
          {userRoles.isServant && (
            <Drawer.Screen
              name="Servants Meeting Attendance"
              component={ServantsMeetingAttendance}
            />
          )}
        </Drawer.Navigator>
      ) : (
        <TabNavigator userRoles={userRoles} />
      )}
    </NavigationContainer>
  );
}