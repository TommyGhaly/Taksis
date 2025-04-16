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
import DateTimePicker from "@react-native-community/datetimepicker";

const ChangeAge = () => {
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const navigation = useNavigation();
  const user = auth().currentUser;

  const formatDate = (date) => {
    return `${date.getFullYear()}-${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
  };

  const handleDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === "ios");
    setDate(currentDate);
  };

  const updateDOBInDB = async (dob) => {
    if (!user?.uid) {
      throw new Error("User not authenticated");
    }
    try {
      await firestore().collection("users").doc(user.uid).update({
        DOB: dob,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      throw new Error("Could not update date of birth. Please try again.");
    }
  };

  const handleConfirm = async () => {
    try {
      const dob = formatDate(date);
      await updateDOBInDB(dob);
      Alert.alert("Success", "Date of birth updated successfully.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to update date of birth.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.innerContainer}>
        <Pressable style={styles.backArrow} onPress={() => navigation.goBack()}>
          <BackArrow />
        </Pressable>

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.title}>Update Your Date of Birth</Text>
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
                display={Platform.OS === "ios" ? "spinner" : "spinner"}
                onChange={handleDateChange}
                maximumDate={new Date()}
                textColor="#F0F0F0"
                accentColor="#147efb"
                style={styles.datePicker}
              />
            )}
          </View>
        </View>

        <Pressable style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmText}>Confirm</Text>
        </Pressable>
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
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  dateButton: {
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    padding: 14,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#404040",
  },
  dateText: {
    fontSize: 18,
    color: "#F0F0F0",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  datePicker: {
    width: "100%",
    marginTop: 10,
  },
  confirmButton: {
    backgroundColor: "#147efb",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
    shadowColor: "#147efb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  confirmText: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
});

export default ChangeAge;