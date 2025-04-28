import React, { useState } from "react";
import { StyleSheet, View, Pressable, Text, Alert } from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import Churches from "../components/churches";
import ProgressBar from "../components/progressBar";

const SelectChurch = ({ navigation }) => {
  const [selectedChurch, setSelectedChurch] = useState(null);
  const user = auth().currentUser;

  const handleChurchSelection = (church) => {
    setSelectedChurch(church);
  };

  const handleContinue = async () => {
    if (!selectedChurch) {
      Alert.alert("Selection Required", "Please select a church before proceeding.");
      return;
    }

    try {
      await firestore().collection("users").doc(user.uid).update({
        church: selectedChurch,
      });
      navigation.navigate("SelectApplicable");
    } catch (error) {
      Alert.alert("Error", "Could not update church information. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.progressBar}>
          <ProgressBar startPercentage={1} endPercentage={20} />
        </View>
        <Text style={styles.titleText}>Select Your Church</Text>
      </View>

      <View style={styles.content}>
        <Churches onSelectChurch={handleChurchSelection} />
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>
        <Pressable
          style={styles.churchRegisterLink}
          onPress={() => navigation.navigate("ChurchRegistration")}
        >
          <Text style={styles.linkText}>
            <Text style={styles.linkPrefix}>Church not listed? </Text>
            <Text style={styles.linkAction}>Register it</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212", // Deep charcoal gray
    paddingHorizontal: 16,
    paddingTop: 120,
    paddingBottom: 40
  },
  header: {
    marginBottom: 32,
  },
  progressBar: {
    height: 6,
    marginBottom: 12, // Lowered from 24 to bring it closer to the title
    backgroundColor: "#2A2A2A", // Darker track for contrast
    borderRadius: 3,
  },
  titleText: {
    fontSize: 36,
    letterSpacing: -0.5,
    fontFamily: "Roboto-Regular",
    fontWeight: "600",
    color: "#E0E0E0", // Light gray for readability
    lineHeight: 42,
    maxWidth: "90%",
    marginTop: 30
  },
  content: {
    flex: 1,
    marginBottom: 24,
  },
  footer: {
    paddingBottom: 32,
    alignItems: "center",
  },
  continueButton: {
    height: 52,
    width: "100%",
    backgroundColor: "#147EFB", // Vibrant, slightly deeper blue
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
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
  churchRegisterLink: {
    alignSelf: "center",
  },
  linkText: {
    fontSize: 16,
    letterSpacing: -0.1,
    fontFamily: "Roboto-Regular",
  },
  linkPrefix: {
    color: "#B0BEC5", // Muted gray-blue for contrast
  },
  linkAction: {
    color: "#147EFB", // Matches blue accent
    fontWeight: "500",
  },
});

export default SelectChurch;