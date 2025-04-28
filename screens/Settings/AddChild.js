import React, { useState, useEffect } from "react";
import {
  TextInput,
  StyleSheet,
  View,
  Text,
  Alert,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import BackArrow from "../../components/backArrow";
import ProgressBar from "../../components/progressBar";
import firestore from '@react-native-firebase/firestore';
import auth from "@react-native-firebase/auth";

// Custom function to generate a UID
const generateUID = () => firestore().collection("dummy").doc().id;

const AddChild = ({ navigation }) => {
  const [name, setName] = useState("");
  const [childData, setChildData] = useState({
    uid: generateUID(),
    name: "",
    age: "",
    rank: "",
    experience: "",
    church: "",
    frequency: "",
    isDeacon: true,
    isSSTeacher: false,
  });

  useEffect(() => {
    const getUserData = async () => {
      try {
        const user = auth().currentUser;
        if (user) {
          const userDoc = await firestore().collection("users").doc(user.uid).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            setChildData((prevData) => ({
              ...prevData,
              church: userData.church,
              frequency: userData.frequency,
            }));
          }
        }
      } catch (error) {
        Alert.alert(
          "Error",
          "Failed to fetch user data. Please try again."
        );
      }
    };

    getUserData();
  }, []);

  const handleContinue = () => {
    if (!name) {
      Alert.alert("Please input a name before continuing.");
      return;
    }
    const words = name.trim().split(/\s+/).filter(word => word.length > 0);
    if (!(words.length >= 2)) {
      Alert.alert("Please input the first and last name.");
      return;
    }
    const updatedChildData = { ...childData, name };
    navigation.navigate("ChildDeaconRank", { childData: updatedChildData });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Back Arrow */}
      <View style={styles.backarrow}>
        <BackArrow onPress={() => navigation.goBack()} />
      </View>
      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <ProgressBar startPercentage={0} endPercentage={1} />
      </View>
      {/* Title */}
      <Text style={styles.title}>Add Child</Text>
      {/* Text Input */}
      <TextInput
        value={name}
        autoCapitalize="words"
        style={styles.textInput}
        placeholder="Enter your child's full name"
        placeholderTextColor="#8e8e93"
        onChangeText={(text) => setName(text)}
        color="#8e8e93"
      />
      {/* Disclaimer Text */}
      <Text style={styles.disclaimerText}>
        Please only add a child if they are a deacon and not already registered.
      </Text>
      {/* Continue Button */}
      <View style={styles.continueLayout}>
        <TouchableOpacity onPress={handleContinue} style={styles.continueButton}>
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  backarrow: {
    position: "absolute",
    top: 10,
    left: 16,
  },
  progressBar: {
    position: "absolute",
    top: 60,
    width: "84%",
    height: 12,
    alignSelf: "center",
  },
  title: {
    marginTop: 100,
    textAlign: "center",
    fontSize: 32,
    fontFamily: "Roboto-Regular",
    color: "#8e8e93",
    letterSpacing: -0.5,
  },
  textInput: {
    marginTop: 30,
    fontSize: 17,
    fontFamily: "Roboto-Regular",
    borderColor: "#8e8e93",
    height: 55,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: "#121212",
    color: "#8e8e93",
    alignSelf: "center",
    width: "84%",
  },
  disclaimerText: {
    fontSize: 14,
    fontFamily: "Roboto-Regular",
    color: "#888",
    textAlign: "center",
    marginTop: 20,
    paddingHorizontal: 16,
  },
  continueLayout: {
    position: "absolute",
    bottom: 20,
    height: 50,
    width: "91%",
    alignSelf: "center",
  },
  continueButton: {
    width: "100%",
    backgroundColor: "#333",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
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