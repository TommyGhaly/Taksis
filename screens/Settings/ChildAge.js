import React, { useState } from "react";
import { TouchableOpacity, StyleSheet, View, Text, Alert, SafeAreaView } from "react-native";
import firestore from "@react-native-firebase/firestore";
import { Picker } from "@react-native-picker/picker";
import BackArrow from "../../components/backArrow";
import ProgressBar from "../../components/progressBar";
import auth from "@react-native-firebase/auth";
import { callFunction } from "../../components/functionCalls";

const ChildAge = ({ route, navigation }) => {
  const user = auth().currentUser; // Directly access currentUser
  const userId = user ? user.uid : null; // Access uid directly
  const { childData } = route.params; // Get child data from the previous screen
  const [selectedAge, setSelectedAge] = useState(childData.age || "1");

  const handleContinue = async () => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    const updatedChildData = { ...childData, age: selectedAge };

    try {
      console.log("User ID:", userId);
      console.log("Updated Child Data:", updatedChildData);

      const userDocRef = firestore().collection("users").doc(userId);
      const userDoc = await userDocRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log("User Data:", userData);

        if (!userData.children) {
          userData.children = [];
        }

        const existingChildIndex = userData.children.findIndex(
          (child) => child.uid === updatedChildData.uid
        );

        if (existingChildIndex !== -1) {
          userData.children[existingChildIndex] = updatedChildData;
        } else {
          userData.children.push(updatedChildData);
        }
        console.log(userData.children);
        console.log(updatedChildData);
        await userDocRef.update({ children: userData.children });
        console.log(userData);
        await callFunction(user, "https://update-user-hy6oofbihq-uc.a.run.app");
        console.log("Children updated successfully");

        Alert.alert("Success", "Child data has been updated");
        navigation.navigate("Settings");
      } else {
        console.log("User document does not exist");
        Alert.alert("Error", "User document does not exist");
      }
    } catch (error) {
      console.error("Error updating child data: ", error);
      Alert.alert("Error", "Failed to update child data");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.innerContainer}>
        <View style={styles.backarrow}>
          <BackArrow onPress={() => navigation.goBack()} />
        </View>
        <View style={styles.progressBar}>
          <ProgressBar startPercentage={67} endPercentage={100} />
        </View>

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.questionText}>
              What is your child's age?
            </Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedAge}
                onValueChange={(itemValue) => setSelectedAge(itemValue)}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {Array.from({ length: 18 }, (_, i) => (
                  <Picker.Item
                    key={i}
                    label={`${i + 1}`}
                    value={`${i + 1}`}
                  />
                ))}
              </Picker>
            </View>
          </View>
        </View>

        <View style={styles.continueLayout}>
          <TouchableOpacity
            onPress={handleContinue}
            style={styles.continueButton}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  innerContainer: {
    flex: 1,
    paddingTop: 18,
    paddingBottom: 40,
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
  content: {
    flex: 1,
    alignItems: "center",
    marginTop: 110, // Slightly adjusted for better spacing
  },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 30, // Increased padding for a more spacious feel
    width: "100%",
    elevation: 6, // Slightly higher elevation for depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, // Stronger shadow for contrast
    shadowRadius: 6,
    borderWidth: 1, // Subtle border for definition
    borderColor: "#2A2A2A",
  },
  questionText: {
    fontSize: 28, // Larger font for emphasis
    fontWeight: "700", // Bolder for a modern look
    color: "#F0F0F0", // Slightly brighter white for contrast
    textAlign: "center",
    marginBottom: 25, // More space below the title
    fontFamily: "Roboto-Regular",
  },
  pickerContainer: {
    backgroundColor: "#2C2C2C", // Slightly lighter than card for contrast
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5, // Added vertical padding for balance
    width: "100%",
    alignSelf: "center",
    borderWidth: 1, // Subtle border
    borderColor: "#404040",
  },
  picker: {
    height: 180, // Larger height for better usability
    color: "#F0F0F0", // Bright text to match the theme
  },
  pickerItem: {
    fontSize: 20, // Larger text in picker items
    fontFamily: "Roboto-Regular",
    color: "#F0F0F0", // Ensure item text matches
  },
  continueLayout: {
    bottom: 20,
    height: 50,
    width: "91%", // Kept for consistency, but centered
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center", // Centers the entire layout horizontally
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
  buttonText: {
    fontSize: 17,
    letterSpacing: -0.2,
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
    color: "#fff",
    textAlign: "center",
  },
});

export default ChildAge;