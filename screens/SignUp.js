import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Image,
  Dimensions,
  Platform,
} from "react-native";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import BackArrow from "../components/backArrow";
import ProgressBar from "../components/progressBar";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { useUser } from "../UserContext";

// Get screen dimensions for dynamic scaling
const { width, height } = Dimensions.get("window");

// Reference dimensions (based on a standard mobile screen, e.g., iPhone X)
const REFERENCE_WIDTH = 375;
const REFERENCE_HEIGHT = 812;

// Scaling functions
const scale = (size) => (width / REFERENCE_WIDTH) * size;
const verticalScale = (size) => (height / REFERENCE_HEIGHT) * size;
const moderateScale = (size, factor = 0.5) =>
  size + (scale(size) - size) * factor;

const SignUp = ({ navigation }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { signUp, setSignUp } = useUser();

  useEffect(() => {
    setSignUp(true);
  }, [setSignUp]);

  GoogleSignin.configure({
    webClientId:
      "642693016544-lt9t0svc4b7ej4koble04ks3vsujea97.apps.googleusercontent.com",
  });

  const handleSignUp = async () => {
    // Validate name has exactly two words
    if (!name) {
      Alert.alert("Error", "Please input a name before continuing.");
      return;
    }
    const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
    if (!(words.length >= 2)) {
      Alert.alert("Error", "Please input your first and last name.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match!");
      return;
    }
    try {
      const userCredential = await auth().createUserWithEmailAndPassword(
        email,
        password
      );
      const user = userCredential.user;
      if (user) {
        await user.updateProfile({ displayName: name });
        await auth().currentUser.reload();
        const updatedUser = auth().currentUser;
        if (updatedUser && updatedUser.displayName) {
          await writeUserToDb(updatedUser, updatedUser.displayName);
          navigation.navigate("PhotoInput");
        } else {
          Alert.alert("Sign Up Error", "Failed to get updated user profile.");
        }
      }
    } catch (error) {
      Alert.alert("Sign Up Error", error.message);
    }
  };

  const writeUserToDb = async (user, fullName) => {
    try {
      const userRef = firestore().collection("users").doc(user.uid);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        await userRef.set({
          uid: user.uid,
          name: fullName || "",
          email: user.email,
          admin: false,
          rank: "Chanter (Epsaltos)",
          experience: 1,
          frequency: 1,
          alhanGrades: [],
          ssGrades: [],
          nextWeekServe: "N/A",
        });
      }
    } catch (error) {
      Alert.alert("Database Error", "Failed to write user data to database.");
    }
  };

  const onGoogleButtonPress = async () => {
    setSignUp(true);
    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      const { idToken } = await GoogleSignin.signIn();
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(
        googleCredential
      );
      const user = auth().currentUser;
      const user_ref = firestore().collection("users").doc(user.uid);
      const user_doc = await user_ref.get();
      if (user_doc.exists) {
        setSignUp(false);
        navigation.navigate("MainContainer");
        Alert.alert(
          "Already signed up.",
          "This email is already signed up for this app."
        );
        return;
      }
      await writeUserToDb(userCredential.user, userCredential.user.displayName);
      navigation.navigate("PhotoInput");
    } catch (error) {
      // Handle error silently as per original code
    }
  };

  const generateNonce = (length = 32) => {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  };

  const onAppleButtonPress = async () => {
    try {
      const rawNonce = generateNonce();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );
      const appleAuthRequestResponse = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!appleAuthRequestResponse.identityToken) {
        throw new Error("Apple Sign-In failed - No identity token received.");
      }
      const { identityToken, fullName, email } = appleAuthRequestResponse;
      const appleCredential = auth.AppleAuthProvider.credential(
        identityToken,
        rawNonce
      );
      const userCredential = await auth().signInWithCredential(appleCredential);
      const user = auth().currentUser;
      const user_ref = firestore().collection("users").doc(user.uid);
      const user_doc = await user_ref.get();
      if (user_doc.exists) {
        setSignUp(false);
        navigation.navigate("MainContainer");
        Alert.alert(
          "Already signed up.",
          "This email is already signed up for this app."
        );
        return;
      }
      const formattedFullName = fullName
        ? `${fullName.givenName} ${fullName.familyName}`
        : "";
      await writeUserToDb(userCredential.user, formattedFullName);
      navigation.navigate("PhotoInput");
    } catch (error) {
      // Handle error silently as per original code
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.backArrow}>
          <BackArrow />
        </View>
        <View style={styles.progressBar}>
          <ProgressBar startPercentage={0} endPercentage={1} />
        </View>
        <Text style={styles.titleText}>Sign Up</Text>
      </View>

      <View style={styles.content}>
        <TextInput
          value={name}
          autoCapitalize="words"
          style={styles.input}
          placeholder="Enter your first and last name"
          placeholderTextColor="#B0BEC5"
          onChangeText={(text) => setName(text)}
        />
        <TextInput
          value={email}
          autoCapitalize="none"
          style={styles.input}
          placeholder="Enter your email"
          placeholderTextColor="#B0BEC5"
          onChangeText={(text) => setEmail(text)}
        />
        <TextInput
          value={password}
          autoCapitalize="none"
          secureTextEntry={true}
          style={styles.input}
          placeholder="Enter your password"
          placeholderTextColor="#B0BEC5"
          onChangeText={(text) => setPassword(text)}
        />
        <TextInput
          value={confirmPassword}
          autoCapitalize="none"
          secureTextEntry={true}
          style={styles.input}
          placeholder="Confirm your password"
          placeholderTextColor="#B0BEC5"
          onChangeText={(text) => setConfirmPassword(text)}
        />
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.continueButton} onPress={handleSignUp}>
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>
        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.orText}>or</Text>
          <View style={styles.divider} />
        </View>
        <Pressable style={styles.googleButton} onPress={onGoogleButtonPress}>
          <Image
            style={styles.googleIcon}
            resizeMode="contain"
            source={require("../assets/googleLogo.png")}
          />
          <Text style={styles.socialText}>Sign up with Google</Text>
        </Pressable>
        <View style={styles.appleButtonContainer}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
            }
            buttonStyle={
              AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={moderateScale(12)}
            style={styles.appleButton}
            onPress={onAppleButtonPress}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: scale(16),
    paddingTop: verticalScale(80),
    paddingBottom: verticalScale(40),
  },
  header: {
    marginBottom: verticalScale(32),
  },
  backArrow: {
    marginBottom: verticalScale(16),
  },
  progressBar: {
    height: verticalScale(6),
    width: "100%",
    backgroundColor: "#2A2A2A",
    borderRadius: moderateScale(3),
    marginBottom: verticalScale(20),
  },
  titleText: {
    fontSize: moderateScale(36),
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    fontWeight: "600",
    color: "#E0E0E0",
    lineHeight: moderateScale(42),
    textAlign: "left",
  },
  content: {
    marginBottom: verticalScale(24),
  },
  input: {
    height: verticalScale(52),
    borderColor: "#8e8e93",
    borderWidth: 1,
    borderRadius: moderateScale(12),
    paddingHorizontal: scale(15),
    fontSize: moderateScale(18),
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    color: "#8e8e93",
    backgroundColor: "#000",
    marginBottom: verticalScale(16),
  },
  footer: {
    paddingTop: 0,
    paddingBottom: verticalScale(32),
    alignItems: "center",
  },
  continueButton: {
    height: verticalScale(52),
    width: "100%",
    backgroundColor: "#147EFB",
    borderRadius: moderateScale(12),
    justifyContent: "center",
    alignItems: "center",
    marginBottom: verticalScale(16),
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: moderateScale(4),
  },
  continueText: {
    fontSize: moderateScale(18),
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    fontWeight: "600",
    color: "#FFF",
    letterSpacing: -0.2,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: verticalScale(16),
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#B0BEC5",
    opacity: 0.3,
  },
  orText: {
    marginHorizontal: scale(10),
    fontSize: moderateScale(16),
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    color: "#B0BEC5",
  },
  googleButton: {
    height: verticalScale(52),
    width: "100%",
    backgroundColor: "#2A2A2A",
    borderRadius: moderateScale(12),
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: verticalScale(16),
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: moderateScale(4),
  },
  googleIcon: {
    width: moderateScale(24),
    height: moderateScale(24),
    marginRight: scale(12),
  },
  socialText: {
    fontSize: moderateScale(20),
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    fontWeight: "600",
    color: "#E0E0E0",
    letterSpacing: -0.2,
  },
  appleButtonContainer: {
    borderWidth: 1,
    borderColor: "#8e8e93",
    borderRadius: moderateScale(12),
    overflow: "hidden",
    width: "100%",
  },
  appleButton: {
    height: verticalScale(52),
    width: "100%",
  },
});

export default SignUp;