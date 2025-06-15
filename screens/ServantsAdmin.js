import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Switch,
  Alert,
  Image,
  FlatList
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import PhotoInput from '../components/photoInput';

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const gradesList = [
  'Pre-School - Age 3',
  'Pre-School - Age 4',
  'Kindergarten',
  '1st Grade',
  '2nd Grade',
  '3rd Grade',
  '4th Grade',
  '5th Grade',
  '6th Grade',
  '7th Grade',
  '8th Grade',
  '9th Grade',
  '10th Grade',
  '11th Grade',
  '12th Grade',
  'College',
];

const ServantsAdmin = () => {
  const [servants, setServants] = useState([]);
  const [church, setChurch] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedServant, setSelectedServant] = useState(null);
  const [selectedGrades, setSelectedGrades] = useState([]);
  const [isServantMeeting, setIsServantMeeting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  const [photoInputVisible, setPhotoInputVisible] = useState(false);
  const [sections, setSections] = useState([]);
  const [availableLetters, setAvailableLetters] = useState([]);
  const [isListReady, setIsListReady] = useState(false);
  const sectionListRef = useRef(null);

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
          Alert.alert(
            'Error',
            'Could not fetch user data. Please try again.',
            [{ text: 'OK' }]
          );
        });
    }
  }, []);

  // Fetch servants and profile pictures
  useEffect(() => {
    if (church) {
      const fetchProfilePictureUrls = async () => {
        try {
          const querySnapshot = await firestore()
            .collection('users')
            .where('church', '==', church)
            .where('isSSTeacher', '==', true)
            .get();
          const urls = {};
          await Promise.all(
            querySnapshot.docs.map(async (doc) => {
              const uid = doc.id;
              try {
                const url = await storage()
                  .ref(`profilePictures/${uid}.png`)
                  .getDownloadURL();
                urls[uid] = typeof url === 'string' && url.trim() ? url : null;
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
        .where('isSSTeacher', '==', true)
        .onSnapshot(
          (querySnapshot) => {
            const servantList = querySnapshot.docs
              .map((doc) => ({
                id: doc.id,
                name: (doc.data().name || '').trim().toLowerCase(),
                ...doc.data(),
              }))
              .sort((a, b) => {
                const nameComparison = a.name.localeCompare(b.name);
                if (nameComparison === 0) {
                  return a.id.localeCompare(b.id);
                }
                return nameComparison;
              })
              .map((servant) => ({
                ...servant,
                name: querySnapshot.docs
                  .find((d) => d.id === servant.id)
                  ?.data().name || '',
              }));

            // Group servants by first letter
            const grouped = servantList.reduce((acc, servant) => {
              const firstLetter = servant.name.charAt(0).toUpperCase() || 'Other';
              if (!acc[firstLetter]) acc[firstLetter] = [];
              acc[firstLetter].push(servant);
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

            setServants(servantList);
            setSections(sectionData);
            setAvailableLetters(letters);
          },
          (error) => {
            Alert.alert('Error', 'Could not fetch servants.');
          }
        );

      return () => {
        clearInterval(intervalId);
        unsubscribe();
      };
    }
  }, [church]);

  const openEditModal = (servant) => {
    if (!servant?.id) return;
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setSelectedServant(servant);
    setSelectedGrades(Array.isArray(servant.ssGrades) ? servant.ssGrades : []);
    setIsServantMeeting(servant.isServant || false);
    setModalVisible(true);
  };

  const openPhotoInputModal = () => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setPhotoInputVisible(true);
  };

  const closeEditModal = () => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setModalVisible(false);
    setSelectedServant(null);
    setSelectedGrades([]);
    setIsServantMeeting(false);
  };

  const closePhotoInputModal = () => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setPhotoInputVisible(false);
  };

  const saveClasses = async () => {
    if (!selectedServant) return;

    try {
      await firestore()
        .collection('users')
        .doc(selectedServant.id)
        .update({
          ssGrades: selectedGrades,
          isServant: isServantMeeting,
        });
      setModalVisible(false);
    } catch (error) {
      Alert.alert(
        'Error',
        'Could not save classes. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const removeServant = async (servantId) => {
    try {
      await firestore()
        .collection('users')
        .doc(servantId)
        .update({
          isSSTeacher: false,
          ssGrades: [],
          isServant: false,
        });
    } catch (error) {
      Alert.alert(
        'Error',
        'Could not remove servant. Please try again.',
        [{ text: 'OK' }]
      );
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

  const renderServant = ({ item }) => (
    <View style={styles.servantCard}>
      <View style={styles.servantInfo}>
        <View style={styles.servantImageContainer}>
          <Image
            style={styles.servantImage}
            source={
              item.id && profilePictureUrls[item.id]
                ? { uri: profilePictureUrls[item.id] }
                : require('../assets/default_profile.png')
            }
            defaultSource={require('../assets/default_profile.png')}
            onError={() => {
              setProfilePictureUrls((prev) => ({
                ...prev,
                [item.id]: null,
              }));
            }}
          />
        </View>
        <View style={styles.servantTextInfo}>
          <Text style={styles.servantName}>{item.name}</Text>
          <Text style={styles.servantGrades}>
            {Array.isArray(item.ssGrades) && item.ssGrades.length > 0
              ? item.ssGrades.join(', ')
              : 'No classes assigned'}
          </Text>
        </View>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => openEditModal(item)}
        >
          <Ionicons name='pencil' size={18} color='#fff' />
          <Text style={styles.buttonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.removeButton]}
          onPress={() => removeServant(item.id)}
        >
          <Ionicons name='trash' size={18} color='#fff' />
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
        <ActivityIndicator size='large' color='#147efb' />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Manage Sunday School Servants</Text>
      <View style={styles.listWrapper}>
        <SectionList
          ref={sectionListRef}
          sections={sections}
          renderItem={renderServant}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={<Text style={styles.emptyText}>No servants found.</Text>}
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
                ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
              }}
            >
              <Text style={styles.indexText}>{letter}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      {selectedServant && (
        <Modal visible={modalVisible} animationType='fade' transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.headerContent}>
                  <View style={styles.profileImageContainer}>
                    <Image
                      style={styles.profileImage}
                      source={
                        selectedServant.id && profilePictureUrls[selectedServant.id]
                          ? { uri: profilePictureUrls[selectedServant.id] }
                          : require('../assets/default_profile.png')
                      }
                      defaultSource={require('../assets/default_profile.png')}
                      onError={() => {
                        setProfilePictureUrls((prev) => ({
                          ...prev,
                          [selectedServant.id]: null,
                        }));
                      }}
                    />
                    <TouchableOpacity
                      style={styles.editProfilePictureButton}
                      onPress={openPhotoInputModal}
                    >
                      <Ionicons name='pencil' size={16} color='#147efb' />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.modalTitle}>
                    Assign Classes for {selectedServant?.name}
                  </Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={closeEditModal}>
                  <Ionicons name='close' size={24} color='#fff' />
                </TouchableOpacity>
              </View>
              <View style={styles.modalContent}>
                <View style={styles.servantTrackerContainer}>
                  <Text style={styles.servantTrackerText}>Servant Meeting Tracker</Text>
                  <Switch
                    value={isServantMeeting}
                    onValueChange={(value) => setIsServantMeeting(value)}
                    trackColor={{ false: '#555', true: '#147efb' }}
                    thumbColor={isServantMeeting ? '#fff' : '#aaa'}
                  />
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
                        <Ionicons name='checkmark-circle' size={20} color='#147efb' />
                      )}
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item) => item}
                  contentContainerStyle={styles.gradesList}
                  nestedScrollEnabled={true}
                />
              </View>
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
      {selectedServant && (
        <PhotoInput
          visible={photoInputVisible}
          onClose={closePhotoInputModal}
          userId={selectedServant.id}
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  servantImageContainer: {
    marginRight: 12,
  },
  servantImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#333333',
  },
  servantTextInfo: {
    flex: 1,
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
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#147efb',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
  modalContent: {
    padding: 16,
    flex: 1,
  },
  servantTrackerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#2a2a2a',
  },
  servantTrackerText: {
    fontSize: 16,
    color: '#fff',
  },
  gradesList: {
    paddingBottom: 16,
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

export default ServantsAdmin;