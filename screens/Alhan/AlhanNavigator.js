import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { createStackNavigator } from "@react-navigation/stack";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

import AlhanAttendance from "./AlhanAttendance";
import AlhanGrades from "./AlhanGrades";

const Stack = createStackNavigator();

const AlhanNavigator = () => {
  const [initialRoute, setInitialRoute] = useState(null);
  const user = auth().currentUser;

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
    </Stack.Navigator>
  );
};

export default AlhanNavigator;
