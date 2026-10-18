import React, { useState, useEffect } from "react";
import { LogBox } from "react-native";
import { StyleSheet, Text, View, ScrollView, RefreshControl } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { getAuth, onAuthStateChanged, updateProfile } from "@react-native-firebase/auth";
import {
  doc,
  getDoc,
  getDocFromCache,
  getFirestore,
  setDoc,
} from "@react-native-firebase/firestore";
import NetInfo from "@react-native-community/netinfo";
import { UserProvider, useUser } from "./UserContext";
import { initializeCacheManager } from "./utils/cacheManager";
import { startDeepLinkListener } from "./utils/deepLinks";
import { takePendingAppleName } from "./utils/pendingAppleName";
import { hydrate as hydrateAvatarCache } from "./utils/avatarCache";
import LoadingWheel from "./components/LoadingWheel";

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
import withContentColumn from "./components/ContentColumn";
import MainContainer from "./screens/MainContainer";

LogBox.ignoreLogs([
  "This method is deprecated",
  "rnfirebase.io/migrating-to-v22",
]);
const Stack = createNativeStackNavigator();

// Onboarding and password reset are phone-width forms; on an iPad they sit in
// a centered column instead of stretching edge to edge (a no-op on phones).
// Welcome / SignIn / SignUp lay themselves out for tablets already.
const FORM_COLUMN = { maxWidth: 560 };
const PasswordResetCol      = withContentColumn(PasswordReset, FORM_COLUMN);
const InputPhotoCol         = withContentColumn(InputPhoto, FORM_COLUMN);
const SelectChurchCol       = withContentColumn(SelectChurch, FORM_COLUMN);
const ChurchRegistrationCol = withContentColumn(ChurchRegistration, FORM_COLUMN);
const SelectApplicableCol   = withContentColumn(SelectApplicable, FORM_COLUMN);
const DeaconRankCol         = withContentColumn(DeaconRank, FORM_COLUMN);
const ExperienceCol         = withContentColumn(Experience, FORM_COLUMN);
const FrequencyCol          = withContentColumn(Frequency, FORM_COLUMN);

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

  // Universal links (the App Clip URLs) open the installed app instead of the
  // clip, so they have to be handled here. Started above the auth gate on
  // purpose: a link can arrive while signed out, and the pending route is held
  // until a screen is able to act on it.
  useEffect(() => startDeepLinkListener(), []);

  useEffect(() => {
    const subscriber = onAuthStateChanged(getAuth(), async (user) => {
      // Check if user needs to complete sign up BEFORE setting user state
      if (!user) {
        // No user logged in, needs sign up
        setSignUp(true);
        setUser(user);
      } else {
        // Non-empty only right after Sign in with Apple handed over a name.
        const appleName = takePendingAppleName();
        if (appleName && !user.displayName) {
          updateProfile(user, { displayName: appleName }).catch(() => {});
        }
        const name = user.displayName || appleName;
        try {
          // User is logged in, ensure Firestore user doc exists, then check if onboarding is complete.
          const userRef = doc(getFirestore(), "users", user.uid);

          // Try the on-disk Firestore cache first. Persistence is enabled by
          // default in RN Firebase but the app never used it, so every launch
          // paid a full network round-trip here while rendering nothing. For a
          // returning user this resolves in ~1ms; the server read below still
          // runs and corrects anything stale.
          let userDoc = null;
          try {
            const cached = await getDocFromCache(userRef);
            if (cached.exists && cached.data()?.DOB) {
              setSignUp(false);
              setUser(user);
              setInitializing(false);
              userDoc = cached;
            }
          } catch {
            // Nothing cached yet (first launch) — fall through to the server.
          }

          if (!userDoc) userDoc = await getDoc(userRef);

          // An existing account with no name on file (e.g. made before Apple's
          // name was saved) takes the one Apple just sent.
          if (userDoc.exists && appleName && !userDoc.data()?.name) {
            await setDoc(userRef, { name: appleName }, { merge: true });
          }

          if (!userDoc.exists) {
            // If the Auth user exists but Firestore doc doesn't (race during sign-up, or legacy state),
            // create a minimal doc so onboarding screens can safely update it.
            await setDoc(
              userRef,
              {
                uid: user.uid,
                name: name || "",
                email: user.email || "",
                admin: false,
                rank: "Chanter (Epsaltos)",
                experience: 1,
                frequency: 1,
                alhanGrades: [],
                ssGrades: [],
                nextWeekServe: "N/A",
              },
              { merge: true }
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

  // Load persisted avatar URLs before first paint so cached profile pictures
  // render instantly on a cold start. Purely local — safe to run unauthenticated.
  useEffect(() => {
    hydrateAvatarCache();
  }, []);

  // Initialize cache only when user setup is complete
  useEffect(() => {
    if (user && !signUp && !cacheInitialized) {
      // User is authenticated and setup is complete
      initializeCacheManager();
      setCacheInitialized(true);
    }
  }, [user, signUp, cacheInitialized]);

  // Only reached on a genuine cold start now (no Firestore cache yet).
  // Previously this rendered `null` — a blank screen — for a full network RTT.
  // We don't know which screen comes next, so: one full-screen block.
  if (initializing) return <LoadingWheel />;

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
              component={PasswordResetCol}
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
            <Stack.Screen name="InputPhoto" component={InputPhotoCol} />
            <Stack.Screen name="SelectChurch" component={SelectChurchCol} />
            <Stack.Screen
              name="ChurchRegistration"
              component={ChurchRegistrationCol}
            />
            <Stack.Screen
              name="SelectApplicable"
              component={SelectApplicableCol}
            />
            <Stack.Screen name="DeaconRank" component={DeaconRankCol} />
            <Stack.Screen name="Experience" component={ExperienceCol} />
            <Stack.Screen name="Frequency" component={FrequencyCol} />
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