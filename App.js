import React, { useState, useEffect } from "react";
import { StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import "react-native-gesture-handler";
import { UserProvider, useUser } from "./UserContext";

import Welcome from "./screens/Welcome";
import SignIn from "./screens/SignIn";
import SignUp from "./screens/SignUp";
import SelectChurch from "./screens/SelectChurch";
import SelectApplicable from "./screens/SelectApplicable";
import DeaconRank from "./screens/DeaconRank";
import Experience from "./screens/Experience";
import Frequency from "./screens/Frequency";
import PasswordReset from "./screens/PasswordReset";
import ChurchRegistration from "./screens/ChurchRegistration";
import MainContainer from "./screens/MainContainer";

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const { user, setUser } = useUser(); // Access user and setUser from the UserContext
  const [initializing, setInitializing] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false); // State to determine if the user is new

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(onAuthStateChanged);
    return subscriber; // unsubscribe on unmount
  }, []);

  useEffect(() => {
    const checkUserData = async () => {
      if (user) {
        try {
          const userDoc = await firestore().collection("users").doc(user.uid).get();
          setIsNewUser(!userDoc.exists || Object.keys(userDoc.data()).length === 0);
        } catch (error) {
          console.error("Error checking user data:", error);
        }
      }
    };

    checkUserData();
  }, [user]);

  function onAuthStateChanged(user) {
    console.log("Auth state changed:", user);
    setUser(user);
    if (initializing) setInitializing(false);
  }
  
  useEffect(() => {
    const checkUserData = async () => {
      if (user) {
        try {
          const userDoc = await firestore().collection("users").doc(user.uid).get();
          console.log("User document exists:", userDoc.exists);
          setIsNewUser(!userDoc.exists || Object.keys(userDoc.data()).length === 0);
        } catch (error) {
          console.error("Error checking user data:", error);
        }
      }
    };
  
    checkUserData();
  }, [user]);

  if (initializing) return null; // Return null or a loading indicator while initializing

  return (
    <NavigationContainer style={styles.container}>
      <Stack.Navigator
        initialRouteName={
          !user ? "Welcome" : isNewUser ? "SelectChurch" : "MainContainer"
        }
        screenOptions={{ headerShown: false }}
      >
        {!user ? (
          <>
            <Stack.Screen name="Welcome" component={Welcome} />
            <Stack.Screen name="SignUp" component={SignUp} />
            <Stack.Screen name="PasswordReset" component={PasswordReset} />
            <Stack.Screen name="SignIn" component={SignIn} />
          </>
        ) : isNewUser ? (
          <>
            <Stack.Screen name="SelectChurch" component={SelectChurch} />
            <Stack.Screen name="ChurchRegistration" component={ChurchRegistration} />
            <Stack.Screen name="SelectApplicable" component={SelectApplicable} />
            <Stack.Screen name="DeaconRank" component={DeaconRank} />
            <Stack.Screen name="Experience" component={Experience} options={{ animation: "none"}}/>
            <Stack.Screen name="Frequency" component={Frequency} options={{ animation: "none"}}/>
            <Stack.Screen name="MainContainer" component={MainContainer} />
          </>
        ) : (
          <Stack.Screen name="MainContainer" component={MainContainer} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <UserProvider>
      <AppNavigator />
    </UserProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});