import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Image,
  ActivityIndicator,
  FlatList,
} from "react-native";
import firestore, { FieldValue } from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import storage from "@react-native-firebase/storage";
import { StorageCache } from "../utils/cacheManager";
import { callFunction } from "./functionCalls";
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

const DATE_FORMATS = {
  SCHEDULE: 'MM-DD-YY',
  LAST_SERVE: 'MM-DD-YY',
};

const parseDate = (dateStr, format) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  
  let day, month, year;
  if (format === DATE_FORMATS.SCHEDULE) {
    month = parseInt(parts[0], 10);
    day = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  } else if (format === DATE_FORMATS.LAST_SERVE) {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  } else {
    return null;
  }
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  
  const fullYear = year < 100 ? 2000 + year : year;
  const date = new Date(fullYear, month - 1, day);
  
  if (date.getFullYear() !== fullYear || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
};

const calculateWeeksBetween = (lastServeStr, targetWeekStr) => {
  if (!lastServeStr || !targetWeekStr) return null;
  const lastServeDate = parseDate(lastServeStr, DATE_FORMATS.LAST_SERVE);
  const targetDate = parseDate(targetWeekStr, DATE_FORMATS.SCHEDULE);
  if (!lastServeDate || !targetDate) return null;
  
  const diffMs = targetDate.getTime() - lastServeDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
};

const getColorForWeeks = (weeks) => {
  if (weeks === null || weeks === undefined || weeks < 0) return '#666';
  
  const colorStops = [
    { weeks: 0, color: '#ff3b30' },
    { weeks: 1, color: '#ff3b30' },
    { weeks: 2, color: '#ff6b30' },
    { weeks: 3, color: '#ff9500' },
    { weeks: 4, color: '#ffcc00' },
    { weeks: 6, color: '#c7dc00' },
    { weeks: 8, color: '#76d600' },
    { weeks: Infinity, color: '#34c759' },
  ];
  
  for (const stop of colorStops) {
    if (weeks <= stop.weeks) return stop.color;
  }
  return '#34c759';
};

