import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons'; // For icons (install expo vector-icons if needed)

const gradesList = [
  'Pre-School - Age 3', 'Pre-School - Age 4', 'Kindergarten', '1st Grade', '2nd Grade',
  '3rd Grade', '4th Grade', '5th Grade', '6th Grade', '7th Grade', '8th Grade',
  '9th Grade', '10th Grade', '11th Grade', '12th Grade', 'College'
];

const AlhanAdmin = () => {
  const [teachers, setTeachers] = useState([]);
  const [church, setChurch] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedGrades, setSelectedGrades] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch current user's church
  useEffect(() => {
    const user = auth().currentUser;
    if (user) {
      firestore()
        .collection('users')
        .doc(user.uid)
        .get()
        .then((doc) => {
          if (doc.exists) {
            setChurch(doc.data().church);
          }
          setLoading(false);
        })
        .catch((error) => {
          console.error('Error fetching church:', error);
          setLoading(false);
        });
    }
  }, []);

  // Fetch teachers from the Alhan Teachers collection in the same church with realtime updates
  useEffect(() => {
    if (church) {
      const unsubscribe = firestore()
        .collection('Alhan Teachers')
        .where('church', '==', church)
        .onSnapshot(
          (querySnapshot) => {
            const teacherList = querySnapshot.docs
              .map((doc) => ({
                id: doc.id,
                ...doc.data(),
              }))
              .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by name
            setTeachers(teacherList);
          },
          (error) => {
            console.error('Error fetching teachers:', error);
          }
        );
      return () => unsubscribe();
    }
  }, [church]);

  const openEditModal = (teacher) => {
    setSelectedTeacher(teacher);
    setSelectedGrades(Array.isArray(teacher.alhanGrades) ? teacher.alhanGrades : []);
    setModalVisible(true);
  };

  const saveClasses = async () => {
    if (!selectedTeacher) return;

    try {
      await firestore()
        .collection('Alhan Teachers')
        .doc(selectedTeacher.id)
        .update({
          alhanGrades: selectedGrades,
        });
      setModalVisible(false);
    } catch (error) {
      console.error('Error saving classes:', error);
    }
  };

  const removeTeacher = async (teacherId) => {
    try {
      await firestore()
        .collection('Alhan Teachers')
        .doc(teacherId)
        .update({
          isAlhanTeacher: false,
          alhanGrades: [],
        });
    } catch (error) {
      console.error('Error removing teacher:', error);
    }
  };

  const renderTeacher = ({ item }) => (
    <View style={styles.servantCard}>
      <View style={styles.servantInfo}>
        <Text style={styles.servantName}>{item.name}</Text>
        <Text style={styles.servantGrades}>
          {Array.isArray(item.alhanGrades) && item.alhanGrades.length > 0
            ? item.alhanGrades.join(', ')
            : 'No classes assigned'}
        </Text>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name="pencil" size={18} color="#fff" />
          <Text style={styles.buttonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.removeButton]}
          onPress={() => removeTeacher(item.id)}
        >
          <Ionicons name="trash" size={18} color="#fff" />
          <Text style={styles.buttonText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

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
      <Text style={styles.header}>Manage Alhan Teachers</Text>
      <FlatList
        data={teachers}
        renderItem={renderTeacher}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={<Text style={styles.emptyText}>No teachers found.</Text>}
        showsVerticalScrollIndicator={false}
      />
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Assign Classes for {selectedTeacher?.name}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={gradesList}
              renderItem={({ item: grade }) => (
                <TouchableOpacity
                  style={[
                    styles.gradeItem,
                    selectedGrades.includes(grade) && styles.gradeItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedGrades((prev) => {
                      // Toggle the grade in the selection
                      const toggled = prev.includes(grade)
                        ? prev.filter((g) => g !== grade)
                        : [...prev, grade];
                      // Return the toggled selections sorted according to the original gradesList order
                      return gradesList.filter(g => toggled.includes(g));
                    });
                  }}
                >
                  <Text style={styles.gradeText}>{grade}</Text>
                  {selectedGrades.includes(grade) && (
                    <Ionicons name="checkmark-circle" size={20} color="#147efb" />
                  )}
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.gradesList}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveClasses}
              >
                <Text style={styles.modalButtonText}>Save Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
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
    backgroundColor: '#121212',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
  servantCard: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  servantInfo: {
    marginBottom: 12,
  },
  servantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  servantGrades: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  editButton: {
    backgroundColor: '#147efb',
  },
  removeButton: {
    backgroundColor: '#ff4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#fff',
  },
  emptyText: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#147efb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  gradesList: {
    padding: 16,
  },
  gradeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#2a2a2a',
  },
  gradeItemSelected: {
    backgroundColor: '#3a3a3a',
  },
  gradeText: {
    fontSize: 16,
    color: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#333',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#147efb',
  },
  cancelButton: {
    backgroundColor: '#555',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default AlhanAdmin;
