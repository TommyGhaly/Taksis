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

const ProfilePictureModal = ({
  visible,
  scaleValue,
  isDeacon,
  onAddPhoto,
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
        <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
          <GlassSurface style={styles.enhancedModalContainer}>
            <View style={styles.modalGradientHeader} />
            <View style={styles.modalIconContainer}>
              <Ionicons name="camera" size={48} color={t.accent} />
            </View>
            <Text style={styles.modalTitle}>Profile Picture Required</Text>
            <Text style={styles.modalSubtitle}>
              As a {isDeacon ? "deacon" : "Sunday school servant"}, you need a
              profile picture to help identify you in the church community.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.enhancedSubmitButton,
                pressed && styles.enhancedButtonPressed,
              ]}
              onPress={onAddPhoto}
            >
              <Ionicons
                name="add-circle-outline"
                size={24}
                color={t.onAccent}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.enhancedButtonText}>Add Profile Picture</Text>
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
  enhancedModalContainer: {
    backgroundColor: t.surface,
    borderRadius: 14,
    padding: 32,
    alignItems: "center",
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: t.border,
    position: "relative",
    overflow: "hidden",
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

export default ProfilePictureModal;
