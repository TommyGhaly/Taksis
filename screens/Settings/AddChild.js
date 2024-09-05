// AddChild.js
import React from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import BackArrow from "../../../components/backarrow"; // Import the BackArrow component

const AddChild = () => {
  return (
    <View style={styles.container}>
      <BackArrow style={styles.backArrow} />
      <Text style={styles.title}>Add Child</Text>
      <TextInput 
        style={styles.input} 
        placeholder="Enter child's name" 
        placeholderTextColor="#8e8e93" // Optional: Color for placeholder text
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#1e1e1e",
  },
  backArrow: {
    marginVertical: 10,
  },
  title: {
    fontSize: 24,
    color: "#ffffff",
    marginBottom: 20,
  },
  input: {
    height: 40,
    borderColor: "#8e8e93",
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 10,
    color: "#ffffff",
  },
});

export default AddChild;
