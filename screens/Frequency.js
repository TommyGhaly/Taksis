import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  SafeAreaView,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Picker } from "@react-native-picker/picker";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useUser } from "../UserContext";
import BackArrow from "../components/backArrow";
import ProgressBar from "../components/progressBar";
import { callFunction } from "../components/functionCalls"

const Frequency = ({ route, navigation }) => {
  const { from } = route.params;
  const user = auth().currentUser;
  const [selectedAge, setSelectedAge] = useState(1);
  const [frequency, setFrequency] = useState(5);
  const fromApplicable = from === "SelectApplicable";
  const { signUp, setSignUp } = useUser();

  const handleAge = (checked) => {
    setSelectedAge(checked);
  };

  const handleFrequency = (checked) => {
    setFrequency(checked);
  };

  const handleContinue = async (user) => {
    try {
      await firestore().collection("users").doc(user.uid).update({
        frequency: frequency,
        age: selectedAge,
      });
      await callFunction(user, "https://update-user-hy6oofbihq-uc.a.run.app");
      setSignUp(false);
      navigation.navigate("MainContainer");
    } catch (error) {
      console.error("Error updating user frequency: ", error);
      Alert.alert(
        "Error",
        "Could not update frequency information. Please try again."
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.backArrow}>
          <BackArrow />
        </View>
        <View style={styles.progressBarContainer}>
          <ProgressBar startPercentage={80} endPercentage={100} />
        </View>
      </View>

      <View contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.questionText}>What's your age?</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedAge}
              onValueChange={handleAge}
              style={styles.picker}
            >
              {Array.from({ length: 100 }, (_, i) => (
                <Picker.Item
                  key={i}
                  label={`${i + 1}`}
                  value={i + 1}
                  color="#E0E0E0"
                />
              ))}
            </Picker>
            <Text style={styles.unitText}>years</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.questionText}>
            How often do you attend church?
          </Text>
          <Text style={styles.sliderValue}>{frequency.toFixed(0)}</Text>
          <Slider
            style={styles.slider}
            value={frequency}
            onValueChange={handleFrequency}
            minimumValue={0}
            maximumValue={10}
            step={1}
            minimumTrackTintColor="#147EFB"
            maximumTrackTintColor="#444"
            thumbTintColor="#147EFB"
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.label}>Rarely</Text>
            <Text style={styles.label}>Weekly</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [styles.continueButton, pressed && styles.buttonPressed]}
            onPress={() => handleContinue(user)}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingHorizontal: 16,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  backArrow: {
    marginBottom: 16,
  },
  progressBarContainer: {
    marginBottom: 12,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 25,
    marginBottom: 30,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  questionText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#E0E0E0",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "Roboto-Regular",
  },
  pickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    paddingHorizontal: 15,
  },
  picker: {
    flex: 1,
    color: "#E0E0E0",
  },
  unitText: {
    color: "#E0E0E0",
    fontSize: 16,
    marginLeft: 10,
    fontFamily: "Roboto-Regular",
  },
  sliderValue: {
    fontSize: 56,
    fontWeight: "bold",
    color: "#E0E0E0",
    textAlign: "center",
    marginBottom: 20,
  },
  slider: {
    width: "100%",
    height: 40,
    marginBottom: 15,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    color: "#8E8E93",
    fontSize: 14,
    fontFamily: "Roboto-Regular",
  },
  footer: {
    paddingBottom: 32,
    alignItems: "center",
  },
  continueButton: {
    height: 52,
    width: "100%",
    backgroundColor: "#147EFB",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    marginBottom: 35

  },
  buttonPressed: {
    backgroundColor: "#115EBB",
    elevation: 2,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFF",
    fontFamily: "Roboto-Medium",
    letterSpacing: -0.2,
  },
});

export default Frequency;