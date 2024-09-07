import React, { useState } from "react";
import {
  Pressable,
  TextInput,
  StyleSheet,
  View,
  Text,
  Alert,
  TouchableOpacity,
} from "react-native";
import BackArrow from "../../components/backArrow";
import ProgressBar from "../../components/progressBar";

// Custom function to generate a UID
const generateUID = () => {
  return Math.random().toString(36).substr(2, 9);
};

const AddChild = ({ navigation }) => {
  const [name, setName] = useState("");
  const [childData, setChildData] = useState({
    uid: generateUID(), // Use custom function to generate UID
    name: "",
    age: "",
    deaconRank: "",
    // other child data fields
  });

  const handleContinue = () => {
    const updatedChildData = { ...childData, name };
    navigation.navigate("ChildDeaconRank", { childData: updatedChildData });
  };

  return (
    <View style={styles.container}>
      <View style={styles.backarrow}>
        <BackArrow />
      </View>
      <View style={styles.progressBar}>
        <ProgressBar startPercentage={0} endPercentage={1} />
      </View>
      <View style={styles.titleContainer}>
        <Text style={styles.titleText}>Add Child</Text>
      </View>
      <TextInput
        value={name}
        autoCapitalize="words"
        style={styles.textInput}
        placeholder="Enter your child's full name"
        placeholderTextColor="#8e8e93"
        onChangeText={(text) => setName(text)}
        color="#8e8e93"
      />
      <TouchableOpacity onPress={handleContinue} activeOpacity={0.8}>
        <View style={styles.continueButton}>
          <Text style={styles.continueText}>Continue</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 16,
    paddingTop: 80,
  },
  backarrow: {
    position: "absolute",
    top: 10,
    left: 16,
  },
  progressBar: {
    height: 12,
    width: "90%", // Match the width of the progress bar in ChildDeaconRank
    alignSelf: "center",
    position: "absolute",
    top: 60, // Match the top position of the progress bar in ChildDeaconRank
  },
  titleContainer: {
    alignItems: "center",
    marginVertical: 40,
  },
  titleText: {
    fontSize: 34,
    fontFamily: "Roboto-Regular",
    color: "#8e8e93",
    letterSpacing: -0.1,
  },
  textInput: {
    fontSize: 17,
    fontFamily: "Roboto-Regular",
    borderColor: "#8e8e93",
    height: 55,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 20,
    backgroundColor: "#333",
    color: "#8e8e93",
  },
  continueButton: {
    backgroundColor: "#333",
    borderRadius: 10,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
  },
  continueText: {
    fontSize: 17,
    fontFamily: "Roboto-Medium",
    color: "#fff",
    letterSpacing: -0.2,
    fontWeight: "500",
  },
});

export default AddChild;
