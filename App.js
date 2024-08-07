const Stack = createNativeStackNavigator();
import * as React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { useFonts } from "expo-font";
import Frame21 from "./components/Frame21";
import HomeScreen from "./components/HomeScreen";
import ChangePhoneNumber from "./screens/ChangePhoneNumber";
import LearnItCommemoration from "./screens/LearnItCommemoration";
import SundaySchoolAttendance from "./screens/SundaySchoolAttendance";
import LearnItSundayTheotokia from "./screens/LearnItSundayTheotokia";
import ChangeAge from "./screens/ChangeAge";
import ChangeName from "./screens/ChangeName";
import ChildSelectApplicable from "./screens/ChildSelectApplicable";
import ChangeRoles from "./screens/ChangeRoles";
import LearnItMatins from "./screens/LearnItMatins";
import PasswordReset from "./screens/PasswordReset";
import WelcomeScreen from "./screens/WelcomeScreen";
import Location1 from "./components/Location1";
import LearnItOfferingLamb from "./screens/LearnItOfferingLamb";
import LearnItLiturgyMenu from "./screens/LearnItLiturgyMenu";
import SignUp from "./screens/SignUp";
import RequestWeek from "./screens/RequestWeek";
import AlhanAttendence from "./screens/AlhanAttendence";
import LearnItLiturgyFaithful from "./screens/LearnItLiturgyFaithful";
import ChurchRegistrationVerification from "./screens/ChurchRegistrationVerification";
import ChangeChurchInfo from "./screens/ChangeChurchInfo";
import ChangeEmail from "./screens/ChangeEmail";
import Experience from "./screens/Experience";
import ChildSelectChurch from "./screens/ChildSelectChurch";
import ChangeHeadAdmin from "./screens/ChangeHeadAdmin";
import LearnItTesbehaMenu from "./screens/LearnItTesbehaMenu";
import Frequency from "./screens/Frequency";
import ChildSignUp from "./screens/ChildSignUp";
import Splash from "./screens/Splash";
import LearnItSecondCanticle from "./screens/LearnItSecondCanticle";
import ChildAccountInfo from "./screens/ChildAccountInfo";
import LearnItIntroduction from "./screens/LearnItIntroduction";
import ChildDeaconRank from "./screens/ChildDeaconRank";
import SignIn from "./screens/SignIn";
import LearnItFourthCanticle from "./screens/LearnItFourthCanticle";
import LearnItVespersMenu from "./screens/LearnItVespersMenu";
import LearnItThirdCanticle from "./screens/LearnItThirdCanticle";
import RequestAdmin from "./screens/RequestAdmin";
import ChangeChurch from "./screens/ChangeChurch";
import DeaconRank from "./screens/DeaconRank";
import ChangeRank from "./screens/ChangeRank";
import EditSchedule from "./screens/EditSchedule";
import SelectApplicable from "./screens/SelectApplicable";
import LearnItDoxology from "./screens/LearnItDoxology";
import LearnItAdamPsali from "./screens/LearnItAdamPsali";
import AccountInfo from "./screens/AccountInfo";
import ChurchLogo from "./screens/ChurchLogo";
import LearnItFirstCanticle from "./screens/LearnItFirstCanticle";
import SelectChurch from "./screens/SelectChurch";
import LearnItVersesCymbals from "./screens/LearnItVersesCymbals";
import PasswordConfirm from "./screens/PasswordConfirm";
import LearnItResponses from "./screens/LearnItResponses";
import ChangeChildren from "./screens/ChangeChildren";
import HeadAdminAppointSelect from "./screens/HeadAdminAppointSelect";
import LearnItDistribution from "./screens/LearnItDistribution";
import LearnItLiturgyWorld from "./screens/LearnItLiturgyWorld";
import ServantsMeetAttendence from "./screens/ServantsMeetAttendence";
import ChildFrequency from "./screens/ChildFrequency";
import ChildHomeScreen from "./screens/ChildHomeScreen";
import Frame13 from "./components/Frame13";
import Frame11 from "./components/Frame11";
import Frame14 from "./components/Frame14";
import Frame12 from "./components/Frame12";
import Frame8 from "./components/Frame8";
import Frame10 from "./components/Frame10";
import Frame2 from "./components/Frame2";
import Frame1 from "./components/Frame1";
import IPhoneWithNotch from "./components/IPhoneWithNotch";
import LearnItMainMenu from "./components/LearnItMainMenu";
import Frame4 from "./components/Frame4";
import ChurchInformation from "./components/ChurchInformation";
import HeadAdminSettings from "./components/HeadAdminSettings";
import Frame from "./components/Frame";
import Settings from "./components/Settings";
import Verification from "./components/Verification";
import ContinueButton from "./components/ContinueButton";
import Frame5 from "./components/Frame5";
import Frame3 from "./components/Frame3";
import AlertTextField from "./components/AlertTextField";
import Notification1 from "./components/Notification1";

