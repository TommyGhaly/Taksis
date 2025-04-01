import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text, Pressable, Alert, SafeAreaView, InteractionManager, Vibration } from "react-native";
import Slider from "@react-native-community/slider";
import BackArrow from "../components/backArrow";
import ProgressBar from "../components/progressBar";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

const Experience = ({ navigation }) => {
  const [slider, setSlider] = useState(5);
  const [isReady, setIsReady] = useState(false);
  const user = auth().currentUser;

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
  }, []);

  const handleContinue = async (user) => {
    try {
      await firestore().collection("users").doc(user.uid).update({
        experience: slider,
      });
      navigation.navigate("Frequency", { from: "Experience" });
    } catch (error) {
      console.error("Error updating user experience: ", error);
      Alert.alert(
        "Error",
        "Could not update experience information. Please try again."
      );
    }
  };

  if (!isReady) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.innerContainer}>
        <View style={styles.header}>
          <View style={styles.backArrow}>
            <BackArrow />
          </View>
          <View style={styles.progressBarContainer}>
            <ProgressBar startPercentage={60} endPercentage={80} />
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.questionText}>
              How much experience being a deacon do you have?
            </Text>
            <Text style={styles.sliderValue}>{slider.toFixed(0)}</Text>
            <Slider
              style={styles.slider}
              value={slider}
              onValueChange={(value) => {
                setSlider(value);
                Vibration.vibrate(50); // Vibrate for 50ms on each new integer
              }}
              minimumValue={0}
              maximumValue={10}
              step={1}
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
            style={({ pressed }) => [styles.continueButton, pressed && styles.buttonPressed]}
            onPress={() => handleContinue(user)}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
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
  content: {
    flex: 1,
    alignItems: "center",
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
    width: "100%",
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
    marginBottom: 33
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