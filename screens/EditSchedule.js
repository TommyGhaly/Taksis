import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  FlatList,
  Modal,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import {
  removeServer as removeServerAPI,
  addServer as addServerAPI,
  switchServers as switchServersAPI,
} from "../components/functionCalls";

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
  // Week will now be determined dynamically (doc id from the schedule collection)
  const [week, setWeek] = useState(null);
  // These states now hold only display values
  const [servers, setServers] = useState([]);
  const [assignedReaders, setAssignedReaders] = useState({});
  const [assignedServers, setAssignedServers] = useState({});
  // New state variables for storing full objects (including uid)
  const [altarServers, setAltarServers] = useState([]);
  const [currentReaders, setCurrentReaders] = useState({});
  const [availableServers, setAvailableServers] = useState([]);

  const [serverDropdownIndex, setServerDropdownIndex] = useState(null);
  const [readerDropdownIndex, setReaderDropdownIndex] = useState(null);
  const scrollViewRef = useRef(null);
  const user = auth().currentUser;

  // Realtime listener for user doc to update churchId if it changes
  useEffect(() => {
    const unsubscribeUser = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot((doc) => {
        if (doc.exists) {
          const userData = doc.data();
          if (userData?.church && userData.church !== churchId) {
            setChurchId(userData.church);
            console.log("Church updated to:", userData.church);
          }
        } else {
          console.log("User not found");
        }
      }, (error) => {
        console.error("Error listening to user document:", error);
      });
    return () => unsubscribeUser();
  }, [user.uid, churchId]);

  // Query the schedule subcollection and determine the nearest upcoming week (schedule)
  useEffect(() => {
    if (churchId) {
      const schedulesRef = firestore()
        .collection("churches")
        .doc(churchId)
        .collection("schedule");
  
      const unsubscribe = schedulesRef.onSnapshot((snapshot) => {
        let closestScheduleDoc = null;
        let closestDate = null;
        const today = new Date().setHours(0, 0, 0, 0); // Normalize today's date
  
        snapshot.docs.forEach((doc) => {
          // Assume doc.id is in the format "MM-DD-YY"
          const scheduleDateStr = doc.id;
          const [month, day, year] = scheduleDateStr.split("-").map(Number);
          // Assuming years are stored as two digits (e.g., "25" means 2025)
          const scheduleDate = new Date(2000 + year, month - 1, day).setHours(
            0,
            0,
            0,
            0
          ); // Normalize schedule date
  
          // Find the schedule closest to today (past or future)
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
          console.log("Nearest schedule for the week:", scheduleForTheWeek);
  
          // Build objects for readers and display names
          const readersObj = {};
          const readersDisplay = {};
          readings.forEach((reading) => {
            const reader = scheduleForTheWeek[reading];
            readersObj[reading] = reader;
            readersDisplay[displayNames[reading]] = reader?.name || "Select Reader";
          });
          setCurrentReaders(readersObj);
          setAssignedReaders(readersDisplay);
  
          // Process altar servers (full objects)
          const fetchedAltarServers = scheduleForTheWeek.altar || [];
          setAltarServers(fetchedAltarServers);
          const initialServerAssignments = {};
          fetchedAltarServers.forEach((server, index) => {
            initialServerAssignments[index] = server.name;
          });
          setAssignedServers(initialServerAssignments);
          // Update servers array (for rendering list headers, etc.)
          setServers(fetchedAltarServers.map((_, index) => `Altar Server ${index + 1}`));
  
          // Also update available extra servers as full objects (filtering out placeholders)
          const extraServers = scheduleForTheWeek.extra || [];
          const filteredExtraServers = extraServers.filter(
            (server) => server.name !== "N/A"
          );
          setAvailableServers(filteredExtraServers);
        } else {
          console.log("No schedules found.");
        }
      });
  
      return () => unsubscribe();
    }
  }, [churchId]);

  // When a new reader is selected, retrieve the old reader’s UID and call switchServersAPI
  const assignReader = async (index, newReader) => {
    if (!week) {
      Alert.alert("Error", "Schedule week not determined yet.");
      return;
    }
    const readingKey = readings[index]; // e.g., "matins"
    const oldReader = currentReaders[readingKey];
    console.log(oldReader, readingKey, newReader);
    if (!oldReader || !oldReader.uid) {
      Alert.alert("Error", "Old reader not found.");
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
      console.error("Error switching readers:", error);
      Alert.alert("Error", "Failed to switch reader.");
    }
    setReaderDropdownIndex(null);
  };

  // When a new server is selected, retrieve the old server’s UID and call switchServersAPI
  const assignServer = async (index, newServer) => {
    if (!week) {
      Alert.alert("Error", "Schedule week not determined yet.");
      return;
    }
    const oldServer = altarServers[index];
    if (!oldServer || !oldServer.uid) {
      Alert.alert("Error", "Old server not found.");
      return;
    }
    try {
      console.log("Servers to swap:", oldServer, newServer);
      await switchServersAPI(
        user,
        churchId,
        week,
        oldServer.uid,
        newServer.uid,
        "https://switch-server-hy6oofbihq-uc.a.run.app"
      );
    } catch (error) {
      console.error("Error switching servers:", error);
      Alert.alert("Error", "Failed to switch server.");
    }
    setServerDropdownIndex(null);
  };

  // Add a new server to the schedule
  const handleAddServer = async () => {
    if (!churchId || !week) {
      Alert.alert("Error", "Church ID or schedule week not found.");
      return;
    }

    if (servers.length >= 6) {
      Alert.alert("Limit Reached", "You cannot add more than 6 servers.");
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
      Alert.alert("Success", "Server added successfully.");
    } catch (error) {
      console.error("Error adding server:", error);
      Alert.alert("Error", `Failed to add server: ${error.message}`);
    }
  };

  // Remove a server from the schedule
  const removeServerFromSchedule = async (index) => {
    if (!churchId || !week) {
      Alert.alert("Error", "Church ID or schedule week not found.");
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
        Alert.alert("Error", "Schedule not found.");
        return;
      }

      const scheduleData = scheduleDoc.data();
      const altarServers = scheduleData?.altar || [];
      const serverToRemove = altarServers[index];

      if (!serverToRemove || !serverToRemove.uid) {
        Alert.alert("Error", "Server UID not found.");
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
      Alert.alert("Success", "Server removed successfully.");
    } catch (error) {
      Alert.alert("Error", `Failed to remove server: ${error.message}`);
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
          <View key={index} style={styles.listItem}>
            <Text style={styles.itemText}>{displayNames[item]}</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setReaderDropdownIndex(index)}
            >
              <Text style={styles.dropdownText}>
                {assignedReaders[displayNames[item]] || "Select Reader"}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.sectionHeader}>Altar Servers</Text>
        {servers.map((_, index) => (
          <View key={index} style={styles.listItem}>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setServerDropdownIndex(index)}
            >
              <Text style={styles.dropdownText}>
                {assignedServers[index] || "Select Server"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeServerFromSchedule(index)}>
              <Text style={styles.removeButton}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.addButton} onPress={handleAddServer}>
        <Text style={styles.addButtonText}>Add Server</Text>
      </TouchableOpacity>

      {/* Server selection modal */}
      <Modal
        visible={serverDropdownIndex !== null}
        transparent
        animationType="none"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <FlatList
              data={availableServers}
              keyExtractor={(item) => item.uid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => assignServer(serverDropdownIndex, item)}
                >
                  <Text style={styles.modalItem}>{item.name}</Text>
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
        animationType="none"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <FlatList
              data={availableServers}
              keyExtractor={(item) => item.uid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => assignReader(readerDropdownIndex, item)}
                >
                  <Text style={styles.modalItem}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setReaderDropdownIndex(null)}>
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    flexGrow: 1,
  },
  itemText: {
    color: "#bbb",
  },
  sectionHeader: {
    fontSize: 20,
    color: "#4d9cff",
    marginBottom: 10,
    marginTop: 20,
    fontWeight: "bold",
  },
  listItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  dropdown: {
    backgroundColor: "#333",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
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
  },
  modalItem: {
    color: "#fff",
    fontSize: 18,
    padding: 10,
  },
  closeButton: {
    color: "#ff3b30",
    fontSize: 18,
    textAlign: "center",
    marginTop: 10,
  },
});

export default EditSchedule;
