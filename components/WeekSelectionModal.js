import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";

const WeekSelectionModal = ({
  visible,
  weeks,
  selectedWeeks,
  unavailableWeeks,
  isLoading,
  onWeekSelection,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Select Unavailable Weeks</Text>
          <Text style={styles.modalSubtitle}>
            This action cannot be undone.
          </Text>
          {weeks.map((week, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.weekButton,
                (selectedWeeks.includes(week) ||
                  unavailableWeeks.includes(week)) &&
                  styles.weekButtonSelected,
              ]}
              onPress={() => onWeekSelection(week)}
              disabled={unavailableWeeks.includes(week)}
            >
              <Text style={styles.weekButtonText}>Week of {week}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.modalButtonContainer}>
            <TouchableOpacity
              style={[styles.submitButton, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitButton, isLoading && { opacity: 0.6 }]}
              onPress={onConfirm}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? "Processing..." : "Confirm"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#1a1a1a",
    padding: 24,
    borderRadius: 14,
    width: "85%",
    alignItems: "center",
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
  weekButton: {
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: 14,
    borderRadius: 14,
    marginVertical: 6,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  weekButtonSelected: {
    backgroundColor: "#ff3b30",
    borderColor: "#ff3b30",
  },
  weekButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
  },
  submitButton: {
    backgroundColor: "#147EFB",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginTop: 12,
  },
  cancelButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
    width: "45%",
  },
  buttonText: {
    fontSize: 16,
    color: "#ffffff",
    fontWeight: "600",
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  modalButtonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 20,
    gap: 12,
  },
});

export default WeekSelectionModal;
