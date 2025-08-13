import * as React from "react";
import {
  Text,
  StyleSheet,
  View,
  Pressable,
  Alert,
  Image,
} from "react-native";
import { useState } from "react";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import BackArrow from "../../components/backArrow";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";
import PhotoInput from "../../components/photoInput";

const ChangePhoto = () => {
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [previewUri, setPreviewUri] = useState(null);
  const navigation = useNavigation();
  const user = auth().currentUser;

  const updatePhotoUrlInDB = async () => {
    try {
      await storage().ref(`profilePictures/${user.uid}.png`).getDownloadURL();
      setPreviewUri(photoUrl); // Update preview after successful upload
    } catch (error) {
    }
  };

  const handleConfirm = async () => {
    navigation.goBack();
    Alert.alert("Success", "Profile picture updated successfully.");
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
        <BackArrow style={styles.backarrow} />
      </Pressable>
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Change Profile Picture</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.previewContainer}>
          <Image
            source={
              previewUri
                ? { uri: previewUri }
                : { uri: 'https://via.placeholder.com/150?text=Profile' }
            }
            style={styles.previewImage}
            resizeMode="cover"
          />
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.uploadButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => setShowPhotoModal(true)}
        >
          <Icon name="image-plus" size={24} color="#fff" style={styles.icon} />
          <Text style={styles.uploadButtonText}>Choose Profile Picture</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.confirmButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleConfirm}
        >
          <Icon name="check-circle" size={24} color="#fff" style={styles.icon} />
          <Text style={styles.confirmText}>Confirm</Text>
        </Pressable>
        <Text style={styles.disclaimer}>Select or capture a new profile picture.</Text>
      </View>

      <PhotoInput
        visible={showPhotoModal}
        onClose={() => {
          setShowPhotoModal(false);
          updatePhotoUrlInDB(); // Update Firestore and preview after upload
        }}
        userId={user?.uid || "default"}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#121212",
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  backButton: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 1,
  },
  backarrow: {
    width: 24,
    height: 24,
  },
  headerContainer: {
    marginBottom: 20,
    alignItems: "center",
  },
  headerText: {
    fontSize: 28,
    fontWeight: "600",
    color: "#ffffff",
    fontFamily: "Roboto-Medium",
  },
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 25,
    marginTop: 10,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  previewContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    marginBottom: 20,
    backgroundColor: "#2A2A2A",
    borderWidth: 1,
    borderColor: "#8e8e93",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  uploadButton: {
    flexDirection: "row",
    backgroundColor: "#147EFB",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 15,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  confirmButton: {
    flexDirection: "row",
    backgroundColor: "#333",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  buttonPressed: {
    backgroundColor: "#115EBB",
    elevation: 1,
  },
  icon: {
    marginRight: 10,
  },
  uploadButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
  },
  confirmText: {
    fontSize: 17,
    color: "#fff",
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
  },
  disclaimer: {
    fontSize: 14,
    color: "#ff6347",
    marginTop: 15,
    textAlign: "center",
    fontFamily: "Roboto-Regular",
  },
});

export default ChangePhoto;