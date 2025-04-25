import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, StyleSheet, ActivityIndicator, Alert, Animated } from 'react-native';
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

  // Animation setup
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Animate modal open
  const animateModalOpen = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Animate modal close
  const animateModalClose = () => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setModalVisible(false));
  };

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
              const deaconList = doc.data().deacons || [];

              const sortedDeacons = deaconList
                .map((deacon) => ({
                  ...deacon,
                  name: (deacon.name || '').trim().toLowerCase(),
                }))
                .sort((a, b) => {
                  const nameComparison = a.name.localeCompare(b.name);
                  if (nameComparison === 0) {
                    return a.uid.localeCompare(b.uid);
                  }
                  return nameComparison;
                })
                .map((deacon) => ({
                  ...deacon,
                  name: doc.data().deacons.find((d) => d.uid === deacon.uid).name,
                }));

                setDeacons(sortedDeacons);
            }
          },
          (error) => {
            console.error('Error fetching deacons:', error);
          }
        );
      return () => unsubscribe();
    }
  }, [church]);

  // Open the edit modal with animation
  const openEditModal = (deacon) => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setSelectedDeacon(deacon);
    setTempExperience(deacon.experience);
    setTempFrequency(deacon.frequency);
    setModalVisible(true);
    animateModalOpen();
  };

  // Save the edited values to Firestore
  const saveEdits = async () => {
    if (!selectedDeacon) return;

    ReactNativeHapticFeedback.trigger('impactMedium', hapticOptions);

    try {
      const churchRef = firestore().collection('churches').doc(church);
      const churchDoc = await churchRef.get();
      const currentDeacons = churchDoc.data().deacons || [];
      const updatedDeacons = currentDeacons.map((d) =>
        d.uid === selectedDeacon.uid
          ? { ...d, experience: tempExperience, frequency: tempFrequency }
          : d
      );
      await churchRef.update({ deacons: updatedDeacons });

      const userQuery = await firestore()
        .collection('users')
        .where('church', '==', church)
        .where('uid', '==', selectedDeacon.uid)
        .get();

      if (!userQuery.empty) {
        const userDoc = userQuery.docs[0];
        await userDoc.ref.update({
          experience: tempExperience,
          frequency: tempFrequency,
        });
      } else {
        const usersQuery = await firestore()
          .collection('users')
          .where('church', '==', church)
          .get();

        for (const userDoc of usersQuery.docs) {
          const userData = userDoc.data();
          const children = userData.children || [];
          const childIndex = children.findIndex((c) => c.uid === selectedDeacon.uid);
          if (childIndex !== -1) {
            const updatedChildren = [...children];
            updatedChildren[childIndex] = {
              ...updatedChildren[childIndex],
              experience: tempExperience,
              frequency: tempFrequency,
            };
            await userDoc.ref.update({ children: updatedChildren });
            break;
          }
        }
      }

      animateModalClose();
    } catch (error) {
      console.error('Error saving edits:', error);
    }
  };

  // Handle cancel with haptic feedback
  const handleCancel = () => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    animateModalClose();
  };

  // Handle remove deacon with warning
  const handleRemove = () => {
    if (!selectedDeacon) return;

    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);

    Alert.alert(
      'Remove Deacon',
      `Are you sure you want to remove ${selectedDeacon.name} as a deacon?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => ReactNativeHapticFeedback.trigger('impactLight', hapticOptions),
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            ReactNativeHapticFeedback.trigger('impactMedium', hapticOptions);
            try {
              const churchRef = firestore().collection('churches').doc(church);
              const churchDoc = await churchRef.get();
              const currentDeacons = churchDoc.data().deacons || [];
              const updatedDeacons = currentDeacons.filter(
                (d) => d.uid !== selectedDeacon.uid
              );
              await churchRef.update({ deacons: updatedDeacons });

              const userQuery = await firestore()
                .collection('users')
                .where('church', '==', church)
                .where('uid', '==', selectedDeacon.uid)
                .get();

              if (!userQuery.empty) {
                const userDoc = userQuery.docs[0];
                await userDoc.ref.update({ isDeacon: false });
              } else {
                const usersQuery = await firestore()
                  .collection('users')
                  .where('church', '==', church)
                  .get();

                for (const userDoc of usersQuery.docs) {
                  const userData = userDoc.data();
                  const children = userData.children || [];
                  const childIndex = children.findIndex(
                    (c) => c.uid === selectedDeacon.uid
                  );
                  if (childIndex !== -1) {
                    const updatedChildren = [...children];
                    updatedChildren[childIndex] = {
                      ...updatedChildren[childIndex],
                      isDeacon: false,
                    };
                    await userDoc.ref.update({ children: updatedChildren });
                    break;
                  }
                }
              }

              animateModalClose();
            } catch (error) {
              console.error('Error removing deacon:', error);
              Alert.alert('Error', 'Failed to remove deacon. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Handle slider value change with haptic feedback on discrete steps
  const handleSliderChange = (setter, currentValue) => (value) => {
    const step = 0.25;
    const prevStep = Math.round(currentValue / step) * step;
    const newStep = Math.round(value / step) * step;
    if (prevStep !== newStep) {
      ReactNativeHapticFeedback.trigger('selection', hapticOptions);
    }
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
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="none"
        transparent={true}
        onRequestClose={handleCancel}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalContent,
              {
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit {selectedDeacon?.name}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleCancel}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>
                Experience: {formatNumber(tempExperience)}
              </Text>
              <View style={styles.sliderTrack}>
                <Slider
                  value={tempExperience}
                  onValueChange={handleSliderChange(setTempExperience, tempExperience)}
                  minimumValue={0}
                  maximumValue={10}
                  step={0.25}
                  thumbTintColor="#147efb"
                  minimumTrackTintColor="#147efb"
                  maximumTrackTintColor="#666"
                  thumbStyle={styles.sliderThumb}
                  trackStyle={styles.sliderTrackStyle}
                  style={styles.slider}
                />
              </View>
            </View>

            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>
                Frequency: {formatNumber(tempFrequency)}
              </Text>
              <View style={styles.sliderTrack}>
                <Slider
                  value={tempFrequency}
                  onValueChange={handleSliderChange(setTempFrequency, tempFrequency)}
                  minimumValue={0}
                  maximumValue={10}
                  step={0.25}
                  thumbTintColor="#147efb"
                  minimumTrackTintColor="#147efb"
                  maximumTrackTintColor="#666"
                  thumbStyle={styles.sliderThumb}
                  trackStyle={styles.sliderTrackStyle}
                  style={styles.slider}
                />
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.removeButton]}
                onPress={handleRemove}
                activeOpacity={0.7}
              >
                <Ionicons name="trash" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleCancel}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={saveEdits}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
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
    backgroundColor: '#000000', // Solid black
  },
  modalContent: {
    width: '92%',
    maxWidth: 400,
    backgroundColor: '#222222', // Solid dark gray
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#333333', // Solid border
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333', // Solid divider
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#444444', // Solid gray
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#555555', // Solid border
  },
  sliderContainer: {
    marginVertical: 20,
    padding: 16,
    borderRadius: 12,
  },
  sliderLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  sliderTrack: {
    borderRadius: 6,
    paddingVertical: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#147efb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sliderTrackStyle: {
    height: 6,
    borderRadius: 3,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  removeButton: {
    flex: 0,
    width: 48,
    paddingVertical: 12,
    backgroundColor: '#ff4444', // Solid red
    borderWidth: 1,
    borderColor: '#cc3333', // Solid border
  },
  cancelButton: {
    backgroundColor: '#555555', // Solid gray
    borderWidth: 1,
    borderColor: '#444444', // Solid border
  },
  confirmButton: {
    backgroundColor: '#147efb', // Solid blue
    borderWidth: 1,
    borderColor: '#1167d0', // Solid border
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

export default DeaconEdits;