import * as React from "react";
import { useState } from "react";
import {
  Pressable,
  Image,
  StyleSheet,
  TextInput,
  View,
  Text,
  TouchableOpacity,
} from "react-native";
import BackArrow from "../components/backArrow";
import { FIREBASE_AUTH } from "../FirebaseConfig";
import { createUserWithEmailAndPassword } from "firebase/auth";

const SignUp = ({ navigation }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const auth = FIREBASE_AUTH;

  const signUp = async () => {
    if (confirm === password) {
      try {
        const response = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        navigation.navigate('SelectChurch', {person: "you"});
      } catch (error) {
        alert("Sign Up failed: " + error.message);
      }
    } else {
      alert("Passwords do not match");
    }
  };
  return (
    <View style={styles.signup}>
      <View style={styles.backarrow}>
        <BackArrow />
      </View>
      <TextInput
        style={[styles.name, styles.nameBorder]}
        value={name}
        placeholder="Enter your name"
        placeholderTextColor="#8e8e93"
        color="#8e8e93"
        onChangeText={(text) => setName(text)}
      />
      <TextInput
        style={[styles.email, styles.nameBorder]}
        value={email}
        placeholder="Enter your email"
        placeholderTextColor="#8e8e93"
        color="#8e8e93"
        autoCapitalize="none"
        onChangeText={(text) => setEmail(text)}
      />
      <TextInput
        style={[styles.password, styles.nameBorder]}
        value={password}
        placeholder="Enter your password"
        placeholderTextColor="#8e8e93"
        color="#8e8e93"
        secureTextEntry={true}
        autoCapitalize="none"
        onChangeText={(text) => setPassword(text)}
      />
      <TextInput
        style={[styles.passwordconfirm, styles.nameBorder]}
        value={confirm}
        placeholder="Confirm your password"
        placeholderTextColor="#8e8e93"
        color="#8e8e93"
        secureTextEntry={true}
        autoCapitalize="none"
        onChangeText={(text) => setConfirm(text)}
      />
      <View style={styles.divider}>
        <View style={[styles.dividerChild, styles.dividerPosition]} />
        <Text style={[styles.or, styles.orFlexBox]}>or</Text>
        <View style={[styles.dividerItem, styles.dividerPosition]} />
      </View>
      <Pressable
        style={[styles.continuebutton, styles.appleFlexBox]}
        activeOpacity={0.2}
        onPress={() => signUp()}
      >
        <Text style={[styles.continue, styles.signUpTypo]}>Continue</Text>
      </Pressable>
      <View style={styles.progressBar}>
        <View style={[styles.track, styles.trackPosition]}>
          <View style={[styles.filled, styles.trackPosition]} />
        </View>
      </View>
      <View style={[styles.component2, styles.component2Position]}>
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
              Register with apple
            </Text>
          </View>
        </Pressable>
        <Pressable
          style={[styles.googleregistration, styles.appleregistrationPosition]}
        >
          <View style={styles.google}>
            <Image
              style={styles.applelogoIcon}
              resizeMode="cover"
              source={require("../assets/googleLogo.png")}
            />
            <Text style={[styles.registerWithGoogle, styles.registerTypo]}>
              Register with google
            </Text>
          </View>
        </Pressable>
      </View>
      <Text style={[styles.signUp, styles.signUpTypo]}>Sign up</Text>
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
    borderColor: "#8e8e93",
    left: "4.58%",
    right: "4.33%",
    height: "5.75%",
    fontFamily: "Roboto-Regular",
    paddingVertical: 1,
    paddingHorizontal: 20,
    alignItems: "center",
    flexDirection: "row",
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: 10,
    width: "91.09%",
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
  orFlexBox: {
    textAlign: "left",
    position: "absolute",
  },
  appleFlexBox: {
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  signUpTypo: {
    fontFamily: "Roboto-Medium",
    fontWeight: "500",
  },
  trackPosition: {
    height: 4,
    top: "50%",
    marginTop: -2,
    position: "absolute",
  },
  component2Position: {
    left: "4.33%",
    right: "4.58%",
    width: "91.09%",
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
    left: "4.07%",
    top: "8.69%",
    right: "89.82%",
    bottom: "88.5%",
    width: "6.11%",
    height: "2.82%",
    position: "absolute",
  },
  name: {
    top: "24.18%",
    bottom: "70.07%",
  },
  email: {
    top: "32.28%",
    bottom: "61.97%",
  },
  password: {
    top: "40.38%",
    bottom: "53.87%",
  },
  passwordconfirm: {
    top: "48.47%",
    bottom: "45.77%",
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
    color: "#8e8e93",
    top: "0%",
    fontFamily: "Roboto-Regular",
    textAlign: "left",
    height: "100%",
  },
  dividerItem: {
    right: "-0.14%",
    left: "55.17%",
  },
  divider: {
    height: "2.11%",
    top: "67.49%",
    right: "4.07%",
    bottom: "30.4%",
    left: "4.83%",
    width: "91.09%",
    position: "absolute",
  },
  continue: {
    textAlign: "center",
    color: "#fff",
    letterSpacing: -0.2,
    fontWeight: "500",
    fontSize: 17,
  },
  continuebutton: {
    height: "5.87%",
    top: "59.27%",
    bottom: "34.86%",
    borderColor: "rgba(0, 0, 0, 0.15)",
    backgroundColor: "#333",
    left: "4.33%",
    right: "4.58%",
    width: "91.09%",
    position: "absolute",
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "solid",
  },
  filled: {
    left: 0,
    borderRadius: 100,
    backgroundColor: "#147efb",
    width: 4,
  },
  track: {
    right: 16,
    left: 16,
    backgroundColor: "rgba(120, 120, 128, 0.32)",
  },
  progressBar: {
    height: "3.29%",
    width: "84.61%",
    top: "8.45%",
    right: "7.25%",
    bottom: "88.26%",
    left: "8.14%",
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
  },
  registerWithGoogle: {
    color: "#8e8e93",
  },
  google: {
    alignItems: "center",
    flexDirection: "row",
  },
  googleregistration: {
    top: "57.48%",
    bottom: "0%",
    borderColor: "rgba(185, 177, 177, 0.15)",
    borderWidth: 1,
    borderStyle: "solid",
    left: "0%",
    right: "0%",
    height: "42.52%",
  },
  component2: {
    height: "14.91%",
    top: "71.95%",
    bottom: "13.15%",
  },
  signUp: {
    height: "4.74%",
    width: "28.73%",
    top: "14.34%",
    left: "4.1%",
    fontSize: 34,
    letterSpacing: -0.3,
    color: "rgba(142, 142, 147, 0.8)",
    textAlign: "left",
    position: "absolute",
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