const getWeeksDisplayText = (weeks) => {
  if (weeks === null) return 'No data';
  if (weeks < 0) return `Will serve in ${Math.abs(weeks)} week${Math.abs(weeks) === 1 ? '' : 's'}`;
  if (weeks === 0) return 'Serving this week';
  if (weeks === 1) return 'Served 1 week ago';
  return `Served ${weeks} weeks ago`;
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
  role,
  original,
  replacement,
  onSkip,
  onSkipAll,
  showSkipAll = false,
  availableServers: propAvailableServers,
  imageUrls: propImageUrls,
  lastServeData: propLastServeData,
  nextServeData: propNextServeData,
  selectedWeek: propSelectedWeek,
}) => {
  const user = auth().currentUser;

  const [originalImageUrl, setOriginalImageUrl] = useState(null);
  const [replacementImageUrl, setReplacementImageUrl] = useState(null);
  const [loadingImages, setLoadingImages] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfileUid, setSelectedProfileUid] = useState(null);

  // View state: 'main' or 'serverSelect'
  const [viewMode, setViewMode] = useState('main');

  const [localAvailableServers, setLocalAvailableServers] = useState([]);
  const [localImageUrls, setLocalImageUrls] = useState({});
  const [localLastServeData, setLocalLastServeData] = useState({});
  const [localNextServeData, setLocalNextServeData] = useState({});
  const [loadingServers, setLoadingServers] = useState(false);

  const availableServers =
    propAvailableServers?.length > 0
      ? propAvailableServers
      : localAvailableServers;
  const imageUrls =
    propImageUrls && Object.keys(propImageUrls).length > 0
      ? propImageUrls
      : localImageUrls;
  const lastServeData =
    propLastServeData && Object.keys(propLastServeData).length > 0
      ? propLastServeData
      : localLastServeData;
  const nextServeData =
    propNextServeData && Object.keys(propNextServeData).length > 0
      ? propNextServeData
      : localNextServeData;
  const selectedWeek = propSelectedWeek || week;

  // Reset view mode when modal closes
  useEffect(() => {
    if (!visible) {
      setViewMode('main');
    }
  }, [visible]);

  // Fetch profile images for original and replacement
  useEffect(() => {
    if (!visible) return;

    const fetchImages = async () => {
      setLoadingImages(true);
      const urls = {};

      for (const uid of [original?.uid, replacement?.uid]) {
        if (!uid) continue;
        try {
          const url = await StorageCache.getDownloadURL(
            `profilePictures/${uid}.png`
          );
          urls[uid] = url;
        } catch {}
      }

      setOriginalImageUrl(urls[original?.uid] || null);
      setReplacementImageUrl(urls[replacement?.uid] || null);
      setLoadingImages(false);
    };

    fetchImages();
  }, [visible, original?.uid, replacement?.uid]);

  // Fetch available servers proactively when modal is visible
  useEffect(() => {
    const hasPropsData = propAvailableServers?.length > 0;
    const hasLocalData = localAvailableServers.length > 0;
    
    if (hasPropsData || hasLocalData || !visible || !churchId || !week) return;

    let isMounted = true;
    setLoadingServers(true);

    const fetchServers = async () => {
      try {
        const scheduleDoc = await firestore()
          .collection("churches")
          .doc(churchId)
          .collection("schedule")
          .doc(week)
          .get();

        if (!scheduleDoc.exists || !isMounted) {
          setLoadingServers(false);
          return;
        }

        const scheduleData = scheduleDoc.data();
        const extraServers = (scheduleData.extra || [])
          .filter((s) => s.name !== "N/A" && s.uid)
          .sort((a, b) =>
            a.name
              .split(" ")[0]
              .toLowerCase()
              .localeCompare(b.name.split(" ")[0].toLowerCase())
          );

        if (!isMounted) return;
        setLocalAvailableServers(extraServers);

        const urls = {};
        const lastServe = {};
        const nextServe = {};

        await Promise.all(
          extraServers.map(async (server) => {
            try {
              const url = await StorageCache.getDownloadURL(
                `profilePictures/${server.uid}.png`
              );
              if (isMounted) urls[server.uid] = url;
            } catch {
              try {
                const url = await storage()
                  .ref(`profilePictures/${server.uid}.png`)
                  .getDownloadURL();
                if (isMounted) urls[server.uid] = url;
              } catch {}
            }

            try {
              const userDoc = await firestore()
                .collection("users")
                .doc(server.uid)
                .get();
              if (userDoc.exists && isMounted) {
                const userData = userDoc.data();
                if (userData.lastServe)
                  lastServe[server.uid] = userData.lastServe;
                if (userData.nextWeekServe)
                  nextServe[server.uid] = userData.nextWeekServe;
              }
            } catch {}
          })
        );

        if (isMounted) {
          setLocalImageUrls(urls);
          setLocalLastServeData(lastServe);
          setLocalNextServeData(nextServe);
          setLoadingServers(false);
        }
      } catch (err) {
        console.error("Error fetching servers:", err);
        if (isMounted) setLoadingServers(false);
      }
    };

    fetchServers();

    return () => {
      isMounted = false;
    };
  }, [visible, churchId, week, propAvailableServers?.length, localAvailableServers.length]);

  const deleteUnavailableEntry = async () => {
    const unavailableRef = firestore()
      .collection("churches")
      .doc(churchId)
      .collection("unavailable")
      .doc(week);

    if (Array.isArray(role)) {
      const [roleType, index] = role;
      await unavailableRef.update({
        [`${roleType}.${index}`]: FieldValue.delete(),
      });

      let doc = await unavailableRef.get();
      if (doc.exists) {
        const data = doc.data();
        if (data[roleType] && Object.keys(data[roleType]).length === 0) {
          await unavailableRef.update({
            [roleType]: FieldValue.delete(),
          });

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
      await unavailableRef.update({
        [role]: FieldValue.delete(),
      });

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
      await callFunction(
        user,
        "https://handle-unavailable-requests-hy6oofbihq-uc.a.run.app",
        {
          church: churchId,
          week,
          name: replacement.name,
          uid: replacement.uid,
          role,
          unavailableUid: original?.uid,
        },
        "Failed to accept replacement. Please try again."
      );

      await deleteUnavailableEntry();
      onClose();
    } catch (err) {
      console.error("Error accepting replacement:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChooseSomeoneElse = () => {
    setViewMode('serverSelect');
  };

  const handleSelectReplacement = async (selectedServer) => {
    setViewMode('main');
    setSubmitting(true);

    try {
      await callFunction(
        user,
        "https://handle-unavailable-requests-hy6oofbihq-uc.a.run.app",
        {
          church: churchId,
          week,
          name: selectedServer.name,
          uid: selectedServer.uid,
          role,
          unavailableUid: original?.uid,
        },
        "Failed to assign replacement. Please try again."
      );

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

  const renderServerItem = ({ item }) => {
    const weeksSinceLastServe = calculateWeeksBetween(lastServeData[item.uid], selectedWeek);
    const indicatorColor = getColorForWeeks(weeksSinceLastServe);
    const displayText = getWeeksDisplayText(weeksSinceLastServe);
    
    let secondaryInfo = null;
    if (nextServeData[item.uid]) {
      const weeksUntilNext = calculateWeeksBetween(selectedWeek, nextServeData[item.uid]);
      if (weeksUntilNext !== null && weeksUntilNext >= 0) {
        if (weeksUntilNext === 0) secondaryInfo = 'Serving next week';
        else if (weeksUntilNext === 1) secondaryInfo = 'Serving in 1 week';
        else if (weeksUntilNext <= 8) secondaryInfo = `Serving in ${weeksUntilNext} weeks`;
      }
    }
    
    return (
      <TouchableOpacity
        style={styles.serverItemContainer}
        onPress={() => handleSelectReplacement(item)}
        activeOpacity={0.7}
      >
        <View style={styles.serverItemContent}>
          <View style={styles.serverProfilePicContainer}>
            <Image
              source={
                imageUrls[item.uid]
                  ? { uri: imageUrls[item.uid] }
                  : require("../assets/default_profile.png")
              }
              style={styles.serverProfilePic}
              resizeMode="cover"
              defaultSource={require("../assets/default_profile.png")}
            />
            <View style={[styles.serverStatusIndicator, { backgroundColor: indicatorColor }]} />
          </View>
          <View style={styles.serverInfo}>
            <Text style={styles.serverName}>{item.name}</Text>
            <View style={styles.serveInfoContainer}>
              <Text style={[styles.primaryServeText, { color: indicatorColor }]}>
                {displayText}
              </Text>
              {secondaryInfo && (
                <Text style={styles.secondaryServeText}>{secondaryInfo}</Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render server selection view
  const renderServerSelectView = () => (
    <View style={styles.modalContent}>
      <View style={styles.serverSelectHeader}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => setViewMode('main')}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.modalTitle}>Choose Replacement</Text>
        <View style={styles.backButton} />
      </View>
      <FlatList
        data={availableServers}
        keyExtractor={(item) => item.uid}
        showsVerticalScrollIndicator={false}
        renderItem={renderServerItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        style={styles.serverList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No servers available</Text>
          </View>
        }
      />
    </View>
  );

  // Render main view
  const renderMainView = () => (
    <View style={styles.modalContent}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Schedule Change</Text>
      </View>

      <View style={styles.modalBody}>
        <Text style={styles.messageText}>
          <Text style={styles.highlightName}>{original?.name}</Text>
          {" is unavailable for "}
          <Text style={styles.roleHighlight}>
            {getRoleDisplayName(role)}
          </Text>
        </Text>

        <View style={styles.weekBadge}>
          <Text style={styles.weekBadgeText}>
            {formatWeekDisplay(week)}
          </Text>
        </View>

        <View style={styles.profilesContainer}>
          <View style={styles.profileCard}>
            <TouchableOpacity
              onPress={() => openProfile(original?.uid)}
              style={styles.profileImageWrapper}
              activeOpacity={0.7}
            >
              {loadingImages ? (
                <View
                  style={[
                    styles.profileImage,
                    styles.profileImagePlaceholder,
                  ]}
                >
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
                  resizeMode="cover"
                  defaultSource={require("../assets/default_profile.png")}
                />
              )}
              <View
                style={[styles.statusBadge, styles.unavailableBadge]}
              >
                <Text style={styles.statusIcon}>✕</Text>
              </View>
            </TouchableOpacity>
            <Text style={styles.profileName} numberOfLines={1}>
              {original?.name?.split(" ")[0]}
            </Text>
            <Text style={styles.unavailableLabel}>Unavailable</Text>
          </View>

          <View style={styles.arrowContainer}>
            <View style={styles.arrowLine} />
            <View style={styles.arrowHead} />
          </View>

          <View style={styles.profileCard}>
            <TouchableOpacity
              onPress={() => openProfile(replacement?.uid)}
              style={styles.profileImageWrapper}
              activeOpacity={0.7}
            >
              {loadingImages ? (
                <View
                  style={[
                    styles.profileImage,
                    styles.profileImagePlaceholder,
                  ]}
                >
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
                  resizeMode="cover"
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
          disabled={submitting || loadingServers}
          activeOpacity={0.8}
        >
          {loadingServers ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.chooseButtonText}>
              Choose Someone Else
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.skipButtonsContainer}>
          <TouchableOpacity
            style={[
              styles.skipButton,
              showSkipAll && styles.skipButtonHalf,
            ]}
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
  );

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={[
            styles.modalWrapper,
            viewMode === 'serverSelect' && styles.modalWrapperTall
          ]}>
            {viewMode === 'main' ? renderMainView() : renderServerSelectView()}
          </View>
        </View>
      </Modal>

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
  modalWrapperTall: {
    maxHeight: "80%",
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
    maxHeight: "100%",
  },
  modalHeader: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  serverSelectHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#252525",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "300",
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
  // Server list styles
  serverList: {
    maxHeight: 400,
  },
  serverItemContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  serverItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  serverProfilePicContainer: {
    position: "relative",
  },
  serverProfilePic: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#2a2a2a",
    backgroundColor: "#2a2a2a",
  },
  serverStatusIndicator: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#1a1a1a",
  },
  serverInfo: {
    marginLeft: 14,
    flex: 1,
  },
  serverName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  serveInfoContainer: {
    marginTop: 2,
  },
  primaryServeText: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: "600",
  },
  secondaryServeText: {
    fontSize: 11,
    marginTop: 1,
    color: "#888",
    fontWeight: "400",
  },
  separator: {
    height: 1,
    backgroundColor: "#2a2a2a",
    marginHorizontal: 20,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#666",
    fontSize: 16,
  },
});

export default UnavailableRequestModal;