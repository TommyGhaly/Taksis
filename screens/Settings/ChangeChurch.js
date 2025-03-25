import React, { useState } from "react";
import { StyleSheet, View, Text, Pressable, Alert } from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import BackArrow from "../../components/backArrow";
import Churches from "../../components/churches"; // Assuming you have a Churches component for displaying church options
import {
  callFunction,
  removeFamilySchedule,
} from "../../components/functionCalls";

const ChangeChurch = ({ navigation }) => {
  const [selectedChurch, setSelectedChurch] = useState(null);
  const user = auth().currentUser;

  const handleChurchSelection = (church) => {
    setSelectedChurch(church);
  };

  const updateChurchAndFunctions = async () => {
    // Update the user's church information in Firestore
    await firestore().collection("users").doc(user.uid).update({
      church: selectedChurch,
    });

    // Call external functions
    await callFunction(
      user,
      "https://sync-child-params-hy6oofbihq-uc.a.run.app"
    );
    Alert.alert("Success", "Church has been updated.");

    // Navigate back to the previous screen
    navigation.goBack();

    await new Promise((resolve) => setTimeout(resolve, 2000));
    // Call twice to ensure nothing gets left behind by accident
    await callFunction(user, "https://update-user-hy6oofbihq-uc.a.run.app");
    await callFunction(user, "https://update-user-hy6oofbihq-uc.a.run.app");
  };

  const handleContinue = async () => {
    if (!user) {
      Alert.alert("Error", "User information is not available.");
      return;
    }
    if (!selectedChurch) {
      Alert.alert(
        "Selection Required",
        "Please select a church before proceeding."
      );
      return;
    }

    try {
      // Retrieve the current church from the user's document
      const userDoc = await firestore().collection("users").doc(user.uid).get();
      const currentChurch = userDoc.data()?.church;

      // Check if the selected church is the same as the current church
      if (selectedChurch === currentChurch) {
        Alert.alert("No Change", "You have selected the same church.");
        return;
      }

      // Alert the user about schedule removals and ask for confirmation before proceeding
      Alert.alert(
        "Warning",
        "Changing your church will remove you from all future schedules including hymns class and Sunday school. Do you want to proceed?",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Yes",
            onPress: async () => {
              await removeFamilySchedule(
                user,
                currentChurch,
                "https://remove-family-schedules-hy6oofbihq-uc.a.run.app"
              );

              await updateChurchAndFunctions();
              // Run the remove schedules function if the church is different
            },
          },
        ]
      );
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
    backgroundColor: "#121212",
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
    marginTop: 5,
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
