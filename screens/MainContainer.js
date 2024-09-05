import React, { useEffect, useState } from "react";
import { StyleSheet, View, Text } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createDrawerNavigator } from "@react-navigation/drawer";
import Icon from 'react-native-vector-icons/FontAwesome';  // Import FontAwesome icons

import HomeScreenNavigation from "./Home/HomeScreenNavigator";
import AlhanAttendance from "./AlhanAttendance";
import SundaySchoolAttendance from "./SundaySchoolAttendance";
import ServantsMeetingAttendance from "./ServantsMeetingAttendance";
import LearnItNavigation from "./LearnIt/LearnItNavigation";
import SettingsNavigation from "./Settings/SettingsNavigation";
import EditSchedule from "./EditSchedule";
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

// Define a common header style
const headerStyle = {
  backgroundColor: "black",
};

function TabNavigator({ userRoles, setHomeTitle, showDrawer }) {
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: '#333' },  // Apply common header style
        headerTintColor: "#fff",
        tabBarStyle: {
          height: 90,
          backgroundColor: "rgba(34,36,40,1)",
          borderTopWidth: 0,
        },
        tabBarLabel: () => null,  // Hide the labels
        headerLeft: showDrawer ? () => <CustomHeader navigation={navigation}/> : undefined,
        tabBarIcon: ({ color, size }) => {
          let iconName;

          switch (route.name) {
            case "This Week's Services":
              iconName = 'home';
              break;
            case "Learn to Serve":
              iconName = 'book';  // Changed to 'book' icon
              break;
            case "Edit Schedule":
              iconName = 'pencil';  // Using 'pencil' as an editing pen
              break;
            case "Settings":
              iconName = 'gear';  // Using 'gear' as a settings icon
              break;
            default:
              iconName = 'question';  // Default icon if route name is not matched
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="This Week's Services"
        component={HomeScreenNavigation}
        listeners={{
          focus: () => setHomeTitle("This Week's Services"),
        }}
      />
      <Tab.Screen
        name="Learn to Serve"
        component={LearnItNavigation}
        listeners={{
          focus: () => setHomeTitle("Learn to Serve"),
        }}
      />
      {userRoles.admin && (
        <Tab.Screen
          name="Edit Schedule"
          component={EditSchedule}
          listeners={{
            focus: () => setHomeTitle("Edit Schedule"),
          }}
        />
      )}
      <Tab.Screen
        name="Settings"
        component={SettingsNavigation}
        listeners={{
          focus: () => setHomeTitle("Settings"),
        }}
      />
    </Tab.Navigator>
  );
}

function DrawerNavigator({ userRoles, homeTitle, setHomeTitle }) {
  return (
    <Drawer.Navigator
      screenOptions={({ navigation, route }) => ({
        drawerStyle: {
          backgroundColor: "#1e1e1e",
          width: 270,
        },
        headerShown: true,
        headerTitle: route.name === 'Home' ? homeTitle : route.name, // Use homeTitle for Home, otherwise use route.name
        headerLeft: () => <CustomHeader navigation={navigation} />,
        drawerActiveTintColor: "#147efb",
        drawerInactiveTintColor: "#8e8e93",
        headerStyle: headerStyle,
        headerTintColor: "#fff",
      })}
    >
      <Drawer.Screen
        name="Home"
        options={{ headerShown: false }} // Hide the drawer header when the tab is active
      >
        {({ navigation }) => (
          <TabNavigator
            userRoles={userRoles}
            setHomeTitle={setHomeTitle}
            showDrawer={true} // Indicate that the drawer should be shown
          />
        )}
      </Drawer.Screen>
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
  );
}

export default function MainContainer() {
  const [userRoles, setUserRoles] = useState({
    isAlhan: false,
    isSSTeacher: false,
    isServant: false,
    admin: false,
  });
  const [homeTitle, setHomeTitle] = useState("This Week's Services");

  useEffect(() => {
    const user = auth().currentUser;
    if (user) {
      const unsubscribe = firestore()
        .collection("users")
        .doc(user.uid)
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              setUserRoles(doc.data());
            }
          },
          (error) => {
            console.error("Error fetching user roles: ", error);
          }
        );

      // Cleanup the subscription on unmount
      return () => unsubscribe();
    }
  }, []);

  const shouldShowDrawer =
    userRoles.isAlhan || userRoles.isSSTeacher || userRoles.isServant;

  return (
    <NavigationContainer independent={true} theme={myTheme}>
      {shouldShowDrawer ? (
        <DrawerNavigator
          userRoles={userRoles}
          homeTitle={homeTitle}
          setHomeTitle={setHomeTitle}
        />
      ) : (
        <TabNavigator
          userRoles={userRoles}
          setHomeTitle={setHomeTitle}
          showDrawer={false} // Indicate that the drawer is not shown
        />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 60,
    backgroundColor: "#000",
  },
  header: {
    backgroundColor: "#1e1e1e",
  },
});
