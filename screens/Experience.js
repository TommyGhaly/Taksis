import * as React from "react";
import { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TouchableOpacity,
} from "react-native";
import Slider from "@react-native-community/slider";
import { useNavigation } from "@react-navigation/native";
import BackArrow from "../components/backArrow";
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import ProgressBar from "../components/progressBar";

const Experience = ({ navigation }) => {
  const [slider, setSlider] = useState(5);
  const user = auth().currentUser;
  const handleContinue = async (user) => {
    try {
      await firestore().collection('users').doc(user.uid).update({
        experience: slider   
      });
      navigation.navigate("Frequency", { from: 'Experience' });
    } catch (error) {
      console.error("Error updating user experience: ", error);
      Alert.alert("Error", "Could not update experience information. Please try again.");
    }
  };
  return (
    <View style={styles.frequency}>
      <View style={styles.backarrow}>
        <BackArrow />
      </View>
      <View style={styles.title}>
        <Text style={styles.titleText}>
          How much experience being a deacon do you have on a scale from 1-10?
        </Text>
      </View>
      <Text style={[styles.sliderText, styles.sliderTextPosition]}>
        {slider.toString().slice(0, 3)}
      </Text>
      <View style={[styles.frequencySlider, styles.backarrowPosition]}>
        <Slider
          style={styles.slider}
          value={slider}
          onValueChange={(value) => setSlider(value)}
          minimumValue={0}
          maximumValue={10}
          minimumTrackTintColor="#147efb"
        />
        <Text style={[styles.notOften, styles.oftenTypo]}>Not often</Text>
        <Text style={[styles.veryVeryOften, styles.oftenTypo]}>Very often</Text>
      </View>
      <View style={styles.progressBar}>
        <ProgressBar startPercentage={60} endPercentage={80}/>
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
    bottom: -476,
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
  backarrowPosition: {
    left: "4.07%",
    position: "absolute",
  },
  knob1Layout: {
    borderRadius: 100,
    position: "absolute",
  },
  oftenTypo: {
    textAlign: "left",
    color: "#8e8e93",
    fontFamily: "Roboto-Regular",
    letterSpacing: -0.1,
    fontSize: 12,
    top: "0%",
    position: "absolute",
  },
  sliderText: {
    textAlign: "center",
    color: "#8e8e93",
    fontSize: 80,
    fontWeight: "900",
    fontFamily: "Roboto-Bold",
    justifyContent: "center",
    alignContent: "center",
  },
  sliderTextPosition: {
    top: "19.7399%",
  },
  unfilledknob: {
    right: 0,
    left: 0,
    backgroundColor: "rgba(120, 120, 128, 0.32)",
    bottom: "42.86%",
    top: "42.86%",
    height: "14.29%",
    borderRadius: 100,
  },
  filledknob: {
    backgroundColor: "#147efb",
    right: "49.17%",
    width: "50.83%",
    borderRadius: 100,
    bottom: "42.86%",
    top: "42.86%",
    height: "14.29%",
    left: "0%",
    position: "absolute",
  },
  knob1: {
    marginTop: -14,
    top: "50%",
    right: -41,
    shadowColor: "rgba(0, 0, 0, 0.12)",
    shadowOffset: {
      width: 0,
      height: 0.5,
    },
    shadowRadius: 4,
    elevation: 4,
    shadowOpacity: 1,
    backgroundColor: "#fff",
    width: 28,
    height: 28,
    transform: [
      {
        rotate: "180deg",
      },
    ],
  },
  knob: {
    height: "100%",
    top: "0%",
    right: "49.17%",
    width: "50.83%",
    left: "0%",
    bottom: "0%",
    position: "absolute",
  },
  slider: {
    height: "53.85%",
    top: "46.15%",
    position: "absolute",
    width: "100%",
  },
  notOften: {
    left: "0.83%",
  },
  veryVeryOften: {
    left: "80.07%",
  },
  frequencySlider: {
    width: "91.86%",
    top: "51.29%",
    right: "4.07%",
    bottom: "42.61%",
    height: "6.1%",
  },

  progressBar: {
    top: 84,
    right: "12.2137%",
    bottom: "88.26%",
    left: "12.2137%",
    position: "absolute",
    backgroundColor: "#000",
  },
  filled: {
    position: "absolute",
    marginTop: -2,
    width: "77.28%",
    top: "50%",
    right: "22.72%",
    left: "0%",
    borderRadius: 100,
    backgroundColor: "#147efb",
    height: 4,
  },
  track: {
    backgroundColor: "rgba(120, 120, 128, 0.32)",
    width: "100%",
    height: 4,
  },
  title: {
    top: 150,
    left: "4.071%",
    right: "4.071%",
    width: "94.295%",
  },
  titleText: {
    fontSize: 34,
    letterSpacing: -0.1,
    fontFamily: "Roboto-Regular",
    color: "#8e8e93",
  },
  continue: {
    top: "75%",
    left: "4.07%",
  },
  frequency: {
    flex: 1,
    height: 852,
    overflow: "hidden",
    width: "100%",
    backgroundColor: "#000",
  },
});

export default Experience;
