import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import NetInfo from "@react-native-community/netinfo";
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

// Component to display when no Wi-Fi is available
const NoWifiScreen = ({ onRetry }) => (
  <SafeAreaView style={styles.noWifiContainer}>
    <View style={styles.noWifiContent}>
      <Text style={styles.noWifiTitle}>No Wi-Fi Connection</Text>
      <Text style={styles.noWifiMessage}>
        This app requires a Wi-Fi connection to function. Please connect to Wi-Fi
        and try again.
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  </SafeAreaView>
);

function AppNavigator() {
  const { user, setUser, signUp, setSignUp } = useUser();
  const [initializing, setInitializing] = useState(true);
  const [isWifiConnected, setIsWifiConnected] = useState(null); // null until checked

  // Check Wi-Fi status and listen for network changes
  useEffect(() => {
    // Initial check
    const checkWifi = async () => {
      try {
        const state = await NetInfo.fetch();
        setIsWifiConnected(state.isConnected && state.type === "wifi");
      } catch (error) {
        console.error("Error checking Wi-Fi:", error);
        setIsWifiConnected(false);
      }
    };

    checkWifi();

    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener((state) => {
      console.log("Network state:", state);
      setIsWifiConnected(state.isConnected && state.type === "wifi");
    });

    return () => unsubscribe();
  }, []);

  // Handle authentication state
  useEffect(() => {
    if (!user) {
      setSignUp(false);
      console.log("user:", !user);
      console.log("signUp:", signUp);
    }
    const subscriber = auth().onAuthStateChanged((user) => {
      setUser(user);
      setInitializing(false);
    });
    return subscriber;
  }, []);

  // Retry button handler
  const handleRetry = async () => {
    try {
      const state = await NetInfo.fetch();
      setIsWifiConnected(state.isConnected && state.type === "wifi");
    } catch (error) {
      console.error("Error retrying Wi-Fi check:", error);
      setIsWifiConnected(false);
    }
  };

  // Show nothing while initializing or Wi-Fi status is unknown
  if (initializing || isWifiConnected === null) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Checking connection...</Text>
      </SafeAreaView>
    );
  }

  // Show No Wi-Fi screen if not connected to Wi-Fi
  if (!isWifiConnected) {
    return <NoWifiScreen onRetry={handleRetry} />;
  }

  // Render the navigation stack if Wi-Fi is connected
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
                  focus: ({ navigation }) => {
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
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
  },
  noWifiContent: {
    padding: 20,
    alignItems: "center",
  },
  noWifiTitle: {
    fontSize: 24,
    color: "#e0e0e0",
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  noWifiMessage: {
    fontSize: 16,
    color: "#e0e0e0",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#147efb",
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignSelf: "center",
  },
  retryButtonText: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "bold",
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    color: "#e0e0e0",
    textAlign: "center",
  },
});