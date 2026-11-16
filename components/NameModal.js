import React from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
} from "react-native";
import { makeStyles, useTheme, GlassSurface } from "../theme";

const NameModal = ({
  visible,
  firstName,
  lastName,
  onChangeFirstName,
  onChangeLastName,
  onSubmit,
}) => {
  const styles = useStyles();
  const t = useTheme();
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={() => {}}
    >
      <View style={styles.modalOverlay}>
        <GlassSurface sheet style={styles.modalContainer}>
          <Text style={styles.modalTitle}>We Need Your Name</Text>
          <Text style={styles.modalSubtitle}>
            Please provide your first and last name to continue.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="First Name"
            placeholderTextColor={t.placeholder}
            keyboardAppearance={t.keyboardAppearance}
            value={firstName}
            onChangeText={onChangeFirstName}
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            placeholder="Last Name"
            placeholderTextColor={t.placeholder}
            keyboardAppearance={t.keyboardAppearance}
            value={lastName}
            onChangeText={onChangeLastName}
            autoCapitalize="words"
          />
          <TouchableOpacity style={styles.submitButton} onPress={onSubmit}>
            <Text style={styles.buttonText}>Submit</Text>
          </TouchableOpacity>
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
  input: {
    width: "100%",
    backgroundColor: t.fill,
    color: t.text,
    borderWidth: 1,
    borderColor: t.border,
    padding: 14,
    borderRadius: 14,
    marginVertical: 8,
    fontSize: 16,
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

export default NameModal;
