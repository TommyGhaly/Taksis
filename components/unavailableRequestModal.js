import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from "react-native";
import firestore, { FieldValue } from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import Avatar from "./Avatar";
import {
  SkeletonProvider,
  SkeletonCircle,
  SkeletonText,
} from "./Skeleton";
import * as avatarCache from "../utils/avatarCache";
import { callFunction } from "./functionCalls";
import IndividualProfile from "./individualProfile";
import { LIST_PERF } from "../utils/listConfig";
import { getDocsByIds } from "../utils/firestoreBatch";
import { weeksBetween, longDateLabel } from "../utils/dateKeys";

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

// The local `DATE_FORMATS` / `parseDate` pair that used to live here is gone. Both
// of its format constants were the string "MM-DD-YY", so the day-first branch was
// unreachable and everything was parsed month-first anyway — see the note in
// utils/dateKeys.js. `weeksBetween(from, to)` has the same argument order and the
// same null-on-unparseable behaviour as the old `calculateWeeksBetween`, and
// `longDateLabel` replaces `formatWeekDisplay` with a cached equivalent.

// Hoisted out of getColorForWeeks, which reallocated this array on every call —
// and it was called once per row per render.
const COLOR_STOPS = [
  { weeks: 0, color: '#ff3b30' },
  { weeks: 1, color: '#ff3b30' },
  { weeks: 2, color: '#ff6b30' },
  { weeks: 3, color: '#ff9500' },
  { weeks: 4, color: '#ffcc00' },
  { weeks: 6, color: '#c7dc00' },
  { weeks: 8, color: '#76d600' },
  { weeks: Infinity, color: '#34c759' },
];

