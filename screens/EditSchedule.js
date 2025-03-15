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
import { removeServer, addServer as addServerAPI } from "../components/functionCalls";

// Sample readings list
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
// Mapping of database keys to display names
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
  const [servers, setServers] = useState([]);
  const [availableServers, setAvailableServers] = useState([]);
  const [assignedReaders, setAssignedReaders] = useState({});
  const [assignedServers, setAssignedServers] = useState({});
  const [serverDropdownIndex, setServerDropdownIndex] = useState(null);
  const [readerDropdownIndex, setReaderDropdownIndex] = useState(null);
  const scrollViewRef = useRef(null);
  const user = auth().currentUser;
  
  const getClosestSunday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilSunday = (7 - dayOfWeek) % 7;
    today.setDate(today.getDate() + daysUntilSunday);

    const month = (today.getMonth() + 1).toString().padStart(2, "0");
    const day = today.getDate().toString().padStart(2, "0");
    const year = today.getFullYear().toString().slice(-2);

    return `${month}-${day}-${year}`;
  };

  useEffect(() => {
    // Fetch user's document to get churchId
    const fetchUserData = async () => {
      const userDoc = await firestore().collection("users").doc(user.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        setChurchId(userData?.church);
      } else {
        console.log("User not found");
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    if (churchId) {
      const closestSunday = getClosestSunday();
      console.log("Closest Sunday:", closestSunday);

      // Using a hardcoded date for now ("03-22-25") – you can substitute closestSunday if desired
      const schedulesRef = firestore()
        .collection("churches")
        .doc(churchId)
        .collection("schedule")
        .doc("03-22-25");

      const unsubscribe = schedulesRef.onSnapshot((doc) => {
        if (doc.exists) {
          const scheduleForTheWeek = doc.data();
          console.log("Schedule for the week:", scheduleForTheWeek);

          // Assign readers
          const initialAssignments = {};
          readings.forEach((reading) => {
            const reader = scheduleForTheWeek[reading];
            initialAssignments[displayNames[reading]] =
              reader?.name || "Select Reader";
          });
          setAssignedReaders(initialAssignments);

          // Assign altar servers
          const altarServers = scheduleForTheWeek.altar || [];
          setServers(
            altarServers.map((server, index) => `Altar Server ${index + 1}`)
          );

          const initialServerAssignments = {};
          altarServers.forEach((server, index) => {
            initialServerAssignments[index] = server.name;
          });
          setAssignedServers(initialServerAssignments);
        } else {
          console.log("No schedule found for this Sunday");
        }
      });

      return () => unsubscribe();
    }
  }, [churchId]);

  const assignReader = (index, reader) => {
    const updatedReaders = { ...assignedReaders };
    updatedReaders[displayNames[readings[index]]] = reader;
    setAssignedReaders(updatedReaders);
    setReaderDropdownIndex(null);
  };

  const assignServer = (index, name) => {
    const updatedServers = { ...assignedServers };
    updatedServers[index] = name;
    setAssignedServers(updatedServers);
    setServerDropdownIndex(null);
  };

  // Renamed from addServer to avoid naming conflicts with the imported function
  const handleAddServer = async () => {
    if (!churchId) {
      Alert.alert("Error", "Church ID not found.");
      return;
    }
  
    // Check if servers array already has 6 entries
    if (servers.length >= 6) {
      Alert.alert("Limit Reached", "You cannot add more than 6 servers.");
      return;
    }
  
    try {
      await addServerAPI(
        auth().currentUser,
        churchId,
        "03-22-25", // Ensure correct date or use getClosestSunday()
        "https://add-server-hy6oofbihq-uc.a.run.app" // Backend function URL
      );
  
      // Increment altarServers count in church document
      const churchRef = firestore().collection("churches").doc(churchId);
      await churchRef.update({
        altarServers: firestore.FieldValue.increment(1),
      });
  
      scrollViewRef.current?.scrollToEnd({ animated: false });
    } catch (error) {
      console.error("Error adding server:", error);
      Alert.alert("Error", `Failed to add server: ${error.message}`);
    }
  };
  
  

  const removeServerFromSchedule = async (index) => {
    if (!churchId) {
      Alert.alert("Error", "Church ID not found.");
      return;
    }
  
    const schedulesRef = firestore()
      .collection("churches")
      .doc(churchId)
      .collection("schedule")
      .doc("03-22-25");
  
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
  
      await removeServer(
        auth().currentUser,
        churchId,
        "03-22-25",
        serverToRemove.uid,
        "https://remove-server-hy6oofbihq-uc.a.run.app"
      );
  
      // Decrement altarServers count in church document
      const churchRef = firestore().collection("churches").doc(churchId);
      await churchRef.update({
        altarServers: firestore.FieldValue.increment(-1),
      });
  
    } catch (error) {
      Alert.alert("Error", `Failed to remove server: ${error.message}`);
    }
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Schedule</Text>
      <ScrollView
        style={styles.scrollView}
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

      <Modal
        visible={serverDropdownIndex !== null}
        transparent
        animationType="none"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <FlatList
              data={availableServers}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => assignServer(serverDropdownIndex, item)}
                >
                  <Text style={styles.modalItem}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setServerDropdownIndex(null)}>
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={readerDropdownIndex !== null}
        transparent
        animationType="none"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <FlatList
              data={availableServers}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => assignReader(readerDropdownIndex, item)}
                >
                  <Text style={styles.modalItem}>{item}</Text>
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
    paddingBottom: 100,
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
    fontSize: 18,
    color: "#bbb",
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
