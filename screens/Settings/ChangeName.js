import * as React from "react";
import {
  Text,
  StyleSheet,
  View,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { useState } from "react";
import BackArrow from "../../components/backArrow";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";

const ChangeName = () => {
  const [name, setName] = useState("");
  const navigation = useNavigation();
  const user = auth().currentUser;

  const updateNameInDB = async (name) => {
    try {
      await firestore().collection("users").doc(user.uid).update({
        name: name,
      });
    } catch (error) {
      Alert.alert(
        "Error",
        "Could not update name information. Please try again."
      );
    }
  };
  const handleConfirm = async () => {
    if (name.trim() === "") {
      Alert.alert("Error", "Name cannot be empty.");
      return;
    }
    try {
      await updateNameInDB(name); // Function to update the name in the DB
      Alert.alert("Success", "Name updated successfully.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to update the name.");
    }
  };

  return (
    <View style={styles.container}>
      <BackArrow style={styles.backarrow} />
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Change Name</Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        placeholderTextColor="#8e8e93"
        value={name}
        onChangeText={setName}
      />
      <Pressable style={styles.confirmButton} onPress={handleConfirm}>
        <Text style={styles.confirmText}>Confirm</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000",
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
    marginBottom: 30,
    alignItems: "center",
  },
  headerText: {
    fontSize: 28,
    fontWeight: "500",
    color: "#ffffff",
  },
  input: {
    height: 50,
    borderColor: "#8e8e93",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    color: "#fff",
    marginBottom: 20,
  },
  confirmButton: {
    backgroundColor: "#333",
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
  },
  confirmText: {
    fontSize: 17,
    color: "#fff",
    fontWeight: "500",
  },
});

export default ChangeName;
