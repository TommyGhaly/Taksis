import React, { useState } from 'react';
import { View, Text, Modal, Pressable, Alert, StyleSheet, Image, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import storage from '@react-native-firebase/storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const PhotoInput = ({ visible, onClose, userId }) => {
  const [loading, setLoading] = useState(false);
  const [previewUri, setPreviewUri] = useState(null);

  const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Error', 'Photo library permission denied. Please enable it in settings.');
      onClose();
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });

    if (result.canceled) {
      onClose();
    } else {
      setPreviewUri(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Error', 'Camera permission denied. Please enable it in settings.');
      onClose();
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });

    if (result.canceled) {
      onClose();
    } else {
      setPreviewUri(result.assets[0].uri);
    }
  };

  const handleConfirmUpload = async () => {
    if (!previewUri) return;

    setLoading(true);
    try {
      const reference = storage().ref(`profilePictures/${userId}.png`);
      await reference.putFile(previewUri);
      Alert.alert('Success', 'Profile picture uploaded successfully!');
      setPreviewUri(null);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelPreview = () => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setPreviewUri(null);
  };

  const handleClose = () => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    setPreviewUri(null);
    onClose();
  };

  const handleButtonPress = (action) => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    action();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.card}>
          <Text style={styles.title}>
            {previewUri ? 'Preview Profile Picture' : 'Choose Profile Picture'}
          </Text>
          {previewUri ? (
            <>
              <View style={styles.previewContainer}>
                <Image
                  source={{ uri: previewUri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  loading && styles.disabledButton,
                  pressed && !loading && styles.buttonPressed,
                ]}
                onPress={() => handleButtonPress(handleConfirmUpload)}
                disabled={loading}
              >
                <Icon name="check-circle" size={24} color="#fff" style={styles.icon} />
                <Text style={styles.buttonText}>Confirm Upload</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => handleButtonPress(handleCancelPreview)}
                disabled={loading}
              >
                <Icon name="image-plus" size={24} color="#fff" style={styles.icon} />
                <Text style={styles.buttonText}>Choose Another</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  loading && styles.disabledButton,
                  pressed && !loading && styles.buttonPressed,
                ]}
                onPress={() => handleButtonPress(handlePickPhoto)}
                disabled={loading}
              >
                <Icon name="image" size={24} color="#fff" style={styles.icon} />
                <Text style={styles.buttonText}>Pick from Gallery</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.button,
                  loading && styles.disabledButton,
                  pressed && !loading && styles.buttonPressed,
                ]}
                onPress={() => handleButtonPress(handleTakePhoto)}
                disabled={loading}
              >
                <Icon name="camera" size={24} color="#fff" style={styles.icon} />
                <Text style={styles.buttonText}>Take a Photo</Text>
              </Pressable>
            </>
          )}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              styles.cancelButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => handleButtonPress(handleClose)}
            disabled={loading}
          >
            <Icon name="close" size={24} color="#fff" style={styles.icon} />
            <Text style={styles.buttonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#F0F0F0',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  previewContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: '#8e8e93',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#147EFB',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginVertical: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  secondaryButton: {
    backgroundColor: '#333',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  disabledButton: {
    backgroundColor: '#A0A0A0',
  },
  buttonPressed: {
    backgroundColor: '#115EBB',
    elevation: 1,
  },
  icon: {
    marginRight: 10,
  },
  buttonText: {
    fontSize: 17,
    color: '#fff',
    fontWeight: '500',
    fontFamily: 'Roboto-Medium',
  },
});

export default PhotoInput;