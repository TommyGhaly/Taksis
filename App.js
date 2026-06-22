import React, { useState, useEffect } from "react";
import { LogBox } from "react-native";
import { StyleSheet, Text, View, ScrollView, RefreshControl } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import NetInfo from "@react-native-community/netinfo";
import { UserProvider, useUser } from "./UserContext";
import { initializeCacheManager } from "./utils/cacheManager";

import Welcome from "./screens/Welcome";
import SignIn from "./screens/SignIn";
import SignUp from "./screens/SignUp";
import InputPhoto from "./screens/AuthenticationScreens/InputPhoto";
import SelectChurch from "./screens/AuthenticationScreens/SelectChurch";
import SelectApplicable from "./screens/AuthenticationScreens/SelectApplicable";
import DeaconRank from "./screens/AuthenticationScreens/DeaconRank";
import Experience from "./screens/AuthenticationScreens/Experience";
import Frequency from "./screens/AuthenticationScreens/Frequency";
import PasswordReset from "./screens/PasswordReset";
import ChurchRegistration from "./screens/ChurchRegistration";
import MainContainer from "./screens/MainContainer";

LogBox.ignoreLogs([
  "This method is deprecated",
  "rnfirebase.io/migrating-to-v22",
]);
const Stack = createNativeStackNavigator();

function NetworkWrapper({ children }) {
  const [isConnected, setIsConnected] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
    });

    // Check initial network status
    NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    const state = await NetInfo.fetch();
    setIsConnected(state.isConnected);
    setRefreshing(false);
  };

  if (!isConnected) {
    return (
      <View style={styles.offlineContainer}>
        <ScrollView
          contentContainerStyle={styles.scrollViewContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Text style={styles.offlineText}>
            This app requires an internet connection. Please connect to Wi-Fi or mobile data and pull down to refresh.
          </Text>
        </ScrollView>
      </View>
    );
  }

  return children;
}

function AppNavigator() {
  const { user, setUser, signUp, setSignUp } = useUser();
  const [initializing, setInitializing] = useState(true);
  const [cacheInitialized, setCacheInitialized] = useState(false);

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(async (user) => {
      // Check if user needs to complete sign up BEFORE setting user state
      if (!user) {
        // No user logged in, needs sign up
        setSignUp(true);
        setUser(user);
      } else {
        try {
          // User is logged in, ensure Firestore user doc exists, then check if onboarding is complete.
          const userRef = firestore().collection("users").doc(user.uid);
          const userDoc = await userRef.get();

          if (!userDoc.exists) {
            // If the Auth user exists but Firestore doc doesn't (race during sign-up, or legacy state),
            // create a minimal doc so onboarding screens can safely update it.
            await userRef.set(
              {
                uid: user.uid,
                name: user.displayName || "",
                email: user.email || "",
                admin: false,
                rank: "Chanter (Epsaltos)",
                experience: 1,
                frequency: 1,
                alhanGrades: [],
                ssGrades: [],
                nextWeekServe: "N/A",
              },
              { merge: true },
            );
            setSignUp(true);
          } else if (!userDoc.data()?.DOB) {
            // Doc exists but sign-up is incomplete (mid-onboarding)
            setSignUp(true);
          } else {
            // Fully set up
            setSignUp(false);
          }
        } catch (error) {
          console.error("Error checking user document:", error);
          setSignUp(true);
        }
        // Set user AFTER signUp state is determined to prevent flash
        setUser(user);
      }

      setInitializing(false);
    });
    return subscriber;
  }, []);

  // Initialize cache only when user setup is complete
  useEffect(() => {
    if (user && !signUp && !cacheInitialized) {
      // User is authenticated and setup is complete
      initializeCacheManager();
      setCacheInitialized(true);
    }
  }, [user, signUp, cacheInitialized]);

  if (initializing) return null;

  return (
    <NavigationContainer style={styles.container}>
      <Stack.Navigator
        initialRouteName={(!user ? "Welcome" : (!signUp? "MainContainer" : "InputPhoto"))}
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
          <Stack.Screen 
            name="MainContainer" 
            component={MainContainer}
            listeners={{
              focus: () => {
                // Ensure cache is initialized when returning to MainContainer
                if (!cacheInitialized) {
                  initializeCacheManager();
                  setCacheInitialized(true);
                }
              },
            }}
          />
        ) : (
          <>
            <Stack.Screen name="InputPhoto" component={InputPhoto} />
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
            <Stack.Screen 
              name="MainContainer" 
              component={MainContainer}
              listeners={{
                focus: () => {
                  // Initialize cache when setup is complete and user reaches MainContainer
                  if (!cacheInitialized) {
                    initializeCacheManager();
                    setCacheInitialized(true);
                  }
                },
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  // Removed cache initialization from here
  return (
    <UserProvider>
      <NetworkWrapper>
        <AppNavigator />
      </NetworkWrapper>
    </UserProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  offlineContainer: {
    flex: 1,
    backgroundColor: "#121212",
  },
  scrollViewContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  offlineText: {
    fontSize: 18,
    textAlign: "center",
    color: "#8e8e93",
  },
});