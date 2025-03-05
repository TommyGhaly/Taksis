import * as React from "react";
import { useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity, Alert } from "react-native";
import Slider from "@react-native-community/slider";
import BackArrow from "../../components/backArrow";
import ProgressBar from "../../components/progressBar";

const ChildExperience = ({ navigation, route }) => {
  const [slider, setSlider] = useState(5);
  const { childData } = route.params; // Get child data from the previous screen

  const handleContinue = async () => {
    const updatedChildData = { ...childData, experience: slider };
    navigation.navigate("ChildAge", { childData: updatedChildData });
  };

  return (
    <View style={styles.container}>
      <View style={styles.backarrow}>
        <BackArrow onPress={() => navigation.goBack()} />
      </View>
      <View style={styles.progressBar}>
        <ProgressBar startPercentage={50} endPercentage={75} />
      </View>

      {/* Title Section */}
      <View>
        <Text style={styles.title}>
          How much experience does your child have being a deacon?
        </Text>
      </View>

      <View style={styles.sliderposition}>
        <Text style={styles.sliderText}>{slider.toString().slice(0, 3)}</Text>
      </View>

      {/* Slider Section */}
      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          value={slider}
          onValueChange={(value) => setSlider(value)}
          minimumValue={0}
          maximumValue={10}
          minimumTrackTintColor="#147efb"
          thumbTintColor="white" // Change knob color to white
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.notOften}>Not often</Text>
          <Text style={styles.veryVeryOften}>Very often</Text>
        </View>
      </View>
      {/* Continue Button */}
      <View style={styles.continueLayout}>
        <TouchableOpacity
          onPress={handleContinue}
          style={styles.continueButton}
        >
          <Text style={styles.continuetext}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  backarrow: {
    top: 10,
    left: 16,
    position: "absolute",
    zIndex: 10, // Ensures it stays on top
  },
  progressBar: {
    height: 12,
    width: "84%",
    top: 60,
    alignSelf: "center",
    position: "absolute",
  },
  title: {
    left: 24,
    width: "88%",
    textAlign: "center",
    fontSize: 34, // Slightly larger title font
    letterSpacing: -0.5,
    fontFamily: "Roboto-Regular",
    color: "#8e8e93",
    marginTop: 100,
    marginBottom: 40, // More space between title and slider
  },
  sliderContainer: {
    width: "91%",
    right: "4.07%",
    bottom: "42.61%",
    height: "6.1%",
    position: "absolute",
    alignItems: "center", // Center content horizontally
  },
  sliderText: {
    textAlign: "center",
    color: "#8e8e93",
    fontSize: 70,
    fontWeight: "900",
    fontFamily: "Roboto-Bold",
    marginBottom: 10, // Add some margin to avoid overlap
  },
  sliderposition: {
    marginBottom: 60,
  },
  sliderLabels: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between", // Spacing out the labels
    paddingTop: 5,
    paddingHorizontal: 10,
  },
  notOften: {
    color: "#8e8e93",
    fontSize: 14,
  },
  veryVeryOften: {
    color: "#8e8e93",
    fontSize: 14,
  },
  slider: {
    height: 40,
    width: "100%",
    marginTop: 10,
  },
  continueLayout: {
    position: "absolute",
    bottom: 20,
    width: "91%",
    left: 16,
    justifyContent: "center",
    alignItems: "center",
    height: 50,
  },
  continueButton: {
    width: "100%",
    backgroundColor: "#333",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  continuetext: {
    fontSize: 17,
    letterSpacing: -0.2,
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
    color: "#fff",
    textAlign: "center",
  },
});

export default ChildExperience;
