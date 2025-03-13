import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import ServantsAttendance from "./ServantsAttendance";
import IndividualServant from "./IndividualServant";

const Stack = createStackNavigator();

const ServantsMeetingNavigator = () => {
  return (
    <Stack.Navigator initialRouteName={"ServantsAttendance"}>
      <Stack.Screen
        name="ServantsAttendance"
        component={ServantsAttendance}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="IndividualServant"
        component={IndividualServant}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default ServantsMeetingNavigator;
