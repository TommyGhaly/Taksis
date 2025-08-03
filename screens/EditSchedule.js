import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  FlatList,
  Modal,
  Image,
} from "react-native";
import firestore, { FieldValue } from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import {
  removeServer as removeServerAPI,
  addServer as addServerAPI,
  switchServers as switchServersAPI,
} from "../components/functionCalls";
import IndividualProfile from "../components/individualProfile";

// Sample readings list and display names mapping
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

// Helper function to format date
const formatDate = (date) => {
  if (!date) return "N/A";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${month}-${day}-${year}`;
};

// Helper function to get next 5 weeks
const getNextFiveWeeks = () => {
  const weeks = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the next Sunday
  const dayOfWeek = today.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysUntilSunday);

  for (let i = 0; i < 5; i++) {
    const weekDate = new Date(nextSunday);
    weekDate.setDate(nextSunday.getDate() + (i * 7));
    weeks.push(formatDate(weekDate));
  }

  return weeks;
};

const EditSchedule = () => {
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
  const [imageUrls, setImageUrls] = useState({}); // Store image URLs for deacons
  const [altarServersCount, setAltarServersCount] = useState(0);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const scrollViewRef = useRef(null);
  const user = auth().currentUser;

  // Initialize available weeks
  useEffect(() => {
    const weeks = getNextFiveWeeks();
    setAvailableWeeks(weeks);
  }, []);

  // Realtime listener for user doc to update churchId
  useEffect(() => {
    const unsubscribeUser = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        (doc) => {
          if (doc.exists) {
            const userData = doc.data();
            if (userData?.church && userData.church !== churchId) {
              setChurchId(userData.church);
            }
          }
        },
        (error) => {
          // Error handling for user data fetch
        }
      );
    return () => unsubscribeUser();
  }, [user.uid, churchId]);

  // Listener for church document to get altarServers count
  useEffect(() => {
    if (churchId) {
      const unsubscribeChurch = firestore()
        .collection("churches")
        .doc(churchId)
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              const churchData = doc.data();
              setAltarServersCount(churchData?.altarServers || 0);
            }
          },
          (error) => {
            // Error handling for church data fetch
          }
        );
      return () => unsubscribeChurch();
    }
  }, [churchId]);

  // Query schedule subcollection for selected week and fetch image URLs
  useEffect(() => {
    if (churchId && selectedWeek) {
      const schedulesRef = firestore()
        .collection("churches")
        .doc(churchId)
        .collection("schedule");

      const unsubscribe = schedulesRef.onSnapshot((snapshot) => {
        const scheduleDoc = snapshot.docs.find(doc => doc.id === selectedWeek);
        
        if (scheduleDoc) {
          setWeek(selectedWeek);
          const scheduleForTheWeek = scheduleDoc.data();

          const readersObj = {};
          const readersDisplay = {};
          readings.forEach((reading) => {
            const reader = scheduleForTheWeek[reading];
            readersObj[reading] = reader;
            readersDisplay[displayNames[reading]] = reader?.name || "Select Reader";
          });
          setCurrentReaders(readersObj);
          setAssignedReaders(readersDisplay);

          const fetchedAltarServers = scheduleForTheWeek.altar || [];
          setAltarServers(fetchedAltarServers);
          const initialServerAssignments = {};
          fetchedAltarServers.forEach((server, index) => {
            initialServerAssignments[index] = server.name;
          });
          setAssignedServers(initialServerAssignments);
          setServers(fetchedAltarServers.map((_, index) => `Altar Server ${index + 1}`));

          // Use the 'extra' array from the schedule for available servers
          const extraServers = scheduleForTheWeek.extra || [];
          const filteredExtraServers = extraServers
            .filter((server) => server.name !== "N/A" && server.uid)
            .sort((a, b) => {
              const nameA = a.name.split(" ")[0].toLowerCase();
              const nameB = b.name.split(" ")[0].toLowerCase();
              return nameA.localeCompare(nameB);
            });
          setAvailableServers(filteredExtraServers);

          // Fetch image URLs for extra servers
          const fetchImages = async () => {
            const newImageUrls = {};
            for (const server of filteredExtraServers) {
              try {
                const storagePath = `profilePictures/${server.uid}.png`;
                const url = await storage().ref(storagePath).getDownloadURL();
                if (typeof url === "string" && url.trim() !== "") {
                  newImageUrls[server.uid] = url;
                } else {
                  newImageUrls[server.uid] = null;
                }
              } catch (error) {
                newImageUrls[server.uid] = null;
              }
            }
            setImageUrls(newImageUrls);
          };
          fetchImages();
        } else {
          // If no schedule exists for this week, create empty state
          setWeek(selectedWeek);
          setCurrentReaders({});
          setAssignedReaders({});
          setAltarServers([]);
          setAssignedServers({});
          setServers([]);
          setAvailableServers([]);
          setImageUrls({});
        }
      });

      return () => unsubscribe();
    }
  }, [churchId, selectedWeek]);

  // Set initial week when available weeks are loaded
  useEffect(() => {
    if (availableWeeks.length > 0 && !selectedWeek) {
      setSelectedWeek(availableWeeks[0]);
    }
  }, [availableWeeks, selectedWeek]);

  // Handle week selection
  const handleWeekSelect = (week) => {
    setSelectedWeek(week);
    setShowWeekSelector(false);
  };

  // Format week display
  const formatWeekDisplay = (weekStr) => {
    if (!weekStr) return "Select Week";
    const [month, day, year] = weekStr.split("-").map(Number);
    const date = new Date(2000 + year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Open profile modal
  const openProfile = (userId) => {
    if (!userId) {
      return;
    }
    setSelectedUserId(userId);
    setProfileModalVisible(true);
  };

  // Close profile modal
  const closeProfile = () => {
    setSelectedUserId(null);
    setProfileModalVisible(false);
  };

  // Assign reader
  const assignReader = async (index, newReader) => {
    if (!week) {
      return;
    }
    const readingKey = readings[index];
    const oldReader = currentReaders[readingKey];
    if (!oldReader || !oldReader.uid) {
      return;
    }
    try {
      await switchServersAPI(
        user,
        churchId,
        week,
        oldReader.uid,
        newReader.uid,
        "https://switch-server-hy6oofbihq-uc.a.run.app"
      );
    } catch (error) {
      // Error handling for reader assignment
    }
    setReaderDropdownIndex(null);
  };

  // Assign server
  const assignServer = async (index, newServer) => {
    if (!week) {
      return;
    }
    const oldServer = altarServers[index];
    if (!oldServer || !oldServer.uid) {
      return;
    }
    try {
      await switchServersAPI(
        user,
        churchId,
        week,
        oldServer.uid,
        newServer.uid,
        "https://switch-server-hy6oofbihq-uc.a.run.app"
      );
    } catch (error) {
      // Error handling for server assignment
    }
    setServerDropdownIndex(null);
  };

  // Add server
  const handleAddServer = async () => {
    if (!churchId || !week) {
      return;
    }
    if (servers.length >= 6) {
      return;
    }
    try {
      await addServerAPI(
        user,
        churchId,
        week,
        "https://add-server-hy6oofbihq-uc.a.run.app"
      );
      const churchRef = firestore().collection("churches").doc(churchId);
      await churchRef.update({
        altarServers: FieldValue.increment(1),
      });
      scrollViewRef.current?.scrollToEnd({ animated: false });
    } catch (error) {
      // Error handling for server addition
    }
  };

  // Remove server
  const removeServerFromSchedule = async (index) => {
    if (!churchId || !week) {
      return;
    }
    const schedulesRef = firestore()
      .collection("churches")
      .doc(churchId)
      .collection("schedule")
      .doc(week);
    try {
      const scheduleDoc = await schedulesRef.get();
      if (!scheduleDoc.exists) {
        return;
      }
      const scheduleData = scheduleDoc.data();
      const altarServers = scheduleData?.altar || [];
      const serverToRemove = altarServers[index];
      if (!serverToRemove || !serverToRemove.uid) {
        return;
      }
      await removeServerAPI(
        user,
        churchId,
        week,
        serverToRemove.uid,
        "https://remove-server-hy6oofbihq-uc.a.run.app"
      );
      const churchRef = firestore().collection("churches").doc(churchId);
      await churchRef.update({
        altarServers: FieldValue.increment(-1),
      });
    } catch (error) {
      // Error handling for server removal
    }
  };

  return (
    <View style={styles.container}>
      {/* Week Selector Header */}
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
        <View style={{ marginBottom: 10, marginTop: 10 }}>
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

        <View style={styles.sectionHeaderContainer}>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
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
              <TouchableOpacity
                onPress={() => removeServerFromSchedule(index)}
              >
                <Text style={styles.removeButton}>Remove</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.addButton} onPress={handleAddServer}>
        <Text style={styles.addButtonText}>Add Server</Text>
      </TouchableOpacity>

      {/* Server selection modal */}
      <Modal
        visible={serverDropdownIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setServerDropdownIndex(null)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setServerDropdownIndex(null)}
        >
          <TouchableOpacity 
            activeOpacity={1}
            style={styles.modalWrapper}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Server</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setServerDropdownIndex(null)}
                >
                  <Text style={styles.modalCloseX}>×</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={availableServers}
                keyExtractor={(item) => item.uid}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItemContainer}
                    onPress={() => assignServer(serverDropdownIndex, item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modalItemContent}>
                      <Image
                        source={
                          imageUrls[item.uid] && typeof imageUrls[item.uid] === "string" && imageUrls[item.uid].trim() !== ""
                            ? { uri: imageUrls[item.uid] }
                            : require("../assets/default_profile.png")
                        }
                        style={styles.profilePic}
                        defaultSource={require("../assets/default_profile.png")}
                        onError={() => setImageUrls((prev) => ({ ...prev, [item.uid]: null }))}
                      />
                      <Text style={styles.modalItem}>{item.name}</Text>
                    </View>
                    <Text style={styles.selectIcon}>›</Text>
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Reader selection modal */}
      <Modal
        visible={readerDropdownIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReaderDropdownIndex(null)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setReaderDropdownIndex(null)}
        >
          <TouchableOpacity 
            activeOpacity={1}
            style={styles.modalWrapper}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Reader</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setReaderDropdownIndex(null)}
                >
                  <Text style={styles.modalCloseX}>×</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={availableServers}
                keyExtractor={(item) => item.uid}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItemContainer}
                    onPress={() => assignReader(readerDropdownIndex, item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.modalItemContent}>
                      <Image
                        source={
                          imageUrls[item.uid] && typeof imageUrls[item.uid] === "string" && imageUrls[item.uid].trim() !== ""
                            ? { uri: imageUrls[item.uid] }
                            : require("../assets/default_profile.png")
                        }
                        style={styles.profilePic}
                        defaultSource={require("../assets/default_profile.png")}
                        onError={() => setImageUrls((prev) => ({ ...prev, [item.uid]: null }))}
                      />
                      <Text style={styles.modalItem}>{item.name}</Text>
                    </View>
                    <Text style={styles.selectIcon}>›</Text>
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Week Selection Modal */}
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
          <TouchableOpacity 
            activeOpacity={1}
            style={styles.modalWrapper}
          >
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
                      selectedWeek === item && styles.selectedWeekItem
                    ]}
                    onPress={() => handleWeekSelect(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.modalItem,
                      selectedWeek === item && styles.selectedWeekText
                    ]}>{formatWeekDisplay(item)}</Text>
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

      {/* Info Modal */}
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
          <TouchableOpacity 
            activeOpacity={1}
            style={styles.infoModalWrapper}
          >
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
                When you add or remove altar servers, the change automatically applies to all future weeks to maintain consistency across your church's schedule.
                {"\n\n"}
                This ensures that the same number of server positions are available each week, making it easier to plan and assign servers for upcoming services.
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

      {/* Individual Profile modal */}
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
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
  },
  headerContainer: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 20,
    color: "#4d9cff",
    fontWeight: "bold",
  },
  sectionHeaderContainer: {
    marginBottom: 10,
    marginTop: 10,
  },
  serverInfoContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginLeft: 12,
  },
  serverCountText: {
    fontSize: 13,
    color: "#999",
    fontStyle: "italic",
  },
  infoButton: {
    padding: 2,
    marginLeft: 4,
  },
  infoIcon: {
    fontSize: 14,
    color: "#147efb",
    fontWeight: "bold",
  },
  listItem: {
    backgroundColor: "#1e1e1e",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  listItemContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemText: {
    color: "#bbb",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledText: {
    color: "#666",
  },
  dropdownContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  dropdown: {
    backgroundColor: "#333",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignSelf: "flex-start",
  },
  dropdownText: {
    color: "#fff",
    fontSize: 16,
  },
  removeButton: {
    color: "#ff3b30",
    fontSize: 16,
  },
  addButton: {
    backgroundColor: "#147efb",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  addButtonText: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "bold",
  },
  weekSelector: {
    backgroundColor: "#1e1e1e",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  weekSelectorContent: {
    flex: 1,
  },
  weekLabel: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  weekSelectorText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  weekSelectorIconContainer: {
    backgroundColor: "#2a2a2a",
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  weekSelectorIcon: {
    color: "#147efb",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalWrapper: {
    width: "90%",
    maxHeight: "70%",
  },
  modalContent: {
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
    backgroundColor: "#252525",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseX: {
    color: "#999",
    fontSize: 24,
    fontWeight: "300",
  },
  modalItemContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  modalItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  modalItem: {
    color: "#fff",
    fontSize: 17,
    marginLeft: 12,
    flex: 1,
  },
  profilePic: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#147efb",
    backgroundColor: "#2a2a2a",
  },
  separator: {
    height: 1,
    backgroundColor: "#2a2a2a",
    marginHorizontal: 20,
  },
  selectIcon: {
    color: "#666",
    fontSize: 20,
    marginLeft: 10,
  },
  checkmark: {
    color: "#147efb",
    fontSize: 18,
    fontWeight: "bold",
  },
  selectedWeekItem: {
    backgroundColor: "rgba(20, 126, 251, 0.1)",
  },
  selectedWeekText: {
    color: "#147efb",
    fontWeight: "700",
  },
  closeButton: {
    color: "#ff3b30",
    fontSize: 18,
    textAlign: "center",
    marginTop: 10,
  },
  infoModalWrapper: {
    width: "85%",
    maxWidth: 400,
  },
  infoModalContent: {
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  infoModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
    backgroundColor: "#252525",
  },
  infoModalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  infoModalText: {
    color: "#ddd",
    fontSize: 16,
    lineHeight: 24,
    padding: 20,
  },
  infoModalButton: {
    backgroundColor: "#147efb",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  infoModalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default EditSchedule;