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
import {StyleSheet, Text, View, Pressable, TouchableOpacity} from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Experience person={"you"}/>
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

