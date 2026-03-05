import React, { useState } from "react";
import { StyleSheet, View, Pressable, Text, Alert } from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import Rank from "../../components/rank";
import BackArrow from "../../components/backArrow";
import ProgressBar from "../../components/progressBar";

const DeaconRank = ({ navigation }) => {
  const [rank, setRank] = useState(null);
  const user = auth().currentUser;

  const handleRank = (selectedRank) => {
    setRank(selectedRank);
  };

  const handleContinue = async () => {
    if (!rank) {
      Alert.alert("Selection Required", "Please select a rank before proceeding.");
      return;
    }

    try {
      await firestore().collection("users").doc(user.uid).update({
        rank: rank,
      });
      navigation.navigate("Experience");
    } catch (error) {
      Alert.alert("Error", "Could not update deacon information. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.backArrow}>
          <BackArrow />
        </View>
        <View style={styles.progressBar}>
          <ProgressBar startPercentage={50} endPercentage={67} />
        </View>
        <Text style={styles.titleText}>What Rank of Deacon Are You?</Text>
      </View>

      <View style={styles.content}>
        <Rank onSelectRank={handleRank} />
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueText}>Continue</Text>
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
    paddingTop: 80, // Matches SelectChurch
    paddingBottom: 40, // Matches SelectChurch
  },
  header: {
    marginBottom: 32, // Matches SelectChurch
  },
  backArrow: {
    marginBottom: 16, // Matches SelectApplicable
  },
  progressBar: {
    height: 6,
    width: "100%",
    backgroundColor: "#2A2A2A",
    borderRadius: 3,
    marginBottom: 12, // Matches SelectChurch
  },
  titleText: {
    fontSize: 36,
    letterSpacing: -0.5,
    fontFamily: "Roboto-Regular",
    fontWeight: "600",
    color: "#E0E0E0",
    lineHeight: 42,
    marginTop: 30, // Matches SelectChurch
  },
  content: {
    flex: 1,
    marginBottom: 24, // Matches SelectChurch
  },
  footer: {
    paddingBottom: 32, // Matches SelectChurch
    alignItems: "center",
  },
  continueButton: {
    height: 52,
    width: "100%",
    backgroundColor: "#147EFB",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 35, // Matches SelectChurch
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  continueText: {
    fontSize: 18,
    letterSpacing: -0.2,
    fontWeight: "600",
    fontFamily: "Roboto-Medium",
    color: "#FFF",
  },
});

export default DeaconRank;