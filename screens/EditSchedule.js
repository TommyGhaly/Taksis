import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";

const roles = [
  "Matins Gospel Reader",
  "Third Hour Reader",
  "Sixth Hour Reader",
  "Pauline Epistle Reader",
  "Catholic Epistle Reader",
  "Praxis Reader",
  "Gospel Reader",
  "Water Server",
  "Wine Server",
];

const people = [
  { label: "John Doe", value: "johnDoe" },
  { label: "Jane Smith", value: "janeSmith" },
  { label: "Chris Johnson", value: "chrisJohnson" },
  { label: "Alex Lee", value: "alexLee" },
];

const EditSchedule = () => {
  const [numberOfServers, setNumberOfServers] = useState(2); // Default to 2
  const [dropdownState, setDropdownState] = useState({
    groupDropdownValue: Array(8).fill(null), // Adjust according to max number of servers
    dropdownOpen: Array(8).fill(false),
  });
  const [roleDropdownState, setRoleDropdownState] = useState(Array(roles.length).fill(false));

  const renderRoleDropdown = (role, index) => {
    return (
      <View style={styles.roleSection}>
        <Text style={styles.roleTitle}>{role}</Text>
        <DropDownPicker
          open={roleDropdownState[index]}
          value={null}
          items={people}
          setOpen={(open) => {
            const newRoleDropdownOpen = [...roleDropdownState];
            newRoleDropdownOpen[index] = open;
            setRoleDropdownState(newRoleDropdownOpen);
          }}
          setValue={() => {}}
          style={styles.dropdown}
          dropDownContainerStyle={styles.dropdownContainer}
          textStyle={styles.dropdownText}
          placeholder="Select a person"
        />
      </View>
    );
  };

  const renderAltarServerDropdown = (index) => {
    return (
      <View style={styles.roleSection}>
        <Text style={styles.roleTitle}>Altar Server {index + 1}</Text>
        <DropDownPicker
          open={dropdownState.dropdownOpen[index]}
          value={dropdownState.groupDropdownValue[index]}
          items={people}
          setOpen={(open) => {
            const newDropdownOpen = [...dropdownState.dropdownOpen];
            newDropdownOpen[index] = open;
            setDropdownState((prevState) => ({
              ...prevState,
              dropdownOpen: newDropdownOpen,
            }));
          }}
          setValue={(value) => {
            const newValues = [...dropdownState.groupDropdownValue];
            newValues[index] = value;
            setDropdownState((prevState) => ({
              ...prevState,
              groupDropdownValue: newValues,
            }));
          }}
          style={styles.dropdown}
          dropDownContainerStyle={styles.dropdownContainer}
          textStyle={styles.dropdownText}
        />
      </View>
    );
  };

  const data = [
    { type: "rolesHeader", title: "Readers" },
    ...roles.map((role, index) => ({ type: "role", id: `role-${index}`, title: role, index })),
    { type: "rolesHeader", title: "Altar Servers" },
    ...Array.from({ length: numberOfServers }, (_, index) => ({
      type: "server",
      id: `server-${index}`,
      index,
    })),
  ];

  const renderItem = ({ item }) => {
    if (item.type === "header") {
      return <Text style={styles.headerText}>{item.title}</Text>;
    } else if (item.type === "server") {
      return renderAltarServerDropdown(item.index);
    } else if (item.type === "rolesHeader") {
      return <Text style={styles.rolesHeader}>{item.title}</Text>;
    } else {
      return renderRoleDropdown(item.title, item.index);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.editschedule}
        showsVerticalScrollIndicator={false}
      />
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => setNumberOfServers((prev) => Math.max(2, prev - 1))}
        >
          <Text style={styles.buttonText}>- Remove Server</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => setNumberOfServers((prev) => Math.min(8, prev + 1))}
        >
          <Text style={styles.buttonText}>+ Add Server</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
  },
  editschedule: {
    paddingBottom: 20,
  },
  headerText: {
    fontSize: 28,
    color: "#e0e0e0",
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: 'center',
  },
  roleSection: {
    marginBottom: 15,
    backgroundColor: "#2C2C2C",
    borderRadius: 8,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  roleTitle: {
    fontSize: 18,
    color: "#ffffff",
    marginBottom: 8,
  },
  dropdown: {
    backgroundColor: "#2C2C2C",
    borderWidth: 0,
    borderRadius: 8,
  },
  dropdownContainer: {
    backgroundColor: "#2C2C2C",
    borderWidth: 0,
    borderRadius: 8,
    zIndex: 999, // Ensure dropdown appears above other elements
  },
  dropdownText: {
    color: "#e0e0e0",
  },
  rolesHeader: {
    fontSize: 20,
    color: "#e0e0e0",
    marginBottom: 10,
    marginTop: 20,
    fontWeight: 'bold'
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    backgroundColor: "#007BFF",
    borderRadius: 8,
    padding: 10,
    margin: 5,
    alignItems: 'center',
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EditSchedule;
