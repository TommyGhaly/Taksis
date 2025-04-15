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
import DateTimePicker from '@react-native-community/datetimepicker';
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useUser } from "../UserContext";
import BackArrow from "../components/backArrow";
import ProgressBar from "../components/progressBar";
import { callFunction } from "../components/functionCalls";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";

const Frequency = ({ route, navigation }) => {
  const { from } = route.params;
  const user = auth().currentUser;
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [frequency, setFrequency] = useState(5);
  const fromApplicable = from === "SelectApplicable";
  const { signUp, setSignUp } = useUser();

  const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };

  const formatDate = (date) => {
    return `${date.getFullYear()}-${(date.getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  };

  const handleDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios');
    setDate(currentDate);
  };

  const handleFrequency = (value) => {
    setFrequency(value);
    ReactNativeHapticFeedback.trigger("impactMedium", hapticOptions);
  };

  const handleContinue = async () => {
    try {
      await firestore().collection("users").doc(user.uid).update({
        frequency: frequency,
        DOB: formatDate(date),
      });
      await callFunction(user, "https://update-user-hy6oofbihq-uc.a.run.app");
      setSignUp(false);
      navigation.navigate("MainContainer");
      Alert.alert("Success", "Your account has been succesfully created!");
    } catch (error) {
      console.error("Error updating user data: ", error);
      Alert.alert(
        "Error",
        "Could not update information. Please try again."
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.innerContainer}>
        <View style={styles.header}>
          <View style={styles.backArrow}>
            <BackArrow />
          </View>
          <View style={styles.progressBar}>
            <ProgressBar
              startPercentage={fromApplicable ? 40 : 80}
              endPercentage={100}
            />
          </View>
        </View>

        <View>
          <View style={styles.card}>
            <Text style={styles.questionText}>What's your date of birth?</Text>
            <View style={styles.datePickerContainer}>
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateText}>{formatDate(date)}</Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  style={styles.datePicker}
                />
              )}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.questionText}>
              How often do you attend church?
            </Text>
            <Text style={styles.sliderValue}>{frequency.toFixed(0)}</Text>
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
  innerContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  header: {
    marginBottom: 2,
  },
  backArrow: {
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    width: "100%",
    backgroundColor: "#2A2A2A",
    borderRadius: 3,
    marginBottom: 0,
  },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 10,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  questionText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#E0E0E0",
    textAlign: "center",
    marginBottom: 10,
    fontFamily: "Roboto-Regular",
  },
  datePickerContainer: {
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  dateButton: {
    padding: 10,
  },
  dateText: {
    color: "#E0E0E0",
    fontSize: 16,
    fontFamily: "Roboto-Regular",
    textAlign: "center",
  },
  datePicker: {
    backgroundColor: "#2A2A2A",
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
    marginBottom: 15,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    color: "#8E8E93",
    fontSize: 14,
    fontFamily: "Roboto-Regular",
  },
  footer: {
    alignItems: "center",
    paddingBottom: 67,
  },
  continueButton: {
    height: 52,
    width: "100%",
    backgroundColor: "#147EFB",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
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