import React, { useState, useEffect } from "react";
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
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import BackArrow from "../../components/backArrow";
import ProgressBar from "../../components/progressBar";
import { callFunction } from "../../components/functionCalls";

const ChildAge = ({ route }) => {
  const { childData } = route.params;
  const user = auth().currentUser;
  const userId = user ? user.uid : null;
  const [date, setDate] = useState(childData.DOB ? new Date(childData.DOB) : new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(date);
  const navigation = useNavigation();
  const scaleValue = React.useRef(new Animated.Value(0.9)).current;

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
      setTempDate(date);
      setShowDatePicker(false);
      return;
    }

    const currentDate = selectedDate || tempDate;
    setTempDate(currentDate);
    setDate(currentDate);
    setShowDatePicker(false);
  };

  const handlePickerCancel = () => {
    setTempDate(date);
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
        navigation.navigate("Settings");
        await userDocRef.update({ children: userData.children });
        await callFunction(user, "https://update-user-hy6oofbihq-uc.a.run.app");
        Alert.alert("Success", "Child data updated successfully.");
      } else {
        Alert.alert("Error", "User document does not exist");
      }
    } catch (error) {
      console.error("Error updating child data: ", error);
      Alert.alert("Error", "Failed to update child data");
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
        <Pressable style={styles.backarrow} onPress={() => navigation.goBack()}>
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
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateText}>{formatDate(date)}</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.continueLayout}>
          <Pressable style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.buttonText}>Continue</Text>
          </Pressable>
        </View>

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
    backgroundColor: "#121212", // Updated to match ChildExperience
  },
  innerContainer: {
    flex: 1,
    paddingTop: 18,
    paddingBottom: 40,
  },
  backarrow: {
    top: 10, // Updated to match ChildExperience
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
    borderRadius: 10, // Updated to match ChildExperience
    justifyContent: "center",
    alignItems: "center",
    height: "100%", // Updated to match ChildExperience
  },
  buttonText: {
    fontSize: 17, // Updated to match ChildExperience
    letterSpacing: -0.2, // Updated to match ChildExperience
    fontWeight: "500", // Updated to match ChildExperience
    fontFamily: "Roboto-Medium", // Updated to match ChildExperience
    color: "#fff", // Updated to match ChildExperience
    textAlign: "center",
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

export default ChildAge;