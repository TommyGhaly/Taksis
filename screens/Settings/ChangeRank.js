import * as React from "react";
import { useState } from "react";
import { StyleSheet, View, Pressable, Text, Alert } from "react-native";
import Rank from "../../components/rank";
import BackArrow from "../../components/backArrow";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

const ChangeRank = ({ navigation }) => {
  const [rank, setRank] = useState(null);
  const user = auth().currentUser;

  const handleRank = (selectedRank) => {
    setRank(selectedRank);
  };

  const handleContinue = async () => {
    try {
      if (rank) {
        await firestore().collection("users").doc(user.uid).update({
          rank: rank,
        });

        // Navigate to the next screen or show a success message
        navigation.goBack(); // Replace "NextScreen" with your target screen
      } else {
        Alert.alert("Select a Rank", "Please select a rank before continuing.");
      }
    } catch (error) {
      console.error("Error updating user rank: ", error);
      Alert.alert(
        "Error",
        "Could not update rank information. Please try again."
      );
    }
  };

  return (
    <View style={styles.container}>
      <BackArrow style={styles.backArrow} />
      <View style={styles.title}>
        <Text style={styles.titleText}>What is your current deacon rank?</Text>
      </View>
      <View style={styles.rank}>
        <Rank onSelectRank={handleRank} />
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
  rank: {
    flex: 1, // Take remaining space to make room for the title and button
    justifyContent: "center", // Center content vertically
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
});

export default ChangeRank;
