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
            styles.availabilityModalContainer,
            { transform: [{ scale: scaleValue }] },
          ]}
        >
          <View style={styles.availabilityModalHeader}>
            <View style={styles.availabilityIconCircle}>
              <Ionicons name="calendar" size={32} color="#147EFB" />
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
                  color="#FFFFFF"
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
                color="rgba(255,255,255,0.4)"
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
                <Ionicons name="help-circle" size={28} color="#FFFFFF" />
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
                color="rgba(255,255,255,0.4)"
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
                  { backgroundColor: "#ff3b30" },
                ]}
              >
                <Ionicons name="close-circle" size={28} color="#FFFFFF" />
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
                color="rgba(255,255,255,0.4)"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.availabilityModalFooter}>
            <Ionicons
              name="lock-closed"
              size={14}
              color="rgba(255,255,255,0.4)"
            />
            <Text style={styles.availabilityFooterText}>
              Only visible to church admins and you
            </Text>
          </View>
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
  availabilityModalContainer: {
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    marginHorizontal: 20,
    maxWidth: 440,
    width: "90%",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
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
    backgroundColor: "rgba(20, 126, 251, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  availabilityModalTitle: {
    fontSize: 20,
    color: "#FFFFFF",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  availabilityModalWeek: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 12,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  availabilityModalRole: {
    fontSize: 26,
    color: "#147EFB",
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
    color: "#FFFFFF",
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  availabilityOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
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
    color: "#FFFFFF",
    fontWeight: "600",
    marginBottom: 2,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  availabilityOptionSubtext: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.5)",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  availabilityModalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  availabilityFooterText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.5)",
    marginLeft: 6,
    fontStyle: "italic",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
});

export default AvailabilityModal;
