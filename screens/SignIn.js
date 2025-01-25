import * as React from "react";
import { useState } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  Text,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import BackArrow from "../components/backArrow";

const SignIn = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  GoogleSignin.configure({
    webClientId: "YOUR_WEB_CLIENT_ID",
  });

  const handleSignIn = async () => {
    try {
      await auth().signInWithEmailAndPassword(email, password);
      navigation.navigate("MainContainer");
    } catch (error) {
      console.error("Sign In Error:", error);
      Alert.alert("Sign In Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.backarrow}>
        <BackArrow />
      </View>
      
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

      {/* Wrap the links in a row */}
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
      <View style={styles.socialButtonsContainer}>
      <Pressable
          style={styles.socialButtonGoogle}
          onPress={() => onGoogleButtonPress(navigation)}
        >
          <Image
            style={styles.socialIcon}
            resizeMode="contain"
            source={require("../assets/googleLogo.png")}
          />
          <Text style={styles.socialText}>Sign in with Google</Text>
        </Pressable>
        <Pressable style={styles.socialButtonApple}>
          <Image
            style={styles.socialIcon}
            resizeMode="contain"
            source={require("../assets/appleLogo.png")}
          />
          <Text style={styles.socialText}>Sign in with Apple</Text>
        </Pressable>
        
      </View>
      {/* New row for the sign-up link */}
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
  );
};

async function onGoogleButtonPress(navigation) {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const { idToken } = await GoogleSignin.signIn();
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    await auth().signInWithCredential(googleCredential);
  } catch (error) {
    console.error(error);
    Alert.alert("Google Sign-In Error", error.message);
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000", // Black background
    padding: 20,
  },
  backarrow: {
    marginTop: 50,
    marginBottom: 20,
  },
  titleText: {
    fontSize: 36, // Increased font size for the title
    fontWeight: "bold",
    color: "#8e8e93", // Color for the title
    textAlign: "center",
    marginBottom: 30,
    textShadowColor: '#000', // Shadow color for title
    textShadowOffset: { width: 0, height: 1 }, // Shadow offset for title
    textShadowRadius: 2, // Shadow radius for title
  },
  icon: {
    alignSelf: "center",
    height: 200, // Increased height for the icon
    marginBottom: 30,
  },
  input: {
    height: 50,
    borderColor: "#B0B0B0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: "#000000", // Black input background
    color: "#FFFFFF", // White text color
  },
  button: {
    height: 50,
    backgroundColor: "#8e8e93", // Gray-ish color for the button
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  buttonText: {
    color: "#000", // Dark text for button
    fontWeight: "bold",
    fontSize: 16,
  },
  linkRow: {
    flexDirection: "row", // Set to row for horizontal alignment
    justifyContent: "center", // Space between links
    marginVertical:0,
    alignItems: "center",
  },
  link: {
    alignItems: "center",
    flexDirection: "row", // Ensure the text elements are in a row
  },
  linkText1: {
    color: "#8e8e93", // Color for the first part of the link
    fontSize: 14,
  },
  linkText2: {
    color: "#6e85e3", // Blue color for the second part of the link
    fontSize: 14,
  },
  dividerWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
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
  socialButtonsContainer: {
    flexDirection: "column",
    alignItems: "center",
  },
  socialButtonApple: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#000", // Dark gray for Apple button
    borderRadius: 10,
    height: 50,
    width: "100%",
    justifyContent: "center",
    marginVertical: 10,
  },
  socialButtonGoogle: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2E", // Black for Google button
    borderRadius: 10,
    height: 50,
    width: "100%",
    justifyContent: "center",
    marginVertical: 0,
  },
  socialIcon: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  socialText: {
    color: "#FFFFFF", // White text for social buttons
    fontSize: 16,
    fontWeight: '500',
  },
});

export default SignIn;
