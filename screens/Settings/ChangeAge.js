import React, { useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  Pressable,
  Alert,
  ScrollView,
} from "react-native";
import BackArrow from "../../components/backArrow";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";
import { Picker } from "@react-native-picker/picker";
import { callFunction } from "../../components/functionCalls";

const ChangeAge = () => {
  const [age, setAge] = useState("18");
  const navigation = useNavigation();
  const user = auth().currentUser;

  const updateAgeInDB = async (age) => {
    try {
      await firestore().collection("users").doc(user.uid).update({
        age: age,
      });
    } catch (error) {
      Alert.alert(
        "Error",
        "Could not update age information. Please try again."
      );
    }
  };

  const handleConfirm = async () => {
    if (age.trim() === "") {
      Alert.alert("Error", "Age cannot be empty.");
      return;
    }
    try {
      await updateAgeInDB(age);
      await callFunction(user, "https://update-user-hy6oofbihq-uc.a.run.app");
      Alert.alert("Success", "Age updated successfully.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to update the age.");
    }
  };

  return (
    <View style={styles.container}>
      <BackArrow style={styles.backarrow} />
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Change Age</Text>
      </View>
      <View style={styles.pickerContainer}>
        <Picker
          selectedValue={age}
          onValueChange={(itemValue) => setAge(itemValue)}
          style={styles.picker}
        >
          {Array.from({ length: 100 }, (_, i) => (
            <Picker.Item key={i} label={`${i + 1}`} value={`${i + 1}`} color="#fff" />
          ))}
        </Picker>
      </View>
      <Pressable style={styles.confirmButton} onPress={handleConfirm}>
        <Text style={styles.confirmText}>Confirm</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#121212",
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  backarrow: {
    position: "absolute",
    top: 20,
    left: 20,
  },
  headerContainer: {
    marginBottom: 10,
    alignItems: "center",
  },
  headerText: {
    fontSize: 28,
    fontWeight: "500",
    color: "#ffffff",
  },
  pickerContainer: {
    width: "91%",
    alignSelf: "center",
    backgroundColor: "#333",
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  picker: {
    height: 0, // Match the previous picker style
    color: "#fff",
  },
  confirmButton: {
    backgroundColor: "#333",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 300,
  },
  confirmText: {
    fontSize: 17,
    color: "#fff",
    fontWeight: "500",
  },
});

export default ChangeAge;
