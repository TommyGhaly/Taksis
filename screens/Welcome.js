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

// Define image dimensions as constants
const TAKSIS_WIDTH = 356;
const TAKSIS_HEIGHT = 96;
const CRUCIFIXION_WIDTH = 1027;
const CRUCIFIXION_HEIGHT = 711;

const Welcome = ({ navigation }) => {
  return (
    <View style={styles.container}>
      {/* Spacer to push images lower */}
      <View style={styles.spacer} />
      <View style={styles.imagesContainer}>
        <Image
          style={styles.icon}
          resizeMode="contain"
          source={require("../assets/taksis.png")}
        />
        <Image
          style={styles.crucifixionicon}
          resizeMode="contain"
          source={require("../assets/CrucifixionIcon.png")}
        />
      </View>
      <View style={styles.buttonsContainer}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingBottom: height * 0.1, // Consistent top/bottom padding
    justifyContent: "space-between", // Distributes space between sections
  },
  spacer: {
  },
  imagesContainer: {
    alignItems: "center",
  },
  icon: {
    width: width * 0.9,
    height: (width * 0.9) * (TAKSIS_HEIGHT / TAKSIS_WIDTH), // Maintains aspect ratio
  },
  crucifixionicon: {
    width: width * 0.9,
    height: (width * 0.9) * (CRUCIFIXION_HEIGHT / CRUCIFIXION_WIDTH), // Maintains aspect ratio
    marginTop: height * 0.05, // Increased spacing between images (was 0.02)
  },
  buttonsContainer: {
    alignItems: "center",
  },
  signInButton: {
    width: width * 0.8,
    height: 60,
    borderRadius: 10,
    justifyContent: "center",
    backgroundColor: "#8e8e93",
    marginBottom: height * 0.03, // Space between buttons
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
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