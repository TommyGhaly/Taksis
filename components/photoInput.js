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
import storage from '@react-native-firebase/storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth } = Dimensions.get('window');

const PhotoInput = ({ visible, onClose, userId }) => {
  const [loading, setLoading] = useState(false);
  const [previewUri, setPreviewUri] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Minimal animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };

  useEffect(() => {
    if (visible) {
      // Simple entrance animation
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
      // Reset animations
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
      const reference = storage().ref(`profilePictures/${userId}.png`);
      const task = reference.putFile(previewUri);
      
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
          ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
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

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
        <BlurView intensity={Platform.OS === 'ios' ? 25 : 20} style={StyleSheet.absoluteFillObject} />
        
        <Animated.View 
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          {/* Gradient Background */}
          <LinearGradient
            colors={['rgba(20, 126, 251, 0.08)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBackground}
          />
          
          {/* Close Button */}
          <Pressable
            style={({ pressed }) => [
              styles.closeIconButton,
              pressed && styles.closeIconPressed
            ]}
            onPress={handleClose}
            disabled={loading}
          >
            <Icon name="close" size={24} color="#8E8E93" />
          </Pressable>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {previewUri ? 'Looking Good!' : 'Profile Picture'}
            </Text>
            <Text style={styles.subtitle}>
              {previewUri ? 'Your photo looks great!' : 'Add a photo to personalize your profile'}
            </Text>
          </View>

          {previewUri ? (
            <>
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
                  <LinearGradient
                    colors={loading ? ['#666', '#555'] : ['#147EFB', '#0F6FEB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientButton}
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
                  </LinearGradient>
                </Pressable>

                {!loading && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={handleCancelPreview}
                  >
                    <Icon name="camera-retake" size={22} color="#147EFB" />
                    <Text style={[styles.buttonText, styles.secondaryButtonText]}>Choose Another</Text>
                  </Pressable>
                )}
              </View>
            </>
          ) : (
            <>
              {/* Options Grid */}
              <View style={styles.optionsGrid}>
                <Pressable
                  style={({ pressed }) => [
                    styles.optionCard,
                    pressed && styles.optionCardPressed,
                  ]}
                  onPress={handlePickPhoto}
                >
                  <LinearGradient
                    colors={['rgba(20, 126, 251, 0.1)', 'rgba(20, 126, 251, 0.05)']}
                    style={styles.optionGradient}
                  />
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
                  <LinearGradient
                    colors={['rgba(76, 175, 80, 0.1)', 'rgba(76, 175, 80, 0.05)']}
                    style={styles.optionGradient}
                  />
                  <View style={[styles.iconContainer, styles.cameraIconContainer]}>
                    <Icon name="camera" size={36} color="#4CAF50" />
                  </View>
                  <Text style={styles.optionTitle}>Camera</Text>
                  <Text style={styles.optionDescription}>Take new photo</Text>
                </Pressable>
              </View>

              {/* Bottom Hint */}
              <View style={styles.hintContainer}>
                <Icon name="information-outline" size={16} color="#8E8E93" />
                <Text style={styles.hintText}>Your photo will be visible to other members</Text>
              </View>
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 28,
    width: '90%',
    maxWidth: 400,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  closeIconButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(142, 142, 147, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconPressed: {
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    lineHeight: 22,
  },
  previewSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  previewContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: 'hidden',
    backgroundColor: '#2C2C2E',
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
    borderColor: '#1C1C1E',
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
    borderRadius: 80,
  },
  progressContainer: {
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  progressLabel: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
  progressPercent: {
    color: '#147EFB',
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(142, 142, 147, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#147EFB',
    borderRadius: 3,
  },
  buttonContainer: {
    gap: 12,
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  gradientButton: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(20, 126, 251, 0.08)',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(20, 126, 251, 0.2)',
    gap: 10,
  },
  optionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 28,
  },
  optionCard: {
    flex: 1,
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    position: 'relative',
    overflow: 'hidden',
  },
  optionCardPressed: {
    backgroundColor: 'rgba(44, 44, 46, 0.9)',
    borderColor: 'rgba(20, 126, 251, 0.3)',
  },
  optionGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(20, 126, 251, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cameraIconContainer: {
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#8E8E93',
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
    color: '#8E8E93',
  },
  disabledButton: {
    opacity: 0.7,
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
    color: '#147EFB',
  },
});

export default PhotoInput;