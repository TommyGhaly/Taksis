import React, { useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  Pressable,
  Alert,
  SafeAreaView,
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
    <SafeAreaView style={styles.container}>
      <View style={styles.innerContainer}>
        <View style={styles.backarrow}>
          <BackArrow onPress={() => navigation.goBack()} />
        </View>

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.questionText}>Change Age</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={age}
                onValueChange={(itemValue) => setAge(itemValue)}
                style={styles.picker}
                itemStyle={styles.pickerItem}
              >
                {Array.from({ length: 100 }, (_, i) => (
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

        <View style={styles.confirmLayout}>
          <Pressable style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmText}>Confirm</Text>
          </Pressable>
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
    paddingHorizontal: 20,
  },
  backarrow: {
    top: 10,
    left: 16,
    position: "absolute",
  },
  content: {
    flex: 1,
    alignItems: "center",
    marginTop: 110,
  },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 30,
    width: "100%",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  questionText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#F0F0F0",
    textAlign: "center",
    marginBottom: 25,
    fontFamily: "Roboto-Regular",
  },
  pickerContainer: {
    backgroundColor: "#252525", // Darker shade than #2C2C2C
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    width: "100%",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#404040",
  },
  picker: {
    height: 180,
    color: "#F0F0F0",
  },
  pickerItem: {
    fontSize: 20,
    fontFamily: "Roboto-Regular",
    color: "#F0F0F0",
  },
  confirmLayout: {
    bottom: 20,
    height: 50,
    width: "91%",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    position: "absolute",
  },
  confirmButton: {
    width: "100%",
    backgroundColor: "#333",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  confirmText: {
    fontSize: 17,
    color: "#fff",
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
    letterSpacing: -0.2,
  },
});

export default ChangeAge;