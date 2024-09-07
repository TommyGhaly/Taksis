import React, { useState } from "react";
import { TouchableOpacity, StyleSheet, View, Text, Alert } from "react-native";
import firestore from "@react-native-firebase/firestore";
import { Picker } from "@react-native-picker/picker";
import BackArrow from "../../components/backArrow";
import ProgressBar from "../../components/progressBar";
import auth from "@react-native-firebase/auth";

const ChildAge = ({ route, navigation }) => {
  const user = auth().currentUser; // Directly access currentUser
  const userId = user ? user.uid : null; // Access uid directly
  const { childData } = route.params; // Get child data from the previous screen
  const [selectedAge, setSelectedAge] = useState(childData.age || "");

  const handleContinue = async () => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    const updatedChildData = { ...childData, age: selectedAge };

    try {
      // Log userId and updatedChildData to verify values
      console.log("User ID:", userId);
      console.log("Updated Child Data:", updatedChildData);

      // Get the current user's document
      const userDocRef = firestore().collection("users").doc(userId);
      const userDoc = await userDocRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log("User Data:", userData); // Log user data

        // Check if the children array exists
        if (!userData.children) {
          userData.children = [];
        }

        // Check if the child already exists in the array
        const existingChildIndex = userData.children.findIndex(
          (child) => child.uid === updatedChildData.uid
        );

        if (existingChildIndex !== -1) {
          // If the child exists, update the existing entry
          userData.children[existingChildIndex] = updatedChildData;
        } else {
          // If the child does not exist, add a new entry
          userData.children.push(updatedChildData);
        }

        // Update the user's document with the new children array
        await userDocRef.update({ children: userData.children });
        console.log("Children updated successfully");

        // Show alert once the data is successfully updated
        Alert.alert("Success", "Child has been added");
        navigation.navigate("Settings");
      } else {
        console.log("User document does not exist");
        Alert.alert("Error", "User document does not exist");
      }
    } catch (error) {
      console.error("Error updating child data: ", error);
      Alert.alert("Error", "Failed to add child data");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.backarrow}>
        <BackArrow onPress={() => navigation.goBack()} />
      </View>
      <View style={styles.progressBar}>
        <ProgressBar startPercentage={50} endPercentage={100} />
      </View>
      <Text style={styles.title}>What is your child's age?</Text>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={selectedAge}
          onValueChange={(itemValue) => setSelectedAge(itemValue)}
          style={styles.picker}
        >
          {Array.from({ length: 18 }, (_, i) => (
            <Picker.Item
              key={i}
              label={`${i + 1}`}
              value={i + 1}
              color="#fff"
            />
          ))}
        </Picker>
      </View>
      <View style={styles.continueLayout}>
        <TouchableOpacity
          onPress={handleContinue}
          style={styles.continueButton}
        >
          <Text style={styles.continuetext}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  backarrow: {
    top: 10,
    left: 16,
    position: "absolute",
  },
  progressBar: {
    height: 12,
    width: "84%",
    top: 60,
    alignSelf: "center",
    position: "absolute",
  },
  title: {
    top: 130,
    left: 24,
    width: "88%",
    textAlign: "center",
    fontSize: 34,
    letterSpacing: -0.1,
    fontFamily: "Roboto-Regular",
    color: "#8e8e93",
  },
  pickerContainer: {
    top: 100,
    marginTop: 10,
    width: "91%",
    alignSelf: "center",
    backgroundColor: "#333",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  picker: {
    height: 0,
    color: "#fff",
  },
  continueLayout: {
    bottom: 20,
    left: 16,
    height: 50,
    width: "91%",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
  },
  continueButton: {
    width: "100%",
    backgroundColor: "#333",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  continuetext: {
    fontSize: 17,
    letterSpacing: -0.2,
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
    color: "#fff",
    textAlign: "center",
  },
});

export default ChildAge;
