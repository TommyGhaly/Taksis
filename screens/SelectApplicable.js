import React, { useState } from "react";
import { StyleSheet, View, Text, Pressable, Alert } from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import Choices from "../components/choices";
import BackArrow from "../components/backArrow";
import ProgressBar from "../components/progressBar";

const SelectApplicable = ({ navigation }) => {
  const user = auth().currentUser;
  const [isDeacon, setIsDeacon] = useState(false);
  const [isAlhan, setIsAlhan] = useState(false);
  const [isSSTeach, setIsSSTeach] = useState(false);

  const handleDeacon = (checked) => {
    setIsDeacon(checked);
  };
  const handleAlhan = (checked) => {
    setIsAlhan(checked);
  };
  const handleSSTeach = (checked) => {
    setIsSSTeach(checked);
  };

  const handleContinue = async () => {
    try {
      await firestore().collection("users").doc(user.uid).update({
        isDeacon: isDeacon,
        isAlhan: isAlhan,
        isSSTeacher: isSSTeach,
        isServant: false,
      });

      if (isDeacon) {
        navigation.navigate("DeaconRank");
      } else {
        navigation.navigate("Frequency", { from: "SelectApplicable" });
      }
    } catch (error) {
      Alert.alert("Error", "Could not update information. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.backArrow}>
          <BackArrow />
        </View>
        <View style={styles.progressBar}>
          <ProgressBar startPercentage={20} endPercentage={40} />
        </View>
        <Text style={styles.titleText}>Select All That Apply</Text>
      </View>

      <View style={styles.content}>
        <Choices
          onDeaconChange={handleDeacon}
          onAlhanChange={handleAlhan}
          onSSTeachChange={handleSSTeach}
        />
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
    paddingTop: 80,
    paddingBottom: 40, // Matches SelectChurch
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
  titleText: {
    fontSize: 36,
    letterSpacing: -0.5,
    fontFamily: "Roboto-Regular",
    fontWeight: "600",
    color: "#E0E0E0",
    lineHeight: 42,
    marginTop: 30,
  },
  content: {
    flex: 1, // Allow content to take available space, pushing footer down
    marginBottom: 24,
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

export default SelectApplicable;