import React, { useState } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from "react-native";

const grades = [
  "Pre-School", "Kindergarten", "1st", "2nd", "3rd", "4th", "5th", "6th", 
  "7th", "8th", "9th", "10th", "11th", "12th", "College"
];

const AlhanGrades = () => {
  const [selectedGrades, setSelectedGrades] = useState([]);

  const toggleGradeSelection = (grade) => {
    setSelectedGrades((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade]
    );
  };

  const handleSubmit = () => {
    Alert.alert("Selected Grades", selectedGrades.join(", ") || "No grades selected");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select the Grades You Teach Hymns To</Text>
      <FlatList
        data={grades}
        keyExtractor={(item) => item}
        numColumns={2}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.gradeButton,
              selectedGrades.includes(item) && styles.selected
            ]}
            onPress={() => toggleGradeSelection(item)}
          >
            <Text style={styles.gradeText}>{item}</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitText}>Submit</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    backgroundColor: "#fff"
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  gradeButton: {
    padding: 15,
    margin: 5,
    borderRadius: 10,
    backgroundColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
    width: "45%",
  },
  selected: {
    backgroundColor: "#4A90E2",
  },
  gradeText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
  },
  submitButton: {
    marginTop: 20,
    padding: 15,
    borderRadius: 10,
    backgroundColor: "#4A90E2",
  },
  submitText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  }
});

export default AlhanGrades;