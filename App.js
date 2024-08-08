import * as React from "react";
import SingIn from "./screens/SignIn.";
import {StyleSheet, Text, View, Pressable, TouchableOpacity} from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
       <SignIn></SignIn>
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

