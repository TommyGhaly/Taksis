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
import { getAuth, signInWithEmailAndPassword } from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";
import { makeStyles, useTheme } from "../../theme";

const ChangeEmail = () => {
  const styles = useStyles();
  const t = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); // State to store the password
  const navigation = useNavigation();

  const handleConfirm = async () => {
    if (email.trim() === "" || password.trim() === "") {
      Alert.alert("Error", "Email and password cannot be empty.");
      return;
    }

    try {
      // Sign in with the current email and password
      const userCredential = await signInWithEmailAndPassword(
        getAuth(),
        getAuth().currentUser.email,
        password
      );
      // Update the email
      navigation.goBack();
      await userCredential.user.updateEmail(email);
      Alert.alert("Success", "Email updated successfully.");
    } catch (error) {
      let errorMessage = "Could not update email.";
      if (error.code === "auth/wrong-password") {
        errorMessage = "Incorrect password.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "The email address is not valid.";
      } else if (error.code === "auth/email-already-in-use") {
        errorMessage = "This email is already in use by another account.";
      } else if (error.code === "auth/operation-not-allowed") {
        errorMessage =
          "Email updates are not allowed. Check your Firebase Authentication settings.";
      } else if (error.code === "auth/requires-recent-login") {
        errorMessage = "Please re-authenticate and try again.";
      }
      Alert.alert("Error", errorMessage);
    }
  };

  return (
    <View style={styles.container}>
      <BackArrow style={styles.backarrow} />
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Change Email</Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Enter your new email"
        placeholderTextColor={t.placeholder}
        keyboardAppearance={t.keyboardAppearance}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        color={t.textMuted}

      />
      <TextInput
        style={styles.input}
        placeholder="Enter your password"
        placeholderTextColor={t.placeholder}
        keyboardAppearance={t.keyboardAppearance}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
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

export default ChangeEmail;
