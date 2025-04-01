import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { createStackNavigator } from "@react-navigation/stack";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";

import AlhanAttendance from "./AlhanAttendance";
import AlhanGrades from "./AlhanGrades";
import IndividualAttendance from "../IndividualAttendance";

const Stack = createStackNavigator();

const AlhanNavigator = () => {
  const [initialRoute, setInitialRoute] = useState(null);
  const user = auth().currentUser;
  const navigation = useNavigation();

  useEffect(() => {
    if (!user) {
      setInitialRoute("AlhanGrades");
      return;
    }

    // Set up the real-time listener on the user document
    const unsubscribe = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        (doc) => {
          if (doc.exists) {
            const userData = doc.data();
            setInitialRoute(userData.alhanSetUp ? "AlhanAttendance" : "AlhanGrades");
          } else {
            setInitialRoute("AlhanGrades");
          }
        },
        (error) => {
          console.error("Error fetching user data:", error);
          setInitialRoute("AlhanGrades");
        }
      );

    // Clean up the listener on unmount
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (initialRoute === "AlhanGrades") {
      navigation.reset({
        index: 0,
        routes: [{ name: "AlhanGrades" }],
      });
    }
  }, [initialRoute, navigation]);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <Stack.Navigator initialRouteName={initialRoute}>
      <Stack.Screen
        name="AlhanAttendance"
        component={AlhanAttendance}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="AlhanGrades"
        component={AlhanGrades}
        options={{ headerShown: false, animation: "slide_from_right", gestureEnabled: false }}
      />
      <Stack.Screen
        name="IndividualAttendance"
        component={IndividualAttendance}
        options={{ headerShown: false, gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
};

export default AlhanNavigator;
