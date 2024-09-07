import * as React from "react";
import {
  Text,
  StyleSheet,
  View,
  Pressable,
  Alert,
  ScrollView,
} from "react-native";
import { useState } from "react";
import BackArrow from "../../components/backArrow";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";
import CustomPicker from "../../components/customPicker";

const ChangeAge = () => {
  const [age, setAge] = useState("18");
  const [pickerVisible, setPickerVisible] = useState(false);
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
      await updateAgeInDB(age); // Function to update the age in the DB
      Alert.alert("Success", "Age updated successfully.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to update the age.");
    }
  };

  const ageOptions = Array.from({ length: 100 }, (_, i) => (i + 1).toString());

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BackArrow style={styles.backarrow} />
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Change Age</Text>
      </View>
      <Pressable
        style={styles.pickerContainer}
        onPress={() => setPickerVisible(true)}
      >
        <Text style={styles.pickerText}>{age}</Text>
      </Pressable>
      <CustomPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onSelect={(item) => setAge(item)}
        data={ageOptions}
      />
      <Pressable style={styles.confirmButton} onPress={handleConfirm}>
        <Text style={styles.confirmText}>Confirm</Text>
      </Pressable>
    </ScrollView>
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
  pickerContainer: {
    marginBottom: 20,
    backgroundColor: "#1e1e1e",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
  },
  pickerText: {
    fontSize: 24,
    color: "#fff",
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

export default ChangeAge;