import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {StyleSheet, Text, View, Pressable, TouchableOpacity} from 'react-native';

import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

const Tab = createBottomTabNavigator();
function BottomTabsRoot({ navigation }) {
  const [bottomTabItemsNormal] = React.useState([
    <Frame8 />,
    <Frame10 />,
    <Frame11 />,
    <Frame12 />,
    <Frame13 />,
    <Frame14 />,
  ]);
  const [bottomTabItemsActive] = React.useState([
    <Frame8 />,
    <Frame10 />,
    <Frame11 />,
    <Frame12 />,
    <Frame13 />,
    <Frame14 />,
  ]);
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={({ state, descriptors, navigation }) => {
        const activeIndex = state.index;
        return (
          <View style={{ flexDirection: "row" }}>
            {bottomTabItemsNormal.map((item, index) => {
              const isFocused = state.index === index;
              return (
                <Pressable
                  key={index}
                  onPress={() => {
                    navigation.navigate({
                      name: state.routes[index].name,
                      merge: true,
                    });
                  }}
                >
                  {activeIndex === index
                    ? bottomTabItemsActive[index] || item
                    : item}
                </Pressable>
              );
            })}
          </View>
        );
      }}
    >
      <Tab.Screen
        name="HomeScreen"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen name="AlhanAttendence" component={AlhanAttendence} />
      <Tab.Screen
        name="ServantsMeetAttendence"
        component={ServantsMeetAttendence}
      />
      <Tab.Screen name="LearnItMainMenu" component={LearnItMainMenu} />
      <Tab.Screen name="EditSchedule" component={EditSchedule} />
      <Tab.Screen
        name="Settings"
        component={Settings}
        options={{ headerShown: false }}
      />
    </Tab.Navigator>
  );
}

