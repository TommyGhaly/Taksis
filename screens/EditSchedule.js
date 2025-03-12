import React, { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, Animated, StyleSheet, Alert, FlatList, Modal } from "react-native";

const readings = [
  "Matins Gospel",
  "Third Hour Gospel",
  "Sixth Hour Gospel",
  "Pauline Epistle",
  "Catholic Epistle",
  "Praxis",
  "Gospel",
  "Water",
  "Wine"
];

const EditSchedule = () => {
  const [servers, setServers] = useState([]);
  const [availableServers, setAvailableServers] = useState([]);
  const [assignedReaders, setAssignedReaders] = useState({});
  const [assignedServers, setAssignedServers] = useState({});
  const [serverDropdownIndex, setServerDropdownIndex] = useState(null);
  const [readerDropdownIndex, setReaderDropdownIndex] = useState(null);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const scrollViewRef = useRef(null);

  useEffect(() => {
    setAvailableServers(["John Doe", "Jane Smith", "Michael Lee", "Emma Wilson"]);
    const initialAssignments = {};
    readings.forEach((reading) => {
      initialAssignments[reading] = "Select Reader";
    });
    setAssignedReaders(initialAssignments);
  }, []);

  const assignReader = (index, reader) => {
    setAssignedReaders({ ...assignedReaders, [index]: reader });
    setReaderDropdownIndex(null);
  };

  const assignServer = (index, name) => {
    setAssignedServers({ ...assignedServers, [index]: name });
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
            <Text style={styles.itemText}>{item}</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setReaderDropdownIndex(index)}
            >
              <Text style={styles.dropdownText}>{assignedReaders[index] || "Select Reader"}</Text>
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
    color: "#bbb"
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
