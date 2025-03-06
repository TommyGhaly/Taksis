import React, { useState, useEffect } from "react";
import { StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import auth from "@react-native-firebase/auth";
import { UserProvider, useUser } from "./UserContext";
import "react-native-gesture-handler";

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
  const { user, setUser, signUp, setSignUp } = useUser();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (!user) {
      setSignUp(false);
      console.log("user :", !user);
      console.log("sign Up :", signUp);
    }
    const subscriber = auth().onAuthStateChanged((user) => {
      setUser(user);
      setInitializing(false);
    });
    return subscriber;
  }, []);

  if (initializing) return null;

  return (
    <NavigationContainer style={styles.container}>
      <Stack.Navigator
        initialRouteName={(!user ? "Welcome" : (!signUp ? "SignUp" : "MainContainer"))}
        screenOptions={{ headerShown: false, animation: "none" }}
      >
        {!user ? (
          <>
            <Stack.Screen
              name="Welcome"
              component={Welcome}
              options={{
                animation: "slide_from_left",
                // Reset the stack when the Welcome screen is shown
                cardStyle: { backgroundColor: "black" },
                headerShown: false,
                gesturesEnabled: false,
                // Optionally, you can clear the stack when navigating to Welcome
                // by overriding navigation actions.
                listeners: {
                  focus: () => {
                    // Reset stack when Welcome screen is focused
                    if (typeof navigation.reset === "function") {
                      navigation.reset({
                        index: 0,
                        routes: [{ name: "Welcome" }],
                      });
                    }
                  },
                },
              }}
            />
            <Stack.Screen
              name="PasswordReset"
              component={PasswordReset}
              options={{ animation: "default" }}
            />
            <Stack.Screen
              name="SignIn"
              component={SignIn}
              options={{ animation: "default" }}
            />
            <Stack.Screen
              name="SignUp"
              component={SignUp}
              options={{ animation: "default" }}
            />
          </>
        ) : signUp ? (
          <Stack.Screen name="MainContainer" component={MainContainer} />
        ) : (
          <>
            <Stack.Screen name="SelectChurch" component={SelectChurch} />
            <Stack.Screen
              name="ChurchRegistration"
              component={ChurchRegistration}
            />
            <Stack.Screen
              name="SelectApplicable"
              component={SelectApplicable}
            />
            <Stack.Screen name="DeaconRank" component={DeaconRank} />
            <Stack.Screen name="Experience" component={Experience} />
            <Stack.Screen name="Frequency" component={Frequency} />
            <Stack.Screen name="MainContainer" component={MainContainer} />
          </>
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
