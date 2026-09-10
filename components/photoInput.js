import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  Modal, 
  Pressable, 
  Alert, 
  StyleSheet, 
  Image, 
  Platform,
  Animated,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, getStorage, putFile, ref } from '@react-native-firebase/storage';
import { doc, getFirestore, updateDoc } from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import * as avatarCache from '../utils/avatarCache';

const { width: screenWidth } = Dimensions.get('window');

/**
 * `inline` hosts the card as plain content instead of its own <Modal>.
 *
 * Needed by any caller that is *already* inside a presented modal: iOS will not
 * present a view controller that is already presenting, so a second, stacked
 * <Modal> is silently dropped and the button that opened it looks dead. Inline
 * mode lays the same card over the parent modal, so there is one presentation.
 */
const PhotoInput = ({ visible, onClose, userId, onUploadSuccess, inline = false }) => {
  const [loading, setLoading] = useState(false);
  const [previewUri, setPreviewUri] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.95);
      progressAnim.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    if (uploadProgress > 0) {
      Animated.timing(progressAnim, {
        toValue: uploadProgress,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [uploadProgress]);

  const handlePickPhoto = async () => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required', 
        'Please allow access to your photo library to select a profile picture.',
        [{ text: 'OK', style: 'cancel' }]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled) {
      setPreviewUri(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required', 
        'Please allow camera access to take a profile picture.',
        [{ text: 'OK', style: 'cancel' }]
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled) {
      setPreviewUri(result.assets[0].uri);
    }
  };

  const handleConfirmUpload = async () => {
    if (!previewUri) return;

    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setLoading(true);
    setUploadProgress(0);
    
    try {
      const reference = ref(getStorage(), `profilePictures/${userId}.png`);
      const task = putFile(reference, previewUri);
      
      task.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          Alert.alert(
            'Upload Failed', 
            'There was an error uploading your photo. Please try again.',
            [{ text: 'OK', style: 'cancel' }]
          );
          setLoading(false);
          setUploadProgress(0);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(reference);
            ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);

            // A download URL for a fixed path is stable across re-uploads, so
            // stamp a version token. This is what makes the new photo appear
            // everywhere without any polling.
            const version = String(Date.now());
            avatarCache.set(userId, downloadURL, version);

            // Publish onto the user doc so every screen that already reads
            // users/{uid} gets the avatar for free, with no Storage request.
            try {
              await updateDoc(doc(getFirestore(), 'users', userId), {
                photoURL: downloadURL,
                photoUpdatedAt: version,
              });
            } catch (e) {
              // Children and manually-created people aren't top-level user
              // docs; the cache write above still covers them.
              console.log('[PhotoInput] photoURL not published to users doc:', e?.message);
            }

            // The version token goes with the url: callers whose people are not
            // users/{uid} docs (students, manually added servants) have to stamp
            // `photoUpdatedAt` onto their own document for other devices to see
            // the change, and it has to be the same token written above.
            onUploadSuccess?.(downloadURL, version);

            Alert.alert(
              'Success!', 
              'Your profile picture has been updated successfully.',
              [{ text: 'Great!', style: 'default' }]
            );
            setPreviewUri(null);
            setUploadProgress(0);
            setLoading(false);
            setTimeout(() => {
              onClose();
            }, 300);
          } catch (urlError) {
            Alert.alert('Error', 'Photo uploaded but failed to get URL. Please try again.');
            setLoading(false);
            setUploadProgress(0);
          }
        }
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image. Please try again.');
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleCancelPreview = () => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setPreviewUri(null);
  };

  const handleClose = () => {
    if (loading) return;
    
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setPreviewUri(null);
      setUploadProgress(0);
      onClose();
    });
  };

  const card = (
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <Animated.View 
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          {/* Close Button */}
          <Pressable
            style={({ pressed }) => [
              styles.closeIconButton,
              pressed && styles.closeIconPressed
            ]}
            onPress={handleClose}
            disabled={loading}
          >
            <Icon name="close" size={24} color="#888" />
          </Pressable>

          {previewUri ? (
            <>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Looking Good!</Text>
                <Text style={styles.subtitle}>Your photo looks great!</Text>
              </View>

              {/* Preview Section */}
              <View style={styles.previewSection}>
                <View style={styles.previewContainer}>
                  <Image
                    source={{ uri: previewUri }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                  {!loading && (
                    <View style={styles.previewBadge}>
                      <Icon name="check" size={20} color="#fff" />
                    </View>
                  )}
                  {loading && (
                    <View style={styles.uploadingOverlay}>
                      <ActivityIndicator color="#fff" size="large" />
                    </View>
                  )}
                </View>
              </View>

              {/* Upload Progress */}
              {loading && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressLabel}>Uploading...</Text>
                    <Text style={styles.progressPercent}>{Math.round(uploadProgress)}%</Text>
                  </View>
                  <View style={styles.progressBar}>
                    <Animated.View 
                      style={[
                        styles.progressFill, 
                        {
                          width: progressAnim.interpolate({
                            inputRange: [0, 100],
                            outputRange: ['0%', '100%']
                          })
                        }
                      ]} 
                    />
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    loading && styles.disabledButton,
                    pressed && !loading && styles.buttonPressed,
                  ]}
                  onPress={handleConfirmUpload}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={styles.buttonText}>Uploading...</Text>
                    </>
                  ) : (
                    <>
                      <Icon name="cloud-upload" size={24} color="#fff" />
                      <Text style={styles.buttonText}>Upload Photo</Text>
                    </>
                  )}
                </Pressable>

                {!loading && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={handleCancelPreview}
                  >
                    <Icon name="camera-retake" size={22} color="#e0e0e0" />
                    <Text style={[styles.buttonText, styles.secondaryButtonText]}>Choose Another</Text>
                  </Pressable>
                )}
              </View>
            </>
          ) : (
            <>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Add Profile Picture</Text>
                <Text style={styles.subtitle}>Choose how you want to add your photo</Text>
              </View>

              {/* Options Grid */}
              <View style={styles.optionsGrid}>
                <Pressable
                  style={({ pressed }) => [
                    styles.optionCard,
                    pressed && styles.optionCardPressed,
                  ]}
                  onPress={handlePickPhoto}
                >
                  <View style={styles.iconContainer}>
                    <Icon name="image-multiple" size={36} color="#147EFB" />
                  </View>
                  <Text style={styles.optionTitle}>Gallery</Text>
                  <Text style={styles.optionDescription}>Choose existing</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.optionCard,
                    pressed && styles.optionCardPressed,
                  ]}
                  onPress={handleTakePhoto}
                >
                  <View style={[styles.iconContainer, styles.cameraIconContainer]}>
                    <Icon name="camera" size={36} color="#4d9cff" />
                  </View>
                  <Text style={styles.optionTitle}>Camera</Text>
                  <Text style={styles.optionDescription}>Take new photo</Text>
                </Pressable>
              </View>

              {/* Bottom Hint */}
              <View style={styles.hintContainer}>
                <Text style={styles.hintText}>Your photo will be visible to other members</Text>
              </View>
            </>
          )}
        </Animated.View>
      </Animated.View>
  );

  if (inline) {
    return visible ? <View style={StyleSheet.absoluteFill}>{card}</View> : null;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
    >
      {card}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  card: {
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    width: '90%',
    maxWidth: 400,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  closeIconButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e0e0e0',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  previewSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  previewContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
    borderWidth: 3,
    borderColor: '#147EFB',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#1e1e1e',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  progressPercent: {
    color: '#147EFB',
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#147EFB',
    borderRadius: 2,
  },
  buttonContainer: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#147EFB',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: '#333',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  optionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 20,
  },
  optionCard: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  optionCardPressed: {
    backgroundColor: '#333',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(20, 126, 251, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cameraIconContainer: {
    backgroundColor: 'rgba(77, 156, 255, 0.1)',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#888',
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 4,
  },
  hintText: {
    fontSize: 13,
    color: '#888',
  },
  disabledButton: {
    backgroundColor: '#555',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  secondaryButtonText: {
    color: '#e0e0e0',
  },
});

export default PhotoInput;