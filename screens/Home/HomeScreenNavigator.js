import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "./HomeScreen";
import { useNavigationTheme } from "../../theme";
import 'react-native-gesture-handler';


const HomeNav = createNativeStackNavigator();
export default function HomeNavigation() {
  const navTheme = useNavigationTheme();
  return (
    <NavigationContainer independent={true} theme={navTheme}>
      <HomeNav.Navigator
        initialRouteName="MainMenu"
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: "horizontal",
        }}
      >
        <HomeNav.Screen name="Home" component={HomeScreen} />
      </HomeNav.Navigator>
    </NavigationContainer>
  );
}
