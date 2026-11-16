import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from "react-native";
import { makeStyles, useTheme, GlassSurface } from "../theme";

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
  const styles = useStyles();
  const t = useTheme();
  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <GlassSurface sheet style={styles.modalContainer}>
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
              <Text
                style={[
                  styles.weekButtonText,
                  (selectedWeeks.includes(week) ||
                    unavailableWeeks.includes(week)) &&
                    styles.weekButtonTextSelected,
                ]}
              >
                Week of {week}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.modalButtonContainer}>
            <TouchableOpacity
              style={[styles.submitButton, styles.cancelButton]}
              onPress={onCancel}
            >
              <Text style={[styles.buttonText, styles.cancelButtonText]}>
                Cancel
              </Text>
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
        </GlassSurface>
      </View>
    </Modal>
  );
};

const useStyles = makeStyles((t) => ({
  modalOverlay: {
    flex: 1,
    backgroundColor: t.overlay,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: t.surface,
    padding: 24,
    borderRadius: 14,
    width: "85%",
    alignItems: "center",
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
  weekButton: {
    backgroundColor: t.fill,
    paddingVertical: 14,
    borderRadius: 14,
    marginVertical: 6,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: t.border,
  },
  weekButtonSelected: {
    backgroundColor: t.danger,
    borderColor: t.danger,
  },
  weekButtonText: {
    fontSize: 16,
    color: t.text,
    fontWeight: "500",
  },
  weekButtonTextSelected: {
    color: t.onAccent,
  },
  submitButton: {
    backgroundColor: t.accent,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginTop: 12,
  },
  cancelButton: {
    backgroundColor: t.fillStrong,
    width: "45%",
  },
  cancelButtonText: {
    color: t.text,
  },
  buttonText: {
    fontSize: 16,
    color: t.onAccent,
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
}));

export default WeekSelectionModal;
