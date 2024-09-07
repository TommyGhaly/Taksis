import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AccountInfo from "./AccountInfo";
import AdminSelect from "./AdminSelect";
import ChangeAge from "./ChangeAge";
import ChangeChildren from "./ChangeChildren";
import ChangeEmail from "./ChangeEmail";
import ChangeName from "./ChangeName";
import ChangeRank from "./ChangeRank";
import ChangeRoles from "./ChangeRoles";
import ChangeChurch from "./ChangeChurch";
import ChangeHeadAdmin from "./ChangeHeadAdmin";
import ChildAccountInfo from "./ChildAccountInfo";
import RequestAdmin from "./RequestAdmin";
import AddChild from "./AddChild";
import Settings from "./Settings";
import SettingsContent from "../../components/settingsContent";
import ChildDeaconRank from "./ChildDeaconRank";
import ChildAge from "./ChildAge";
import PasswordReset from "../PasswordReset";
import DefaultTheme from "@react-navigation/native";
const SettingsNav = createNativeStackNavigator();
const myTheme = {
  ...DefaultTheme,
  colors: {
    primary: "#000",
    card: "rgb(255, 255, 255)",
    background: "#000",
  },
};
export default function SettingsNavigation() {
  return (
    <NavigationContainer independent={true} theme={myTheme}>
      <SettingsNav.Navigator
        initialRouteName="Settings"
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          gestureDirection: "horizontal",
        }}
      >
        <SettingsNav.Screen name="Settings" component={Settings} />
        <SettingsNav.Screen
          name="SettingsContent"
          component={SettingsContent}
        />
        <SettingsNav.Screen name="AccountInfo" component={AccountInfo} />
        <SettingsNav.Screen name="AdminSelect" component={AdminSelect} />
        <SettingsNav.Screen name="ChangeAge" component={ChangeAge} />
        <SettingsNav.Screen name="ChangeChildren" component={ChangeChildren} />
        <SettingsNav.Screen name="ChangeEmail" component={ChangeEmail} />
        <SettingsNav.Screen
          name="ChangeHeadAdmin"
          component={ChangeHeadAdmin}
        />
        <SettingsNav.Screen name="ChangeName" component={ChangeName} />
        <SettingsNav.Screen name="ChangeChurch" component={ChangeChurch} />
        <SettingsNav.Screen name="ChangeRank" component={ChangeRank} />
        <SettingsNav.Screen name="ChangeRoles" component={ChangeRoles} />
        <SettingsNav.Screen
          name="ChildAccountInfo"
          component={ChildAccountInfo}
        />
        <SettingsNav.Screen name="RequestAdmin" component={RequestAdmin} />
        <SettingsNav.Screen
          name="AddChild"
          component={AddChild}
          options={{ animation: "none" }}
        />
        <SettingsNav.Screen
          name="ChildDeaconRank"
          component={ChildDeaconRank}
          options={{ animation: "none" }}
        />
        <SettingsNav.Screen
          name="ChildAge"
          component={ChildAge}
          options={{ animation: "none" }}
        />
        <SettingsNav.Screen
          name="ChangePassword"
          component={PasswordReset}
          options={{ animation: "none" }}
        />
      </SettingsNav.Navigator>
    </NavigationContainer>
  );
}
