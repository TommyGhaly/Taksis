import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Platform,
} from "react-native";
import { makeStyles, useTheme, GlassSurface } from "../theme";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

const AvailabilityModal = ({
  visible,
  scaleValue,
  currentWeek,
  userCurrentWeekRole,
  isSubmittingStatus,
  onAvailabilityResponse,
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
        <Animated.View
          style={[styles.panelFrame, { transform: [{ scale: scaleValue }] }]}
        >
          <GlassSurface style={styles.availabilityModalContainer}>
            <View style={styles.availabilityModalHeader}>
              <View style={styles.availabilityIconCircle}>
                <Ionicons name="calendar" size={32} color={t.accent} />
              </View>
              <Text style={styles.availabilityModalTitle}>
                You're Scheduled
              </Text>
              <Text style={styles.availabilityModalWeek}>
                Week of {currentWeek}
              </Text>
              <Text style={styles.availabilityModalRole}>
                {userCurrentWeekRole}
              </Text>
            </View>

            <View style={styles.availabilityModalBody}>
              <Text style={styles.availabilityQuestion}>
                Will you be attending?
              </Text>

              <TouchableOpacity
                style={styles.availabilityOptionButton}
                onPress={() => onAvailabilityResponse("confirmed")}
                disabled={isSubmittingStatus}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.availabilityOptionIcon,
                    { backgroundColor: "#28A745" },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={28}
                    color={t.onAccent}
                  />
                </View>
                <View style={styles.availabilityOptionText}>
                  <Text style={styles.availabilityOptionTitle}>
                    I will be there
                  </Text>
                  <Text style={styles.availabilityOptionSubtext}>
                    Confirm attendance
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={t.textTertiary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.availabilityOptionButton}
                onPress={() => onAvailabilityResponse("unsure")}
                disabled={isSubmittingStatus}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.availabilityOptionIcon,
                    { backgroundColor: "#E68A00" },
                  ]}
                >
                  <Ionicons name="help-circle" size={28} color={t.onAccent} />
                </View>
                <View style={styles.availabilityOptionText}>
                  <Text style={styles.availabilityOptionTitle}>
                    Unsure yet
                  </Text>
                  <Text style={styles.availabilityOptionSubtext}>
                    Still deciding
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={t.textTertiary}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.availabilityOptionButton}
                onPress={() => onAvailabilityResponse("unavailable")}
                disabled={isSubmittingStatus}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.availabilityOptionIcon,
                    { backgroundColor: t.danger },
                  ]}
                >
                  <Ionicons name="close-circle" size={28} color={t.onAccent} />
                </View>
                <View style={styles.availabilityOptionText}>
                  <Text style={styles.availabilityOptionTitle}>
                    Unavailable
                  </Text>
                  <Text style={styles.availabilityOptionSubtext}>
                    Cannot attend
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={t.textTertiary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.availabilityModalFooter}>
              <Ionicons
                name="lock-closed"
                size={14}
                color={t.textTertiary}
              />
              <Text style={styles.availabilityFooterText}>
                Only visible to church admins and you
              </Text>
            </View>
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
  availabilityModalContainer: {
    backgroundColor: t.surface,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: t.border,
  },
  // Sizing lives on the animated wrapper so the percentage resolves against
  // the overlay, not the glass panel.
  panelFrame: {
    marginHorizontal: 20,
    maxWidth: 440,
    width: "90%",
  },
  availabilityModalHeader: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  availabilityIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: t.accentFill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  availabilityModalTitle: {
    fontSize: 20,
    color: t.text,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  availabilityModalWeek: {
    fontSize: 15,
    color: t.textSecondary,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 12,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  availabilityModalRole: {
    fontSize: 26,
    color: t.accent,
    fontWeight: "700",
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  availabilityModalBody: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  availabilityQuestion: {
    fontSize: 18,
    color: t.text,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  availabilityOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.fill,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: t.border,
  },
  availabilityOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  availabilityOptionText: {
    flex: 1,
  },
  availabilityOptionTitle: {
    fontSize: 17,
    color: t.text,
    fontWeight: "600",
    marginBottom: 2,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  availabilityOptionSubtext: {
    fontSize: 13,
    color: t.textSecondary,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  availabilityModalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: t.isDark ? "rgba(0, 0, 0, 0.2)" : t.fill,
    borderTopWidth: 1,
    borderTopColor: t.border,
  },
  availabilityFooterText: {
    fontSize: 12,
    color: t.textSecondary,
    marginLeft: 6,
    fontStyle: "italic",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
}));

export default AvailabilityModal;
