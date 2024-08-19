import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "./HomeScreen";
import Attendence from "./Attendence";
import LearnItMainMenu from "./LearnItMainMenu";
import Settings from "./Settings";
import EditSchedule from "./EditSchedule";

const Tab = createBottomTabNavigator();

export default function MainContainer({ navigation }) {
  return (
    <NavigationContainer independent={true}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            height: 90,
            backgroundColor: "rgba(34,36,40,1)",
            borderTopWidth: 0,
          },
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Attendence" component={Attendence} />
        <Tab.Screen name="Learn It" component={LearnItMainMenu} />
        <Tab.Screen name="Settings" component={Settings} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
