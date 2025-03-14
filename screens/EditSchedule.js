import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, FlatList, Modal } from "react-native";
import firestore from "@react-native-firebase/firestore"; 
import auth from "@react-native-firebase/auth";

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
  "wine"
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
  wine: "Wine"
};

const EditSchedule = () => {
  const [churchId, setChurchId] = useState(null); // Church ID state
  const [servers, setServers] = useState([]);
  const [availableServers, setAvailableServers] = useState([]);
  const [assignedReaders, setAssignedReaders] = useState({});
  const [assignedServers, setAssignedServers] = useState({});
  const [serverDropdownIndex, setServerDropdownIndex] = useState(null);
  const [readerDropdownIndex, setReaderDropdownIndex] = useState(null);
  const scrollViewRef = useRef(null);
  const user = auth().currentUser;

  useEffect(() => {
    // Fetch user's document to get churchId
    const fetchUserData = async () => {
      const userDoc = await firestore().collection('users').doc(user.uid).get(); 
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
      const getClosestSunday = () => {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysUntilSunday = (7 - dayOfWeek) % 7;
        today.setDate(today.getDate() + daysUntilSunday);
  
        const month = (today.getMonth() + 1).toString().padStart(2, '0');
        const day = today.getDate().toString().padStart(2, '0');
        const year = today.getFullYear().toString().slice(-2);
  
        return `${month}-${day}-${year}`;
      };
  
      const closestSunday = getClosestSunday();
      console.log("Closest Sunday:", closestSunday);
  
      const schedulesRef = firestore()
        .collection("churches")
        .doc(churchId)
        .collection("schedule")
        .doc(closestSunday);
  
      const unsubscribe = schedulesRef.onSnapshot((doc) => {
        if (doc.exists) {
          const scheduleForTheWeek = doc.data();
          console.log("Schedule for the week:", scheduleForTheWeek);
  
          const initialAssignments = {};
  
          readings.forEach((reading) => {
            const reader = scheduleForTheWeek[reading];
            if (reader && reader.name) {
              initialAssignments[displayNames[reading]] = reader.name;
            } else {
              initialAssignments[displayNames[reading]] = "Select Reader";
            }
          });
  
          console.log("Initial Assignments:", initialAssignments);
  
          setAssignedReaders(initialAssignments);
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

  const addServer = () => {
    if (servers.length >= 6) {
      Alert.alert("Limit Reached", "You cannot add more than 6 altar servers.");
      return;
    }
    setServers((prevServers) => [...prevServers, `Altar Server ${prevServers.length + 1}`]);
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 300);
  };

  const removeServer = (index) => {
    setServers((prevServers) => prevServers.filter((_, i) => i !== index).map((s, i) => `Altar Server ${i + 1}`));
    setAssignedServers((prevAssigned) => {
      const newAssigned = {};
      Object.keys(prevAssigned).forEach((key, i) => {
        if (parseInt(key) !== index) {
          newAssigned[i < index ? i : i - 1] = prevAssigned[key];
        }
      });
      return newAssigned;
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Edit Schedule</Text>
      <ScrollView style={styles.scrollView} ref={scrollViewRef} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeader}>Assign Readers</Text>
        {readings.map((item, index) => (
          <View key={index} style={styles.listItem}>
            <Text style={styles.itemText}>{displayNames[item]}</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setReaderDropdownIndex(index)}
            >
              <Text style={styles.dropdownText}>{assignedReaders[displayNames[item]] || "Select Reader"}</Text>
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
              <Text style={styles.dropdownText}>{assignedServers[index] || "Select Server"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeServer(index)}>
              <Text style={styles.removeButton}>Remove</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.addButton} onPress={addServer}>
        <Text style={styles.addButtonText}>Add Server</Text>
      </TouchableOpacity>

      <Modal visible={serverDropdownIndex !== null} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <FlatList
              data={availableServers}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => assignServer(serverDropdownIndex, item)}>
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

      <Modal visible={readerDropdownIndex !== null} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <FlatList
              data={availableServers}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => assignReader(readerDropdownIndex, item)}>
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
