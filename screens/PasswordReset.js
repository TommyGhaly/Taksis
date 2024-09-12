import * as React from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Text,
  Pressable,
  ScrollView,
  Alert,
} from "react-native";
import auth from '@react-native-firebase/auth';  // Import Firebase Auth
import BackArrow from "../components/backArrow";

const PasswordReset = ({ navigation }) => {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const handlePasswordReset = () => {
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    // Send a password reset email using react-native-firebase Auth
    auth()
      .sendPasswordResetEmail(email)
      .then(() => {
        Alert.alert(
          "Success",
          "A password reset email has been sent to the provided email address."
        );
        navigation.goBack();
      })
      .catch((error) => {
        console.error("Error sending password reset email: ", error);
        Alert.alert("Error", error.message);
      });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BackArrow style={styles.backarrow} />
      <Text style={styles.title}>Change Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        placeholderTextColor="#8e8e93"
        value={email}
        onChangeText={(text) => setEmail(text)}
      />
      <TextInput
        style={styles.input}
        placeholder="Enter your new password"
        placeholderTextColor="#8e8e93"
        secureTextEntry
        value={password}
        onChangeText={(text) => setPassword(text)}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm your new password"
        placeholderTextColor="#8e8e93"
        secureTextEntry
        value={confirmPassword}
        onChangeText={(text) => setConfirmPassword(text)}
      />

      <Text style={styles.infoText}>
        Please verify the change through the email sent to the provided address.
      </Text>
      <Pressable style={styles.confirmButton} onPress={handlePasswordReset}>
        <Text style={styles.confirmText}>Continue</Text>
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
    paddingBottom: 20,
  },
  backarrow: {
    position: "absolute",
    top: 20,
    left: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "500",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 30,
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
  infoText: {
    fontSize: 12,
    color: "#8e8e93",
    textAlign: "center",
    marginBottom: 30,
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

export default PasswordReset;
