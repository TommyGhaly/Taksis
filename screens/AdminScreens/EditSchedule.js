import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  FlatList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
} from "react-native";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDocs,
  getFirestore,
  increment,
  onSnapshot,
  updateDoc,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import callFunction from "../../components/functionCalls";
import IndividualProfile from "../../components/individualProfile";
import SkeletonScreen from "../../components/Skeleton";
import { useAfterInteractions } from "../../hooks/useAfterInteractions";
import ServerSelectionModal from "../../components/ServerSelectionModal";
import * as avatarCache from "../../utils/avatarCache";
import { LIST_PERF } from "../../utils/listConfig";
import { longDateLabelWithYear, parseDateKey } from "../../utils/dateKeys";
import { getDocsByIds } from "../../utils/firestoreBatch";
import useServeDates from "../../hooks/useServeDates";

const NOTIFICATION_URL =
  "https://us-central1-taksis-a8ba7.cloudfunctions.net/traffic_notification";

const DATE_FORMATS = {
  SCHEDULE: "MM-DD-YY",
  LAST_SERVE: "MM-DD-YY",
};

const readings = [
  "matins",
  "third",
  "sixth",
  "pauline",
  "catholic",
  "praxis",
  "gospel",
  "water",
  "wine",
];

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
};

const STATUS_COLORS = {
  confirmed: "#34c759",
  unsure: "#ff9500",
  unavailable: "#ff3b30",
};

const STATUS_LABELS = {
  confirmed: "Confirmed",
  unsure: "Unsure",
  unavailable: "Unavailable",
};

const parseDate = (dateStr, format) => {
  if (!dateStr || typeof dateStr !== "string") return null;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return null;
  let day, month, year;
  if (format === DATE_FORMATS.SCHEDULE) {
    [month, day, year] = parts.map((p) => parseInt(p, 10));
  } else if (format === DATE_FORMATS.LAST_SERVE) {
    [day, month, year] = parts.map((p) => parseInt(p, 10));
  } else return null;
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const fullYear = year < 100 ? 2000 + year : year;
  const date = new Date(fullYear, month - 1, day);
  if (
    date.getFullYear() !== fullYear ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return null;
  return date;
};

const formatDate = (date, format = DATE_FORMATS.SCHEDULE) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return format === DATE_FORMATS.SCHEDULE
    ? `${month}-${day}-${year}`
    : `${day}-${month}-${year}`;
};

const getWeekStart = (date) => {
  const d = new Date(date);
  return new Date(d.setDate(d.getDate() - d.getDay()));
};

const generateWeeks = (startDate, count = 5) => {
  const weeks = [];
  const weekStart = getWeekStart(startDate);
  for (let i = 0; i < count; i++) {
    const weekDate = new Date(weekStart);
    weekDate.setDate(weekStart.getDate() + i * 7);
    weeks.push(formatDate(weekDate, DATE_FORMATS.SCHEDULE));
  }
  return weeks;
};

// Delegates to the cached label so `toLocaleDateString` doesn't run per row per
// render; the two special-case strings are this screen's own and stay here.
const formatWeekDisplay = (weekStr) => {
  if (!weekStr) return "Select Week";
  if (!parseDateKey(weekStr)) return "Invalid Date";
  return longDateLabelWithYear(weekStr);
};

/** One week in the picker. Label arrives precomputed and cached. */
const WeekItemRow = React.memo(({ week, label, isSelected, isArchived, onPress }) => (
  <TouchableOpacity
    style={[styles.modalItemContainer, isSelected && styles.selectedWeekItem]}
    onPress={() => onPress(week, isArchived)}
    activeOpacity={0.7}
  >
    <View style={styles.weekItemContent}>
      <Text style={[styles.modalItem, isSelected && styles.selectedWeekText]}>
        {label}
      </Text>
      {isArchived && <Text style={styles.archivedLabel}>Archived</Text>}
    </View>
    {isSelected && <Text style={styles.checkmark}>✓</Text>}
  </TouchableOpacity>
));
WeekItemRow.displayName = "WeekItemRow";

const weekKeyExtractor = (item) => item;
const WeekSeparator = () => <View style={styles.separator} />;

