import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Function to format numbers, removing unnecessary decimal places
const formatNumber = (num) => {
  if (num % 1 === 0) {
    return num.toString();
  } else {
    return num.toFixed(2).replace(/\.?0+$/, '');
  }
};

const DeaconEdits = () => {
  const [church, setChurch] = useState(null);
  const [deacons, setDeacons] = useState([]);
  const [selectedDeacon, setSelectedDeacon] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [tempExperience, setTempExperience] = useState(0);
  const [tempFrequency, setTempFrequency] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch the user's church on mount
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

  // Subscribe to deacons array updates when church is set (real-time updates)
  useEffect(() => {
    if (church) {
      const unsubscribe = firestore()
        .collection('churches')
        .doc(church)
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              const deaconList = (doc.data().deacons || []).sort((a, b) =>
                a.name.localeCompare(b.name)
              );
              setDeacons(deaconList);
              // If no deacon is selected and there are deacons, select the first one
              if (deaconList.length > 0 && !selectedDeacon) {
                setSelectedDeacon(deaconList[0]);
                setTempExperience(deaconList[0].experience);
                setTempFrequency(deaconList[0].frequency);
                setModalVisible(true);
              }
            }
          },
          (error) => {
            console.error('Error fetching deacons:', error);
          }
        );
      return () => unsubscribe();
    }
  }, [church]);

  // Open the edit modal with the selected deacon's data
  const openEditModal = (deacon) => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setSelectedDeacon(deacon);
    setTempExperience(deacon.experience);
    setTempFrequency(deacon.frequency);
    setModalVisible(true);
  };

  // Save the edited values to Firestore
  const saveEdits = async () => {
    if (!selectedDeacon) return;

    ReactNativeHapticFeedback.trigger('impactMedium', hapticOptions);

    try {
      // Update the church document
      const churchRef = firestore().collection('churches').doc(church);
      const churchDoc = await churchRef.get();
      const currentDeacons = churchDoc.data().deacons || [];
      const updatedDeacons = currentDeacons.map((d) =>
        d.name === selectedDeacon.name
          ? { ...d, experience: tempExperience, frequency: tempFrequency }
          : d
      );
      await churchRef.update({ deacons: updatedDeacons });

      // Check if the deacon is a registered user
      const userQuery = await firestore()
        .collection('users')
        .where('church', '==', church)
        .where('name', '==', selectedDeacon.name)
        .get();

      if (!userQuery.empty) {
        // Update the user document
        const userDoc = userQuery.docs[0];
        await userDoc.ref.update({
          experience: tempExperience,
          frequency: tempFrequency,
        });
      } else {
        // Find the parent user for a child deacon
        const usersQuery = await firestore()
          .collection('users')
          .where('church', '==', church)
          .get();

        for (const userDoc of usersQuery.docs) {
          const userData = userDoc.data();
          const children = userData.children || [];
          const childIndex = children.findIndex((c) => c.name === selectedDeacon.name);
          if (childIndex !== -1) {
            const updatedChildren = [...children];
            updatedChildren[childIndex] = {
              ...updatedChildren[childIndex],
              experience: tempExperience,
              frequency: tempFrequency,
            };
            await userDoc.ref.update({ children: updatedChildren });
            break; // Assume only one parent per child name
          }
        }
      }

      setModalVisible(false);
    } catch (error) {
      console.error('Error saving edits:', error);
    }
  };

  // Handle cancel with haptic feedback
  const handleCancel = () => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setModalVisible(false);
  };

  // Handle slider value change with haptic feedback on discrete steps
  const handleSliderChange = (setter, currentValue) => (value) => {
    // Trigger haptic only when crossing a 0.25 step boundary
    const step = 0.25;
    const prevStep = Math.round(currentValue / step) * step;
    const newStep = Math.round(value / step) * step;
    if (prevStep !== newStep) {
      ReactNativeHapticFeedback.trigger('selection', hapticOptions);
    }
    // Update state immediately for smooth visual feedback
    setter(value);
  };

  // Render each deacon item
  const renderDeacon = ({ item }) => (
    <TouchableOpacity
      style={styles.deaconItem}
      onPress={() => openEditModal(item)}
      activeOpacity={0.7}
    >
      <View style={styles.deaconInfo}>
        <Text style={styles.deaconName}>{item.name}</Text>
        <Text style={styles.deaconDetail}>Age: {item.age}</Text>
        <Text style={styles.deaconDetail}>Experience: {formatNumber(item.experience)}</Text>
        <Text style={styles.deaconDetail}>Frequency: {formatNumber(item.frequency)}</Text>
      </View>
      <Ionicons name="pencil" size={20} color="#147efb" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#147efb" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Edit Deacons</Text>
      {deacons.length === 0 ? (
        <Text style={styles.noData}>No deacons found.</Text>
      ) : (
        <FlatList
          data={deacons}
          renderItem={renderDeacon}
          keyExtractor={(item) => item.name}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Edit Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit {selectedDeacon?.name}</Text>
              <TouchableOpacity onPress={handleCancel}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>
                Experience: {formatNumber(tempExperience)}
              </Text>
              <Slider
                value={tempExperience}
                onValueChange={handleSliderChange(setTempExperience, tempExperience)}
                minimumValue={0}
                maximumValue={10}
                step={0.25}
                thumbTintColor="#147efb"
                minimumTrackTintColor="#147efb"
                maximumTrackTintColor="#555"
                style={styles.slider}
              />
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>
                Frequency: {formatNumber(tempFrequency)}
              </Text>
              <Slider
                value={tempFrequency}
                onValueChange={handleSliderChange(setTempFrequency, tempFrequency)}
                minimumValue={0}
                maximumValue={10}
                step={0.25}
                thumbTintColor="#147efb"
                minimumTrackTintColor="#147efb"
                maximumTrackTintColor="#555"
                style={styles.slider}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={saveEdits}
              >
                <Text style={styles.buttonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Styles
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
    textAlign: 'center',
    marginBottom: 20,
  },
  listContainer: {
    paddingBottom: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#aaa',
  },
  deaconItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  deaconInfo: {
    flex: 1,
  },
  deaconName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  deaconDetail: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 4,
  },
  noData: {
    textAlign: 'center',
    fontSize: 16,
    color: '#aaa',
    marginTop: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  sliderContainer: {
    marginVertical: 15,
  },
  sliderLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ff4444',
  },
  confirmButton: {
    backgroundColor: '#147efb',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default DeaconEdits;