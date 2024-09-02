import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
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
import CustomHeader from '../components/customHeader';

const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

const myTheme = {
  ...DefaultTheme,
  colors: {
    primary: "#147efb",
    card: "rgb(255, 255, 255)",
    background: "#000",
  },
  headerShown: false,
};

// Tab Navigator containing the main screens
function TabNavigator({ userRoles, shouldShowDrawer }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: {shouldShowDrawer}, 
        gestureEnabled: true,
        gestureDirection: "horizontal",
        tabBarStyle: {
          height: 90,
          backgroundColor: "rgba(34,36,40,1)",
          borderTopWidth: 0,
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} 
      options={{
        headerStyle: {
          backgroundColor: '#000',
          opacity: 1,
        },
        headerTintColor: 'white',
      }}/>
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
    <NavigationContainer independent={true} theme={myTheme} style={styles.header}>
      {shouldShowDrawer ? (
        <Drawer.Navigator
        screenOptions={({ navigation }) => ({
          drawerStyle: {
            backgroundColor: "#1e1e1e",
            width: 270,
          },
          headerShown: true,
          headerLeft: () => <CustomHeader navigation={navigation} />,
          drawerActiveTintColor: "#147efb",
          drawerInactiveTintColor: "#8e8e93",
          headerStyle: {
            backgroundColor: 'black',
            opacity: 1
          },
          headerTintColor: '#fff'
        })}
      >
          {/* Add the TabNavigator as the main content */}
          {/* <Button title="Show drawer" onPress={() => console.log("Show drawer")} /> */}
          <Drawer.Screen
            name="This Week's Service"
            options={{
              headerShown: true
            }}
          >
            {() => <TabNavigator userRoles={userRoles} shouldShowDrawer={shouldShowDrawer}/>}
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
        <TabNavigator userRoles={userRoles} shouldShowDrawer={shouldShowDrawer} />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 60,
    backgroundColor: "#000"
  },
  header: {
    backgroundColor: '#1e1e1e',
  },
});