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
import { makeStyles, useTheme, GlassSurface } from "../theme";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Churches from "./churches";

const ChurchSelectionModal = ({
  visible,
  scaleValue,
  selectedChurch,
  isSubmitting,
  onSelectChurch,
  onSubmit,
}) => {
  const styles = useStyles();
  const t = useTheme();
  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={visible}
      onRequestClose={() => {}}
    >
      <View style={styles.modalOverlay}>
        <BlurView
          intensity={20}
          tint={t.isDark ? "default" : "light"}
          style={StyleSheet.absoluteFillObject}
        />
        <Animated.View style={[styles.panelFrame, { transform: [{ scale: scaleValue }] }]}>
          <GlassSurface sheet style={styles.churchModalContainer}>
            <View style={styles.modalGradientHeader} />
            <View style={styles.modalIconContainer}>
              <Ionicons name="business" size={48} color={t.accent} />
            </View>
            <Text style={styles.modalTitle}>Select Your Church</Text>
            <Text style={styles.modalSubtitle}>
              Please select your church to continue with the app.
            </Text>

            <View style={styles.churchListContainer}>
              <Churches onSelectChurch={onSelectChurch} />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.enhancedSubmitButton,
                pressed && styles.enhancedButtonPressed,
                { opacity: selectedChurch && !isSubmitting ? 1 : 0.6 },
              ]}
              onPress={onSubmit}
              disabled={!selectedChurch || isSubmitting}
            >
              <Text style={styles.enhancedButtonText}>
                {isSubmitting ? "Setting up..." : "Continue"}
              </Text>
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
  churchModalContainer: {
    backgroundColor: t.surface,
    borderRadius: 14,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: t.border,
    position: "relative",
    overflow: "hidden",
    flexShrink: 1,
  },
  // Sizing lives on the animated wrapper so the percentages resolve against
  // the overlay, not the glass panel.
  panelFrame: {
    width: "90%",
    maxHeight: "80%",
    marginHorizontal: 20,
  },
  churchListContainer: {
    maxHeight: 300,
    marginVertical: 20,
  },
  modalGradientHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: t.accent,
    opacity: 0.08,
  },
  modalIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: t.fill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
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
  enhancedSubmitButton: {
    flexDirection: "row",
    backgroundColor: t.accent,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    marginTop: 24,
    alignItems: "center",
  },
  enhancedButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  enhancedButtonText: {
    fontSize: 16,
    color: t.onAccent,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
}));

export default ChurchSelectionModal;
