import * as React from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { useUser } from "../UserContext";

// Define image dimensions as constants
const TAKSIS_WIDTH = 356;
const TAKSIS_HEIGHT = 96;
const CRUCIFIXION_WIDTH = 1027;
const CRUCIFIXION_HEIGHT = 711;

const TAKSIS_RATIO = TAKSIS_HEIGHT / TAKSIS_WIDTH;
const CRUCIFIXION_RATIO = CRUCIFIXION_HEIGHT / CRUCIFIXION_WIDTH;

// The original stacked layout: logo above the art, buttons pinned to the bottom.
// Used on phones and on tablets held in portrait.
const getStackedSizes = (width, height) => {
  const iconWidth = width * 0.9;
  return {
    container: {
      paddingBottom: height * 0.1, // Consistent top/bottom padding
      justifyContent: "space-between", // Distributes space between sections
    },
    icon: {
      width: iconWidth,
      height: iconWidth * TAKSIS_RATIO, // Maintains aspect ratio
    },
    crucifixionicon: {
      width: iconWidth,
      height: iconWidth * CRUCIFIXION_RATIO, // Maintains aspect ratio
      marginTop: height * 0.05, // Increased spacing between images (was 0.02)
    },
    button: { width: width * 0.8 },
    buttonSpacing: { marginBottom: height * 0.03 }, // Space between buttons
  };
};

// Tablets in landscape are far too short for the stacked layout, so the art
// sits beside the logo and buttons instead of above them.
const getSplitSizes = (width, height) => {
  // Fit the art inside the left half, bounded by the available height too.
  const artWidth = Math.min(width * 0.46, (height * 0.78) / CRUCIFIXION_RATIO);
  const columnWidth = Math.min(width * 0.36, 420);
  return {
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: width * 0.04,
    },
    icon: {
      width: columnWidth,
      height: columnWidth * TAKSIS_RATIO, // Maintains aspect ratio
      marginBottom: height * 0.08, // Space between the logo and the buttons
    },
    crucifixionicon: {
      width: artWidth,
      height: artWidth * CRUCIFIXION_RATIO, // Maintains aspect ratio
    },
    column: { width: columnWidth, marginLeft: width * 0.05 },
    button: { width: columnWidth },
    buttonSpacing: { marginBottom: height * 0.03 }, // Space between buttons
  };
};

const Welcome = ({ navigation }) => {
  // Move useUser inside the component
  const { signUp, setSignUp } = useUser();
  const { width, height } = useWindowDimensions();

  const isTablet = Platform.isPad || Math.min(width, height) >= 768;
  const isSplitLayout = isTablet && width > height;
  const sizes = isSplitLayout
    ? getSplitSizes(width, height)
    : getStackedSizes(width, height);

  const handleSignUp = async () => {
    setSignUp(true);
    navigation.navigate("SignUp");
  };

  const handleSignIn = async () => {
    setSignUp(false);
    navigation.navigate("SignIn");
  };

  const renderButtons = () => (
    <View style={styles.buttonsContainer}>
      <TouchableOpacity
        onPress={handleSignIn}
        style={[styles.signInButton, sizes.button, sizes.buttonSpacing]}
      >
        <Text style={styles.signInButtonText}>Sign In</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={handleSignUp}
        style={[styles.signUpButton, sizes.button]}
      >
        <Text style={styles.buttonText}>Sign Up</Text>
      </TouchableOpacity>
    </View>
  );

  if (isSplitLayout) {
    return (
      <View style={[styles.container, sizes.container]}>
        <Image
          style={sizes.crucifixionicon}
          resizeMode="contain"
          source={require("../assets/CrucifixionIcon.png")}
        />
        <View style={[styles.column, sizes.column]}>
          <Image
            style={sizes.icon}
            resizeMode="contain"
            source={require("../assets/taksis.png")}
          />
          {renderButtons()}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, sizes.container]}>
      {/* Spacer to push images lower */}
      <View style={styles.spacer} />
      <View style={styles.imagesContainer}>
        <Image
          style={sizes.icon}
          resizeMode="contain"
          source={require("../assets/taksis.png")}
        />
        <Image
          style={sizes.crucifixionicon}
          resizeMode="contain"
          source={require("../assets/CrucifixionIcon.png")}
        />
      </View>
      {renderButtons()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  spacer: {
  },
  imagesContainer: {
    alignItems: "center",
  },
  column: {
    alignItems: "center",
  },
  buttonsContainer: {
    alignItems: "center",
  },
  signInButton: {
    height: 60,
    borderRadius: 10,
    justifyContent: "center",
    backgroundColor: "#8e8e93",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  signUpButton: {
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
