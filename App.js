import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import auth from "@react-native-firebase/auth";
import NetInfo from "@react-native-community/netinfo";
import { UserProvider, useUser } from "./UserContext";
import { initializeCacheManager } from "./utils/cacheManager";
import "react-native-gesture-handler";

import Welcome from "./screens/Welcome";
import SignIn from "./screens/SignIn";
import SignUp from "./screens/SignUp";
import InputPhoto from "./screens/InputPhoto";
import SelectChurch from "./screens/SelectChurch";
import SelectApplicable from "./screens/SelectApplicable";
import DeaconRank from "./screens/DeaconRank";
import Experience from "./screens/Experience";
import Frequency from "./screens/Frequency";
import PasswordReset from "./screens/PasswordReset";
import ChurchRegistration from "./screens/ChurchRegistration";
import MainContainer from "./screens/MainContainer";

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
  const [refreshing, setRefreshing] = useState(false);
  const [authSubscriber, setAuthSubscriber] = useState(null);

  useEffect(() => {
    if (!user) {
      setSignUp(false);
    }
    
    // Subscribe to auth state changes
    const subscriber = auth().onAuthStateChanged((user) => {
      setUser(user);
      setInitializing(false);
    });
    
    setAuthSubscriber(() => subscriber);
    
    // Set a timeout to force initialization to false if it takes too long
    const timeout = setTimeout(() => {
      if (initializing) {
        setInitializing(false);
      }
    }, 10000); // 10 seconds timeout
    
    return () => {
      subscriber();
      clearTimeout(timeout);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    setInitializing(true);
    
    try {
      // Re-initialize auth listener
      if (authSubscriber) {
        authSubscriber();
      }
      
      // Force a re-check of current auth state
      const currentUser = auth().currentUser;
      setUser(currentUser);
      
      // Re-subscribe to auth changes
      const newSubscriber = auth().onAuthStateChanged((user) => {
        setUser(user);
        setInitializing(false);
        setRefreshing(false);
      });
      
      setAuthSubscriber(() => newSubscriber);
      
      // Set timeout for refresh
      setTimeout(() => {
        setInitializing(false);
        setRefreshing(false);
      }, 5000);
      
    } catch (error) {
      console.error("Error refreshing auth state:", error);
      setInitializing(false);
      setRefreshing(false);
    }
  };

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ScrollView
          contentContainerStyle={styles.scrollViewContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8e8e93"
            />
          }
        >
          <ActivityIndicator size="large" color="#8e8e93" />
          <Text style={styles.loadingText}>Loading...</Text>
          <Text style={styles.pullDownText}>Pull down to refresh if stuck</Text>
        </ScrollView>
      </View>
    );
  }

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
          <Stack.Screen name="MainContainer" component={MainContainer} />
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
            <Stack.Screen name="MainContainer" component={MainContainer} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    // Initialize cache manager on app startup
    initializeCacheManager();
  }, []);

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
  loadingContainer: {
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
  loadingText: {
    fontSize: 18,
    textAlign: "center",
    color: "#8e8e93",
    marginTop: 20,
  },
  pullDownText: {
    fontSize: 14,
    textAlign: "center",
    color: "#6e6e73",
    marginTop: 10,
  },
});