import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "./HomeScreen";
import RequestWeek from "./RequestWeek";
import DefaultTheme from "@react-navigation/native";

const HomeNav = createNativeStackNavigator();
const myTheme = {
  ...DefaultTheme,
  colors: {
    primary: "#000",
    card: "rgb(255, 255, 255)",
    background: "#000",
  },
};
export default function HomeNavigation() {
  return (
    <NavigationContainer independent={true} theme={myTheme}>
      <HomeNav.Navigator
        initialRouteName="MainMenu"
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: "horizontal",
        }}
      >
        <HomeNav.Screen name="Home" component={HomeScreen} />
        <HomeNav.Screen name="RequestWeek" component={RequestWeek} />
      </HomeNav.Navigator>
    </NavigationContainer>
  );
}
