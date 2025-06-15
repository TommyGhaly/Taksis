import React, { useState, useEffect, useRef } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Alert, Image, FlatList } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import PhotoInput from "../components/photoInput";

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

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
  const [sections, setSections] = useState([]);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  const [photoInputVisible, setPhotoInputVisible] = useState(false);
  const [isListReady, setIsListReady] = useState(false);
  const sectionListRef = useRef(null);

  // Alphabet for index bar (only letters with data)
  const [availableLetters, setAvailableLetters] = useState([]);

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
          setLoading(false);
          Alert.alert('Error', 'Could not fetch user data. Please try again.');
        });
    }
  }, []);

  // Fetch teachers and profile pictures
  useEffect(() => {
    if (church) {
      const fetchProfilePictureUrls = async () => {
        try {
          const querySnapshot = await firestore()
            .collection('users')
            .where('church', '==', church)
            .where('isAlhan', '==', true)
            .get();
          const urls = {};
          await Promise.all(
            querySnapshot.docs.map(async (doc) => {
              const uid = doc.id;
              try {
                const url = await storage()
                  .ref(`profilePictures/${uid}.png`)
                  .getDownloadURL();
                urls[uid] = typeof url === "string" && url.trim() ? url : null;
              } catch (error) {
                urls[uid] = null;
              }
            })
          );
          setProfilePictureUrls(urls);
        } catch (error) {}
      };

      fetchProfilePictureUrls();
      const intervalId = setInterval(fetchProfilePictureUrls, 30000);

      const unsubscribe = firestore()
        .collection('users')
        .where('church', '==', church)
        .where('isAlhan', '==', true)
        .onSnapshot(
          (querySnapshot) => {
            const teacherList = querySnapshot.docs
              .map((doc) => ({
                id: doc.id,
                name: (doc.data().name || "").trim().toLowerCase(),
                ...doc.data(),
              }))
              .sort((a, b) => {
                const nameComparison = a.name.localeCompare(b.name);
                if (nameComparison === 0) {
                  return a.id.localeCompare(b.id);
                }
                return nameComparison;
              })
              .map((teacher) => ({
                ...teacher,
                name: querySnapshot.docs
                  .find((d) => d.id === teacher.id)
                  ?.data().name || "",
              }));

            // Group teachers by first letter
            const grouped = teacherList.reduce((acc, teacher) => {
              const firstLetter = teacher.name.charAt(0).toUpperCase() || "Other";
              if (!acc[firstLetter]) acc[firstLetter] = [];
              acc[firstLetter].push(teacher);
              return acc;
            }, {});

            // Convert to SectionList format
            const sectionData = Object.keys(grouped)
              .sort()
              .map((letter) => ({
                title: letter,
                data: grouped[letter],
              }));

            // Set available letters
            const letters = sectionData.map((section) => section.title).sort();

            setTeachers(teacherList);
            setSections(sectionData);
            setAvailableLetters(letters);
          },
          (error) => {
            Alert.alert('Error', 'Could not fetch teachers.');
          }
        );

      return () => {
        clearInterval(intervalId);
        unsubscribe();
      };
    }
  }, [church]);

  const openEditModal = (teacher) => {
    if (!teacher?.id) return;
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setSelectedTeacher(teacher);
    setSelectedGrades(Array.isArray(teacher.alhanGrades) ? teacher.alhanGrades : []);
    setModalVisible(true);
  };

  const openPhotoInputModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setPhotoInputVisible(true);
  };

  const closeEditModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setModalVisible(false);
    setSelectedTeacher(null);
    setSelectedGrades([]);
  };

  const closePhotoInputModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setPhotoInputVisible(false);
  };

  const saveClasses = async () => {
    if (!selectedTeacher) return;

    try {
      await firestore()
        .collection('users')
        .doc(selectedTeacher.id)
        .update({
          alhanGrades: selectedGrades,
        });
      setModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'Could not save classes. Please try again.');
    }
  };

  const removeTeacher = async (teacherId) => {
    try {
      await firestore()
        .collection('users')
        .doc(teacherId)
        .update({
          isAlhan: false,
          alhanGrades: [],
        });
    } catch (error) {
      Alert.alert('Error', 'Could not remove teacher. Please try again.');
    }
  };

  const scrollToSection = (letter) => {
    if (!sectionListRef.current || !availableLetters.includes(letter) || !isListReady) {
      return;
    }

    const sectionIndex = sections.findIndex(
      (section) => section.title.toUpperCase() === letter.toUpperCase()
    );

    if (sectionIndex >= 0) {
      try {
        sectionListRef.current.scrollToLocation({
          sectionIndex,
          itemIndex: 0,
          animated: false,
          viewPosition: 0,
          viewOffset: 0,
        });
      } catch (error) {
        // Fallback: Calculate item index
        let itemIndex = 0;
        for (let i = 0; i < sectionIndex; i++) {
          itemIndex += sections[i].data.length; // Items only
          itemIndex += 1; // Section header
        }
        try {
          sectionListRef.current.scrollToIndex({
            index: itemIndex,
            animated: false,
            viewPosition: 0,
          });
        } catch (fallbackError) {}
      }
    }
  };

  const renderTeacher = ({ item }) => (
    <View style={styles.teacherCard}>
      <View style={styles.teacherInfo}>
        <View style={styles.teacherImageContainer}>
          <Image
            style={styles.teacherImage}
            source={
              item.id && profilePictureUrls[item.id]
                ? { uri: profilePictureUrls[item.id] }
                : require("../assets/default_profile.png")
            }
            defaultSource={require("../assets/default_profile.png")}
            onError={() => {
              setProfilePictureUrls((prev) => ({
                ...prev,
                [item.id]: null,
              }));
            }}
          />
        </View>
        <View style={styles.teacherTextInfo}>
          <Text style={styles.teacherName}>{item.name}</Text>
          <Text style={styles.teacherGrades}>
            {Array.isArray(item.alhanGrades) && item.alhanGrades.length > 0
              ? item.alhanGrades.join(', ')
              : 'No classes assigned'}
          </Text>
        </View>
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

  const renderSectionHeader = ({ section: { title } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
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
      <View style={styles.listWrapper}>
        <SectionList
          ref={sectionListRef}
          sections={sections}
          renderItem={renderTeacher}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No teachers found.</Text>
          }
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          extraData={profilePictureUrls}
          onLayout={() => {
            setIsListReady(true);
          }}
        />
        <View style={styles.indexBar}>
          {availableLetters.map((letter) => (
            <TouchableOpacity
              key={letter}
              style={styles.indexItem}
              onPressIn={() => {
                scrollToSection(letter);
                ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
              }}
            >
              <Text style={styles.indexText}>{letter}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {selectedTeacher && (
        <Modal visible={modalVisible} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.headerContent}>
                  <View style={styles.profileImageContainer}>
                    <Image
                      style={styles.profileImage}
                      source={
                        selectedTeacher.id && profilePictureUrls[selectedTeacher.id]
                          ? { uri: profilePictureUrls[selectedTeacher.id] }
                          : require("../assets/default_profile.png")
                      }
                      defaultSource={require("../assets/default_profile.png")}
                      onError={() => {
                        setProfilePictureUrls((prev) => ({
                          ...prev,
                          [selectedTeacher.id]: null,
                        }));
                      }}
                    />
                    <TouchableOpacity
                      style={styles.editProfilePictureButton}
                      onPress={openPhotoInputModal}
                    >
                      <Ionicons name="pencil" size={16} color="#147efb" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.modalTitle}>
                    Assign Classes for {selectedTeacher?.name}
                  </Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={closeEditModal}>
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
                        const toggled = prev.includes(grade)
                          ? prev.filter((g) => g !== grade)
                          : [...prev, grade];
                        return gradesList.filter((g) => toggled.includes(g));
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
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={closeEditModal}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveClasses}
                >
                  <Text style={styles.modalButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      {selectedTeacher && (
        <PhotoInput
          visible={photoInputVisible}
          onClose={closePhotoInputModal}
          userId={selectedTeacher.id}
        />
      )}
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
  listWrapper: {
    flex: 1,
    flexDirection: 'row',
  },
  listContainer: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  teacherCard: {
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
  teacherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  teacherImageContainer: {
    marginRight: 12,
  },
  teacherImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#333333',
  },
  teacherTextInfo: {
    flex: 1,
  },
  teacherName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  teacherGrades: {
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
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#fff',
  },
  editProfilePictureButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  closeButton: {
    padding: 4,
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
    justifyContent: 'space-between',
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
    backgroundColor: '#ff4444',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  sectionHeader: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  indexBar: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  indexItem: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  indexText: {
    fontSize: 16,
    color: '#147efb',
    fontWeight: '600',
  },
});

export default AlhanAdmin;