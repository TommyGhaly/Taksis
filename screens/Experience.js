import * as React from "react";
import { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Alert,
} from "react-native";
import Slider from "@react-native-community/slider";
import { useNavigation } from "@react-navigation/native";
import BackArrow from "../components/backArrow";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import ProgressBar from "../components/progressBar";

const Experience = ({ navigation }) => {
  const [slider, setSlider] = useState(5);
  const user = auth().currentUser;
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
  return (
    <View style={styles.frequency}>
      <View style={styles.backarrow}>
        <BackArrow />
      </View>
      <View style={styles.content}>
        <Text style={styles.titleText}>
          How much experience being a deacon do you have on a scale from 1-10?
        </Text>
        <Text style={styles.sliderValue}>{slider.toFixed(1)}</Text>
        <Slider
          style={styles.slider}
          value={slider}
          onValueChange={(value) => setSlider(value)}
          minimumValue={0}
          maximumValue={10}
          minimumTrackTintColor="#147efb"
          maximumTrackTintColor="#444"
          thumbTintColor="#147efb"
        />
        <View style={styles.sliderLabels}>
          <Text style={styles.label}>Not experienced</Text>
          <Text style={styles.label}>Very experienced</Text>
        </View>
      </View>
      <View style={styles.progressBar}>
        <ProgressBar startPercentage={60} endPercentage={80} />
      </View>
      <Pressable
        onPress={() => handleContinue(user)}
        style={styles.continueLayout}
      >
        <Text style={styles.continuetext}>Continue</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  frequency: {
    flex: 1,
    backgroundColor: "#000",
  },
  backarrow: {
    position: "absolute",
    top: 74,
    left: 16,
  },
  content: {
    flex: 1,
    marginTop: 200,
    alignItems: "center",
    paddingHorizontal: 20,

  },
  titleText: {
    fontSize: 28,
    color: "#8e8e93",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "Roboto-Regular",
  },
  sliderValue: {
    fontSize: 64,
    color: "#8e8e93",
    fontWeight: "bold",
    marginVertical: 20,
    textAlign: "center",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 5,
  },
  label: {
    fontSize: 14,
    color: "#8e8e93",
    fontFamily: "Roboto-Regular",
  },
  // Leave these unchanged:
  progressBar: {
    position: "absolute",
    top: 84,
    left: "12.2137%",
    right: "12.2137%",
    bottom: "88.26%",
    backgroundColor: "#000",
  },
  continueLayout: {
    position: "absolute",
    bottom: 80,
    alignSelf: "center",
    height: 50,
    width: 358,
    backgroundColor: "#333",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
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

export default Experience;
