import React from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { makeStyles, useTheme, GlassSurface } from "../theme";
import { Ionicons } from "@expo/vector-icons";

const ChildrenProfilePictureModal = ({
  visible,
  scaleValue,
  onRemoveChildren,
  onClose,
}) => {
  const styles = useStyles();
  const t = useTheme();
  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
          <GlassSurface style={styles.modalDOBContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Children Profile Pictures Required
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={t.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              Some of your children are missing profile pictures. Please remove
              them and reregister with profile pictures.
            </Text>
            <Pressable style={styles.submitButton} onPress={onRemoveChildren}>
              <Text style={styles.buttonText}>Remove Children</Text>
            </Pressable>
          </GlassSurface>
        </Animated.View>
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
  modalDOBContainer: {
    backgroundColor: t.surface,
    borderRadius: 14,
    padding: 28,
    alignItems: "center",
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: t.border,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
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
  closeButton: {
    padding: 8,
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

export default ChildrenProfilePictureModal;
