import * as React from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  Dimensions,
  TouchableOpacity,
} from "react-native";


const { width, height } = Dimensions.get("window");

const Welcome = ({ navigation }) => {

  return (
    <View style={styles.welcomescreen}>
      <Image
        style={styles.icon}
        resizeMode="cover"
        source={require("../assets/Taksis.png")}
      />
      <Image
        style={styles.crucifixionicon}
        resizeMode="center"
        source={require("../assets/crucifixionIcon.png")}
      />
      <TouchableOpacity
        onPress={() => navigation.navigate("SignIn")}
        style={styles.signInButton}
      >
        <Text style={styles.signInButtonText}>Sign In</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => navigation.navigate("SignUp")}
        style={styles.signUpButton}
      >
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  welcomescreen: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "flex-end", // Align items to the bottom
    paddingBottom: 40, // Add some padding to the bottom
  },
  icon: {
    marginTop: 40,
    marginBottom: 20,
    width: width * 0.9,
    position: "absolute",
    top: height * 0.05,
  },
  crucifixionicon: {
    position: "absolute",
    top: height * 0.05, // Adjust this value to move the icon closer to Taksis
  },
  signInButton: {
    width: width * 0.8,
    height: 60,
    borderRadius: 10,
    justifyContent: "center",
    backgroundColor: "#8e8e93",
    marginBottom: 30, // Add some space below the Sign In button
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  signUpButton: {
    width: width * 0.8,
    height: 60,
    borderRadius: 10,
    justifyContent: "center",
    backgroundColor: "#000",
    marginBottom: 50, // Add some space below the Sign Up button
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  signInButtonText: {
    textAlign: "center",
    fontFamily: "Roboto-Bold",
    fontWeight: "600",
    fontSize: 20,
    color: "#000",
  },
  buttonText: {
    textAlign: "center",
    fontFamily: "Roboto-Bold",
    fontWeight: "600",
    fontSize: 20,
    color: "#8e8e93",
  },
});

export default Welcome;
