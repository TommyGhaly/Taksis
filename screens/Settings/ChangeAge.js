import React, { useState } from "react";
import {
  Text,
  View,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BackArrow from "../../components/backArrow";
import { doc, getFirestore, updateDoc } from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { callFunction } from "../../components/functionCalls";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import { makeStyles, useTheme, GlassSurface } from "../../theme";

const ChangeAge = () => {
  const styles = useStyles();
  const t = useTheme();
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const navigation = useNavigation();
  const user = getAuth().currentUser;

  const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };

  const formatDate = (date) => {
    return `${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}-${date.getFullYear()}`;
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

  const updateDOBInDB = async (dob) => {
    if (!user?.uid) {
      throw new Error("User not authenticated");
    }
    try {
      await updateDoc(doc(getFirestore(), "users", user.uid), {
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.innerContainer}>
        <View style={styles.header}>
          <Pressable
            style={styles.backArrow}
            onPress={() => navigation.goBack()}
          >
            <BackArrow />
          </Pressable>
        </View>

        <View style={styles.content}>
          <GlassSurface style={styles.card}>
            <Text style={styles.title}>Update Your Date of Birth</Text>
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
                  minimumDate={new Date(1900, 0, 1)} // Allow dates from 1900
                  style={styles.datePicker}
                  textColor={t.isDark ? "#F0F0F0" : t.text}
                  accentColor={t.accent}
                />
              )}
            </View>
          </GlassSurface>
        </View>

        <Pressable style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmText}>Confirm</Text>
        </Pressable>
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
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  header: {
    marginBottom: 20,
  },
  backArrow: {
    marginBottom: 16,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: t.surface,
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: t.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: t.surfaceElevated,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: (t.isDark ? "#F0F0F0" : t.text),
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
    color: (t.isDark ? "#F0F0F0" : t.text),
    marginTop: 5,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    textAlign: "center",
    textDecorationLine: "underline",
  },
  confirmButton: {
    backgroundColor: t.surfaceHighest,
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
    color: t.text,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
}));

export default ChangeAge;