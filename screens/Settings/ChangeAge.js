import React, { useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  Pressable,
  Alert,
  SafeAreaView,
  Platform,
} from "react-native";
import BackArrow from "../../components/backArrow";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";
import DateTimePicker from '@react-native-community/datetimepicker';
import { callFunction } from "../../components/functionCalls";

const ChangeAge = () => {
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const navigation = useNavigation();
  const user = auth().currentUser;

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

  const updateDOBInDB = async (dob) => {
    try {
      await firestore().collection("users").doc(user.uid).update({
        DOB: dob,
      });
    } catch (error) {
      Alert.alert(
        "Error",
        "Could not update date of birth. Please try again."
      );
    }
  };

  const handleConfirm = async () => {
    try {
      const dob = formatDate(date);
      await updateDOBInDB(dob);
      await callFunction(user, "https://update-user-hy6oofbihq-uc.a.run.app");
      Alert.alert("Success", "Date of birth updated successfully.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to update date of birth.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.innerContainer}>
        <View style={styles.backarrow}>
          <BackArrow onPress={() => navigation.goBack()} />
        </View>

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.questionText}>Change Date of Birth</Text>
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
        </View>

        <View style={styles.confirmLayout}>
          <Pressable style={styles.confirmButton} onPress={handleConfirm}>
            <Text style={styles.confirmText}>Confirm</Text>
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
    paddingHorizontal: 20,
  },
  backarrow: {
    top: 10,
    left: 16,
    position: "absolute",
  },
  content: {
    flex: 1,
    alignItems: "center",
    marginTop: 110,
  },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 30,
    width: "100%",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: "#2A2A2A",
  },
  questionText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#F0F0F0",
    textAlign: "center",
    marginBottom: 25,
    fontFamily: "Roboto-Regular",
  },
  datePickerContainer: {
    backgroundColor: "#252525",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 15,
    width: "100%",
    alignSelf: "center",
    borderWidth: 1,
    borderColor: "#404040",
  },
  dateButton: {
    padding: 10,
  },
  dateText: {
    fontSize: 20,
    color: "#F0F0F0",
    textAlign: "center",
    fontFamily: "Roboto-Regular",
  },
  datePicker: {
    backgroundColor: "#252525",
  },
  confirmLayout: {
    bottom: 20,
    height: 50,
    width: "91%",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    position: "absolute",
  },
  confirmButton: {
    width: "100%",
    backgroundColor: "#333",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  confirmText: {
    fontSize: 17,
    color: "#fff",
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
    letterSpacing: -0.2,
  },
});

export default ChangeAge;