const App = () => {
  const [hideSplashScreen, setHideSplashScreen] = React.useState(false);

  const [fontsLoaded, error] = useFonts({
    "Roboto-Regular": require("./assets/fonts/Roboto-Regular.ttf"),
    "Roboto-Medium": require("./assets/fonts/Roboto-Medium.ttf"),
    "Roboto-Bold": require("./assets/fonts/Roboto-Bold.ttf"),
    "Inter-Regular": require("./assets/fonts/Inter-Regular.ttf"),
  });

  React.useEffect(() => {
    setTimeout(() => {
      setHideSplashScreen(true);
    }, 2000);
  }, []);

  if (!fontsLoaded && !error) {
    return null;
  }

  return (
    <>
      <NavigationContainer>
        {hideSplashScreen ? (
          <Stack.Navigator
            initialRouteName="WelcomeScreen"
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="BottomTabsRoot" component={BottomTabsRoot} />
            <Stack.Screen
              name="ChangePhoneNumber"
              component={ChangePhoneNumber}
            />
            <Stack.Screen
              name="LearnItCommemoration"
              component={LearnItCommemoration}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SundaySchoolAttendance"
              component={SundaySchoolAttendance}
            />
            <Stack.Screen
              name="LearnItSundayTheotokia"
              component={LearnItSundayTheotokia}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="ChangeAge" component={ChangeAge} />
            <Stack.Screen name="ChangeName" component={ChangeName} />
            <Stack.Screen
              name="ChildSelectApplicable"
              component={ChildSelectApplicable}
            />
            <Stack.Screen name="ChangeRoles" component={ChangeRoles} />
            <Stack.Screen
              name="LearnItMatins"
              component={LearnItMatins}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="PasswordReset" component={PasswordReset} />
            <Stack.Screen
              name="WelcomeScreen"
              component={WelcomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Location1"
              component={Location1}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LearnItOfferingLamb"
              component={LearnItOfferingLamb}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LearnItLiturgyMenu"
              component={LearnItLiturgyMenu}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="SignUp" component={SignUp} />
            <Stack.Screen
              name="RequestWeek"
              component={RequestWeek}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LearnItLiturgyFaithful"
              component={LearnItLiturgyFaithful}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ChurchRegistrationVerification"
              component={ChurchRegistrationVerification}
            />
            <Stack.Screen
              name="ChangeChurchInfo"
              component={ChangeChurchInfo}
            />
            <Stack.Screen name="ChangeEmail" component={ChangeEmail} />
            <Stack.Screen name="Experience" component={Experience} />
            <Stack.Screen
              name="ChildSelectChurch"
              component={ChildSelectChurch}
            />
            <Stack.Screen
              name="ChangeHeadAdmin"
              component={ChangeHeadAdmin}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LearnItTesbehaMenu"
              component={LearnItTesbehaMenu}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="Frequency" component={Frequency} />
            <Stack.Screen name="ChildSignUp" component={ChildSignUp} />
            <Stack.Screen
              name="Splash"
              component={Splash}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LearnItSecondCanticle"
              component={LearnItSecondCanticle}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ChildAccountInfo1"
              component={ChildAccountInfo}
            />
            <Stack.Screen
              name="LearnItIntroduction"
              component={LearnItIntroduction}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="ChildDeaconRank" component={ChildDeaconRank} />
            <Stack.Screen name="SignIn" component={SignIn} />
            <Stack.Screen
              name="LearnItFourthCanticle"
              component={LearnItFourthCanticle}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LearnItVespersMenu"
              component={LearnItVespersMenu}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LearnItThirdCanticle"
              component={LearnItThirdCanticle}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="RequestAdmin"
              component={RequestAdmin}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="ChangeChurch" component={ChangeChurch} />
            <Stack.Screen name="DeaconRank" component={DeaconRank} />
            <Stack.Screen name="ChangeRank" component={ChangeRank} />
            <Stack.Screen
              name="SelectApplicable"
              component={SelectApplicable}
            />
            <Stack.Screen
              name="LearnItDoxology"
              component={LearnItDoxology}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LearnItAdamPsali"
              component={LearnItAdamPsali}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="AccountInfo" component={AccountInfo} />
            <Stack.Screen name="ChurchLogo" component={ChurchLogo} />
            <Stack.Screen
              name="LearnItFirstCanticle"
              component={LearnItFirstCanticle}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="SelectChurch" component={SelectChurch} />
            <Stack.Screen
              name="LearnItVersesCymbals"
              component={LearnItVersesCymbals}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="PasswordConfirm" component={PasswordConfirm} />
            <Stack.Screen
              name="LearnItResponses"
              component={LearnItResponses}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ChangeChildren"
              component={ChangeChildren}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="HeadAdminAppointSelect"
              component={HeadAdminAppointSelect}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LearnItDistribution"
              component={LearnItDistribution}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LearnItLiturgyWorld"
              component={LearnItLiturgyWorld}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="ChildFrequency" component={ChildFrequency} />
            <Stack.Screen name="ChildHomeScreen" component={ChildHomeScreen} />
          </Stack.Navigator>
        ) : (
          <Splash />
        )}
      </NavigationContainer>
    </>
  );
};
export default App;
