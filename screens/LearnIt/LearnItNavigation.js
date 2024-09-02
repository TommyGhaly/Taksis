import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LearnItMainMenu from "./LearnItMainMenu";
import LearnItTesbehaMenu from "./Tesbeha/LearnItTesbehaMenu";
import LearnItLiturgyMenu from "./Liturgy/LearnItLiturgyMenu";
import LearnItVespersMenu from "./Vespers/LearnItVespersMenu";
import LearnItMatins from "./Liturgy/LearnItMatins";
import LearnItOfferingLamb from "./Liturgy/LearnItOfferingLamb";
import LearnItLiturgyWord from "./Liturgy/LearnItLiturgyWord";
import LearnItLiturgyFaithful from "./Liturgy/LearnItLiturgyFaithful";
import LearnItDistribution from "./Liturgy/LearnItDistribution";
import LearnItIntroduction from "./Tesbeha/LearnItIntroduction";
import LearnItFirstCanticle from "./Tesbeha/LearnItFirstCanticle";
import LearnItSecondCanticle from "./Tesbeha/LearnItSecondCanticle";
import LearnItThirdCanticle from "./Tesbeha/LearnItThirdCanticle";
import LearnItCommemoration from "./Tesbeha/LearnItCommemoration";
import LearnItFourthCanticle from "./Tesbeha/LearnItFourthCanticle";
import LearnItAdamPsali from "./Tesbeha/LearnItAdamPsali";
import LearnItSundayTheotokia from "./Tesbeha/LearnItSundayTheotokia";
import LearnItResponses from "./Vespers/LearnItResponses";
import LearnItDoxology from "./Vespers/LearnItDoxology";
import LearnItVersesCymbols from "./Vespers/LearnItVersesCymbals";
import DefaultTheme from "@react-navigation/native";

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
        <LearnNav.Screen name="TesbehaMenu" component={LearnItTesbehaMenu} />
        <LearnNav.Screen name="LiturgyMenu" component={LearnItLiturgyMenu} />
        <LearnNav.Screen name="VespersMenu" component={LearnItVespersMenu} />
        <LearnNav.Screen name="Matins" component={LearnItMatins} />
        <LearnNav.Screen name="OfferingLamb" component={LearnItOfferingLamb} />
        <LearnNav.Screen name="LiturgyWord" component={LearnItLiturgyWord} />
        <LearnNav.Screen
          name="LiturgyFaithful"
          component={LearnItLiturgyFaithful}
        />
        <LearnNav.Screen name="Distribution" component={LearnItDistribution} />
        <LearnNav.Screen name="Introduction" component={LearnItIntroduction} />
        <LearnNav.Screen
          name="FirstCanticle"
          component={LearnItFirstCanticle}
        />
        <LearnNav.Screen
          name="SecondCanticle"
          component={LearnItSecondCanticle}
        />
        <LearnNav.Screen
          name="ThirdCanticle"
          component={LearnItThirdCanticle}
        />
        <LearnNav.Screen
          name="Commemoration"
          component={LearnItCommemoration}
        />
        <LearnNav.Screen
          name="FourthCanticle"
          component={LearnItFourthCanticle}
        />
        <LearnNav.Screen name="AdamPsali" component={LearnItAdamPsali} />
        <LearnNav.Screen
          name="SundayTheotokia"
          component={LearnItSundayTheotokia}
        />
        <LearnNav.Screen name="Responses" component={LearnItResponses} />
        <LearnNav.Screen name="Doxology" component={LearnItDoxology} />
        <LearnNav.Screen
          name="VersesCymbals"
          component={LearnItVersesCymbols}
        />
      </LearnNav.Navigator>
    </NavigationContainer>
  );
}
