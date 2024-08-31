import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "./HomeScreen";
import AlhanAttendance from "./AlhanAttendance";
import SundaySchoolAttendance from "./SundaySchoolAttendance";
import ServantsMeetingAttendance from "./ServantsMeetingAttendance";
import LearnItNavigation from "./LearnIt/LearnItNavigation";
import SettingsNavigation from "./Settings/SettingsNavigation";
import EditSchedule from "./EditSchedule";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import DefaultTheme from "@react-navigation/native";

const Tab = createBottomTabNavigator();
const myTheme = {
  ...DefaultTheme,
  colors: {
    primary: "#147efb",
    card: "rgb(255, 255, 255)",
    background: "#000",
  },
};

export default function MainContainer() {
  const [userRoles, setUserRoles] = useState({
    isAlhan: false,
    isSSTeacher: false,
    isServant: false,
    isAdmin: false,
  });

  useEffect(() => {
    const fetchUserRoles = async () => {
      try {
        const user = auth().currentUser;
        if (user) {
          const userDoc = await firestore().collection("users").doc(user.uid).get();
          if (userDoc.exists) {
            setUserRoles(userDoc.data());
          }
        }
      } catch (error) {
        console.error("Error fetching user roles: ", error);
      }
    };

    fetchUserRoles();
  }, []);

  return (
    <NavigationContainer independent={true} theme={myTheme}>
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
        {userRoles.isAlhan && (
          <Tab.Screen name="Alhan" component={AlhanAttendance} />
        )}
        {userRoles.isSSTeacher && (
          <Tab.Screen
            name="Sunday School"
            component={SundaySchoolAttendance}
          />
        )}
        <Tab.Screen name="Learn It" component={LearnItNavigation} />
        {userRoles.isServant && (
          <Tab.Screen
            name="Servants Meeting"
            component={ServantsMeetingAttendance}
          />
        )}
        {userRoles.isAdmin && (
          <Tab.Screen name="Edit Schedule" component={EditSchedule} />
        )}
        <Tab.Screen name="Settings" component={SettingsNavigation} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}