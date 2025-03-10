import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

import SundaySchoolAttendance from './SundaySchoolAttendance';
import SundaySchoolGrades from './SundaySchoolGrades';

const Stack = createStackNavigator();

const AlhanNavigator = () => {
  const [initialRoute, setInitialRoute] = useState(null);
  const user = auth().currentUser;

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        setInitialRoute('SundaySchoolGrades'); // Default to Grades if no user
        return;
      }

      try {
        const userDoc = await firestore().collection("users").doc(user.uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          setInitialRoute(userData.AlhanSetUp ? 'SundaySchoolAttendance' : 'SundaySchoolGrades');
        } else {
          setInitialRoute('SundaySchoolGrades');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setInitialRoute('SundaySchoolGrades');
      }
    };

    fetchUserData();
  }, [user]);

  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <Stack.Navigator initialRouteName={initialRoute}>
      <Stack.Screen name="SundaySchoolAttendance" component={SundaySchoolAttendance} />
      <Stack.Screen name="SundaySchoolGrades" component={SundaySchoolGrades} />
    </Stack.Navigator>
  );
};

export default AlhanNavigator;
