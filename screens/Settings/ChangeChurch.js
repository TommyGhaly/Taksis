import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Alert,
  TextInput,
  Image,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import BackArrow from "../../components/backArrow";
import ProgressBar from "../../components/progressBar";
import Churches from "../../components/churches"; // Assuming you have a Churches component for displaying church options

const ChangeChurch = ({ navigation }) => {
  const [selectedChurch, setSelectedChurch] = useState(null);
  const user = auth().currentUser;

  const handleChurchSelection = (church) => {
    setSelectedChurch(church);
  };

  const handleContinue = async () => {
    try {
      await firestore().collection("users").doc(user.uid).update({
        church: selectedChurch,
      });

      // Navigate to the next screen or show a success message
      navigation.goBack();
    } catch (error) {
      console.error("Error updating user church: ", error);
      Alert.alert(
        "Error",
        "Could not update church information. Please try again."
      );
    }
  };

  return (
    <View style={styles.container}>
      <BackArrow style={styles.backArrow} />
      <Text style={styles.titleText}>
        Select the church(s) you regularly attend
      </Text>
      <View style={styles.churchesContainer}>
        <Churches onSelectChurch={handleChurchSelection} />
      </View>
      <Pressable style={styles.continueButton} onPress={handleContinue}>
        <Text style={styles.continueText}>Confirm</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 16,
    justifyContent: "space-between",
  },
  backArrow: {
    marginTop: 30,
  },
  titleText: {
    fontSize: 34,
    letterSpacing: -0.1,
    fontFamily: "Roboto-Regular",
    color: "#8e8e93",
    textAlign: "center",
    marginVertical: 20,
  },
  churchesContainer: {
    flex: 1,
    marginTop: 20,
  },
  continueButton: {
    height: 50,
    backgroundColor: "#333",
    borderRadius: 10,
    justifyContent: "center",
    marginBottom: 30,
    marginTop: 5, // Added marginTop for space above the button
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

export default ChangeChurch;
