import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Image,
} from "react-native";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import BackArrow from "../components/backArrow";
import ProgressBar from "../components/progressBar";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { useUser } from "../UserContext";

const SignUp = ({ navigation }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { signUp, setSignUp } = useUser();

  useEffect(() => {
    setSignUp(true);
    console.log("sign Up :", signUp);
  }, [setSignUp]);

  GoogleSignin.configure({
    webClientId:
      "642693016544-lt9t0svc4b7ej4koble04ks3vsujea97.apps.googleusercontent.com",
  });

  const handleSignUp = async () => {
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
          navigation.navigate("SelectChurch");
        } else {
          console.error("Failed to get updated user profile.");
          Alert.alert("Sign Up Error", "Failed to get updated user profile.");
        }
      }
    } catch (error) {
      console.error("Sign Up Error:", error);
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
          experience: "1",
          alhanSetUp: false,
          ssSetUp: false,
          alhanGrades: null,
          ssGrades: null,
          nextWeekServe: "N/A",
        });
      }
    } catch (error) {
      console.error("Error handling Firestore operations: ", error);
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
      navigation.navigate("SelectChurch");
    } catch (error) {
      console.error(error);
      Alert.alert("Google Sign-In Error", error.message);
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
      const formattedFullName = `${fullName.givenName} ${fullName.familyName}`;
      await writeUserToDb(userCredential.user, formattedFullName);
      navigation.navigate("SelectChurch");
    } catch (error) {
      console.error("Apple Sign-In Error:", error);
      Alert.alert("Apple Sign-In Error", error.message);
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
          placeholder="Enter your name"
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
            cornerRadius={12}
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
    backgroundColor: "#000", // Matches other screens
    paddingHorizontal: 16, // Matches SelectChurch
    paddingTop: 80, // Matches SelectChurch
    paddingBottom: 40, // Matches SelectChurch
  },
  header: {
    marginBottom: 32, // Matches SelectChurch
  },
  backArrow: {
    marginBottom: 16, // Matches SelectApplicable
  },
  progressBar: {
    height: 6,
    width: "100%",
    backgroundColor: "#2A2A2A", // Matches SelectChurch
    borderRadius: 3,
    marginBottom: 20, // Matches SelectChurch
  },
  titleText: {
    fontSize: 36,
    fontFamily: "Roboto-Regular",
    fontWeight: "600",
    color: "#E0E0E0", // Matches other screens
    lineHeight: 42,
    textAlign: "left", // Matches SelectChurch
  },
  content: {
    marginBottom: 24, // Matches SelectChurch
  },
  input: {
    height: 52, // Matches button height for consistency
    borderColor: "#8e8e93",
    borderWidth: 1,
    borderRadius: 12, // Matches SelectChurch
    paddingHorizontal: 15,
    fontSize: 18, // Matches other text sizes
    fontFamily: "Roboto-Regular",
    color: "#8e8e93", // Matches primary text
    backgroundColor: "#000", // Matches unselected items
    marginBottom: 16, // Consistent spacing
  },
  footer: {
    paddingTop: 0,
    paddingBottom: 32, // Matches SelectChurch
    alignItems: "center",
  },
  continueButton: {
    height: 52, // Matches SelectChurch
    width: "100%", // Matches SelectChurch
    backgroundColor: "#147EFB", // Matches SelectChurch
    borderRadius: 12, // Matches SelectChurch
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16, // Matches SelectChurch
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  continueText: {
    fontSize: 18, // Matches SelectChurch
    fontFamily: "Roboto-Medium",
    fontWeight: "600",
    color: "#FFF",
    letterSpacing: -0.2,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16, // Reduced from 30 for tighter spacing
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#B0BEC5",
    opacity: 0.3, // Matches Choices divider
  },
  orText: {
    marginHorizontal: 10,
    fontSize: 16,
    fontFamily: "Roboto-Regular",
    color: "#B0BEC5", // Matches secondary text
  },
  googleButton: {
    height: 52, // Matches SelectChurch
    width: "100%", // Matches SelectChurch
    backgroundColor: "#2A2A2A", // Matches unselected items
    borderRadius: 12, // Matches SelectChurch
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16, // Matches SelectChurch
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  googleIcon: {
    width: 24, // Slightly larger for visibility
    height: 24,
    marginRight: 12,
  },
  socialText: {
    fontSize: 18, // Matches other button text
    fontFamily: "Roboto-Medium",
    fontWeight: "600",
    color: "#E0E0E0", // Matches primary text
    letterSpacing: -0.2,
  },
  appleButtonContainer: {
    borderWidth: 1, // Adds the border
    borderColor: "#8e8e93", // Adjust the color as needed
    borderRadius: 12, // Matches the button's corner radius
    overflow: "hidden", // Ensures the button doesn't exceed the container's border
    width: "100%"
  },
  appleButton: {
    height: 52, // Matches SelectChurch
    width: "100%", // Matches SelectChurch
  },
});

export default SignUp;
