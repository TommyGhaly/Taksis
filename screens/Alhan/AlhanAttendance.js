import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, ScrollView, ActivityIndicator, TextInput, Modal, Button } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const AlhanAttendance = () => {
  const user = auth().currentUser;
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        Alert.alert("Error", "No user found.");
        return;
      }

      try {
        const userDoc = await firestore().collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
          Alert.alert("Error", "User not found.");
          return;
        }

        setUserData(userDoc.data());
      } catch (error) {
        Alert.alert("Error", error.message);
      }
    };

    fetchUserData();
  }, [user]);

  useEffect(() => {
    if (!userData) return;

    const fetchStudents = async () => {
      try {
        const hymnsClassDoc = await firestore()
          .collection('churches')
          .doc(userData.church)
          .collection('hymnsClass')
          .doc(userData.alhanGrades)
          .get();

        if (!hymnsClassDoc.exists) {
          Alert.alert("Error", "Hymns class not found.");
          return;
        }

        const studentsCollection = await hymnsClassDoc.ref.collection('students').get();
        let studentsData = studentsCollection.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        studentsData.sort((a, b) => a.name.localeCompare(b.name)); // Sorting students alphabetically

        const dateKey = getNextSunday();
        const studentsWithAttendance = await Promise.all(
          studentsData.map(async (student) => {
            const attendanceDoc = await firestore()
              .collection('churches')
              .doc(userData.church)
              .collection('hymnsClass')
              .doc(userData.alhanGrades)
              .collection('students')
              .doc(student.uid)
              .get();

            const attendanceStatus = attendanceDoc.exists ? attendanceDoc.data()[dateKey] : null;

            return {
              ...student,
              attendance: attendanceStatus,
            };
          })
        );

        setStudents(studentsWithAttendance);
      } catch (error) {
        Alert.alert("Error", error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [userData]);

  const getNextSunday = () => {
    const today = new Date();
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + (7 - today.getDay()));
    const month = String(nextSunday.getMonth() + 1).padStart(2, '0');
    const day = String(nextSunday.getDate()).padStart(2, '0');
    const year = nextSunday.getFullYear();
    return `${month}-${day}-${year}`;
  };

  const handleAttendance = (studentId, status) => {
    const dateKey = getNextSunday();
    firestore()
      .collection('churches')
      .doc(userData.church)
      .collection('hymnsClass')
      .doc(userData.alhanGrades)
      .collection('students')
      .doc(studentId)
      .update({
        [dateKey]: status,
      })
      .then(() => {
        setStudents((prevStudents) =>
          prevStudents.map((student) =>
            student.uid === studentId ? { ...student, attendance: status } : student
          )
        );
      });
  };

  const addStudent = async () => {
    if (!newStudentName.trim()) {
      Alert.alert('Error', 'Please enter a student name');
      return;
    }

    const newStudentRef = firestore()
      .collection('churches')
      .doc(userData.church)
      .collection('hymnsClass')
      .doc(userData.alhanGrades)
      .collection('students')
      .doc();

    try {
      await newStudentRef.set({
        name: newStudentName,
        uid: newStudentRef.id,
      });

      setStudents((prevStudents) => [
        ...prevStudents,
        { uid: newStudentRef.id, name: newStudentName, attendance: null },
      ]);
      setModalVisible(false);
      setNewStudentName('');
    } catch (error) {
      Alert.alert('Error', 'Failed to add student');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#147efb" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>
        Attendance for the week of {getNextSunday()}
      </Text>

      <ScrollView contentContainerStyle={styles.studentsContainer} showsVerticalScrollIndicator={false}>
        {students.map((student) => (
          <View key={student.uid} style={styles.studentContainer}>
            <Text style={styles.studentName}>{student.name}</Text>
            <View style={styles.attendanceButtons}>
              <TouchableOpacity
                style={[styles.attendanceButton, student.attendance === false && styles.absentSelected]}
                onPress={() => handleAttendance(student.uid, false)}
              >
                <Text style={styles.attendanceButtonText}>Absent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.attendanceButton, student.attendance === true && styles.presentSelected]}
                onPress={() => handleAttendance(student.uid, true)}
              >
                <Text style={styles.attendanceButtonText}>Present</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
        <Text style={styles.addButtonText}>Add Student</Text>
      </TouchableOpacity>

      {/* Add Student Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Add New Student</Text>
            <TextInput
              style={styles.modalInput}
              value={newStudentName}
              onChangeText={setNewStudentName}
              placeholder="Enter student's name"
              placeholderTextColor="#888"
            />
            <View style={styles.modalButtons}>
              <Button title="Cancel" onPress={() => setModalVisible(false)} />
              <Button title="Add" onPress={addStudent} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#121212',
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  studentsContainer: {
    paddingBottom: 80,
  },
  studentContainer: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  studentName: {
    fontSize: 18,
    color: '#FFFFFF',
    marginBottom: 10,
  },
  attendanceButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  attendanceButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 5,
    backgroundColor: '#444',  // Darker default background when not selected
  },
  presentSelected: {
    backgroundColor: '#147efb',  // Original background color for "Present"
  },
  absentSelected: {
    backgroundColor: '#D32F2F',  // Original background color for "Absent"
  },
  attendanceButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  addButton: {
    backgroundColor: '#147efb',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    fontSize: 18,
    color: '#147efb',
    marginTop: 10,
  },
  modalBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '80%',
    padding: 20,
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 10,
  },
  modalInput: {
    width: '100%',
    padding: 10,
    borderRadius: 5,
    backgroundColor: '#333',
    color: '#fff',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
});



export default AlhanAttendance;
