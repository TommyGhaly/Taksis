import React, { useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Image,
  Platform,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";
import BackArrow from "../../components/backArrow";
import ProgressBar from "../../components/progressBar";
import PhotoInput from "../../components/photoInput";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import defaultProfile from "../../assets/default_profile.png";

const ChildPhoto = ({ route }) => {
  const { childData } = route.params;
  const user = auth().currentUser;
  const userId = user ? user.uid : null;
  const navigation = useNavigation();
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [previewUri, setPreviewUri] = useState(null);
  const [photoUploaded, setPhotoUploaded] = useState(false);

  const hapticOptions = {
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: true,
  };

  const updatePhotoUrlInDB = async () => {
    try {
      const photoUrl = await storage()
        .ref(`childProfilePictures/${childData.uid}.png`)
        .getDownloadURL();
      setPreviewUri(photoUrl); // Update preview
      setPhotoUploaded(true); // Mark photo as uploaded
      return photoUrl;
    } catch (error) {
      Alert.alert("Error", "Could not retrieve child profile picture. Please try again.");
      return null;
    }
  };

  const handleContinue = async () => {
    if (!userId) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    if (!photoUploaded) {
      Alert.alert("Error", "Please select a profile picture before proceeding.");
      return;
    }

    try {
      const photoUrl = await storage()
        .ref(`childProfilePictures/${childData.uid}.png`)
        .getDownloadURL();
      const updatedChildData = { ...childData, photoUrl };

      const userDocRef = firestore().collection("users").doc(userId);
      const userDoc = await userDocRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        const children = userData.children || [];
        const childIndex = children.findIndex((child) => child.uid === childData.uid);

        if (childIndex !== -1) {
          children[childIndex] = updatedChildData;
        } else {
          children.push(updatedChildData);
        }

        await userDocRef.update({ children });
        navigation.navigate("ChildDeaconRank", { childData: updatedChildData });
      } else {
        throw new Error("User document does not exist");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update child profile picture. Please try again.");
    }
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleUploadPress = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setShowPhotoModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.backarrow}>
        <BackArrow onPress={handleBackPress} />
      </View>
      <View style={styles.progressBar}>
        <ProgressBar startPercentage={0} endPercentage={20} />
      </View>

      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Add Child Profile Picture</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.questionText}>Choose a profile picture for your child</Text>
          <View style={styles.previewContainer}>
            <Image
              source={previewUri ? { uri: previewUri } : defaultProfile}
              style={styles.previewImage}
              resizeMode="cover"
            />
          </View>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handleUploadPress}
          >
            <Icon name="image-plus" size={24} color="#fff" style={styles.icon} />
            <Text style={styles.uploadButtonText}>Select Profile Picture</Text>
          </TouchableOpacity>
          <Text style={styles.disclaimer}>Select or capture a photo for your child’s profile.</Text>
        </View>
      </View>

      <View style={styles.continueLayout}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
        >
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>
      </View>

      <PhotoInput
        visible={showPhotoModal}
        onClose={() => {
          setShowPhotoModal(false);
          updatePhotoUrlInDB(); // Update preview and mark photo as uploaded
        }}
        userId={childData.uid || "default"} // Use child UID for storage path
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  backarrow: {
    position: "absolute",
    top: 10,
    left: 16,
  },
  progressBar: {
    position: "absolute",
    top: 60,
    width: "84%",
    height: 12,
    alignSelf: "center",
  },
  headerContainer: {
    marginTop: 100,
    alignItems: "center",
  },
  headerText: {
    fontSize: 32,
    fontWeight: "600",
    color: "#F0F0F0",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
    letterSpacing: -0.5,
  },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  card: {
    backgroundColor: "#1E1E1E",
    borderRadius: 28,
    padding: 28,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: "#2A2A2A",
  },
  questionText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#F0F0F0",
    textAlign: "center",
    marginBottom: 24,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  previewContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: "hidden",
    marginBottom: 24,
    backgroundColor: "#2A2A2A",
    borderWidth: 1.5,
    borderColor: "#8e8e93",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  uploadButton: {
    flexDirection: "row",
    backgroundColor: "#147EFB",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  continueLayout: {
    position: "absolute",
    bottom: 20,
    height: 50,
    width: "91%",
    alignSelf: "center",
  },
  continueButton: {
    width: "100%",
    backgroundColor: "#333",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  icon: {
    marginRight: 12,
  },
  uploadButtonText: {
    fontSize: 17,
    color: "#fff",
    fontWeight: "600",
    fontFamily: "Roboto-Medium",
  },
  continueText: {
    fontSize: 17,
    fontFamily: "Roboto-Medium",
    color: "#fff",
    letterSpacing: -0.2,
    fontWeight: "500",
  },
  disclaimer: {
    fontSize: 15,
    color: "#ff6347",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
});

export default ChildPhoto;