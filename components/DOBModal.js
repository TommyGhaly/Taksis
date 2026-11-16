import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  Platform,
} from "react-native";
import { makeStyles, useTheme, GlassSurface } from "../theme";
import DateTimePicker from "@react-native-community/datetimepicker";

const DOBModal = ({
  visible,
  scaleValue,
  date,
  tempDate,
  showDatePicker,
  formatDate,
  onDateChange,
  onShowDatePicker,
  onSubmit,
}) => {
  const styles = useStyles();
  const t = useTheme();
  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="none"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
            <GlassSurface sheet style={styles.modalDOBContainer}>
              <Text style={styles.modalTitle}>We Need Your Date of Birth</Text>
              <Text style={styles.modalSubtitle}>
                Please provide your date of birth to continue.
              </Text>
              <View style={styles.datePickerContainer}>
                {Platform.OS === "ios" ? (
                  <>
                    <Text style={styles.dateText}>{formatDate(date)}</Text>
                    <DateTimePicker
                      value={tempDate}
                      mode="date"
                      display="spinner"
                      onChange={onDateChange}
                      maximumDate={new Date()}
                      {...(Platform.OS === "ios"
                        ? { textColor: t.isDark ? "#F0F0F0" : "#000" }
                        : {})}
                      themeVariant={t.isDark ? "dark" : "light"}
                      accentColor={t.accent}
                      style={styles.datePicker}
                    />
                  </>
                ) : (
                  <Pressable onPress={onShowDatePicker}>
                    <Text style={styles.dateText}>{formatDate(date)}</Text>
                  </Pressable>
                )}
              </View>
              <Pressable style={styles.submitButton} onPress={onSubmit}>
                <Text style={styles.buttonText}>Submit</Text>
              </Pressable>
            </GlassSurface>
          </Animated.View>
        </View>
      </Modal>

      {Platform.OS === "android" && showDatePicker && (
        <Modal
          visible={showDatePicker}
          transparent={true}
          animationType="none"
          onRequestClose={() => {}}
        >
          <View style={styles.modalOverlay}>
            <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
              <GlassSurface sheet style={styles.modalDOBContainer}>
                {(() => {
                  try {
                    return (
                      <DateTimePicker
                        value={tempDate}
                        mode="date"
                        display="spinner"
                        onChange={onDateChange}
                        maximumDate={new Date()}
                        accentColor={t.accent}
                      />
                    );
                  } catch (error) {
                    return <Text>Error rendering date picker</Text>;
                  }
                })()}
              </GlassSurface>
            </Animated.View>
          </View>
        </Modal>
      )}
    </>
  );
};

const useStyles = makeStyles((t) => ({
  modalOverlay: {
    flex: 1,
    backgroundColor: t.overlay,
    justifyContent: "center",
    alignItems: "center",
  },
  modalDOBContainer: {
    backgroundColor: t.surface,
    borderRadius: 14,
    padding: 28,
    alignItems: "center",
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: t.border,
  },
  modalTitle: {
    fontSize: 22,
    color: t.text,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  modalSubtitle: {
    fontSize: 15,
    color: t.textSecondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  datePickerContainer: {
    backgroundColor: t.fill,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: t.border,
  },
  dateText: {
    fontSize: 16,
    color: t.text,
    marginBottom: 10,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  datePicker: {
    width: "100%",
  },
  submitButton: {
    backgroundColor: t.accent,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginTop: 12,
  },
  buttonText: {
    fontSize: 16,
    color: t.onAccent,
    fontWeight: "600",
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
}));

export default DOBModal;
