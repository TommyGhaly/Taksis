import React, { useState, useEffect } from "react";
import {
  Text,
  StyleSheet,
  View,
  Pressable,
  Alert,
  SafeAreaView,
  Platform,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import BackArrow from "../../components/backArrow";
import ProgressBar from "../../components/progressBar";
import { callFunction } from "../../components/functionCalls";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";

const ChildAge = ({ route }) => {
  const { childData } = route.params;
  const user = auth().currentUser;
  const userId = user ? user.uid : null;
  const [date, setDate] = useState(childData.DOB ? new Date(childData.DOB) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const navigation = useNavigation();

  const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };

  const formatDate = (date) => {
    return `${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}-${date.getFullYear()}`;
  };

  const calculateAge = (dob) => {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age.toString();
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

  const handleContinue = async () => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    const dob = formatDate(date);
    const age = calculateAge(date);
    const updatedChildData = { ...childData, age, DOB: dob };

    try {
      const userDocRef = firestore().collection("users").doc(userId);
      const userDoc = await userDocRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        if (!userData.children) {
          userData.children = [];
        }

        const existingChildIndex = userData.children.findIndex(
          (child) => child.uid === updatedChildData.uid
        );

        if (existingChildIndex !== -1) {
          userData.children[existingChildIndex] = updatedChildData;
        } else {
          userData.children.push(updatedChildData);
        }
        await userDocRef.update({ children: userData.children });
        await callFunction(user, "https://update-user-hy6oofbihq-uc.a.run.app");
        navigation.navigate("Settings");
        Alert.alert("Success", "Child data updated successfully.");
      } else {
        Alert.alert("Error", "User document does not exist");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update child data");
    }
  };

  const handleBackPress = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.innerContainer}>
        <Pressable style={styles.backarrow} onPress={handleBackPress}>
          <BackArrow />
        </Pressable>
        <View style={styles.progressBar}>
          <ProgressBar startPercentage={67} endPercentage={100} />
        </View>

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.questionText}>
              What is your child's date of birth?
            </Text>
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
                  display={Platform.OS === "ios" ? "spinner" : "spinner"}
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  style={styles.datePicker}
                  textColor="#F0F0F0"
                  accentColor="#147EFB"
                />
              )}
            </View>
          </View>
        </View>

        <View style={styles.continueLayout}>
          <Pressable style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
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
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 80,
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
    color: "#F0F0F0",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  datePickerContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  datePicker: {
    width: "100%",
    height: Platform.OS === "ios" ? 150 : 180,
  },
  dateText: {
    fontSize: 20,
    color: "#F0F0F0",
    marginTop: 5,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    textAlign: "center",
    textDecorationLine: "underline",
  },
  continueLayout: {
    bottom: 20,
    height: 50,
    width: "91%",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    position: "absolute",
  },
  continueButton: {
    width: "100%",
    backgroundColor: "#333",
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
    color: "#fff",
    textAlign: "center",
  },
});

export default ChildAge;