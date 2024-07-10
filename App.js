import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import WelcomeScreen from './screens/WelcomeScreen';
import HomeScreen from './screens/HomeScreen';
import SignInScreen from './screens/SignInScreen';
import SignUpScreen from './screens/SignUpScreen'
import SelectChurchScreen from './screens/SelectChurchScreen'
import SelectApplicableScreen from './screens/SelectApplicableScreen'
import DeaconRankScreen from './screens/DeaconRankScreen'

export default function App() {
  return (
    <View style={styles.container}>
      <DeaconRankScreen/>
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
