import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LearnItMainMenu from "./LearnItMainMenu";
import LearnItTasbehaMenu from "./Tasbeha/LearnItTasbehaMenu";
import LearnItLiturgyMenu from "./Liturgy/LearnItLiturgyMenu";
import LearnItVespersMenu from "./Vespers/LearnItVespers";
import LearnItMatins from "./Liturgy/LearnItMatins";
import LearnItOfferingLamb from "./Liturgy/LearnItOfferingLamb";
import LearnItLiturgyWord from "./Liturgy/LearnItLiturgyWord";
import LearnItLiturgyFaithful from "./Liturgy/LearnItLiturgyFaithful";
import LearnItDistribution from "./Liturgy/LearnItDistribution";
import DefaultTheme from "@react-navigation/native";
import "react-native-gesture-handler";

const LearnNav = createNativeStackNavigator();
const myTheme = {
  ...DefaultTheme,
  colors: {
    primary: "#000",
    card: "rgb(255, 255, 255)",
    background: "#000",
  },
};
export default function LearnNavigation() {
  return (
    <NavigationContainer independent={true} theme={myTheme}>
      <LearnNav.Navigator
        initialRouteName="MainMenu"
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: "horizontal",
        }}
      >
        <LearnNav.Screen name="MainMenu" component={LearnItMainMenu} />
        <LearnNav.Screen
          name="TesbehaMenu"
          component={LearnItTasbehaMenu}
          options={{ animation: "none" }}
        />
        <LearnNav.Screen
          name="LearnItMainMenu"
          component={LearnItMainMenu}
          options={{ animation: "none" }}
        />
        <LearnNav.Screen
          name="LiturgyMenu"
          component={LearnItLiturgyMenu}
          options={{ animation: "none" }}
        />
        <LearnNav.Screen
          name="VespersMenu"
          component={LearnItVespersMenu}
          options={{ animation: "none" }}
        />
        <LearnNav.Screen
          name="Matins"
          component={LearnItMatins}
          options={{ animation: "none" }}
        />
        <LearnNav.Screen
          name="OfferingLamb"
          component={LearnItOfferingLamb}
          options={{ animation: "none" }}
        />
        <LearnNav.Screen
          name="LiturgyWord"
          component={LearnItLiturgyWord}
          options={{ animation: "none" }}
        />
        <LearnNav.Screen
          name="LiturgyFaithful"
          component={LearnItLiturgyFaithful}
          options={{ animation: "none" }}
        />
        <LearnNav.Screen
          name="Distribution"
          component={LearnItDistribution}
          options={{ animation: "none" }}
        />
      </LearnNav.Navigator>
    </NavigationContainer>
  );
}
