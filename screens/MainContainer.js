import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "./HomeScreen";
import Attendence from "./Attendence";
import LearnItNavigation from "./LearnIt/LearnItNavigation";
import Settings from "./Settings/SettingsNavigation";
import DefaultTheme from "@react-navigation/native";
import { defaultTheme } from "@rneui/base";

const Tab = createBottomTabNavigator();
const myTheme = {
  ...DefaultTheme,
  colors: {
    primary: "#147efb",
    card: 'rgb(255, 255, 255)',
    background: "#000"
  },
}; 
export default function MainContainer() {
  return (
    <NavigationContainer independent={true} theme={myTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: "horizontal",
          tabBarStyle: {
            height: 90,
            backgroundColor: "rgba(34,36,40,1)",
            borderTopWidth: 0,
          },
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Attendence" component={Attendence} />
        <Tab.Screen name="Learn It" component={LearnItNavigation} />
        <Tab.Screen name="Settings" component={Settings} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
