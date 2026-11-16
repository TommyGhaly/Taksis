import * as React from "react";
import {
  Text,
  View,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { useState } from "react";
import BackArrow from "../../components/backArrow";
import { doc, getFirestore, updateDoc } from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";
import { makeStyles, useTheme } from "../../theme";

const ChangeNumber = () => {
  const styles = useStyles();
  const t = useTheme();
  const [phoneNumber, setPhoneNumber] = useState("");
  const navigation = useNavigation();
  const user = getAuth().currentUser;

  const updateNumberInDB = async (phoneNumber) => {
    try {
      await updateDoc(doc(getFirestore(), "users", user.uid), {
        phone: phoneNumber,
      });
    } catch (error) {
      Alert.alert(
        "Error",
        "Could not update phone number. Please try again."
      );
    }
  };

  const handleConfirm = async () => {
    // Trim the input to remove leading/trailing spaces
    const trimmedPhoneNumber = phoneNumber.trim();

    // Check if the phone number is empty
    if (trimmedPhoneNumber === "") {
      Alert.alert("Error", "Phone number cannot be empty.");
      return;
    }

    try {
      navigation.goBack();
      await updateNumberInDB(trimmedPhoneNumber);
      Alert.alert("Success", "Phone number updated successfully.");
    } catch (error) {
      Alert.alert("Error", "Failed to update the phone number.");
    }
  };

  return (
    <View style={styles.container}>
      <BackArrow style={styles.backarrow} />
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Change Phone Number</Text>
      </View>
      <TextInput
        style={styles.input}
        keyboardType="phone-pad"
        placeholder="Enter your phone number"
        placeholderTextColor={t.placeholder}
        keyboardAppearance={t.keyboardAppearance}
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        color={t.textMuted}
      />
      <Pressable style={styles.confirmButton} onPress={handleConfirm}>
        <Text style={styles.confirmText}>Confirm</Text>
      </Pressable>
    </View>
  );
};

const useStyles = makeStyles((t) => ({
  container: {
    backgroundColor: t.background,
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
    color: t.text,
  },
  disclaimer: {
    fontSize: 14,
    color: t.isDark ? "#ff6347" : "#D9381E",
    marginTop: 10,
    textAlign: "center",
  },
  input: {
    height: 50,
    borderColor: t.textMuted,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    color: t.text,
    marginBottom: 20,
  },
  confirmButton: {
    backgroundColor: t.surfaceHighest,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
  },
  confirmText: {
    fontSize: 17,
    color: t.text,
    fontWeight: "500",
  },
}));

export default ChangeNumber;