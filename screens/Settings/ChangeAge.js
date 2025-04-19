import React, { useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  Pressable,
  Alert,
  SafeAreaView,
  Platform,
  Modal,
  Animated,
} from "react-native";
import BackArrow from "../../components/backArrow";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { callFunction } from "../../components/functionCalls";

const ChangeAge = () => {
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(date);
  const navigation = useNavigation();
  const user = auth().currentUser;
  const scaleValue = React.useRef(new Animated.Value(0.9)).current;

  const formatDate = (date) => {
    return `${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}-${date.getFullYear()}`;
  };

  const handleDateChange = (event, selectedDate) => {
    if (event.type === "dismissed") {
      setTempDate(date);
      setShowDatePicker(false);
      return;
    }

    const currentDate = selectedDate || tempDate;
    setTempDate(currentDate);
    setDate(currentDate); // Update date immediately
    setShowDatePicker(false); // Close picker on selection
  };

  // Removed handlePickerConfirm as it's not needed
  const handlePickerCancel = () => {
    setTempDate(date);
    setShowDatePicker(false);
  };

  const updateDOBInDB = async (dob) => {
    if (!user?.uid) {
      throw new Error("User not authenticated");
    }
    try {
      await firestore().collection("users").doc(user.uid).update({
        DOB: dob,
      });
      await callFunction(user, "https://update-user-hy6oofbihq-uc.a.run.app");
    } catch (error) {
      throw new Error("Could not update date of birth. Please try again.");
    }
  };

  const handleConfirm = async () => {
    try {
      const dob = formatDate(date);
      navigation.goBack();
      await updateDOBInDB(dob);
      Alert.alert("Success", "Date of birth updated successfully.");
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to update date of birth.");
    }
  };

  React.useEffect(() => {
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

        <View style={styles.content}>
          <View style={styles.card}>
            <Text style={styles.title}>Update Your Date of Birth</Text>
            <View style={styles.datePickerContainer}>
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateText}>{formatDate(date)}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <Pressable style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmText}>Confirm</Text>
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
                    onPress={() => {
                      setDate(tempDate);
                      setShowDatePicker(false);
                    }}
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
  confirmButton: {
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
  confirmText: {
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

export default ChangeAge;