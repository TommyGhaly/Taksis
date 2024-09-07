import * as React from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Text,
  Pressable,
  ScrollView,
} from "react-native";
import BackArrow from "../components/backArrow";

const PasswordReset = ({ navigation }) => {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BackArrow style={styles.backarrow} />
      <Text style={styles.title}>Change Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        placeholderTextColor="#8e8e93"
      />
      <TextInput
        style={styles.input}
        placeholder="Enter your new password"
        placeholderTextColor="#8e8e93"
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm your new password"
        placeholderTextColor="#8e8e93"
        secureTextEntry
      />

      <Text style={styles.infoText}>
        Please verify the change through the email sent to the provided address.
      </Text>
      <Pressable
        style={styles.confirmButton}
        onPress={() => navigation.goBack()}
      >
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
