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

const AlhanNavigator = () => {
  const [initialRoute, setInitialRoute] = useState(null);
  const user = auth().currentUser;
  const navigation = useNavigation();  // Get the navigation object

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        setInitialRoute("SundaySchoolGrades"); // Default route when user is not found
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
            userData.ssSetUp ? "SundaySchoolAttendance" : "SundaySchoolGrades"
          );
        } else {
          setInitialRoute("SundaySchoolGrades"); // Default route when no document found
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setInitialRoute("SundaySchoolGrades");
      }
    };

    fetchUserData();
  }, [user]);

  useEffect(() => {
    // Reset the navigation stack when the initial route changes to "SundaySchoolGrades"
    if (initialRoute === "SundaySchoolGrades") {
      navigation.reset({
        index: 0,  // Reset to the first screen
        routes: [{ name: "SundaySchoolGrades" }],
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
        name="SundaySchoolAttendance"
        component={SundaySchoolAttendance}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SundaySchoolGrades"
        component={SundaySchoolGrades}
        options={{ headerShown: false ,
          animation: "slide_from_left",
        }}
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
