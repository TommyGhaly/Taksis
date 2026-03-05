import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import Slider from "@react-native-community/slider";
import DateTimePicker from "@react-native-community/datetimepicker";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useUser } from "../../UserContext";
import BackArrow from "../../components/backArrow";
import ProgressBar from "../../components/progressBar";
import { callFunction } from "../../components/functionCalls";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";

const Frequency = ({ route, navigation }) => {
  const { from } = route.params;
  const user = auth().currentUser;
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [frequency, setFrequency] = useState(5);
  const fromApplicable = from === "SelectApplicable";
  const { setSignUp } = useUser();

  const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };

  const formatDate = (date) => {
    return `${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}-${date.getFullYear()}`;
  };

  const calculateAge = (birthDate) => {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // Adjust age if birthday hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  const formatSliderValue = (value) => {
    const rounded = Number(value.toFixed(2));
    if (rounded % 1 === 0) {
      return rounded.toFixed(0);
    } else if (rounded % 0.5 === 0) {
      return rounded.toFixed(1);
    } else {
      return rounded.toFixed(2);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    if (event.type === "dismissed") {
      setShowDatePicker(false);
      return;
    }
    const currentDate = selectedDate || date;
    setDate(currentDate);
    setShowDatePicker(false);
  };

  const handleFrequency = (value) => {
    setFrequency(value);
    ReactNativeHapticFeedback.trigger("impactMedium", hapticOptions);
  };

  const handleContinue = async () => {
    if (!user?.uid) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    try {
      const userAge = calculateAge(date);
      
      await firestore().collection("users").doc(user.uid).update({
        frequency: frequency,
        DOB: formatDate(date),
        age: userAge,
      });
      setSignUp(false);
      navigation.navigate("MainContainer");
      await callFunction(user, "https://update-user-hy6oofbihq-uc.a.run.app");
      Alert.alert("Success", "Your account has been successfully created!");
    } catch (error) {
      Alert.alert("Error", "Could not update information. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.backArrow}>
          <Pressable onPress={() => navigation.goBack()}>
            <BackArrow />
          </Pressable>
        </View>
        <View style={styles.progressBar}>
          <ProgressBar
            startPercentage={fromApplicable ? 50 : 83}
            endPercentage={100}
          />
        </View>
      </View>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.questionText}>What's your date of birth?</Text>
          <View style={styles.datePickerContainer}>
            <Pressable
              onPress={() => {
                ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
                setShowDatePicker(true);
              }}
            >
              <Text
                style={[styles.dateText, { textDecorationLine: "underline" }]}
              >
                {formatDate(date)}
              </Text>
            </Pressable>

            {(Platform.OS === "ios" || showDatePicker) && (
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "spinner"} // Use spinner for both iOS and Android
                onChange={handleDateChange}
                maximumDate={new Date()}
                minimumDate={new Date(1900, 0, 1)} // Allow dates from 1900
                style={styles.datePicker}
                {...(Platform.OS === "ios"
                  ? { textColor: "#E0E0E0", accentColor: "#147EFB" }
                  : { textColor: "#E0E0E0" })} // Apply textColor for Android
              />
            )}
          </View>

          <Text style={[styles.questionText, { marginTop: 20 }]}>
            How often do you attend church?
          </Text>
          <Text style={styles.sliderValue}>{formatSliderValue(frequency)}</Text>
          <Slider
            style={styles.slider}
            value={frequency}
            onValueChange={handleFrequency}
            minimumValue={0}
            maximumValue={10}
            step={0.25}
            minimumTrackTintColor="#147EFB"
            maximumTrackTintColor="#444"
            thumbTintColor="#147EFB"
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.label}>Rarely</Text>
            <Text style={styles.label}>Often</Text>
          </View>
        </View>
      </View>
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.continueButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleContinue}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingHorizontal: 16,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 0,
  },
  backArrow: {
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    width: "100%",
    backgroundColor: "#2A2A2A",
    borderRadius: 3,
    marginBottom: 12,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 25,
    width: "100%",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    alignItems: "center",
  },
  questionText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#E0E0E0",
    textAlign: "center",
    marginBottom: 10,
    fontFamily: "Roboto-Regular",
  },
  datePickerContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  datePicker: {
    width: "100%",
    height: Platform.OS === "ios" ? 150 : 180, // Slightly taller for Android spinner
  },
  dateText: {
    fontSize: 20, // Increased from 18 to 20 for a slightly larger size
    color: "#E0E0E0",
    marginTop: 5, // Reduced from 10 to 5 to decrease padding above
    fontFamily: "Roboto-Regular",
    textAlign: "center",
    textDecorationLine: "underline", // Retained underline
  },
  sliderValue: {
    fontSize: 56,
    fontWeight: "bold",
    color: "#E0E0E0",
    textAlign: "center",
    marginBottom: 10,
  },
  slider: {
    width: "100%",
    height: 40,
    marginBottom: 1,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  label: {
    color: "#8E8E93",
    fontSize: 14,
    fontFamily: "Roboto-Regular",
  },
  footer: {
    alignItems: "center",
  },
  continueButton: {
    height: 52,
    width: "100%",
    backgroundColor: "#147EFB",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 67,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  buttonPressed: {
    backgroundColor: "#115EBB",
    elevation: 2,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFF",
    fontFamily: "Roboto-Medium",
    letterSpacing: -0.2,
  },
});

export default Frequency;