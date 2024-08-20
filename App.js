import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import auth from '@react-native-firebase/auth';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import Welcome from './screens/Welcome';
import SignIn from './screens/SignIn';
import SignUp from './screens/SignUp';
import SelectChurch from "./screens/SelectChurch";
import SelectApplicable from "./screens/SelectApplicable";
import DeaconRank from "./screens/DeaconRank";
import Frequency from "./screens/Frequency";
import Experience from "./screens/Experience";
import ChurchInformation from "./screens/ChurchInformation";
import PasswordReset from "./screens/PasswordReset";
import ChurchLogo from "./screens/ChurchLogo";
import ChurchRegistrationVerification from "./screens/ChurchRegistrationVerification";
import ChurchVerification from "./screens/ChurchVerification";
import Home from "./screens/HomeScreen";
import Attendence from "./screens/Attendence";
import EditSchedule from "./screens/EditSchedule";
import MainContainer from "./screens/MainContainer";

const Stack = createNativeStackNavigator();

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);

  function onAuthStateChanged(user) {
    setUser(user);
    if (initializing) setInitializing(false);
  }

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(onAuthStateChanged);
    return subscriber; // unsubscribe on unmount
  }, []);

  if (initializing) return null;

  return (
    <NavigationContainer style={styles.container}>
      <Stack.Navigator
        initialRouteName={user ? 'Home' : 'Welcome'}
        screenOptions={{ headerShown: false }}
        gestureEnabled={false}
      >
        {!user ? (
          <>
            <Stack.Screen name="Welcome" component={Welcome} />
            <Stack.Screen name="SignUp" component={SignUp} />
            <Stack.Screen name="SignIn" component={SignIn} />
            <Stack.Screen name="PasswordReset" component={PasswordReset} />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={Home} />
            <Stack.Screen name="SelectChurch" component={SelectChurch} initialParams={{ person: "you" }} />
            <Stack.Screen name="SelectApplicable" component={SelectApplicable} />
            <Stack.Screen name="DeaconRank" component={DeaconRank} />
            <Stack.Screen name="Frequency" component={Frequency} />
            <Stack.Screen name="Experience" component={Experience} />
            <Stack.Screen name="ChurchInformation" component={ChurchInformation} />
            <Stack.Screen name="ChurchLogo" component={ChurchLogo} />
            <Stack.Screen name="ChurchVerification" component={ChurchVerification} />
            <Stack.Screen name="Attendence" component={Attendence} />
            <Stack.Screen name="EditSchedule" component={EditSchedule} />
            <Stack.Screen name="MainContainer" component={MainContainer} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});