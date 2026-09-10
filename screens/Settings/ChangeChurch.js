import React, { useState } from "react";
import { StyleSheet, View, Text, Pressable, Alert } from "react-native";
import { doc, getDoc, getFirestore, updateDoc } from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import BackArrow from "../../components/backArrow";
import Churches from "../../components/churches"; // Assuming you have a Churches component for displaying church options
import { callFunction } from "../../components/functionCalls";

const ChangeChurch = ({ navigation }) => {
  const [selectedChurch, setSelectedChurch] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const user = getAuth().currentUser;

  const handleChurchSelection = (church) => {
    setSelectedChurch(church);
  };

  const updateChurchAndFunctions = async () => {
    const user = getAuth().currentUser;
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      // Update the user's church information in Firestore
      await updateDoc(doc(getFirestore(), "users", user.uid), {
        church: selectedChurch,
      });

      // Call external functions with proper parameters
      await callFunction(
        user,
        "https://sync-child-params-hy6oofbihq-uc.a.run.app",
        {},
        "Failed to sync child parameters."
      );

      await callFunction(
        user,
        "https://update-user-hy6oofbihq-uc.a.run.app",
        {},
        "Failed to update user."
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Call again to ensure nothing gets left behind
      await callFunction(
        user,
        "https://update-user-hy6oofbihq-uc.a.run.app",
        {},
        "Failed to update user."
      );

      Alert.alert("Success", "Church has been updated.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error("Error updating church:", error);
      throw error;
    }
  };

  const handleContinue = async () => {
    const user = getAuth().currentUser;
    if (!user) {
      Alert.alert("Error", "User not authenticated. Please sign in again.");
      return;
    }
    if (!selectedChurch) {
      Alert.alert(
        "Selection Required",
        "Please select a church before proceeding."
      );
      return;
    }

    setIsLoading(true);

    try {
      const userDoc = await getDoc(doc(getFirestore(), "users", user.uid));
      const userData = userDoc.data();
      const currentChurch = userData?.church;

      if (selectedChurch === currentChurch) {
        Alert.alert("No Change", "You have selected the same church.");
        setIsLoading(false);
        return;
      }

      Alert.alert(
        "Warning",
        "Changing your church will remove you from all future schedules including hymns class and Sunday school. Do you want to proceed?",
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setIsLoading(false),
          },
          {
            text: "Yes",
            onPress: async () => {
              try {
                if (currentChurch) {
                  await callFunction(
                    user,
                    "https://remove-family-schedules-hy6oofbihq-uc.a.run.app",
                    { uid: user.uid, church: currentChurch },
                    "Failed to remove family from schedules. Please try again."
                  );
                }

                await updateChurchAndFunctions();
              } catch (error) {
                console.error("Error in church change process:", error);
                Alert.alert(
                  "Error",
                  "Could not complete the church change. Please try again."
                );
              } finally {
                setIsLoading(false);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error("Error handling continue:", error);
      Alert.alert(
        "Error",
        "Could not update church information. Please try again."
      );
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <BackArrow style={styles.backArrow} />
      <Text style={styles.titleText}>
        Select the church you regularly attend
      </Text>
      <View style={styles.churchesContainer}>
        <Churches onSelectChurch={handleChurchSelection} />
      </View>
      <Pressable
        style={[
          styles.continueButton,
          isLoading && styles.continueButtonDisabled,
        ]}
        onPress={handleContinue}
        disabled={isLoading}
      >
        <Text style={styles.continueText}>
          {isLoading ? "Processing..." : "Confirm"}
        </Text>
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
  continueButtonDisabled: {
    backgroundColor: "#1a1a1a",
    opacity: 0.6,
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
