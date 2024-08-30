import React, { useState } from "react";
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

// TODO: fix the continue button and backarrow forgot password set new password
const SignUp = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState("");

  GoogleSignin.configure({
    webClientId:
      "642693016544-lt9t0svc4b7ej4koble04ks3vsujea97.apps.googleusercontent.com",
  });

  const isValidPhoneNumber = (phone) => {
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(phone);
  };

  const onGoogleButtonPress = async () => {
    if (!isValidPhoneNumber(phoneNumber)) {
      Alert.alert(
        "Invalid Phone Number",
        "Please enter your phone number with no dashes."
      );
      return;
    }

    try {
      // Check if your device supports Google Play
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
      // Get the users ID token
      const { idToken } = await GoogleSignin.signIn();

      // Create a Google credential with the token
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);

      // Sign-in the user with the credential
      const userCredential = await auth().signInWithCredential(
        googleCredential
      );

      // Check if the user exists in Firestore and write them if they don't
      await writeUserToDb(userCredential.user);

      // Navigate to the SelectChurch screen if sign-up is successful
      navigation.navigate("SelectChurch");
    } catch (error) {
      console.error(error);
    }
  };

  const writeUserToDb = async (user) => {
    try {
      // Check if the user exists in Firestore
      const userDoc = await firestore().collection("users").doc(user.uid).get();

      if (!userDoc.exists) {
        // Write the user to the database if they don't exist
        await firestore().collection("users").doc(user.uid).set({
          uid: user.uid,
          name: user.displayName,
          phoneNumber: phoneNumber,
        });
      }
    } catch (error) {
      console.error("Error handling Firestore operations: ", error);
    }
  };

  return (
    <View style={styles.signup}>
      <View style={styles.backarrow}>
        <BackArrow />
      </View>
      <View style={styles.title}>
        <Text style={styles.titleText}>Sign Up</Text>
      </View>
      <TextInput
        style={[styles.name, styles.nameBorder]}
        placeholder="Enter your name"
        placeholderTextColor="#8e8e93"
      />
      <TextInput
        style={[styles.phone, styles.nameBorder]}
        placeholder="Enter your phone number (no dashes)"
        placeholderTextColor="#8e8e93"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
      />
      <TextInput
        style={[styles.email, styles.nameBorder]}
        placeholder="Enter your email"
        placeholderTextColor="#8e8e93"
      />
      <TextInput
        style={[styles.password, styles.nameBorder]}
        placeholder="Enter your password"
        placeholderTextColor="#8e8e93"
      />
      <TextInput
        style={[styles.passwordconfirm, styles.nameBorder]}
        placeholder="Confirm your password"
        placeholderTextColor="#8e8e93"
      />
      <View style={styles.divider}>
        <View style={[styles.dividerChild, styles.dividerPosition]} />
        <Text style={styles.or}>or</Text>
        <View style={[styles.dividerItem, styles.dividerPosition]} />
      </View>
      <View style={styles.continueLayout}>
        <Pressable
          onPress={() => navigation.navigate("SelectChurch", { person: "you" })}
        >
          <Text style={styles.continuetext}>Continue</Text>
        </Pressable>
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.track, styles.trackPosition]}>
          <View style={[styles.filled, styles.trackPosition]} />
        </View>
      </View>
      <View style={styles.component2}>
        <Pressable
          style={[styles.appleregistration, styles.appleregistrationPosition]}
        >
          <View style={styles.appleFlexBox}>
            <Image
              style={styles.applelogoIcon}
              resizeMode="cover"
              source={require("../assets/appleLogo.png")}
            />
            <Text style={[styles.registerWithApple, styles.registerTypo]}>
              Register with Apple
            </Text>
          </View>
        </Pressable>
        <Pressable
          style={[styles.googleregistration, styles.appleregistrationPosition]}
          onPress={onGoogleButtonPress}
        >
          <View style={styles.google}>
            <Image
              style={styles.applelogoIcon}
              resizeMode="cover"
              source={require("../assets/googleLogo.png")}
            />
            <Text style={[styles.registerWithGoogle, styles.registerTypo]}>
              Register with Google
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backarrow: {
    top: 74,
    left: 16,
  },
  nameBorder: {
    fontSize: 17,
    fontFamily: "Roboto-Regular",
    borderColor: "#8e8e93",
    height: "5.75%",
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
    flexDirection: "row",
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: 10,
    right: "4.83%",
    width: "91.09%",
    left: "4.07%",
    position: "absolute",
  },
  dividerPosition: {
    borderTopWidth: 1,
    bottom: "41.67%",
    top: "52.78%",
    width: "44.97%",
    height: "5.56%",
    borderColor: "#8e8e93",
    borderStyle: "solid",
    position: "absolute",
  },
  appleFlexBox: {
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  trackPosition: {
    height: 4,
    top: "50%",
    marginTop: -2,
    position: "absolute",
  },
  appleregistrationPosition: {
    left: "0%",
    right: "0%",
    height: "42.52%",
    justifyContent: "center",
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
    flexDirection: "row",
    borderRadius: 10,
    position: "absolute",
    width: "100%",
  },
  registerTypo: {
    marginLeft: 12,
    fontFamily: "Roboto-Medium",
    fontWeight: "500",
    letterSpacing: -0.2,
    textAlign: "left",
    fontSize: 17,
  },
  icon: {
    maxWidth: "100%",
    maxHeight: "100%",
    height: "100%",
    overflow: "hidden",
    width: "100%",
  },
  backarrow: {
    top: "8.69%",
    right: "89.82%",
    bottom: "88.5%",
    width: "6.11%",
    height: "2.82%",
    left: "4.07%",
    position: "absolute",
  },
  name: {
    top: "21.83%",
    bottom: "72.42%",
    color: "#8e8e93",
  },
  phone: {
    top: "29.93%",
    bottom: "64.32%",
    color: "#8e8e93",
  },
  email: {
    top: "38.03%",
    bottom: "56.22%",
    color: "#8e8e93",
  },
  password: {
    top: "46.13%",
    bottom: "48.12%",
    color: "#8e8e93",
  },
  passwordconfirm: {
    top: "54.23%",
    bottom: "40.02%",
    color: "#8e8e93",
  },
  dividerChild: {
    right: "55.17%",
    left: "-0.14%",
  },
  or: {
    width: "3.91%",
    left: "48.04%",
    fontSize: 15,
    letterSpacing: -0.1,
    textAlign: "left",
    color: "#8e8e93",
    top: "0%",
    fontFamily: "Roboto-Regular",
    height: "100%",
    position: "absolute",
  },
  dividerItem: {
    right: "-0.14%",
    left: "55.17%",
  },
  divider: {
    height: "2.11%",
    top: "70.54%",
    right: "4.33%",
    bottom: "27.35%",
    left: "4.58%",
    width: "91.09%",
    position: "absolute",
  },
  filled: {
    left: 0,
    borderRadius: 100,
    backgroundColor: "#147efb",
    width: 4,
  },
  track: {
    right: "12.2136%",
    left: 0,
    backgroundColor: "rgba(120, 120, 128, 0.32)",
  },
  progressBar: {
    height: "3.29%",
    width: "84.61%",
    top: "8.45%",
    bottom: "88.26%",
    left: "12.2137%",
    position: "absolute",
    backgroundColor: "#000",
  },
  applelogoIcon: {
    width: 24,
    height: 24,
    overflow: "hidden",
  },
  registerWithApple: {
    color: "#fff",
  },
  appleregistration: {
    bottom: "57.48%",
    backgroundColor: "#333",
    top: "0%",
    left: "0%",
    right: "0%",
    height: "42.52%",
  },
  registerWithGoogle: {
    color: "#8e8e93",
    marginLeft: 12,
  },
  google: {
    alignItems: "center",
    flexDirection: "row",
  },
  googleregistration: {
    top: "57.48%",
    bottom: "0%",
    borderColor: "rgba(185, 177, 177, 0.15)",
    left: "0%",
    right: "0%",
    height: "42.52%",
    borderWidth: 1,
    borderStyle: "solid",
  },
  component2: {
    height: "14.91%",
    top: "75%",
    bottom: "10.09%",
    right: "4.83%",
    width: "91.09%",
    left: "4.07%",
    position: "absolute",
  },
  title: {
    top: "15.023%",
    left: 16,
    height: "6.103%",
    width: "88.295%",
    flex: 1,
  },
  titleText: {
    fontSize: 34,
    letterSpacing: -0.1,
    fontFamily: "Roboto-Regular",
    textAlign: "left",
    color: "#8e8e93",
  },
  continueLayout: {
    bottom: 271,
    left: 16,
    height: 50,
    width: 358,
    backgroundColor: "#333",
    borderRadius: 10,
  },
  continuetext: {
    top: 15,
    fontSize: 17,
    letterSpacing: -0.2,
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
    color: "#fff",
    textAlign: "center",
  },
  signup: {
    flex: 1,
    height: 852,
    overflow: "hidden",
    width: "100%",
    backgroundColor: "#000",
  },
});

export default SignUp;
