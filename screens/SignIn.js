import * as React from "react";
import { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  Dimensions, // Added for screen size detection
} from "react-native";
import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import BackArrow from "../components/backArrow";
import { UserProvider, useUser } from "../UserContext";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";

const SignIn = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { signUp, setSignUp } = useUser();

  // Get screen width to detect iPad
  const { width } = Dimensions.get("window");
  const isTablet = width >= 768; // Typical iPad width threshold

  useEffect(() => {
    setSignUp(false);
  }, []);

  GoogleSignin.configure({
    webClientId:
      "642693016544-lt9t0svc4b7ej4koble04ks3vsujea97.apps.googleusercontent.com",
  });

  const handleSignIn = async () => {
    try {
      await auth().signInWithEmailAndPassword(email, password);
      navigation.navigate("MainContainer");
    } catch (error) {
      Alert.alert("Sign-In Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.backarrow}>
        <BackArrow />
      </View>

      <View style={styles.contentWrapper}>
        <Image
          style={styles.icon}
          resizeMode="contain"
          source={require("../assets/lastSupperIcon.png")}
        />
        <Text style={styles.titleText}>Sign In</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter your email"
          placeholderTextColor="#B0B0B0"
          onChangeText={setEmail}
          value={email}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Enter your password"
          placeholderTextColor="#B0B0B0"
          onChangeText={setPassword}
          value={password}
          secureTextEntry
        />
        <TouchableOpacity style={styles.button} onPress={handleSignIn}>
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>

        <View style={styles.linkRow}>
          <Pressable
            style={styles.link}
            onPress={() => navigation.navigate("PasswordReset")}
          >
            <Text style={styles.linkText1}>Forgot password?</Text>
            <Text style={styles.linkText2}> Set new password</Text>
          </Pressable>
        </View>

        <View style={styles.dividerWrapper}>
          <View style={styles.divider} />
          <Text style={styles.or}>or</Text>
          <View style={styles.divider} />
        </View>

        <Pressable
          style={styles.socialButtonGoogle}
          onPress={() => onGoogleButtonPress()}
        >
          <View style={styles.socialButtonContent}>
            <Image
              style={styles.socialIcon}
              resizeMode="cover"
              source={require("../assets/googleLogo.png")}
            />
            <Text style={styles.socialText}>Sign in with Google</Text>
          </View>
        </Pressable>

        <View style={[styles.appleButtonContainer, isTablet && styles.appleButtonContainerTablet]}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
            }
            buttonStyle={
              AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={12}
            style={[styles.appleButton, isTablet && styles.appleButtonTablet]}
            onPress={() => onAppleButtonPress()}
          />
        </View>

        <View style={styles.linkRow}>
          <TouchableOpacity
            style={styles.link}
            onPress={() => navigation.navigate("SignUp")}
          >
            <Text style={styles.linkText1}>Don’t have an account?</Text>
            <Text style={styles.linkText2}> Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

async function onGoogleButtonPress() {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const { idToken } = await GoogleSignin.signIn();
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    await auth().signInWithCredential(googleCredential);
    // Navigation is handled by onAuthStateChanged in App.js after Firestore check
  } catch (error) {
    Alert.alert("Error", "Google Sign-In failed. Please try again.");
  }
}

const generateNonce = (length = 32) => {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

async function onAppleButtonPress() {
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

    const { identityToken } = appleAuthRequestResponse;
    const appleCredential = auth.AppleAuthProvider.credential(
      identityToken,
      rawNonce
    );

    await auth().signInWithCredential(appleCredential);
    // Navigation is handled by onAuthStateChanged in App.js after Firestore check
  } catch (error) {
    Alert.alert("Error", "Apple Sign-In failed. Please try again.");
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 20,
  },
  backarrow: {
    paddingTop: 70,
    marginBottom: 0,
  },
  contentWrapper: {
    paddingTop: 30,
  },
  titleText: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#8e8e93",
    textAlign: "center",
    marginBottom: 20,
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  icon: {
    alignSelf: "center",
    width: "100%",
    height: undefined,
    aspectRatio: 1089 / 499,
    marginBottom: 20,
  },
  input: {
    height: 50,
    borderColor: "#B0B0B0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: "#000",
    color: "#FFFFFF",
  },
  button: {
    height: 50,
    backgroundColor: "#147EFB",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 10,
    alignItems: "center",
  },
  link: {
    alignItems: "center",
    flexDirection: "row",
  },
  linkText1: {
    color: "#8e8e93",
    fontSize: 14,
  },
  linkText2: {
    color: "#6e85e3",
    fontSize: 14,
  },
  dividerWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#B0B0B0",
  },
  or: {
    marginHorizontal: 10,
    fontSize: 14,
    color: "#B0B0B0",
  },
  socialButtonGoogle: {
    backgroundColor: "#2C2C2E",
    borderRadius: 10,
    height: 50,
    width: "100%",
    justifyContent: "center",
    marginVertical: 5,
    alignItems: "center",
    marginBottom: 15,
  },
  appleButtonContainer: {
    borderWidth: 1,
    borderColor: "#8e8e93",
    borderRadius: 12,
    overflow: "hidden",
    width: "100%", // Default for phones
  },
  appleButtonContainerTablet: {
    width: "60%", // Smaller width for iPad
    alignSelf: "center", // Center the button on iPad
  },
  appleButton: {
    height: 52,
    width: "100%",
  },
  appleButtonTablet: {
    height: 44, // Slightly smaller height for iPad
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
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "500",
  },
});

export default SignIn;