const StatusBadge = ({ status, align = "left" }) => {
  if (!status || !STATUS_LABELS[status]) return null;
  return (
    <View
      style={[styles.statusBadge, align === "right" && styles.statusBadgeRight]}
    >
      <View
        style={[styles.statusDot, { backgroundColor: STATUS_COLORS[status] }]}
      />
      <Text style={[styles.statusText, { color: STATUS_COLORS[status] }]}>
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
};

const EditSchedule = () => {
  const user = getAuth().currentUser;
  const scrollViewRef = useRef(null);
  // Hold reads until the drawer transition finishes animating.
  const ready = useAfterInteractions();
  const [churchId, setChurchId] = useState(null);
  const [week, setWeek] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [availableWeeks, setAvailableWeeks] = useState([]);
  // This screen had no loading state at all — it rendered with empty arrays,
  // so you saw a bare shell until the reads happened to land.
  const [weeksLoaded, setWeeksLoaded] = useState(false);
  const [archivedWeeks, setArchivedWeeks] = useState([]);
  const [showArchivedWeeks, setShowArchivedWeeks] = useState(false);
  const [isViewingArchived, setIsViewingArchived] = useState(false);
  const [showWeekSelector, setShowWeekSelector] = useState(false);
  const [servers, setServers] = useState([]);
  const [assignedReaders, setAssignedReaders] = useState({});
  const [assignedServers, setAssignedServers] = useState({});
  const [altarServers, setAltarServers] = useState([]);
  const [currentReaders, setCurrentReaders] = useState({});
  const [availableServers, setAvailableServers] = useState([]);
  const [serverDropdownIndex, setServerDropdownIndex] = useState(null);
  const [readerDropdownIndex, setReaderDropdownIndex] = useState(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [altarServersCount, setAltarServersCount] = useState(0);
  const [showInfoModal, setShowInfoModal] = useState(false);
  // One chunked listener for the whole roster instead of one per servant.
  const {
    lastServeData,
    nextServeData,
    watchServers: setupUserListeners,
    stopWatching: cleanupUserListeners,
  } = useServeDates();
  // The schedule's `extra` list exactly as stored, unfiltered and unsorted.
  // `availableServers` below is the display copy — filtered and alphabetised — so
  // it cannot answer "who does add_server move into the altar next?", which is
  // always the raw extra[0]. A ref rather than state: nothing renders from it.
  const rawExtraRef = useRef([]);

  // Notification state
  const [notifyVisible, setNotifyVisible] = useState(false);
  const [notifyTokens, setNotifyTokens] = useState([]);
  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyMsg, setNotifyMsg] = useState("");
  const [notifyDeaconName, setNotifyDeaconName] = useState("");
  const [deaconTokens, setDeaconTokens] = useState({});
  const [deaconIsChild, setDeaconIsChild] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(
      doc(getFirestore(), "users", user.uid),
      (doc) => {
        if (doc.exists) {
          const data = doc.data();
          if (data?.church && data.church !== churchId)
            setChurchId(data.church);
          else if (!data?.church) setWeeksLoaded(true);
        } else {
          setWeeksLoaded(true);
        }
      },
      (err) => console.error("Error fetching user:", err)
    );
    return () => unsub();
  }, [user.uid, churchId]);

  useEffect(() => {
    if (!churchId) return;
    const unsub = onSnapshot(
      doc(getFirestore(), "churches", churchId),
      (doc) => {
        if (doc.exists) setAltarServersCount(doc.data()?.altarServers || 0);
      },
      (err) => console.error("Error fetching church:", err)
    );
    return () => unsub();
  }, [churchId]);

  useEffect(() => {
    if (!churchId || !ready) return;
    const fetchSchedules = async () => {
      try {
        const snapshot = await getDocs(
          collection(getFirestore(), "churches", churchId, "schedule")
        );
        if (snapshot.empty) {
          const today = new Date();
          const nextSunday = getWeekStart(today);
          if (nextSunday <= today) nextSunday.setDate(nextSunday.getDate() + 7);
          setAvailableWeeks(generateWeeks(nextSunday, 5));
          return;
        }
        const scheduleDates = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            date: parseDate(doc.id, DATE_FORMATS.SCHEDULE),
          }))
          .filter((item) => item.date !== null)
          .sort((a, b) => a.date - b.date);
        if (scheduleDates.length === 0) {
          const today = new Date();
          const nextSunday = getWeekStart(today);
          if (nextSunday <= today) nextSunday.setDate(nextSunday.getDate() + 7);
          setAvailableWeeks(generateWeeks(nextSunday, 5));
          return;
        }
        let earliestSunday = scheduleDates.find(
          (d) => d.date.getDay() === 0,
        )?.date;
        if (!earliestSunday)
          earliestSunday = getWeekStart(scheduleDates[0].date);
        setAvailableWeeks(generateWeeks(earliestSunday, 5));
      } catch (err) {
        console.error("Error fetching schedules:", err);
        const today = new Date();
        const nextSunday = getWeekStart(today);
        if (nextSunday <= today) nextSunday.setDate(nextSunday.getDate() + 7);
        setAvailableWeeks(generateWeeks(nextSunday, 5));
      }
    };
    fetchSchedules().finally(() => setWeeksLoaded(true));
  }, [churchId, ready]);

  useEffect(() => {
    if (!churchId) return;
    const fetchArchivedWeeks = async () => {
      try {
        const snapshot = await getDocs(
          collection(getFirestore(), "churches", churchId, "archive")
        );
        const archived = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            date: parseDate(doc.id, DATE_FORMATS.SCHEDULE),
          }))
          .filter((item) => item.date !== null)
          .sort((a, b) => b.date - a.date)
          .map((item) => item.id);
        setArchivedWeeks(archived);
      } catch (err) {
        console.error("Error fetching archived weeks:", err);
        setArchivedWeeks([]);
      }
    };
    fetchArchivedWeeks();
  }, [churchId]);

  useEffect(() => {
    if (availableWeeks.length > 0 && !selectedWeek)
      setSelectedWeek(availableWeeks[0]);
  }, [availableWeeks, selectedWeek]);

  useEffect(() => {
    if (!churchId || !selectedWeek) return;

    const collectionPath = isViewingArchived ? "archive" : "schedule";

    // Listen to the one document we actually read. This used to subscribe to
    // the entire schedule/archive collection and then .find() the selected
    // week out of it, which meant every write to any other week re-delivered
    // and re-parsed the whole collection.
    const unsub = onSnapshot(
      doc(getFirestore(), "churches", churchId, collectionPath, selectedWeek),
      (scheduleDoc) => {
        if (scheduleDoc?.exists) {
          setWeek(selectedWeek);
          const data = scheduleDoc.data();
          const readersObj = {},
            readersDisplay = {};
          readings.forEach((reading) => {
            readersObj[reading] = data[reading];
            readersDisplay[displayNames[reading]] =
              data[reading]?.name || "Select Reader";
          });
          setCurrentReaders(readersObj);
          setAssignedReaders(readersDisplay);
          const fetchedAltarServers = data.altar || [];
          setAltarServers(fetchedAltarServers);
          const serverAssignments = {};
          fetchedAltarServers.forEach((server, i) => {
            serverAssignments[i] = server.name;
          });
          setAssignedServers(serverAssignments);
          setServers(
            fetchedAltarServers.map((_, i) => `Altar Server ${i + 1}`),
          );
          rawExtraRef.current = data.extra || [];
          const extraServers = (data.extra || [])
            .filter((s) => s.name !== "N/A" && s.uid)
            .sort((a, b) =>
              a.name
                .split(" ")[0]
                .toLowerCase()
                .localeCompare(b.name.split(" ")[0].toLowerCase()),
            );
          setAvailableServers(extraServers);

          // Collect all scheduled deacon UIDs for token fetching
          const scheduledUids = new Set();
          readings.forEach((reading) => {
            if (data[reading]?.uid) scheduledUids.add(data[reading].uid);
          });
          fetchedAltarServers.forEach((server) => {
            if (server?.uid) scheduledUids.add(server.uid);
          });
          fetchDeaconTokens(Array.from(scheduledUids));

          setupUserListeners(extraServers);
        } else {
          resetScheduleData();
        }
      }
    );
    return () => {
      unsub();
      cleanupUserListeners();
    };
  }, [churchId, selectedWeek, isViewingArchived]);

  /**
   * FCM tokens for the scheduled servants, falling back to a child's parent.
   *
   * Two chunked passes instead of up to 2n individual reads: one for the uids
   * themselves, then one for whichever of them turned out to be child profiles
   * pointing at a parent. Cost goes from 2n round-trips to
   * ceil(n/30) + ceil(parents/30).
   */
  const fetchDeaconTokens = async (uids) => {
    const tokens = {};
    const isChild = {};

    const docs = await getDocsByIds("users", uids);

    // Collect the parents we still need before reading any of them.
    const parentUidByChild = new Map();
    docs.forEach((data, uid) => {
      if (data?.fcmTokens && Object.keys(data.fcmTokens).length > 0) {
        tokens[uid] = data.fcmTokens;
        isChild[uid] = false;
      } else if (data?.parent) {
        parentUidByChild.set(uid, data.parent);
      }
    });

    if (parentUidByChild.size > 0) {
      const parents = await getDocsByIds(
        "users",
        Array.from(parentUidByChild.values())
      );
      parentUidByChild.forEach((parentUid, childUid) => {
        const parentData = parents.get(parentUid);
        if (parentData?.fcmTokens && Object.keys(parentData.fcmTokens).length > 0) {
          tokens[childUid] = parentData.fcmTokens;
          isChild[childUid] = true;
        }
      });
    }

    setDeaconTokens(tokens);
    setDeaconIsChild(isChild);
  };

  const resetScheduleData = () => {
    rawExtraRef.current = [];
    setWeek(selectedWeek);
    setCurrentReaders({});
    setAssignedReaders({});
    setAltarServers([]);
    setAssignedServers({});
    setServers([]);
    setAvailableServers([]);
    // Serve dates are cleared by cleanupUserListeners() below.
    setDeaconTokens({});
    setDeaconIsChild({});
    cleanupUserListeners();
  };

  const handleWeekSelect = (w, isArchived = false) => {
    setSelectedWeek(w);
    setIsViewingArchived(isArchived);
    setShowWeekSelector(false);
    setShowArchivedWeeks(false);
  };

  const openProfile = (userId) => {
    if (userId) {
      setSelectedUserId(userId);
      setProfileModalVisible(true);
    }
  };
  const closeProfile = () => {
    setSelectedUserId(null);
    setProfileModalVisible(false);
  };

  /**
   * `switched_weeks` bookkeeping for whichever week is being edited.
   *
   * The rule is symmetric, and deliberately so: taking somebody out of a slot for
   * `selectedWeek` records that week against them, and putting anybody into a slot
   * for that same week clears it again. Removing a deacon and then adding them
   * straight back therefore leaves no mark, instead of the old behaviour where the
   * entry stuck around once written.
   *
   * `arrayUnion`/`arrayRemove` on the stored week key means this stays idempotent
   * — two admins doing the same thing cannot produce a duplicate entry, and the
   * counts in DeaconEdits are a plain length.
   *
   * Best-effort by design. Children live on their parent's document and have no
   * `users` doc of their own, so `update` rejects for them; that must not undo a
   * schedule change the admin already made and saw take effect.
   */
  const updateSwitchedWeek = async (server, op) => {
    if (!server?.uid || !selectedWeek) return;
    // add_server backfills empty slots with `{name: "N/A", uid: <uuid>}`. Those
    // uuids are not people and have no user document.
    if (server.name === "N/A") return;
    try {
      await updateDoc(doc(getFirestore(), "users", server.uid), {
        switched_weeks:
          op === "add"
            ? arrayUnion(selectedWeek)
            : arrayRemove(selectedWeek),
      });
    } catch (err) {
      console.error("Error updating switched_weeks:", server.uid, err);
    }
  };

  // A swap always pulls the incoming servant out of `extra` (that is the only list
  // the selection modal offers), so the outgoing one lands in `extra` — i.e. off
  // the schedule for this week. Both sides of that are recorded.
  const applySwitch = async (outgoing, incoming) => {
    if (!outgoing?.uid || outgoing.uid === incoming?.uid) return;
    await Promise.all([
      updateSwitchedWeek(outgoing, "add"),
      updateSwitchedWeek(incoming, "remove"),
    ]);
  };

  const assignReader = async (index, newReader) => {
    if (!week || isViewingArchived) return;
    const readingKey = readings[index];
    const oldReader = currentReaders[readingKey];
    if (!oldReader?.uid) return;
    try {
      await callFunction(
        user,
        "https://switch-server-hy6oofbihq-uc.a.run.app",
        { church: churchId, week: week, firstServer: oldReader.uid, secondServer: newReader.uid },
        "Failed to assign reader.",
      );
      await applySwitch(oldReader, newReader);
    } catch (err) {
      console.error("Error assigning reader:", err);
    }
    setReaderDropdownIndex(null);
  };

  const assignServer = async (index, newServer) => {
    if (!week || isViewingArchived) return;
    const oldServer = altarServers[index];
    if (!oldServer?.uid) return;
    try {
      await callFunction(
        user,
        "https://switch-server-hy6oofbihq-uc.a.run.app",
        { church: churchId, week: week, firstServer: oldServer.uid, secondServer: newServer.uid },
        "Failed to assign server.",
      );
      await applySwitch(oldServer, newServer);
    } catch (err) {
      console.error("Error assigning server:", err);
    }
    setServerDropdownIndex(null);
  };

  const handleAddServer = async () => {
    if (!churchId || !week || servers.length >= 6 || isViewingArchived) return;
    // add_server always promotes the *first* raw extra, and remove_server puts the
    // person it removed at the front of that list — so this is exactly the deacon
    // who is about to go back into the altar, including the one just removed.
    const promoted = rawExtraRef.current[0];
    try {
      await callFunction(
        user,
        "https://add-server-hy6oofbihq-uc.a.run.app",
        { church: churchId, week: week },
        "Failed to add server.",
      );
      await updateDoc(
        doc(getFirestore(), "churches", churchId),
        { altarServers: increment(1) }
      );
      await updateSwitchedWeek(promoted, "remove");
      scrollViewRef.current?.scrollToEnd({ animated: false });
    } catch (err) {
      console.error("Error adding server:", err);
    }
  };

  const removeServerFromSchedule = async (index) => {
    if (!churchId || !week || isViewingArchived) return;
    const serverToRemove = altarServers[index];
    if (!serverToRemove?.uid) return;
    try {
      await callFunction(
        user,
        "https://remove-server-hy6oofbihq-uc.a.run.app",
        { church: churchId, week: week, server: serverToRemove.uid },
        "Failed to remove server.",
      );
      await updateDoc(
        doc(getFirestore(), "churches", churchId),
        { altarServers: increment(-1) }
      );
      await updateSwitchedWeek(serverToRemove, "add");
    } catch (err) {
      console.error("Error removing server:", err);
    }
  };

  // Notification functions
  const openNotify = (uid, name) => {
    const tokens = deaconTokens[uid];
    if (!tokens || Object.keys(tokens).length === 0) return;
    setNotifyTokens(Object.values(tokens));
    setNotifyDeaconName(name);
    const weekDisplay = formatWeekDisplay(selectedWeek);
    const isChild = deaconIsChild[uid];

    if (isChild) {
      // Message for parents
      setNotifyTitle("Your Child is Scheduled to Serve");
      setNotifyMsg(
        `${name} is scheduled to serve on ${weekDisplay}. Please open the app to confirm their availability.`,
      );
    } else {
      // Message for the deacon themselves
      setNotifyTitle("You're Scheduled to Serve");
      setNotifyMsg(
        `You are scheduled to serve on ${weekDisplay}. Please open the app to confirm your availability.`,
      );
    }
    setNotifyVisible(true);
  };

  const sendNotify = () => {
    if (!notifyTitle.trim() || !notifyMsg.trim()) {
      Alert.alert("Missing Info", "Please enter title and message.");
      return;
    }
    callFunction(
      user,
      NOTIFICATION_URL,
      {
        tokens: notifyTokens,
        title: notifyTitle.trim(),
        message: notifyMsg.trim(),
      },
      "Failed to send notification.",
    );
    setNotifyVisible(false);
    Alert.alert("Sent", "Notification sent.");
  };

  const displayedWeeks = showArchivedWeeks ? archivedWeeks : availableWeeks;

  // Was an inline renderItem calling formatWeekDisplay — i.e. Intl's
  // toLocaleDateString — for every mounted row on every render. The label is now
  // cached per date in utils/dateKeys.js.
  const renderWeekItem = useCallback(
    ({ item }) => (
      <WeekItemRow
        week={item}
        label={formatWeekDisplay(item)}
        isSelected={selectedWeek === item && isViewingArchived === showArchivedWeeks}
        isArchived={showArchivedWeeks}
        onPress={handleWeekSelect}
      />
    ),
    [selectedWeek, isViewingArchived, showArchivedWeeks, handleWeekSelect]
  );

  if (!ready || !weeksLoaded) {
    return <SkeletonScreen variant="cards" count={8} />;
  }

  return (
    <View style={styles.container}>
      {availableWeeks.length > 0 && (
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={[
              styles.weekSelector,
              isViewingArchived && styles.archivedWeekSelector,
            ]}
            onPress={() => setShowWeekSelector(true)}
            activeOpacity={0.8}
          >
            <View style={styles.weekSelectorContent}>
              <View style={styles.weekLabelRow}>
                <Text style={styles.weekLabel}>Week of</Text>
                {isViewingArchived && (
                  <View style={styles.archivedBadge}>
                    <Text style={styles.archivedBadgeText}>Archived</Text>
                  </View>
                )}
              </View>
              <Text style={styles.weekSelectorText}>
                {formatWeekDisplay(selectedWeek)}
              </Text>
            </View>
            <View style={styles.weekSelectorIconContainer}>
              <Text style={styles.weekSelectorIcon}>▼</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {isViewingArchived && (
        <View style={styles.archivedBanner}>
          <Text style={styles.archivedBannerText}>
            Viewing archived week (read-only)
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 90 }}
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>Assign Readers</Text>
        </View>
        {readings.map((item, index) => {
          const reader = currentReaders[item];
          const readerStatus = reader?.status;
          const hasToken = reader?.uid && !!deaconTokens[reader.uid];
          return (
            <TouchableOpacity
              key={index}
              style={styles.listItem}
              onPress={() => openProfile(reader?.uid)}
              disabled={!reader?.uid}
              activeOpacity={1}
            >
              <View style={styles.listItemContent}>
                <View style={styles.readerLeftContent}>
                  <Text
                    style={[
                      styles.itemText,
                      !reader?.uid && styles.disabledText,
                    ]}
                  >
                    {displayNames[item]}
                  </Text>
                  <StatusBadge status={readerStatus} align="right" />
                </View>
                <View style={styles.readerRightContent}>
                  {!isViewingArchived && hasToken && (
                    <TouchableOpacity
                      style={styles.notifyBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        openNotify(reader.uid, reader.name);
                      }}
                    >
                      <Icon name="bell-outline" size={18} color="#ff9f0a" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.dropdown,
                      isViewingArchived && styles.disabledDropdown,
                    ]}
                    onPress={() =>
                      !isViewingArchived && setReaderDropdownIndex(index)
                    }
                    disabled={isViewingArchived}
                  >
                    <Text style={styles.dropdownText}>
                      {assignedReaders[displayNames[item]] || "Select Reader"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={styles.altarSectionHeaderContainer}>
          <Text style={styles.sectionHeader}>Altar Servers</Text>
          <View style={styles.serverInfoContainer}>
            <Text style={styles.serverCountText}>
              {altarServersCount} additional servers
            </Text>
            <TouchableOpacity
              onPress={() => setShowInfoModal(true)}
              style={styles.infoButton}
            >
              <Text style={styles.infoIcon}>ⓘ</Text>
            </TouchableOpacity>
          </View>
        </View>
        {servers.map((_, index) => {
          const server = altarServers[index];
          const serverStatus = server?.status;
          const hasToken = server?.uid && !!deaconTokens[server.uid];
          return (
            <TouchableOpacity
              key={index}
              style={styles.listItem}
              onPress={() => openProfile(server?.uid)}
              disabled={!server?.uid}
              activeOpacity={1}
            >
              <View style={styles.serverItemContent}>
                <View style={styles.serverLeftContent}>
                  <View style={styles.serverDropdownRow}>
                    <TouchableOpacity
                      style={[
                        styles.dropdown,
                        isViewingArchived && styles.disabledDropdown,
                      ]}
                      onPress={() =>
                        !isViewingArchived && setServerDropdownIndex(index)
                      }
                      disabled={isViewingArchived}
                    >
                      <Text
                        style={[
                          styles.dropdownText,
                          !server?.uid && styles.disabledText,
                        ]}
                      >
                        {assignedServers[index] || "Select Server"}
                      </Text>
                    </TouchableOpacity>
                    {!isViewingArchived && hasToken && (
                      <TouchableOpacity
                        style={styles.notifyBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          openNotify(server.uid, server.name);
                        }}
                      >
                        <Icon name="bell-outline" size={18} color="#ff9f0a" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <StatusBadge status={serverStatus} align="left" />
                </View>
                {!isViewingArchived && (
                  <TouchableOpacity
                    onPress={() => removeServerFromSchedule(index)}
                  >
                    <Text style={styles.removeButton}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {!isViewingArchived && (
        <TouchableOpacity style={styles.addButton} onPress={handleAddServer}>
          <Text style={styles.addButtonText}>Add Extra Altar Server</Text>
        </TouchableOpacity>
      )}

      <ServerSelectionModal
        visible={serverDropdownIndex !== null && !isViewingArchived}
        onClose={() => setServerDropdownIndex(null)}
        onSelect={(server) => assignServer(serverDropdownIndex, server)}
        servers={availableServers}
        lastServeData={lastServeData}
        nextServeData={nextServeData}
        selectedWeek={selectedWeek}
        title="Select Server"
        showNextServe={true}
      />
      <ServerSelectionModal
        visible={readerDropdownIndex !== null && !isViewingArchived}
        onClose={() => setReaderDropdownIndex(null)}
        onSelect={(reader) => assignReader(readerDropdownIndex, reader)}
        servers={availableServers}
        lastServeData={lastServeData}
        nextServeData={nextServeData}
        selectedWeek={selectedWeek}
        title="Select Reader"
        showNextServe={true}
      />

      <Modal
        visible={showWeekSelector}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowWeekSelector(false);
          setShowArchivedWeeks(false);
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowWeekSelector(false);
            setShowArchivedWeeks(false);
          }}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalWrapper}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {showArchivedWeeks ? "Archived Weeks" : "Select Week"}
                </Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => {
                    setShowWeekSelector(false);
                    setShowArchivedWeeks(false);
                  }}
                >
                  <Text style={styles.modalCloseX}>×</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                {...LIST_PERF}
                data={displayedWeeks}
                keyExtractor={weekKeyExtractor}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={() => (
                  <View style={styles.emptyListContainer}>
                    <Text style={styles.emptyListText}>
                      {showArchivedWeeks
                        ? "No archived weeks found"
                        : "No weeks available"}
                    </Text>
                  </View>
                )}
                renderItem={renderWeekItem}
                ItemSeparatorComponent={WeekSeparator}
                ListFooterComponent={() =>
                  archivedWeeks.length > 0 && !showArchivedWeeks ? (
                    <TouchableOpacity
                      style={styles.archiveToggle}
                      onPress={() => setShowArchivedWeeks(true)}
                    >
                      <Text style={styles.archiveToggleText}>
                        View previous weeks
                      </Text>
                    </TouchableOpacity>
                  ) : showArchivedWeeks ? (
                    <TouchableOpacity
                      style={styles.archiveToggle}
                      onPress={() => setShowArchivedWeeks(false)}
                    >
                      <Text style={styles.archiveToggleText}>
                        ← Back to current weeks
                      </Text>
                    </TouchableOpacity>
                  ) : null
                }
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowInfoModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.infoModalWrapper}>
            <View style={styles.infoModalContent}>
              <View style={styles.infoModalHeader}>
                <Text style={styles.infoModalTitle}>Additional Servers</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowInfoModal(false)}
                >
                  <Text style={styles.modalCloseX}>×</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.infoModalText}>
                When you add or remove altar servers, the change automatically
                applies to all future weeks to maintain consistency across your
                church's schedule.
                {"\n\n"}
                This ensures that the same number of server positions are
                available each week, making it easier to plan and assign servers
                for upcoming services.
              </Text>
              <TouchableOpacity
                style={styles.infoModalButton}
                onPress={() => setShowInfoModal(false)}
              >
                <Text style={styles.infoModalButtonText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Notification Modal */}
      {notifyVisible && (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.notifyOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.notifyAvoid}
            >
              <TouchableWithoutFeedback>
                <View style={styles.notifyModal}>
                  <View style={styles.notifyIconWrap}>
                    <Icon name="bell-ring" size={28} color="#ff9f0a" />
                  </View>
                  <Text style={styles.notifyTitleText}>Send Notification</Text>
                  <Text style={styles.notifySubtitle}>
                    Notify {notifyDeaconName}
                  </Text>

                  <Text style={styles.notifyLabel}>Title</Text>
                  <TextInput
                    style={styles.notifyInput}
                    placeholder="Notification title"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={notifyTitle}
                    onChangeText={setNotifyTitle}
                    autoFocus
                    returnKeyType="next"
                  />

                  <Text style={styles.notifyLabel}>Message</Text>
                  <TextInput
                    style={[styles.notifyInput, styles.notifyTextarea]}
                    placeholder="Notification message"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                    value={notifyMsg}
                    onChangeText={setNotifyMsg}
                    multiline
                    textAlignVertical="top"
                  />

                  <View style={styles.notifyBtns}>
                    <TouchableOpacity
                      style={styles.notifyCancelBtn}
                      onPress={() => setNotifyVisible(false)}
                    >
                      <Text style={styles.notifyCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.notifySendBtn}
                      onPress={sendNotify}
                    >
                      <Icon name="send" size={16} color="#fff" />
                      <Text style={styles.notifySendText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      )}

      <IndividualProfile
        userId={selectedUserId}
        show={profileModalVisible}
        onClose={closeProfile}
        church={churchId}
        week={selectedWeek}
        currentEditingWeek={selectedWeek}
        family={null}
        url="https://unavailable-for-week-hy6oofbihq-uc.a.run.app"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212", padding: 20 },
  headerContainer: { marginBottom: 24 },
  scrollView: { flex: 1 },
  sectionHeader: { fontSize: 22, color: "#4d9cff", fontWeight: "600" },
  sectionHeaderContainer: { marginBottom: 14, marginTop: 10 },
  altarSectionHeaderContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 14,
    marginTop: 20,
  },
  serverInfoContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginLeft: 12,
  },
  serverCountText: { fontSize: 13, color: "rgba(255,255,255,0.4)" },
  infoButton: { paddingHorizontal: 4 },
  infoIcon: { fontSize: 13, color: "rgba(255,255,255,0.4)" },
  listItem: {
    backgroundColor: "#1a1a1a",
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  listItemContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  readerLeftContent: {
    flexDirection: "column",
    alignItems: "flex-start",
    flex: 1,
  },
  readerRightContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  serverItemContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  serverLeftContent: {
    flexDirection: "column",
    alignItems: "flex-start",
    flex: 1,
  },
  serverDropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  disabledText: { color: "rgba(255,255,255,0.4)" },
  dropdownContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  dropdown: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  disabledDropdown: {
    opacity: 0.5,
  },
  dropdownText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    fontWeight: "500",
  },
  removeButton: { color: "#ff3b30", fontSize: 15, fontWeight: "600" },
  notifyBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,159,10,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    backgroundColor: "#147efb",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: "center",
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  addButtonText: { fontSize: 16, color: "#fff", fontWeight: "600" },
  weekSelector: {
    backgroundColor: "#1a1a1a",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  archivedWeekSelector: {
    borderColor: "rgba(255, 149, 0, 0.3)",
  },
  weekSelectorContent: { flex: 1 },
  weekLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  weekLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  archivedBadge: {
    backgroundColor: "rgba(255, 149, 0, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 10,
  },
  archivedBadgeText: {
    color: "#ff9500",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  weekSelectorText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  weekSelectorIconContainer: {
    backgroundColor: "rgba(255,255,255,0.05)",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  weekSelectorIcon: { color: "#4d9cff", fontSize: 12 },
  archivedBanner: {
    backgroundColor: "rgba(255, 149, 0, 0.15)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 149, 0, 0.3)",
  },
  archivedBannerText: {
    color: "#ff9500",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalWrapper: { width: "90%", maxHeight: "70%" },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "600" },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseX: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 24,
    fontWeight: "300",
    marginTop: -2,
  },
  archiveToggle: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  archiveToggleText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontWeight: "400",
    textAlign: "center",
  },
  modalItemContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  weekItemContent: {
    flex: 1,
  },
  modalItem: { color: "#fff", fontSize: 16, fontWeight: "500" },
  archivedLabel: {
    color: "rgba(255, 149, 0, 0.7)",
    fontSize: 12,
    marginTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginHorizontal: 20,
  },
  checkmark: { color: "#4d9cff", fontSize: 18, fontWeight: "600" },
  selectedWeekItem: { backgroundColor: "rgba(77, 156, 255, 0.1)" },
  selectedWeekText: { color: "#4d9cff", fontWeight: "600" },
  emptyListContainer: {
    paddingVertical: 30,
    alignItems: "center",
  },
  emptyListText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
  },
  infoModalWrapper: { width: "85%", maxWidth: 400 },
  infoModalContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  infoModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  infoModalTitle: { color: "#fff", fontSize: 20, fontWeight: "600" },
  infoModalText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    lineHeight: 24,
    padding: 20,
  },
  infoModalButton: {
    backgroundColor: "#147efb",
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  infoModalButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  statusBadgeRight: {
    alignSelf: "flex-start",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  // Notification Modal Styles
  notifyOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  notifyAvoid: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  notifyModal: {
    backgroundColor: "#1a1a1a",
    borderRadius: 24,
    width: "90%",
    maxWidth: 360,
    padding: 24,
  },
  notifyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,159,10,0.12)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  notifyTitleText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
  },
  notifySubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 24,
  },
  notifyLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.5)",
    marginBottom: 8,
  },
  notifyInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 15,
    marginBottom: 16,
  },
  notifyTextarea: { height: 100, paddingTop: 14 },
  notifyBtns: { flexDirection: "row", gap: 12, marginTop: 8 },
  notifyCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  notifyCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.7)",
  },
  notifySendBtn: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#ff9f0a",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  notifySendText: { fontSize: 15, fontWeight: "600", color: "#fff" },
});

export default EditSchedule;
