import React, { useEffect, useState } from "react";
import {
  Pressable,
  Image,
  StyleSheet,
  TextInput,
  View,
  Text,
  Alert,
} from "react-native";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import BackArrow from "../components/backArrow";
import ProgressBar from "../components/progressBar";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { UserProvider, useUser } from "../UserContext";

const SignUp = ({ navigation }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { setSignUp } = useUser();

  useEffect(() => {
    setSignUp(false);
  });

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
      // Create user with email and password
      const userCredential = await auth().createUserWithEmailAndPassword(
        email,
        password
      );
      const user = userCredential.user;

      // Check if user object is created successfully
      if (user) {
        // Update display name
        await user.updateProfile({ displayName: name });

        // Ensure to reload the user profile to get the updated display name
        await auth().currentUser.reload();

        // Get the updated user after reload
        const updatedUser = auth().currentUser;

        if (updatedUser && updatedUser.displayName) {
          // Write updated user to Firestore
          await writeUserToDb(updatedUser, updatedUser.displayName);

          // Navigate to SelectChurch after successful signup
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
          name: fullName || "", // Store name if available
          email: user.email,
          admin: false,
        });
      }
    } catch (error) {
      console.error("Error handling Firestore operations: ", error);
    }
  };

  const onGoogleButtonPress = async () => {
    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      const { idToken } = await GoogleSignin.signIn();
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(
        googleCredential
      );
      await writeUserToDb(userCredential.user, userCredential.user.displayName);
      navigation.navigate("SelectChurch");
    } catch (error) {
      console.error(error);
      Alert.alert("Google Sign-In Error", error.message);
    }
  };

  // Helper: Generate a random nonce string
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
      if (!email) {
        throw new Error("Apple Sign-In Error: email already in use.");
      }

      const appleCredential = auth.AppleAuthProvider.credential(
        identityToken,
        rawNonce
      );

      // Sign in with Apple credential
      const userCredential = await auth().signInWithCredential(appleCredential);

      // Format the full name as "First Name Last Name"
      const formattedFullName = `${fullName.givenName} ${fullName.familyName}`;

      writeUserToDb(userCredential.user, formattedFullName);

      navigation.navigate("SelectChurch");
    } catch (error) {
      console.error("Apple Sign-In Error:", error);
      Alert.alert("Apple Sign-In Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.backarrow}>
        <BackArrow />
      </View>
      <View style={styles.progressBar}>
        <ProgressBar startPercentage={0} endPercentage={1} />
      </View>
      <View style={styles.title}>
        <Text style={styles.titleText}>Sign Up</Text>
      </View>
      <TextInput
        value={name}
        autoCapitalize="words"
        style={[styles.input]}
        placeholder="Enter your name"
        placeholderTextColor="#8e8e93"
        color="#8e8e93"
        onChangeText={(text) => setName(text)}
      />
      <TextInput
        value={email}
        autoCapitalize="none"
        style={[styles.input]}
        placeholder="Enter your email"
        placeholderTextColor="#8e8e93"
        color="#8e8e93"
        onChangeText={(text) => setEmail(text)}
      />
      <TextInput
        value={password}
        autoCapitalize="none"
        secureTextEntry={true}
        style={[styles.input]}
        placeholder="Enter your password"
        placeholderTextColor="#8e8e93"
        color="#8e8e93"
        onChangeText={(text) => setPassword(text)}
      />
      <TextInput
        value={confirmPassword}
        autoCapitalize="none"
        secureTextEntry={true}
        style={[styles.input]}
        placeholder="Confirm your password"
        placeholderTextColor="#8e8e93"
        color="#8e8e93"
        onChangeText={(text) => setConfirmPassword(text)}
      />

      <View style={styles.continueLayout}>
        <Pressable onPress={handleSignUp}>
          <Text style={styles.continuetext}>Continue</Text>
        </Pressable>
      </View>
      <View style={styles.dividerWrapper}>
        <View style={styles.divider} />
        <Text style={styles.or}>or</Text>
        <View style={styles.divider} />
      </View>
      <Pressable
        style={styles.socialButtonGoogle}
        onPress={onGoogleButtonPress}
      >
        <View style={styles.socialButtonContent}>
          <Image
            style={styles.socialIcon}
            resizeMode="cover"
            source={require("../assets/googleLogo.png")}
          />
          <Text style={styles.socialText}>Sign up with Google</Text>
        </View>
      </Pressable>
      <View style={styles.componentContainer}>
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={10}
          style={styles.socialButtonApple}
          onPress={onAppleButtonPress}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000", // Black background
    padding: 20,
  },
  backarrow: {
    marginTop: 24,
    position: "absolute", // Position the back arrow absolutely
    top: 50,
    left: 16,
  },
  progressBar: {
    top: 84,
    right: "12.2137%",
    bottom: "88.26%",
    left: "12.2137%",
    position: "absolute",
  },
  title: {
    alignItems: "center",
    marginBottom: 20,
    marginTop: 120, // Add space after moving the progress bar up
  },
  titleText: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#8e8e93",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  input: {
    height: 50,
    borderColor: "#8e8e93",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: "#000000", // Black input background
    color: "#FFFFFF", // White text color
  },
  dividerWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 30,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#8e8e93",
  },
  or: {
    marginHorizontal: 10,
    fontSize: 14,
    color: "#8e8e93",
  },
  continueLayout: {
    backgroundColor: "#8e8e93",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    marginVertical: 15,
  },
  continuetext: {
    color: "#000", // Dark text for button
    fontWeight: "bold",
    fontSize: 16,
  },
  componentContainer: {
    marginTop: 0,
    alignItems: "center",
  },
  socialButtonApple: {
    backgroundColor: "#2C2C2E", // Dark gray for Apple button
    borderRadius: 10,
    height: 50,
    width: "100%",
    justifyContent: "center",
    marginVertical: 10,
    alignItems: "center",
  },
  socialButtonGoogle: {
    backgroundColor: "#2C2C2E", // Black for Google button
    borderRadius: 10,
    height: 50,
    width: "100%",
    justifyContent: "center",
    marginVertical: 10,
    alignItems: "center",
  },
  socialButtonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  socialIcon: {
    width: 15,
    height: 15,
    marginRight: 10,
  },
  socialText: {
    color: "#FFFFFF", // White text for social buttons
    fontSize: 19,
    fontWeight: "500",
  },
});

export default SignUp;
