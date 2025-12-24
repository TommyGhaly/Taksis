import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";
import firestore, { FieldValue } from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { StorageCache } from "../utils/cacheManager";
import { callFunction } from "./functionCalls";
import ServerSelectionModal from "./ServerSelectionModal";
import IndividualProfile from "./individualProfile";

const displayNames = {
  matins: "Matins Gospel",
  third: "Third Hour Gospel",
  sixth: "Sixth Hour Gospel",
  pauline: "Pauline Epistle",
  catholic: "Catholic Epistle",
  praxis: "Praxis",
  gospel: "Gospel",
  water: "Water",
  wine: "Wine",
  altar: "Altar Server",
};

const formatWeekDisplay = (weekStr) => {
  if (!weekStr) return "";
  const parts = weekStr.split("-");
  if (parts.length !== 3) return weekStr;
  const [month, day, year] = parts.map((p) => parseInt(p, 10));
  const date = new Date(2000 + year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
};

const getRoleDisplayName = (role) => {
  if (Array.isArray(role)) {
    return displayNames[role[0]] || role[0];
  }
  return displayNames[role] || role;
};

const UnavailableRequestModal = ({
  visible,
  onClose,
  churchId,
  week,
  role, // string like "gospel" or array like ["altar", 0]
  original, // { name, uid }
  replacement, // { name, uid }
  onSkip, // callback for skipping this one
  onSkipAll, // callback for skipping all (only rendered if provided)
  showSkipAll = false, // whether to show "Skip All" button
}) => {
  const user = auth().currentUser;

  // State
  const [originalImageUrl, setOriginalImageUrl] = useState(null);
  const [replacementImageUrl, setReplacementImageUrl] = useState(null);
  const [loadingImages, setLoadingImages] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfileUid, setSelectedProfileUid] = useState(null);

  // Data for ServerSelectionModal
  const [availableServers, setAvailableServers] = useState([]);
  const [imageUrls, setImageUrls] = useState({});
  const [lastServeData, setLastServeData] = useState({});
  const [nextServeData, setNextServeData] = useState({});

  // Fetch profile images for original and replacement
  useEffect(() => {
    if (!visible) return;

    const fetchImages = async () => {
      setLoadingImages(true);
      const urls = {};

      for (const uid of [original?.uid, replacement?.uid]) {
        if (!uid) continue;
        try {
          const url = await StorageCache.getDownloadURL(`profilePictures/${uid}.png`);
          urls[uid] = url;
        } catch {
          // Silent fail - use default
        }
      }

      setOriginalImageUrl(urls[original?.uid] || null);
      setReplacementImageUrl(urls[replacement?.uid] || null);
      setLoadingImages(false);
    };

    fetchImages();
  }, [visible, original?.uid, replacement?.uid]);

  // Fetch available servers when "Choose Someone Else" is pressed
  useEffect(() => {
    if (!showServerModal || !churchId || !week) return;

    const fetchServers = async () => {
      try {
        const scheduleDoc = await firestore()
          .collection("churches")
          .doc(churchId)
          .collection("schedule")
          .doc(week)
          .get();

        if (!scheduleDoc.exists) return;

        const scheduleData = scheduleDoc.data();
        const extraServers = (scheduleData.extra || [])
          .filter((s) => s.name !== "N/A" && s.uid)
          .sort((a, b) =>
            a.name.split(" ")[0].toLowerCase().localeCompare(b.name.split(" ")[0].toLowerCase())
          );

        setAvailableServers(extraServers);

        // Fetch images and serve data for each server
        const urls = {};
        const lastServe = {};
        const nextServe = {};

        await Promise.all(
          extraServers.map(async (server) => {
            // Fetch image
            try {
              const url = await StorageCache.getDownloadURL(`profilePictures/${server.uid}.png`);
              urls[server.uid] = url;
            } catch {}

            // Fetch user data
            try {
              const userDoc = await firestore().collection("users").doc(server.uid).get();
              if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.lastServe) lastServe[server.uid] = userData.lastServe;
                if (userData.nextWeekServe) nextServe[server.uid] = userData.nextWeekServe;
              }
            } catch {}
          })
        );

        setImageUrls(urls);
        setLastServeData(lastServe);
        setNextServeData(nextServe);
      } catch (err) {
        console.error("Error fetching servers:", err);
      }
    };

    fetchServers();
  }, [showServerModal, churchId, week]);

  const deleteUnavailableEntry = async () => {
    const unavailableRef = firestore()
      .collection("churches")
      .doc(churchId)
      .collection("unavailable")
      .doc(week);

    if (Array.isArray(role)) {
      // Altar server - delete the specific index
      const [roleType, index] = role;
      await unavailableRef.update({
        [`${roleType}.${index}`]: FieldValue.delete(),
      });

      // Check if altar object is now empty and delete it too
      let doc = await unavailableRef.get();
      if (doc.exists) {
        const data = doc.data();
        if (data[roleType] && Object.keys(data[roleType]).length === 0) {
          await unavailableRef.update({
            [roleType]: FieldValue.delete(),
          });

          // Re-fetch to check if document is now empty
          doc = await unavailableRef.get();
          if (doc.exists) {
            const updatedData = doc.data();
            if (!updatedData || Object.keys(updatedData).length === 0) {
              await unavailableRef.delete();
            }
          }
        }
      }
    } else {
      // Single role - delete the entire role key
      await unavailableRef.update({
        [role]: FieldValue.delete(),
      });

      // Check if document is now empty and delete it
      const doc = await unavailableRef.get();
      if (doc.exists) {
        const data = doc.data();
        if (!data || Object.keys(data).length === 0) {
          await unavailableRef.delete();
        }
      }
    }
  };

  const handleAccept = async () => {
    if (!replacement?.uid || !replacement?.name) return;

    setSubmitting(true);
    try {
      await callFunction({
        user,
        url: "https://handle-unavailable-requests-hy6oofbihq-uc.a.run.app",
        payload: {
          church: churchId,
          week,
          name: replacement.name,
          uid: replacement.uid,
          role,
          unavailableUid: original?.uid,
        },
        errorMessage: "Failed to accept replacement. Please try again.",
        awaitResponse: true,
      });

      await deleteUnavailableEntry();
      onClose();
    } catch (err) {
      console.error("Error accepting replacement:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChooseSomeoneElse = () => {
    setShowServerModal(true);
  };

  const handleSelectReplacement = async (selectedServer) => {
    setShowServerModal(false);
    setSubmitting(true);

    try {
      await callFunction({
        user,
        url: "https://handle-unavailable-requests-hy6oofbihq-uc.a.run.app",
        payload: {
          church: churchId,
          week,
          name: selectedServer.name,
          uid: selectedServer.uid,
          role,
          unavailableUid: original?.uid,
        },
        errorMessage: "Failed to assign replacement. Please try again.",
        awaitResponse: true,
      });

      await deleteUnavailableEntry();
      onClose();
    } catch (err) {
      console.error("Error selecting replacement:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const openProfile = (uid) => {
    if (!uid) return;
    setSelectedProfileUid(uid);
    setShowProfileModal(true);
  };

  const closeProfile = () => {
    setSelectedProfileUid(null);
    setShowProfileModal(false);
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalWrapper}>
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Schedule Change</Text>
              </View>

              {/* Body */}
              <View style={styles.modalBody}>
                {/* Message */}
                <Text style={styles.messageText}>
                  <Text style={styles.highlightName}>{original?.name}</Text>
                  {" is unavailable for "}
                  <Text style={styles.roleHighlight}>{getRoleDisplayName(role)}</Text>
                </Text>

                {/* Week Badge */}
                <View style={styles.weekBadge}>
                  <Text style={styles.weekBadgeText}>{formatWeekDisplay(week)}</Text>
                </View>

                {/* Profile Cards */}
                <View style={styles.profilesContainer}>
                  {/* Unavailable Person */}
                  <View style={styles.profileCard}>
                    <TouchableOpacity
                      onPress={() => openProfile(original?.uid)}
                      style={styles.profileImageWrapper}
                      activeOpacity={0.7}
                    >
                      {loadingImages ? (
                        <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
                          <ActivityIndicator size="small" color="#666" />
                        </View>
                      ) : (
                        <Image
                          source={
                            originalImageUrl
                              ? { uri: originalImageUrl }
                              : require("../assets/default_profile.png")
                          }
                          style={[styles.profileImage, styles.unavailableImage]}
                          defaultSource={require("../assets/default_profile.png")}
                        />
                      )}
                      <View style={[styles.statusBadge, styles.unavailableBadge]}>
                        <Text style={styles.statusIcon}>✕</Text>
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.profileName} numberOfLines={1}>
                      {original?.name?.split(" ")[0]}
                    </Text>
                    <Text style={styles.unavailableLabel}>Unavailable</Text>
                  </View>

                  {/* Arrow */}
                  <View style={styles.arrowContainer}>
                    <View style={styles.arrowLine} />
                    <View style={styles.arrowHead} />
                  </View>

                  {/* Suggested Replacement */}
                  <View style={styles.profileCard}>
                    <TouchableOpacity
                      onPress={() => openProfile(replacement?.uid)}
                      style={styles.profileImageWrapper}
                      activeOpacity={0.7}
                    >
                      {loadingImages ? (
                        <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
                          <ActivityIndicator size="small" color="#666" />
                        </View>
                      ) : (
                        <Image
                          source={
                            replacementImageUrl
                              ? { uri: replacementImageUrl }
                              : require("../assets/default_profile.png")
                          }
                          style={[styles.profileImage, styles.suggestedImage]}
                          defaultSource={require("../assets/default_profile.png")}
                        />
                      )}
                      <View style={[styles.statusBadge, styles.suggestedBadge]}>
                        <Text style={styles.statusIcon}>✓</Text>
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.profileName} numberOfLines={1}>
                      {replacement?.name?.split(" ")[0]}
                    </Text>
                    <Text style={styles.suggestedLabel}>Suggested</Text>
                  </View>
                </View>
              </View>

              {/* Actions */}
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={handleAccept}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.acceptButtonText}>Accept</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.chooseButton]}
                  onPress={handleChooseSomeoneElse}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  <Text style={styles.chooseButtonText}>Choose Someone Else</Text>
                </TouchableOpacity>

                <View style={styles.skipButtonsContainer}>
                  <TouchableOpacity
                    style={[styles.skipButton, showSkipAll && styles.skipButtonHalf]}
                    onPress={onSkip}
                    disabled={submitting}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.skipButtonText}>Skip</Text>
                  </TouchableOpacity>

                  {showSkipAll && (
                    <TouchableOpacity
                      style={[styles.skipButton, styles.skipButtonHalf]}
                      onPress={onSkipAll}
                      disabled={submitting}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.skipButtonText}>Skip All</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Server Selection Modal */}
      <ServerSelectionModal
        visible={showServerModal}
        onClose={() => setShowServerModal(false)}
        onSelect={handleSelectReplacement}
        servers={availableServers}
        imageUrls={imageUrls}
        lastServeData={lastServeData}
        nextServeData={nextServeData}
        selectedWeek={week}
        title="Choose Replacement"
        showNextServe={!Array.isArray(role)}
      />

      {/* Individual Profile Modal */}
      <IndividualProfile
        userId={selectedProfileUid}
        show={showProfileModal}
        onClose={closeProfile}
        church={churchId}
        week={week}
        currentEditingWeek={week}
        family={null}
        url="https://unavailable-for-week-hy6oofbihq-uc.a.run.app"
      />
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalWrapper: {
    width: "90%",
    maxWidth: 380,
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
    elevation: 25,
  },
  modalHeader: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  modalBody: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: "center",
  },
  messageText: {
    color: "#999",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 12,
  },
  highlightName: {
    color: "#fff",
    fontWeight: "600",
  },
  roleHighlight: {
    color: "#4d9cff",
    fontWeight: "600",
  },
  weekBadge: {
    backgroundColor: "rgba(77, 156, 255, 0.15)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 28,
  },
  weekBadgeText: {
    color: "#4d9cff",
    fontSize: 13,
    fontWeight: "600",
  },
  profilesContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  profileCard: {
    alignItems: "center",
    flex: 1,
  },
  profileImageWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  profileImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#2a2a2a",
  },
  profileImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  unavailableImage: {
    borderWidth: 3,
    borderColor: "rgba(255, 59, 48, 0.4)",
  },
  suggestedImage: {
    borderWidth: 3,
    borderColor: "rgba(52, 199, 89, 0.4)",
  },
  statusBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#1a1a1a",
  },
  unavailableBadge: {
    backgroundColor: "#ff3b30",
  },
  suggestedBadge: {
    backgroundColor: "#34c759",
  },
  statusIcon: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  profileName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 90,
  },
  unavailableLabel: {
    color: "#ff6b6b",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  suggestedLabel: {
    color: "#5fd97d",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  arrowContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingBottom: 36,
  },
  arrowLine: {
    width: 24,
    height: 2,
    backgroundColor: "#444",
    borderRadius: 1,
  },
  arrowHead: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 8,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "#444",
    marginLeft: -1,
  },
  actionsContainer: {
    padding: 20,
    paddingTop: 8,
    gap: 10,
  },
  actionButton: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButton: {
    backgroundColor: "#147efb",
  },
  acceptButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  chooseButton: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  chooseButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
  },
  skipButtonsContainer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  skipButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  skipButtonHalf: {
    flex: 0.5,
  },
  skipButtonText: {
    color: "#777",
    fontSize: 14,
    fontWeight: "500",
  },
});

export default UnavailableRequestModal;