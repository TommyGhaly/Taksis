import React, { useState } from "react";
import { StyleSheet, View, Text, Pressable, Alert } from "react-native";
import Slider from "@react-native-community/slider";
import BackArrow from "../../components/backArrow";
import ProgressBar from "../../components/progressBar";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";

const Experience = ({ navigation }) => {
  const [slider, setSlider] = useState(5);
  const user = auth().currentUser;

  const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };

  const formatSliderValue = (value) => {
    const rounded = Number(value.toFixed(2)); // Round to 2 decimal places to handle floating-point precision
    if (rounded % 1 === 0) {
      return rounded.toFixed(0); // No decimal for whole numbers (e.g., 1.00 -> 1)
    } else if (rounded % 0.5 === 0) {
      return rounded.toFixed(1); // One decimal for .5 values (e.g., 1.50 -> 1.5)
    } else {
      return rounded.toFixed(2); // Two decimals for .25 and .75 values (e.g., 1.25, 1.75)
    }
  };

  const handleContinue = async () => {
    try {
      await firestore().collection("users").doc(user.uid).update({
        experience: slider,
      });
      navigation.navigate("Frequency", { from: "Experience" });
    } catch (error) {
      Alert.alert(
        "Error",
        "Could not update experience information. Please try again."
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.backArrow}>
          <BackArrow />
        </View>
        <View style={styles.progressBar}>
          <ProgressBar startPercentage={67} endPercentage={83} />
        </View>
      </View>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.questionText}>
            How much experience being a deacon do you have?
          </Text>
          <Text style={styles.sliderValue}>{formatSliderValue(slider)}</Text>
          <Slider
            style={styles.slider}
            value={slider}
            onValueChange={(value) => {
              setSlider(value);
              ReactNativeHapticFeedback.trigger("impactMedium", hapticOptions);
            }}
            minimumValue={0}
            maximumValue={10}
            step={0.25}
            minimumTrackTintColor="#147EFB"
            maximumTrackTintColor="#444"
            thumbTintColor="#147EFB"
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.label}>Not experienced</Text>
            <Text style={styles.label}>Very experienced</Text>
          </View>
        </View>
      </View>
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.continueButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleContinue}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
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
  progressBar: {
    height: 6,
    width: "100%",
    backgroundColor: "#2A2A2A",
    borderRadius: 3,
    marginBottom: 12,
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 25,
    width: "100%",
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
    alignItems: "center",
  },
  continueButton: {
    height: 52,
    width: "100%",
    backgroundColor: "#147EFB",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 67,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
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

export default Experience;