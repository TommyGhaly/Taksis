import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useUser } from "../UserContext";
import ProgressBar from "../components/progressBar";
import PhotoInput from "../components/photoInput";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import BackArrow from "../components/backArrow";

const InputPhoto = ({ route, navigation }) => {
  const { from } = route.params || {};
  const user = auth().currentUser;
  const { setSignUp } = useUser();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const fromApplicable = from === "SelectApplicable";

  const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };

  const handleContinue = async () => {
    if (!user?.uid) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    if (!phoneNumber.trim()) {
      Alert.alert("Error", "Please enter a phone number");
      return;
    }

    try {
      await firestore().collection("users").doc(user.uid).update({
        phoneNumber: phoneNumber.trim(),
      });
      setSignUp(true);
      navigation.navigate("SelectChurch");
    } catch (error) {
      Alert.alert("Error", "Could not update profile information. Please try again.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 120}
    >
      <View style={styles.header}>
        <View style={styles.backArrow}>
          <Pressable onPress={() => navigation.goBack()}>
            <BackArrow />
          </Pressable>
        </View>
        <View style={styles.progressBar}>
          <ProgressBar startPercentage={1} endPercentage={17} />
        </View>
        <Text style={styles.titleText}>Set Up Your Profile</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.questionText}>Upload your profile picture (optional)</Text>
          <Pressable
            style={styles.uploadButton}
            onPress={() => {
              ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
              setShowPhotoModal(true);
            }}
          >
            <Text style={styles.uploadButtonText}>Choose Profile Picture</Text>
          </Pressable>

          <Text style={[styles.questionText, { marginTop: 20 }]}>
            What's your phone number?
          </Text>
          <TextInput
            style={styles.input}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Enter phone number"
            placeholderTextColor="#8E8E93"
            keyboardType="phone-pad"
            autoCapitalize="none"
            onPressIn={() => ReactNativeHapticFeedback.trigger("impactLight", hapticOptions)}
          />
        </View>
      </View>
      <View style={styles.footer}>
        <Pressable style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>
      </View>

      <PhotoInput
        visible={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        userId={user?.uid || "default"}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingHorizontal: 16,
    paddingTop: 120,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  backArrow: {
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    marginBottom: 12,
    backgroundColor: "#2A2A2A",
    borderRadius: 3,
  },
  titleText: {
    fontSize: 36,
    letterSpacing: -0.5,
    fontFamily: "Roboto-Regular",
    fontWeight: "600",
    color: "#E0E0E0",
    lineHeight: 42,
    maxWidth: "90%",
    marginTop: 30,
  },
  content: {
    flex: 1,
    marginBottom: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 25,
    width: "100%",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    alignItems: "center",
  },
  questionText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#E0E0E0",
    textAlign: "center",
    marginBottom: 10,
    fontFamily: "Roboto-Regular",
  },
  uploadButton: {
    backgroundColor: "#147EFB",
    padding: 10,
    borderRadius: 5,
    width: "100%",
    alignItems: "center",
    marginVertical: 10,
  },
  uploadButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontFamily: "Roboto-Medium",
  },
  input: {
    width: "100%",
    height: 50,
    backgroundColor: "#2A2A2A",
    borderRadius: 10,
    paddingHorizontal: 15,
    color: "#E0E0E0",
    fontSize: 16,
    fontFamily: "Roboto-Regular",
    marginTop: 10,
  },
  footer: {
    paddingBottom: 32,
    alignItems: "center",
  },
  continueButton: {
    height: 52,
    width: "100%",
    backgroundColor: "#147EFB",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  continueText: {
    fontSize: 18,
    letterSpacing: -0.2,
    fontWeight: "600",
    fontFamily: "Roboto-Medium",
    color: "#FFF",
  },
});

export default InputPhoto;