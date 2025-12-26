import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  FlatList,
  Modal,
} from "react-native";
import firestore, { FieldValue } from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import callFunction from "../components/functionCalls";
import IndividualProfile from "../components/individualProfile";
import ServerSelectionModal from "../components/ServerSelectionModal";
import { FirestoreCache, StorageCache } from "../utils/cacheManager";

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

const formatWeekDisplay = (weekStr) => {
  if (!weekStr) return "Select Week";
  const date = parseDate(weekStr, DATE_FORMATS.SCHEDULE);
  if (!date) return "Invalid Date";
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const EditSchedule = () => {
  const user = auth().currentUser;
  const scrollViewRef = useRef(null);
  const [churchId, setChurchId] = useState(null);
  const [week, setWeek] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [availableWeeks, setAvailableWeeks] = useState([]);
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
  const [imageUrls, setImageUrls] = useState({});
  const [altarServersCount, setAltarServersCount] = useState(0);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [lastServeData, setLastServeData] = useState({});
  const [nextServeData, setNextServeData] = useState({});
  const [userListeners, setUserListeners] = useState([]);

  useEffect(() => {
    const unsub = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        (doc) => {
          if (doc.exists) {
            const data = doc.data();
            if (data?.church && data.church !== churchId)
              setChurchId(data.church);
          }
        },
        (err) => console.error("Error fetching user:", err)
      );
    return () => unsub();
  }, [user.uid, churchId]);

  useEffect(() => {
    if (!churchId) return;
    const unsub = firestore()
      .collection("churches")
      .doc(churchId)
      .onSnapshot(
        (doc) => {
          if (doc.exists) setAltarServersCount(doc.data()?.altarServers || 0);
        },
        (err) => console.error("Error fetching church:", err)
      );
    return () => unsub();
  }, [churchId]);

  useEffect(() => {
    if (!churchId) return;
    const fetchSchedules = async () => {
      try {
        const snapshot = await firestore()
          .collection("churches")
          .doc(churchId)
          .collection("schedule")
          .get();
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
          (d) => d.date.getDay() === 0
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
    fetchSchedules();
  }, [churchId]);

  useEffect(() => {
    if (availableWeeks.length > 0 && !selectedWeek)
      setSelectedWeek(availableWeeks[0]);
  }, [availableWeeks, selectedWeek]);

  useEffect(() => {
    if (!churchId || !selectedWeek) return;
    const unsub = firestore()
      .collection("churches")
      .doc(churchId)
      .collection("schedule")
      .onSnapshot((snapshot) => {
        const scheduleDoc = snapshot.docs.find(
          (doc) => doc.id === selectedWeek
        );
        if (scheduleDoc) {
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
            fetchedAltarServers.map((_, i) => `Altar Server ${i + 1}`)
          );
          const extraServers = (data.extra || [])
            .filter((s) => s.name !== "N/A" && s.uid)
            .sort((a, b) =>
              a.name
                .split(" ")[0]
                .toLowerCase()
                .localeCompare(b.name.split(" ")[0].toLowerCase())
            );
          setAvailableServers(extraServers);
          setupUserListeners(extraServers);
        } else {
          resetScheduleData();
        }
      });
    return () => {
      unsub();
      cleanupUserListeners();
    };
  }, [churchId, selectedWeek]);

  useEffect(() => () => cleanupUserListeners(), []);

  const setupUserListeners = (servers) => {
    cleanupUserListeners();
    const newListeners = [];
    servers.forEach((server, idx) => {
      const storagePath = `profilePictures/${server.uid}.png`;
      setTimeout(
        async () => {
          try {
            const url = await StorageCache.getDownloadURL(storagePath);
            setImageUrls((prev) => ({ ...prev, [server.uid]: url }));
          } catch {
            storage()
              .ref(storagePath)
              .getDownloadURL()
              .then((url) =>
                setImageUrls((prev) => ({ ...prev, [server.uid]: url }))
              )
              .catch(() => {});
          }
        },
        idx === 0 ? 0 : Math.random() * 500
      );
      const unsub = firestore()
        .collection("users")
        .doc(server.uid)
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              const userData = doc.data();
              setLastServeData((prev) =>
                userData.lastServe
                  ? { ...prev, [server.uid]: userData.lastServe }
                  : (({ [server.uid]: _, ...rest }) => rest)(prev)
              );
              setNextServeData((prev) =>
                userData.nextWeekServe
                  ? { ...prev, [server.uid]: userData.nextWeekServe }
                  : (({ [server.uid]: _, ...rest }) => rest)(prev)
              );
            }
          },
          (err) => console.error("Error listening to user:", server.uid, err)
        );
      newListeners.push(unsub);
    });
    setUserListeners(newListeners);
  };

  const cleanupUserListeners = () => {
    userListeners.forEach((unsub) => typeof unsub === "function" && unsub());
    setUserListeners([]);
  };

  const resetScheduleData = () => {
    setWeek(selectedWeek);
    setCurrentReaders({});
    setAssignedReaders({});
    setAltarServers([]);
    setAssignedServers({});
    setServers([]);
    setAvailableServers([]);
    setImageUrls({});
    setLastServeData({});
    setNextServeData({});
    cleanupUserListeners();
  };

  const handleWeekSelect = (w) => {
    setSelectedWeek(w);
    setShowWeekSelector(false);
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

  const assignReader = async (index, newReader) => {
    if (!week) return;
    const readingKey = readings[index];
    const oldReader = currentReaders[readingKey];
    if (!oldReader?.uid) return;
    try {
      await callFunction(
        user,
        "https://switch-server-hy6oofbihq-uc.a.run.app",
        {
          church: churchId,
          week: week,
          firstServer: oldReader.uid,
          secondServer: newReader.uid,
        },
        "Failed to assign reader."
      );
    } catch (err) {
      console.error("Error assigning reader:", err);
    }
    setReaderDropdownIndex(null);
  };

  const assignServer = async (index, newServer) => {
    if (!week) return;
    const oldServer = altarServers[index];
    if (!oldServer?.uid) return;
    try {
      await callFunction(
        user,
        "https://switch-server-hy6oofbihq-uc.a.run.app",
        {
          church: churchId,
          week: week,
          firstServer: oldServer.uid,
          secondServer: newServer.uid,
        },
        "Failed to assign server."
      );
    } catch (err) {
      console.error("Error assigning server:", err);
    }
    setServerDropdownIndex(null);
  };

  const handleAddServer = async () => {
    if (!churchId || !week || servers.length >= 6) return;
    try {
      await callFunction(
        user,
        "https://add-server-hy6oofbihq-uc.a.run.app",
        { church: churchId, week: week },
        "Failed to add server."
      );
      await firestore()
        .collection("churches")
        .doc(churchId)
        .update({ altarServers: FieldValue.increment(1) });
      scrollViewRef.current?.scrollToEnd({ animated: false });
    } catch (err) {
      console.error("Error adding server:", err);
    }
  };

  const removeServerFromSchedule = async (index) => {
    if (!churchId || !week) return;
    const serverToRemove = altarServers[index];
    if (!serverToRemove?.uid) return;
    try {
      await callFunction(
        user,
        "https://remove-server-hy6oofbihq-uc.a.run.app",
        { church: churchId, week: week, server: serverToRemove.uid },
        "Failed to remove server."
      );
      await firestore()
        .collection("churches")
        .doc(churchId)
        .update({ altarServers: FieldValue.increment(-1) });
    } catch (err) {
      console.error("Error removing server:", err);
    }
  };

  return (
    <View style={styles.container}>
      {availableWeeks.length > 0 && (
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.weekSelector}
            onPress={() => setShowWeekSelector(true)}
            activeOpacity={0.8}
          >
            <View style={styles.weekSelectorContent}>
              <Text style={styles.weekLabel}>Week of</Text>
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 90 }}
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeaderContainer}>
          <Text style={styles.sectionHeader}>Assign Readers</Text>
        </View>
        {readings.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.listItem}
            onPress={() => openProfile(currentReaders[item]?.uid)}
            disabled={!currentReaders[item]?.uid}
            activeOpacity={1}
          >
            <View style={styles.listItemContent}>
              <Text
                style={[
                  styles.itemText,
                  !currentReaders[item]?.uid && styles.disabledText,
                ]}
              >
                {displayNames[item]}
              </Text>
              <View style={styles.dropdownContainer}>
                <TouchableOpacity
                  style={styles.dropdown}
                  onPress={() => setReaderDropdownIndex(index)}
                >
                  <Text style={styles.dropdownText}>
                    {assignedReaders[displayNames[item]] || "Select Reader"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))}

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
        {servers.map((_, index) => (
          <TouchableOpacity
            key={index}
            style={styles.listItem}
            onPress={() => openProfile(altarServers[index]?.uid)}
            disabled={!altarServers[index]?.uid}
            activeOpacity={1}
          >
            <View style={styles.listItemContent}>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setServerDropdownIndex(index)}
              >
                <Text
                  style={[
                    styles.dropdownText,
                    !altarServers[index]?.uid && styles.disabledText,
                  ]}
                >
                  {assignedServers[index] || "Select Server"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeServerFromSchedule(index)}>
                <Text style={styles.removeButton}>Remove</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.addButton} onPress={handleAddServer}>
        <Text style={styles.addButtonText}>Add Server</Text>
      </TouchableOpacity>

      <ServerSelectionModal
        visible={serverDropdownIndex !== null}
        onClose={() => setServerDropdownIndex(null)}
        onSelect={(server) => assignServer(serverDropdownIndex, server)}
        servers={availableServers}
        imageUrls={imageUrls}
        lastServeData={lastServeData}
        nextServeData={nextServeData}
        selectedWeek={selectedWeek}
        title="Select Server"
        showNextServe={true}
      />
      <ServerSelectionModal
        visible={readerDropdownIndex !== null}
        onClose={() => setReaderDropdownIndex(null)}
        onSelect={(reader) => assignReader(readerDropdownIndex, reader)}
        servers={availableServers}
        imageUrls={imageUrls}
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
        onRequestClose={() => setShowWeekSelector(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowWeekSelector(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalWrapper}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Week</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowWeekSelector(false)}
                >
                  <Text style={styles.modalCloseX}>×</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={availableWeeks}
                keyExtractor={(item) => item}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.modalItemContainer,
                      selectedWeek === item && styles.selectedWeekItem,
                    ]}
                    onPress={() => handleWeekSelect(item)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.modalItem,
                        selectedWeek === item && styles.selectedWeekText,
                      ]}
                    >
                      {formatWeekDisplay(item)}
                    </Text>
                    {selectedWeek === item && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  dropdownText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    fontWeight: "500",
  },
  removeButton: { color: "#ff3b30", fontSize: 15, fontWeight: "600" },
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
  weekSelectorContent: { flex: 1 },
  weekLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 2,
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
  modalItemContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  modalItem: { color: "#fff", fontSize: 16, fontWeight: "500" },
  separator: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginHorizontal: 20,
  },
  checkmark: { color: "#4d9cff", fontSize: 18, fontWeight: "600" },
  selectedWeekItem: { backgroundColor: "rgba(77, 156, 255, 0.1)" },
  selectedWeekText: { color: "#4d9cff", fontWeight: "600" },
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
});

export default EditSchedule;