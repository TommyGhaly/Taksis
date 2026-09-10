import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
} from "react-native";
import { doc, getFirestore, updateDoc } from "@react-native-firebase/firestore";
import { getDownloadURL, getStorage, ref } from "@react-native-firebase/storage";
import { getAuth } from "@react-native-firebase/auth";
import { useUser } from "../../UserContext";
import ProgressBar from "../../components/progressBar";
import PhotoInput from "../../components/photoInput";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";

const InputPhoto = ({ route, navigation }) => {
  const { from } = route.params || {};
  const user = getAuth().currentUser;
  const { setSignUp } = useUser();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [uploadedPhotoURL, setUploadedPhotoURL] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };

  const handleContinue = useCallback(async () => {
    if (!user?.uid) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    setIsLoading(true);

    try {
      // Check if profile picture exists in storage (in case state got out of sync)
      let photoURL = uploadedPhotoURL;
      if (!photoURL) {
        try {
          const reference = ref(getStorage(), `profilePictures/${user.uid}.png`);
          photoURL = await getDownloadURL(reference);
        } catch (storageError) {
          // No photo uploaded - that's fine, it's optional
        }
      }

      // Update Firestore with phone and photo URL if it exists
      const updateData = { phone: phoneNumber.trim() };
      if (photoURL) {
        updateData.photoURL = photoURL;
      }

      await updateDoc(doc(getFirestore(), "users", user.uid), updateData);
      setSignUp(true);
      navigation.navigate("SelectChurch");
    } catch (error) {
      Alert.alert(
        "Error",
        "Could not update profile information. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }, [phoneNumber, user, setSignUp, navigation, uploadedPhotoURL]);

  const handlePhotoPress = useCallback(() => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setShowPhotoModal(true);
  }, []);

  const handleTextInputPress = useCallback(() => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
  }, []);

  const handlePhoneNumberChange = useCallback((text) => {
    setPhoneNumber(text);
    const digitsOnly = text.replace(/\D/g, "");
    if (digitsOnly.length >= 10) {
      Keyboard.dismiss();
    }
  }, []);

  const handleUploadSuccess = useCallback((url) => {
    setUploadedPhotoURL(url);
  }, []);

  const handleSkipPhoto = useCallback(() => {
    setShowPhotoModal(false);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.progressBar}>
          <ProgressBar startPercentage={1} endPercentage={17} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
      >
        <Text style={styles.titleText}>Set Up Your Profile</Text>

        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              {/* Phone Input Section */}
              <View style={styles.card}>
                <Text style={styles.questionText}>
                  What's your phone number (Optional)?
                </Text>
                <TextInput
                  style={styles.input}
                  value={phoneNumber}
                  onChangeText={handlePhoneNumberChange}
                  placeholder="Enter phone number"
                  placeholderTextColor="#8E8E93"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  onPressIn={handleTextInputPress}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>

              {/* Photo Input Section */}
              <View style={[styles.card, { marginTop: 20 }]}>
                <Text style={styles.questionText}>
                  Upload your profile picture (optional)
                </Text>
                <Pressable
                  style={[
                    styles.uploadButton,
                    uploadedPhotoURL && styles.uploadButtonSuccess,
                  ]}
                  onPress={handlePhotoPress}
                >
                  {uploadedPhotoURL ? (
                    <View style={styles.uploadedContainer}>
                      <Icon name="check-circle" size={20} color="#FFF" />
                      <Text style={styles.uploadButtonText}>
                        Photo Uploaded ✓
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.uploadButtonText}>
                      Choose Profile Picture
                    </Text>
                  )}
                </Pressable>
                {uploadedPhotoURL && (
                  <Text style={styles.changePhotoText}>
                    Tap to change photo
                  </Text>
                )}
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
        <View style={styles.footer}>
          <Pressable
            style={[styles.continueButton, isLoading && styles.disabledButton]}
            onPress={handleContinue}
            disabled={isLoading}
          >
            <Text style={styles.continueText}>
              {isLoading ? "Saving..." : "Continue"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <PhotoInput
        visible={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        userId={user?.uid || "default"}
        onUploadSuccess={handleUploadSuccess}
        onSkip={handleSkipPhoto}
      />
    </View>
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
    marginBottom: 0,
  },
  progressBar: {
    height: 6,
    width: "100%",
    backgroundColor: "#2A2A2A",
    borderRadius: 3,
    marginBottom: 12,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  titleText: {
    fontSize: 36,
    letterSpacing: -0.5,
    fontFamily: "Roboto-Regular",
    fontWeight: "600",
    color: "#E0E0E0",
    lineHeight: 42,
    marginTop: 30,
    marginBottom: 10,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    marginBottom: 54,
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
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginTop: 10,
  },
  uploadButtonSuccess: {
    backgroundColor: "#4CAF50",
  },
  uploadedContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  uploadButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "Roboto-Medium",
  },
  changePhotoText: {
    color: "#888",
    fontSize: 13,
    marginTop: 8,
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
    alignItems: "center",
  },
  continueButton: {
    height: 52,
    width: "100%",
    backgroundColor: "#147EFB",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 67,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  disabledButton: {
    backgroundColor: "#555",
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