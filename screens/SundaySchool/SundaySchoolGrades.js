import React, { useState } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
const grades = [
  "Pre-School", "Kindergarten", "1st", "2nd", "3rd", "4th", "5th", "6th", 
  "7th", "8th", "9th", "10th", "11th", "12th", "College"
];

const SundaySchoolGrades = ({navigation}) => {
  const [selectedGrades, setSelectedGrades] = useState([]);
  const user = auth().currentUser;

  const toggleGradeSelection = (grade) => {
    setSelectedGrades((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade]
    );
  };
  const setGrades = async (selectedGrades) => {
    orderedGrades = []
    for(let i = 0; i < grades.length; i++) {
      for (let j = 0; j < selectedGrades.length; j++) {
        if (grades[i] == selectedGrades[j]){
          orderedGrades.push(selectedGrades[j])
        }
      }
    }
    console.log(orderedGrades)
    return orderedGrades
  };
  const handleSubmit = async () => {
    if (!user) {
      Alert.alert("Error", "User not found.");
      return;
    }
    const orderedGrades = await setGrades(selectedGrades)
    console.log(orderedGrades)
    try {
      const userRef = firestore().collection("users").doc(user.uid);
      await userRef.update({
        ssSetUp: true,
        ssGrades: orderedGrades.join(", ")
      });

      const userDoc = await userRef.get();
      const userData = userDoc.data();
      const userChurch = userData?.church;
      
      if (!userChurch) {
        Alert.alert("Error", "User's church not found.");
        return;
      }

      const churchRef = firestore().collection("churches").doc(userChurch);
      const hymnsClassRef = churchRef.collection("Sunday School");
      
      const gradeRef = hymnsClassRef.doc(orderedGrades.join(", "));
      const gradeDoc = await gradeRef.get();
        
      if (!gradeDoc.exists) {
        await gradeRef.set({
          servants: [{ uid: user.uid }]
        });
      } else {
        await gradeRef.update({
          servants: firestore.FieldValue.arrayUnion({ uid: user.uid })
        });
      }
      navigation.navigate("SundaySchoolAttendance")
      Alert.alert("Success", "Your selections have been saved.");
    } catch (error) {
      console.error("Error updating Firestore:", error);
      Alert.alert("Error", "Failed to update data.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select the Grades You Teach Sunday School To</Text>
      <FlatList
        data={grades}
        keyExtractor={(item) => item}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.gradeButton, selectedGrades.includes(item) && styles.selected]}
            onPress={() => toggleGradeSelection(item)}
          >
            <Text style={styles.gradeText}>{item}</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Ionicons name="checkmark-circle" size={24} color="#fff" style={styles.icon} />
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
    backgroundColor: "#121212",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#e0e0e0",
    marginBottom: 20,
    textAlign: "center",
  },
  gradeButton: {
    padding: 20,
    paddingHorizontal: 90,
    marginVertical: 5,
    borderRadius: 12,
    backgroundColor: "#1e1e1e",
    alignItems: "center",
    justifyContent: "center",
  },
  selected: {
    backgroundColor: "#147efb",
  },
  gradeText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#e0e0e0",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    marginTop: 15,
    padding: 15,
    borderRadius: 12,
    backgroundColor: "#147efb",
    width: "60%",
    justifyContent: "center",
  },
  submitText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginLeft: 10,
  },
  icon: {
    marginRight: 5,
  }
});

export default SundaySchoolGrades;
