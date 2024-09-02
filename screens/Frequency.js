import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TouchableOpacity,
  Alert
} from "react-native";
import FrequencyQuestions from "../components/frequencyQuestions";
import BackArrow from "../components/backArrow";
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import ProgressBar from "../components/progressBar";

const Frequency = ({ route, navigation }) => {
  const { from } = route.params
  const user = auth().currentUser;
  const [selectedAge, setSelectedAge] = useState(1);
  const [frequency, setFrequency] = useState(5);
  const fromApplicable = (from === 'SelectApplicable')
  const handleAge = (checked) => {
    setSelectedAge(checked);
  };
  const handleFrequency = (checked) => {
    setFrequency(checked);
  };
  const handleContinue = async (user) => {
    try {
      await firestore().collection('users').doc(user.uid).update({
        frequency: frequency,
        age: selectedAge   
      });
      navigation.navigate("MainContainer");
    } catch (error) {
      console.error("Error updating user frequency: ", error);
      Alert.alert("Error", "Could not update frequency information. Please try again.");
    }; 
  };
  return (
    <View style={styles.experience}>
      <View style={styles.backarrow}>
        <BackArrow />
      </View>
      <View style={styles.title}>
        <Text style={styles.titleText}>How old are you?</Text>
      </View>

      <View style={styles.wrapper}>
        <FrequencyQuestions onAgeChange={handleAge} onFrequencyChange={handleFrequency}/>
      </View>
      <View style={styles.title2}>
        <Text style={styles.titleText}>
          How much frequently do you go to church on a scale from 1-10?
        </Text>
      </View>
      <View style={styles.progressBar}>
        <ProgressBar startPercentage={fromApplicable? 40 : 80} endPercentage={100}/>
      </View>
      <View style={styles.continueLayout}>
        <Pressable onPress={() => handleContinue(user)}>
          <Text style={styles.continuetext}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backarrow: {
    top: 74,
    left: 16,
  },
  continueLayout: {
    bottom: -103,
    left: 16,
    height: 50,
    width: 358,
    backgroundColor: "#333",
    borderRadius: 10,
  },
  continuetext: {
    top: 15,
    fontSize: 17,
    letterSpacing: -0.2,
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
    color: "#fff",
    textAlign: "center",
  },
  wrapper: {
    top: "18.661%",
  },
  progressBar: {
    top: 84,
    right: "12.2137%",
    bottom: "88.26%",
    left: "12.2137%",
    position: "absolute",
    backgroundColor: "#000",
  },
  trackLayout: {
    height: 4,
    left: "12.2137%",
    right: "12.2137%",
    top: 86,
  },
  filled: {
    position: "absolute",
    marginTop: -2,
    top: "50%",
    right: "8.1429%",
    left: "8.1429%",
    borderRadius: 100,
    backgroundColor: "#007bfe",
  },
  experience: {
    flex: 1,
    height: "100%",
    overflow: "hidden",
    width: "100%",
    backgroundColor: "#000",
  },
  title: {
    top: "18.663%",
    left: "6.615%",
    width: "68.7023%",
  },
  titleText: {
    fontSize: 34,
    letterSpacing: -0.1,
    fontFamily: "Roboto-Regular",
    color: "#8e8e93",
  },
  title2: {
    top: "-10%",
    left: "5.85242%",
    width: "92.768%",
  },
});

export default Frequency;