import * as React from "react";
import Welcome from './screens/Welcome';
import SignIn from './screens/SignIn'
import SignUp from './screens/SignUp'
import SelectChurch from "./screens/SelectChurch";
import SelectApplicable from "./screens/SelectApplicable";
import { NavigationContainer } from "@react-navigation/native";
import DeaconRank from "./screens/DeaconRank"
import Frequency from "./screens/Frequency";
import Experience from "./screens/Experience";
import ChurchInformation from "./screens/ChurchInformation";
import PasswordReset from "./screens/PasswordReset";
import ChurchLogo from "./screens/ChurchLogo";
import PasswordConfirm from "./screens/PasswordConfirm";
import ChurchVerification from "./screens/ChurchVerification";
import Home from "./screens/Home";
import AlhanAttendence from "./screens/Attendence";
import {StyleSheet, Text, View, Pressable, TouchableOpacity} from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Home person={"you"}/>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

