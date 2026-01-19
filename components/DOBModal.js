import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  Platform,
} from "react-native";
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
  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="none"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalDOBContainer,
              { transform: [{ scale: scaleValue }] },
            ]}
          >
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
                    {...(Platform.OS === "ios" ? { textColor: "#F0F0F0" } : {})}
                    accentColor="#147ffb"
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
            <Animated.View
              style={[
                styles.modalDOBContainer,
                { transform: [{ scale: scaleValue }] },
              ]}
            >
              {(() => {
                try {
                  return (
                    <DateTimePicker
                      value={tempDate}
                      mode="date"
                      display="spinner"
                      onChange={onDateChange}
                      maximumDate={new Date()}
                      accentColor="#147ffb"
                    />
                  );
                } catch (error) {
                  return <Text>Error rendering date picker</Text>;
                }
              })()}
            </Animated.View>
          </View>
        </Modal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalDOBContainer: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 28,
    alignItems: "center",
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  modalTitle: {
    fontSize: 22,
    color: "#fff",
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  modalSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  datePickerContainer: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  dateText: {
    fontSize: 16,
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  datePicker: {
    width: "100%",
  },
  submitButton: {
    backgroundColor: "#147EFB",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginTop: 12,
  },
  buttonText: {
    fontSize: 16,
    color: "#ffffff",
    fontWeight: "600",
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
});

export default DOBModal;
