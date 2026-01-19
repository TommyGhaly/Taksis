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
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

const ProfilePictureModal = ({
  visible,
  scaleValue,
  isDeacon,
  onAddPhoto,
}) => {
  return (
    <Modal
      animationType="none"
      transparent={true}
      visible={visible}
      onRequestClose={() => {}}
    >
      <View style={styles.modalOverlay}>
        <BlurView intensity={20} style={StyleSheet.absoluteFillObject} />
        <Animated.View
          style={[
            styles.enhancedModalContainer,
            { transform: [{ scale: scaleValue }] },
          ]}
        >
          <View style={styles.modalGradientHeader} />
          <View style={styles.modalIconContainer}>
            <Ionicons name="camera" size={48} color="#147EFB" />
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
              color="#FFFFFF"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.enhancedButtonText}>Add Profile Picture</Text>
          </Pressable>
        </Animated.View>
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
  enhancedModalContainer: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 32,
    alignItems: "center",
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    position: "relative",
    overflow: "hidden",
  },
  modalGradientHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: "#147EFB",
    opacity: 0.08,
  },
  modalIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
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
  enhancedSubmitButton: {
    flexDirection: "row",
    backgroundColor: "#147EFB",
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
    color: "#FFFFFF",
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
});

export default ProfilePictureModal;