const getColorForWeeks = (weeks) => {
  if (weeks === null || weeks === undefined || weeks < 0) return '#666';
  for (const stop of COLOR_STOPS) {
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

/** How long until this server serves again, or null if that isn't worth showing. */
const nextServeLabel = (selectedWeek, nextServeStr) => {
  const weeks = weeksBetween(selectedWeek, nextServeStr);
  if (weeks === null || weeks < 0 || weeks > 8) return null;
  if (weeks === 0) return 'Serving next week';
  if (weeks === 1) return 'Serving in 1 week';
  return `Serving in ${weeks} weeks`;
};

/**
 * One replacement candidate.
 *
 * Everything it displays arrives precomputed — this file previously had no
 * memoization at all, so each row redid the week arithmetic, colour interpolation
 * and label formatting on every render of the modal.
 */
const ServerCandidateRow = React.memo(({ server, indicatorColor, displayText, secondaryInfo, onPress }) => (
  <TouchableOpacity
    style={styles.serverItemContainer}
    onPress={() => onPress(server)}
    activeOpacity={0.7}
  >
    <View style={styles.serverItemContent}>
      <View style={styles.serverProfilePicContainer}>
        <Avatar
          uid={server.uid}
          user={server}
          size={48}
          borderRadius={24}
          style={styles.serverProfilePic}
          showBorder={false}
        />
        <View style={[styles.serverStatusIndicator, { backgroundColor: indicatorColor }]} />
      </View>
      <View style={styles.serverInfo}>
        <Text style={styles.serverName}>{server.name}</Text>
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
));
ServerCandidateRow.displayName = "ServerCandidateRow";

// Hoisted: as inline props these were a new identity every render.
const serverRowKeyExtractor = (item) => item.server.uid;
const ServerSeparator = () => <View style={styles.separator} />;
const EmptyServers = () => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyText}>No servers available</Text>
  </View>
);

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
  lastServeData: propLastServeData,
  nextServeData: propNextServeData,
  selectedWeek: propSelectedWeek,
}) => {
  const user = auth().currentUser;

  const [submitting, setSubmitting] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfileUid, setSelectedProfileUid] = useState(null);

  // View state: 'main' or 'serverSelect'
  const [viewMode, setViewMode] = useState('main');

  const [localAvailableServers, setLocalAvailableServers] = useState([]);
  const [localLastServeData, setLocalLastServeData] = useState({});
  const [localNextServeData, setLocalNextServeData] = useState({});
  const [loadingServers, setLoadingServers] = useState(false);

  const availableServers =
    propAvailableServers?.length > 0
      ? propAvailableServers
      : localAvailableServers;
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

  // The original/replacement avatars are rendered by <Avatar uid=...>, which
  // resolves them through avatarCache (memory -> AsyncStorage -> network, once).
  // Priming here is free for whatever the caller already handed us.
  useEffect(() => {
    if (!visible) return;
    avatarCache.primeMany([original, replacement]);
  }, [visible, original, replacement]);

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

        const lastServe = {};
        const nextServe = {};
        const userDocs = [];

        // These user docs already carry photoURL, so the extra Storage
        // getDownloadURL per server is gone entirely — one primeMany call feeds
        // every avatar from data we were fetching anyway.
        //
        // Read in chunks rather than one request per server: this was
        // `extraServers.map(server => doc(server.uid).get())` inside a
        // Promise.all, i.e. N round-trips to build one list.
        const fetched = await getDocsByIds(
          "users",
          extraServers.map((s) => s.uid)
        );
        if (isMounted) {
          fetched.forEach((userData, uid) => {
            if (!userData) return;
            userDocs.push(userData);
            if (userData.lastServe) lastServe[uid] = userData.lastServe;
            if (userData.nextWeekServe) nextServe[uid] = userData.nextWeekServe;
          });
        }

        if (isMounted) {
          avatarCache.primeMany(userDocs);
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

  /**
   * Replacement candidates with their derived display values resolved once.
   *
   * The week arithmetic, colour interpolation and label formatting used to run
   * inside `renderServerItem` — a plain function recreated on every render — so
   * every mounted row redid all of it on every render of this modal.
   */
  const serverRows = useMemo(
    () =>
      availableServers.map((server) => {
        const weeksSinceLastServe = weeksBetween(lastServeData[server.uid], selectedWeek);
        return {
          server,
          indicatorColor: getColorForWeeks(weeksSinceLastServe),
          displayText: getWeeksDisplayText(weeksSinceLastServe),
          secondaryInfo: nextServeData[server.uid]
            ? nextServeLabel(selectedWeek, nextServeData[server.uid])
            : null,
        };
      }),
    [availableServers, lastServeData, nextServeData, selectedWeek]
  );

  const renderServerItem = useCallback(
    ({ item }) => (
      <ServerCandidateRow
        server={item.server}
        indicatorColor={item.indicatorColor}
        displayText={item.displayText}
        secondaryInfo={item.secondaryInfo}
        onPress={handleSelectReplacement}
      />
    ),
    [handleSelectReplacement]
  );

  // Placeholder rows in the exact shape of renderServerItem, so the real list
  // drops straight in without the sheet resizing.
  const renderServerSkeleton = () => (
    <View style={styles.serverList}>
      <SkeletonProvider>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i}>
            <View style={styles.serverItemContainer}>
              <View style={styles.serverItemContent}>
                <SkeletonCircle size={48} />
                <View style={styles.serverInfo}>
                  <SkeletonText width="58%" height={16} />
                  <SkeletonText
                    width="36%"
                    height={13}
                    style={{ marginTop: 6 }}
                  />
                </View>
              </View>
            </View>
            {i < 4 && <View style={styles.separator} />}
          </View>
        ))}
      </SkeletonProvider>
    </View>
  );

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
      {loadingServers && availableServers.length === 0 ? (
        renderServerSkeleton()
      ) : (
        <FlatList
          {...LIST_PERF}
          data={serverRows}
          keyExtractor={serverRowKeyExtractor}
          showsVerticalScrollIndicator={false}
          renderItem={renderServerItem}
          ItemSeparatorComponent={ServerSeparator}
          style={styles.serverList}
          ListEmptyComponent={EmptyServers}
        />
      )}
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
            {longDateLabel(week)}
          </Text>
        </View>

        <View style={styles.profilesContainer}>
          <View style={styles.profileCard}>
            <TouchableOpacity
              onPress={() => openProfile(original?.uid)}
              style={styles.profileImageWrapper}
              activeOpacity={0.7}
            >
              <Avatar
                uid={original?.uid}
                user={original}
                size={72}
                borderRadius={36}
                style={[styles.profileImage, styles.unavailableImage]}
                showBorder={false}
              />
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
              <Avatar
                uid={replacement?.uid}
                user={replacement}
                size={72}
                borderRadius={36}
                style={[styles.profileImage, styles.suggestedImage]}
                showBorder={false}
              />
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

        {/* Openable while the roster is still in flight — the list itself
            shows skeleton rows until the servers land. */}
        <TouchableOpacity
          style={[styles.actionButton, styles.chooseButton]}
          onPress={handleChooseSomeoneElse}
          disabled={submitting}
          activeOpacity={0.8}
        >
          <Text style={styles.chooseButtonText}>
            Choose Someone Else
          </Text>
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
      {/* Hidden while the profile is up: iOS silently refuses to present a
          second Modal over an already-presented one, which is why tapping a
          person here used to do nothing. */}
      <Modal
        visible={visible && !showProfileModal}
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