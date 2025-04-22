import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import auth from "@react-native-firebase/auth";
import { UserProvider, useUser } from "./UserContext";
import NetInfo from "@react-native-community/netinfo";
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
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // Check any internet connectivity
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected && state.isInternetReachable);
    });

    // Initial auth state check
    if (!user) {
      setSignUp(false);
      console.log("user :", !user);
      console.log("sign Up :", signUp);
    }
    const subscriber = auth().onAuthStateChanged((user) => {
      setUser(user);
      setInitializing(false);
    });

    return () => {
      unsubscribe();
      subscriber();
    };
  }, []);

  // Function to retry internet connection and navigate if connected
  const handleRetry = () => {
    NetInfo.fetch().then((state) => {
      const isNowConnected = state.isConnected && state.isInternetReachable;
      setIsConnected(isNowConnected);
    });
  };

  if (initializing) return null;

  // If not connected to the internet, show message with retry button
  if (!isConnected) {
    return (
      <View style={styles.noWifiContainer}>
        <Text style={styles.noWifiText}>
          This app requires an internet connection. Please connect to the internet and try again.
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <NavigationContainer style={styles.container}>
      <Stack.Navigator
        initialRouteName={
          !user ? "Welcome" : !signUp ? "MainContainer" : "SelectChurch"
        }
        screenOptions={{ headerShown: false, animation: "none" }}
      >
        {!user ? (
          <>
            <Stack.Screen
              name="Welcome"
              component={Welcome}
              options={{
                animation: "slide_from_left",
                cardStyle: { backgroundColor: "black" },
                headerShown: false,
                gesturesEnabled: false,
                listeners: {
                  focus: () => {
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
        ) : !signUp ? (
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
  noWifiContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#1e1e1e",
  },
  noWifiText: {
    fontSize: 18,
    textAlign: "center",
    color: "#fff",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#147EFB",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});