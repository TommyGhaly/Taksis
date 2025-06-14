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
import firestore from "@react-native-firebase/firestore";
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

const EditSchedule = () => {
  const [churchId, setChurchId] = useState(null);
  const [week, setWeek] = useState(null);
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
  const scrollViewRef = useRef(null);
  const user = auth().currentUser;

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
          console.error("Error fetching user data:", error);
        }
      );
    return () => unsubscribeUser();
  }, [user.uid, churchId]);

  // Query schedule subcollection for nearest week and fetch image URLs
  useEffect(() => {
    if (churchId) {
      const schedulesRef = firestore()
        .collection("churches")
        .doc(churchId)
        .collection("schedule");

      const unsubscribe = schedulesRef.onSnapshot((snapshot) => {
        let closestScheduleDoc = null;
        let closestDate = null;
        const today = new Date().setHours(0, 0, 0, 0);

        snapshot.docs.forEach((doc) => {
          const scheduleDateStr = doc.id;
          const [month, day, year] = scheduleDateStr.split("-").map(Number);
          const scheduleDate = new Date(2000 + year, month - 1, day).setHours(0, 0, 0, 0);

          if (
            !closestDate ||
            Math.abs(scheduleDate - today) < Math.abs(closestDate - today)
          ) {
            closestDate = scheduleDate;
            closestScheduleDoc = doc;
          }
        });

        if (closestScheduleDoc) {
          setWeek(closestScheduleDoc.id);
          const scheduleForTheWeek = closestScheduleDoc.data();

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
        }
      });

      return () => unsubscribe();
    }
  }, [churchId]);

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
      console.error("Error assigning reader:", error);
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
      console.error("Error assigning server:", error);
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
        altarServers: firestore.FieldValue.increment(1),
      });
      scrollViewRef.current?.scrollToEnd({ animated: false });
    } catch (error) {
      console.error("Error adding server:", error);
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
        altarServers: firestore.FieldValue.increment(-1),
      });
    } catch (error) {
      console.error("Error removing server:", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Schedule</Text>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 90 }}
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeader}>Assign Readers</Text>
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

        <Text style={styles.sectionHeader}>Altar Servers</Text>
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
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <FlatList
              data={availableServers}
              keyExtractor={(item) => item.uid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItemContainer}
                  onPress={() => assignServer(serverDropdownIndex, item)}
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
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setServerDropdownIndex(null)}>
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Reader selection modal */}
      <Modal
        visible={readerDropdownIndex !== null}
        transparent
        animationType="slide"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <FlatList
              data={availableServers}
              keyExtractor={(item) => item.uid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItemContainer}
                  onPress={() => assignReader(readerDropdownIndex, item)}
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
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setReaderDropdownIndex(null)}>
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Individual Profile modal */}
      <IndividualProfile
        userId={selectedUserId}
        show={profileModalVisible}
        onClose={closeProfile}
        church={churchId}
        week={week}
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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 20,
    color: "#4d9cff",
    marginBottom: 10,
    marginTop: 20,
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
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  modalContent: {
    backgroundColor: "#222",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    maxHeight: "60%", // Limit modal height to 60% of screen
  },
  modalItemContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
  },
  modalItemContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalItem: {
    color: "#fff",
    fontSize: 18,
    marginLeft: 10,
  },
  profilePic: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#147efb",
  },
  closeButton: {
    color: "#ff3b30",
    fontSize: 18,
    textAlign: "center",
    marginTop: 10,
  },
});

export default EditSchedule;