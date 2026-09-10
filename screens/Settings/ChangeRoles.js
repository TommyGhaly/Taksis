import React, { useState } from "react";
import { StyleSheet, View, Text, Pressable, Alert } from "react-native";
import Choices from "../../components/choices";
import BackArrow from "../../components/backArrow";
import { doc, getFirestore, updateDoc } from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import { callFunction } from "../../components/functionCalls";

const ChangeRoles = ({ navigation }) => {
  const [isDeacon, setIsDeacon] = useState(false);
  const [isAlhan, setIsAlhan] = useState(false);
  const [isSSTeach, setIsSSTeach] = useState(false);
  const user = getAuth().currentUser;

  const handleDeacon = (checked) => setIsDeacon(checked);
  const handleAlhan = (checked) => setIsAlhan(checked);
  const handleSSTeach = (checked) => setIsSSTeach(checked);

  const handleContinue = async () => {
    try {
      await updateDoc(doc(getFirestore(), "users", user.uid), {
        isDeacon: isDeacon,
        isAlhan: isAlhan,
        isSSTeacher: isSSTeach,
      });
      navigation.goBack();
      await callFunction(user, "https://update-user-hy6oofbihq-uc.a.run.app");
      Alert.alert("Success", "Roles updated successfully.");
    } catch (error) {
      Alert.alert("Error", "Could not update roles. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.backArrow}>
          <BackArrow />
        </View>
        <Text style={styles.titleText}>Select All That Apply to You</Text>
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
    paddingHorizontal: 16, // Matches SelectChurch
    paddingTop: 20, // Matches SelectChurch
    paddingBottom: 40, // Matches SelectChurch
  },
  header: {
    marginBottom: 32, // Matches SelectChurch
  },
  backArrow: {
    marginBottom: 16, // Matches SelectApplicable
  },
  titleText: {
    fontSize: 36,
    letterSpacing: -0.5,
    fontFamily: "Roboto-Regular",
    fontWeight: "600",
    color: "#E0E0E0", // Matches other screens
    lineHeight: 42,
    textAlign: "left", // Matches SelectChurch
  },
  content: {
    flex: 1, // Pushes footer to bottom
    marginBottom: 24, // Matches SelectChurch
  },
  footer: {
    paddingBottom: 32, // Matches SelectChurch
    alignItems: "center",
  },
  continueButton: {
    height: 52, // Matches SelectChurch
    width: "100%", // Matches SelectChurch
    backgroundColor: "#333", // Matches SelectChurch
    borderRadius: 12, // Matches SelectChurch
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16, // Matches SelectChurch
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  continueText: {
    fontSize: 18, // Matches SelectChurch
    letterSpacing: -0.2,
    fontWeight: "600",
    fontFamily: "Roboto-Medium",
    color: "#FFF",
  },
});

export default ChangeRoles;