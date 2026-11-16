import * as React from "react";
import { useState, useRef } from "react";
import { View, Text, TouchableOpacity, Vibration } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import BackArrow from "../../components/backArrow";
import ProgressBar from "../../components/progressBar";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import { makeStyles, useTheme, GlassSurface, useTabBarInset } from "../../theme";

const ChildExperience = ({ navigation, route }) => {
  const styles = useStyles();
  const t = useTheme();
  const tabBarInset = useTabBarInset();
  const [slider, setSlider] = useState(5);
  const previousValueRef = useRef(slider); // Store the previous slider value
  const { childData } = route.params; // Get child data from the previous screen
  const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };

  const formatSliderValue = (value) => {
    const rounded = Number(value.toFixed(2)); // Round to 2 decimal places to handle floating-point precision
    if (rounded % 1 === 0) {
      return rounded.toFixed(0); // No decimal for whole numbers (e.g., 1.00 -> 1)
    } else if (rounded % 0.5 === 0) {
      return rounded.toFixed(1); // One decimal for .5 values (e.g., 1.50 -> 1.5)
    } else {
      return rounded.toFixed(2); // Two decimals for .25 and .75 values (e.g., 1.25, 1.75)
    }
  };

  const handleValueChange = (value) => {
    setSlider(value);
    const currentInteger = Math.round(value); // Ensure integer comparison
    const previousInteger = Math.round(previousValueRef.current);
    if (currentInteger !== previousInteger) {
      Vibration.vibrate(20); // Trigger vibration on new integer
      previousValueRef.current = value; // Update previous value
    }
  };

  const handleContinue = () => {
    const updatedChildData = { ...childData, experience: slider };
    navigation.navigate("ChildAge", { childData: updatedChildData });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.innerContainer}>
        <View style={styles.backarrow}>
          <BackArrow onPress={() => navigation.goBack()} />
        </View>
        <View style={styles.progressBar}>
          <ProgressBar startPercentage={60} endPercentage={80} />
        </View>

        <View style={styles.content}>
          <GlassSurface style={styles.card}>
            <Text style={styles.questionText}>
              How much experience does your child have being a deacon?
            </Text>
            <Text style={styles.sliderValue}>{formatSliderValue(slider)}</Text>
            <Slider
              style={styles.slider}
              value={slider}
              onValueChange={(value) => {
                setSlider(value);
                ReactNativeHapticFeedback.trigger("impactMedium", hapticOptions);
              }}
              minimumValue={0}
              maximumValue={10}
              step={0.25}
              minimumTrackTintColor={t.accent}
              maximumTrackTintColor={t.surfaceHighest}
              thumbTintColor={t.accent}
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.label}>Not experienced</Text>
              <Text style={styles.label}>Very experienced</Text>
            </View>
          </GlassSurface>
        </View>

        <View style={[styles.continueLayout, { bottom: 20 + tabBarInset }]}>
          <TouchableOpacity onPress={handleContinue} style={styles.continueButton}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const useStyles = makeStyles((t) => ({
  container: {
    flex: 1,
    backgroundColor: t.background,
  },
  innerContainer: {
    flex: 1,
    paddingTop: 18,
    paddingBottom: 40,
  },
  backarrow: {
    top: 10,
    left: 16,
    position: "absolute",
    zIndex: 10, // Ensures it stays on top
  },
  progressBar: {
    height: 12,
    width: "84%",
    top: 60,
    alignSelf: "center",
    position: "absolute",
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20
  },
  card: {
    backgroundColor: t.surface,
    borderRadius: 20,
    padding: 25,
    width: "100%",
    elevation: 5,
    shadowColor: t.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    marginTop: 100, // Adjusted to align with original title positioning
  },
  questionText: {
    fontSize: 24,
    fontWeight: "600",
    color: (t.isDark ? "#E0E0E0" : t.text),
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "Roboto-Regular",
  },
  sliderValue: {
    fontSize: 56,
    fontWeight: "bold",
    color: (t.isDark ? "#E0E0E0" : t.text),
    textAlign: "center",
    marginBottom: 20,
  },
  slider: {
    width: "100%",
    height: 40,
    marginBottom: 15,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    color: t.textMuted,
    fontSize: 14,
    fontFamily: "Roboto-Regular",
  },
  continueLayout: {
    bottom: 20,
    height: 50,
    width: "91%", // Kept for consistency, but centered
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center", // Centers the entire layout horizontally
    position: "absolute",
  },
  continueButton: {
    width: "100%",
    backgroundColor: t.surfaceHighest,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  buttonText: {
    fontSize: 17,
    letterSpacing: -0.2,
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
    color: t.text,
    textAlign: "center",
  },
}));

export default ChildExperience;