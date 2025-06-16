import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import IndividualProfile from '../components/individualProfile';

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Responsive design helper
const { width, height } = Dimensions.get('window');
const isTablet = Platform.isPad || (width >= 768 && height >= 768);
const scale = isTablet ? 1.2 : 1;
const paddingHorizontal = isTablet ? 32 : 16;
const indexBarWidth = isTablet ? 32 : 24;

const ServantsAdmin = () => {
  const [servants, setServants] = useState([]);
  const [church, setChurch] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedServant, setSelectedServant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  const [sections, setSections] = useState([]);
  const [availableLetters, setAvailableLetters] = useState([]);
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerHeightRef = useRef(0);
  const sectionListRef = useRef(null);

  // Fetch user's church with real-time updates
  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      setLoading(false);
      Alert.alert('Error', 'No user authenticated.', [{ text: 'OK' }]);
      return;
    }

    const unsubscribe = firestore()
      .collection('users')
      .doc(user.uid)
      .onSnapshot(
        (doc) => {
          if (doc.exists) {
            setChurch(doc.data().church || null);
          }
          setLoading(false);
        },
        (error) => {
          setLoading(false);
          Alert.alert('Error', 'Failed to fetch church data.', [{ text: 'OK' }]);
        }
      );

    return () => unsubscribe();
  }, []);

  // Fetch servants and profile pictures
  useEffect(() => {
    if (!church) return;

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
              console.warn(`Failed to fetch profile picture for ${uid}:`, error);
              urls[uid] = null;
            }
          })
        );
        setProfilePictureUrls(urls);
      } catch (error) {
        console.warn('Error fetching profile pictures:', error);
      }
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
          Alert.alert('Error', 'Could not fetch servants.', [{ text: 'OK' }]);
        }
      );

    return () => {
      clearInterval(intervalId);
      unsubscribe();
    };
  }, [church]);

  // Open edit modal
  const openEditModal = (servant) => {
    if (!servant?.id) return;
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setSelectedServant(servant);
    setModalVisible(true);
  };

  // Close edit modal
  const closeEditModal = () => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setModalVisible(false);
    setSelectedServant(null);
  };

  // Remove servant
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
      closeEditModal();
    } catch (error) {
      Alert.alert('Error', 'Could not remove servant. Please try again.', [{ text: 'OK' }]);
    }
  };

  // Scroll to section
  const scrollToSection = (letter) => {
    const sectionIndex = sections.findIndex((s) => s.title === letter);
    if (sectionIndex < 0 || !sectionListRef.current) return;

    sectionListRef.current.scrollToLocation({
      sectionIndex,
      itemIndex: 1,
      animated: false,
      viewPosition: 0,
      viewOffset: headerHeight,
    });
  };

  // Render section header
  const renderSectionHeader = ({ section: { title } }) => (
    <View
      style={styles.sectionHeader}
      onLayout={(event) => {
        const { height } = event.nativeEvent.layout;
        if (height > 0 && headerHeightRef.current !== height) {
          headerHeightRef.current = height;
          setHeaderHeight(height);
        }
      }}
    >
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  // Render servant item
  const renderServant = ({ item }) => (
    <TouchableOpacity
      style={styles.servantItem}
      onPress={() => openEditModal(item)}
      activeOpacity={0.7}
    >
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
      <View style={styles.servantInfo}>
        <Text style={styles.servantName}>{item.name || 'Unknown'}</Text>
        <Text style={styles.servantDetail}>
          Grades: {Array.isArray(item.ssGrades) && item.ssGrades.length > 0 ? item.ssGrades.join(', ') : 'None'}
        </Text>
        <Text style={styles.servantDetail}>
          Servant Meeting: {item.isServant ? 'Yes' : 'No'}
        </Text>
      </View>
      <Ionicons name="pencil" size={20 * scale} color="#147efb" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size={isTablet ? 'large' : 'small'} color="#147efb" />
        <Text style={[styles.loadingText, { fontSize: 16 * scale }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingHorizontal }]}>
      {sections.length === 0 ? (
        <Text style={[styles.noData, { fontSize: 16 * scale }]}>No servants found.</Text>
      ) : (
        <View style={[styles.listWrapper, { paddingRight: indexBarWidth }]}>
          <SectionList
            ref={sectionListRef}
            sections={sections}
            renderItem={renderServant}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={(item) => item.id || Math.random().toString()}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={true}
            extraData={profilePictureUrls}
          />
          <View style={[styles.indexBar, { width: indexBarWidth }]}>
            {availableLetters.map((letter) => (
              <View
                key={letter}
                style={styles.indexItem}
                onTouchStart={() => {
                  scrollToSection(letter);
                  ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
                }}
              >
                <Text style={[styles.indexText, { fontSize: 18 * scale }]}>{letter}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {selectedServant && (
        <IndividualProfile
          userId={selectedServant.id}
          show={modalVisible}
          onClose={closeEditModal}
          church={church}
          week=""
          family=""
          url=""
          onRemove={() => removeServant(selectedServant.id)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingTop: 20,
  },
  listWrapper: {
    flex: 1,
    flexDirection: 'row',
  },
  listContainer: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    marginTop: 10,
    color: '#aaa',
  },
  servantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16 * scale,
    marginRight: 10,
    marginBottom: 12 * scale,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  servantImageContainer: {
    marginRight: 12 * scale,
  },
  servantImage: {
    width: 48 * scale,
    height: 48 * scale,
    borderRadius: 24 * scale,
    borderWidth: 1,
    borderColor: '#333333',
  },
  servantInfo: {
    flex: 1,
  },
  servantName: {
    fontSize: 18 * scale,
    fontWeight: '600',
    color: '#fff',
  },
  servantDetail: {
    fontSize: 14 * scale,
    color: '#aaa',
    marginTop: 4 * scale,
  },
  noData: {
    textAlign: 'center',
    color: '#aaa',
    marginTop: 20,
  },
  sectionHeader: {
    backgroundColor: 'transparent',
    paddingVertical: 8 * scale,
    paddingHorizontal: 12 * scale,
  },
  sectionHeaderText: {
    fontSize: 18 * scale,
    fontWeight: '600',
    color: '#fff',
  },
  indexBar: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
  },
  indexItem: {
    paddingVertical: 0,
    backgroundColor: '#121212',
    borderRadius: 4,
    marginVertical: 2 * scale,
  },
  indexText: {
    color: '#147efb',
    fontWeight: '600',
  },
});

export default ServantsAdmin;