import React, { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { createStackNavigator } from "@react-navigation/stack";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useNavigation } from '@react-navigation/native';

import SundaySchoolAttendance from "./SundaySchoolAttendance";
import SundaySchoolGrades from "./SundaySchoolGrades";
import IndividualAttendance from "../IndividualAttendance";

const Stack = createStackNavigator();

const SundaySchoolNavigator = () => {
  const [initialRoute, setInitialRoute] = useState(null);
  const user = auth().currentUser;
  const navigation = useNavigation();

  useEffect(() => {
    if (!user) {
      setInitialRoute("SundaySchoolGrades");
      return;
    }

    const userRef = firestore().collection("users").doc(user.uid);

    // Set up a Firestore real-time listener
    const unsubscribe = userRef.onSnapshot((doc) => {
      if (doc.exists) {
        const userData = doc.data();
        const newInitialRoute = userData.ssSetUp ? "SundaySchoolAttendance" : "SundaySchoolGrades";
        setInitialRoute(newInitialRoute);

        // Reset navigation when the initial route is "SundaySchoolGrades"
        if (newInitialRoute === "SundaySchoolGrades") {
          navigation.reset({
            index: 0,
            routes: [{ name: "SundaySchoolGrades" }],
          });
        }
      } else {
        setInitialRoute("SundaySchoolGrades");
      }
    }, (error) => {
      console.error("Error fetching user data:", error);
      setInitialRoute("SundaySchoolGrades");
    });

    return () => unsubscribe(); // Cleanup the listener when the component unmounts
  }, [user, navigation]);

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
        name="SundaySchoolAttendance"
        component={SundaySchoolAttendance}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <Stack.Screen
        name="SundaySchoolGrades"
        component={SundaySchoolGrades}
        options={{
          headerShown: false,
          animation: "slide_from_right",
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="IndividualAttendance"
        component={IndividualAttendance}
        options={{ headerShown: false, gestureEnabled: true }}
      />
    </Stack.Navigator>
  );
};

export default SundaySchoolNavigator;
