import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { createStackNavigator } from "@react-navigation/stack";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useNavigation } from '@react-navigation/native';

import AlhanAttendance from "./AlhanAttendance";
import AlhanGrades from "./AlhanGrades";
import IndividualAttendance from "../IndividualAttendance";

const Stack = createStackNavigator();

const AlhanNavigator = () => {
  const [initialRoute, setInitialRoute] = useState(null);
  const user = auth().currentUser;
  const navigation = useNavigation();  // Get the navigation object

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        setInitialRoute("AlhanGrades"); // Default route when user is not found
        return;
      }

      try {
        const userDoc = await firestore()
          .collection("users")
          .doc(user.uid)
          .get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          setInitialRoute(
            userData.alhanSetUp ? "AlhanAttendance" : "AlhanGrades"
          );
        } else {
          setInitialRoute("AlhanGrades"); // Default route when no document found
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setInitialRoute("AlhanGrades");
      }
    };

    fetchUserData();
  }, [user]);

  useEffect(() => {
    // Reset the navigation stack when the initial route changes to "AlhanGrades"
    if (initialRoute === "AlhanGrades") {
      navigation.reset({
        index: 0,  // Reset to the first screen
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
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AlhanGrades"
        component={AlhanGrades}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="IndividualAttendance"
        component={IndividualAttendance}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default AlhanNavigator;
