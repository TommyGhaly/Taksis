import React, { useState } from "react";
import { StyleSheet, View, Text, Pressable, Alert } from "react-native";
import Choices from "../../components/choices";
import BackArrow from "../../components/backArrow";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import ProgressBar from "../../components/progressBar";

const ChangeRoles = ({ navigation }) => {
  const [isDeacon, setIsDeacon] = useState(false);
  const [isAlhan, setIsAlhan] = useState(false);
  const [isSSTeach, setIsSSTeach] = useState(false);
  const [isServant, setIsServant] = useState(false);
  const user = auth().currentUser;

  const handleDeacon = (checked) => setIsDeacon(checked);
  const handleAlhan = (checked) => setIsAlhan(checked);
  const handleSSTeach = (checked) => setIsSSTeach(checked);
  const handleServant = (checked) => setIsServant(checked);

  const handleContinue = async () => {
    try {
      await firestore().collection("users").doc(user.uid).update({
        isDeacon,
        isAlhan,
        alhanClass: [],
        isSSTeacher: isSSTeach,
        sundaySchoolClass: [],
        isServant,
      });

      // Navigate to the next screen based on the selected roles
      navigation.goBack();
    } catch (error) {
      console.error("Error updating user roles: ", error);
      Alert.alert("Error", "Could not update roles. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <BackArrow style={styles.backArrow} />
      <View style={styles.title}>
        <Text style={styles.titleText}>Select all that apply to you</Text>
      </View>
      <View style={styles.choices}>
        <Choices
          onDeaconChange={handleDeacon}
          onAlhanChange={handleAlhan}
          onSSTeachChange={handleSSTeach}
          onServantChange={handleServant}
        />
      </View>
      <Pressable style={styles.continueLayout} onPress={handleContinue}>
        <Text style={styles.continueText}>Continue</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 16,
    justifyContent: "space-between", // Distribute space evenly
  },
  backArrow: {
    marginTop: 30, // Adjusted margin for better positioning
  },
  title: {
    marginVertical: 20,
    width: "100%",
  },
  titleText: {
    fontSize: 34,
    letterSpacing: -0.1,
    fontFamily: "Roboto-Regular",
    color: "#8e8e93",
    textAlign: "center",
  },
  choices: {
    left: 25,
    top: 20,
    flex: 1,
    justifyContent: "center", // Center choices vertically
  },
  continueLayout: {
    height: 50,
    backgroundColor: "#333",
    borderRadius: 10,
    justifyContent: "center",
    marginBottom: 30, // Adjusted margin to ensure button is visible
  },
  continueText: {
    fontSize: 17,
    letterSpacing: -0.2,
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
    color: "#fff",
    textAlign: "center",
  },
  progressBar: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
  },
});

export default ChangeRoles;
