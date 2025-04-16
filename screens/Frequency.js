import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Alert,
  SafeAreaView,
  Platform,
  Modal,
  Animated,
} from "react-native";
import Slider from "@react-native-community/slider";
import DateTimePicker from "@react-native-community/datetimepicker";
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
  const [tempDate, setTempDate] = useState(date);
  const [frequency, setFrequency] = useState(5);
  const fromApplicable = from === "SelectApplicable Certains";
  const { setSignUp } = useUser();
  const scaleValue = React.useRef(new Animated.Value(0.9)).current;

  const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };

  const formatDate = (date) => {
    return `${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}-${date.getFullYear()}`;
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
      setTempDate(date);
      setShowDatePicker(false);
      return;
    }

    const currentDate = selectedDate || tempDate;
    setTempDate(currentDate);

    if (Platform.OS === "android" && event.type === "set") {
      setDate(currentDate);
      setShowDatePicker(false);
    }
  };

  const handlePickerConfirm = () => {
    setDate(tempDate);
    setShowDatePicker(false);
  };

  const handlePickerCancel = () => {
    setTempDate(date);
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
      await firestore().collection("users").doc(user.uid).update({
        frequency: frequency,
        DOB: formatDate(date),
      });
      await callFunction(user, "https://update-user-hy6oofbihq-uc.a.run.app");
      setSignUp(false);
      navigation.navigate("MainContainer");
      Alert.alert("Success", "Your account has been successfully created!");
    } catch (error) {
      console.error("Error updating user data: ", error);
      Alert.alert("Error", "Could not update information. Please try again.");
    }
  };

  useEffect(() => {
    if (showDatePicker) {
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      scaleValue.setValue(0.9);
    }
  }, [showDatePicker]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.innerContainer}>
        <Pressable style={styles.backArrow} onPress={() => navigation.goBack()}>
          <BackArrow />
        </Pressable>
        <View style={styles.progressBar}>
          <ProgressBar
            startPercentage={fromApplicable ? 40 : 80}
            endPercentage={100}
          />
        </View>

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.questionText}>What's your date of birth?</Text>
            <View style={styles.datePickerContainer}>
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateText}>{formatDate(date)}</Text>
              </Pressable>
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

        <Pressable style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>

        {/* Date Picker Modal */}
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="none"
          onRequestClose={handlePickerCancel}
        >
          <View style={[styles.modalOverlay, Platform.OS === "ios" && styles.modalOverlayIOS]}>
            <Animated.View
              style={[
                styles.modalContainer,
                { transform: [{ scale: scaleValue }] },
              ]}
            >
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={new Date()}
                textColor="#F0F0F0"
                accentColor="#147efb"
                style={styles.datePicker}
              />
              {Platform.OS === "ios" && (
                <View style={styles.modalButtonContainer}>
                  <Pressable
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={handlePickerCancel}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, styles.confirmModalButton]}
                    onPress={handlePickerConfirm}
                  >
                    <Text style={styles.modalButtonText}>Confirm</Text>
                  </Pressable>
                </View>
              )}
            </Animated.View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  backArrow: {
    position: "absolute",
    top: 40,
    left: 16,
    zIndex: 10,
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
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: "#1E1E1E",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  questionText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  datePickerContainer: {
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
    width: "100%",
    alignItems: "center",
  },
  dateButton: {
    padding: 10,
  },
  dateText: {
    fontSize: 18,
    color: "#F0F0F0",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    textAlign: "center",
  },
  datePicker: {
    width: "100%",
  },
  sliderValue: {
    fontSize: 32,
    fontWeight: "600",
    color: "#F0F0F0",
    textAlign: "center",
    marginBottom: 10,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  slider: {
    width: "100%",
    height: 40,
    marginBottom: 15,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  label: {
    fontSize: 14,
    color: "#BBBBBB",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  continueButton: {
    backgroundColor: "#333",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalOverlayIOS: {
    justifyContent: "center",
  },
  modalContainer: {
    backgroundColor: "#252525",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginHorizontal: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#333",
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelButton: {
    backgroundColor: "#555",
  },
  confirmModalButton: {
    backgroundColor: "#147efb",
  },
  modalButtonText: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
});

export default Frequency;