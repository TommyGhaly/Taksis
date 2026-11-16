import React, { useState } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { doc, getDoc, getFirestore, updateDoc } from "@react-native-firebase/firestore";
import { getDownloadURL, getStorage, ref } from "@react-native-firebase/storage";
import { getAuth } from "@react-native-firebase/auth";
import { useNavigation } from "@react-navigation/native";
import BackArrow from "../../components/backArrow";
import ProgressBar from "../../components/progressBar";
import PhotoInput from "../../components/photoInput";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import defaultProfile from "../../assets/default_profile.png";
import { makeStyles, useTheme, GlassSurface, useTabBarInset } from "../../theme";

const ChildPhoto = ({ route }) => {
  const styles = useStyles();
  const t = useTheme();
  const tabBarInset = useTabBarInset();
  const { childData } = route.params;
  const user = getAuth().currentUser;
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
      const photoUrl = await getDownloadURL(
        ref(getStorage(), `profilePictures/${childData.uid}.png`)
      );
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
      const photoUrl = await getDownloadURL(
        ref(getStorage(), `profilePictures/${childData.uid}.png`)
      );
      const updatedChildData = { ...childData, photoUrl };

      const userDocRef = doc(getFirestore(), "users", userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists) {
        const userData = userDoc.data();
        const children = userData.children || [];
        const childIndex = children.findIndex((child) => child.uid === childData.uid);

        if (childIndex !== -1) {
          children[childIndex] = updatedChildData;
        } else {
          children.push(updatedChildData);
        }

        await updateDoc(userDocRef, { children });
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
        <ProgressBar startPercentage={20} endPercentage={40} />
      </View>

      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Add Child Profile Picture</Text>
      </View>

      <View style={styles.content}>
        <GlassSurface style={styles.card}>
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
            <Icon name="image-plus" size={24} color={t.onAccent} style={styles.icon} />
            <Text style={styles.uploadButtonText}>Select Profile Picture</Text>
          </TouchableOpacity>
          <Text style={styles.disclaimer}>Select or capture a photo for your child’s profile.</Text>
        </GlassSurface>
      </View>

      <View style={[styles.continueLayout, { bottom: 20 + tabBarInset }]}>
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

const useStyles = makeStyles((t) => ({
  container: {
    flex: 1,
    backgroundColor: t.background,
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
    color: (t.isDark ? "#F0F0F0" : t.text),
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
    backgroundColor: t.surface,
    borderRadius: 28,
    padding: 28,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: t.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: t.surfaceElevated,
  },
  questionText: {
    fontSize: 22,
    fontWeight: "700",
    color: (t.isDark ? "#F0F0F0" : t.text),
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
    backgroundColor: t.surfaceElevated,
    borderWidth: 1.5,
    borderColor: t.textMuted,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  uploadButton: {
    flexDirection: "row",
    backgroundColor: t.accent,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 16,
    elevation: 4,
    shadowColor: t.shadow,
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
    backgroundColor: t.surfaceHighest,
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
    color: t.onAccent,
    fontWeight: "600",
    fontFamily: "Roboto-Medium",
  },
  continueText: {
    fontSize: 17,
    fontFamily: "Roboto-Medium",
    color: t.text,
    letterSpacing: -0.2,
    fontWeight: "500",
  },
  disclaimer: {
    fontSize: 15,
    color: t.isDark ? "#ff6347" : "#D9381E",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
}));

export default ChildPhoto;