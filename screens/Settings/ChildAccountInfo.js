import * as React from "react";
import { useState, useEffect } from "react";
import {
  Text,
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BackArrow from "../../components/backArrow";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import storage from "@react-native-firebase/storage";
import ProfileImageExpander from '../../components/ProfileImageExpander';
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import PhotoInput from "../../components/photoInput";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Cache keys
const CACHE_KEYS = {
  CHILD_DATA: 'child_data_',
  CHILD_IMAGE_URL: 'child_image_url_',
  CACHE_TIMESTAMP: '_timestamp'
};

// Cache duration (3 days in milliseconds)
const CACHE_DURATION = 3 * 24 * 60 * 60 * 1000;

const ChildAccountInfo = ({ route, navigation }) => {
  const { childUid } = route.params;
  const [childData, setChildData] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(true);

  // Helper function to check if cache is valid
  const isCacheValid = async (key) => {
    try {
      const timestampKey = key + CACHE_KEYS.CACHE_TIMESTAMP;
      const timestamp = await AsyncStorage.getItem(timestampKey);
      if (!timestamp) return false;
      
      const cacheTime = parseInt(timestamp);
      const currentTime = Date.now();
      return (currentTime - cacheTime) < CACHE_DURATION;
    } catch (error) {
      return false;
    }
  };

  // Helper function to save to cache
  const saveToCache = async (key, data) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
      await AsyncStorage.setItem(key + CACHE_KEYS.CACHE_TIMESTAMP, Date.now().toString());
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  };

  // Helper function to get from cache
  const getFromCache = async (key) => {
    try {
      const isValid = await isCacheValid(key);
      if (!isValid) return null;
      
      const cachedData = await AsyncStorage.getItem(key);
      return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
      console.error('Error getting from cache:', error);
      return null;
    }
  };

  // Helper function to clear cache for a specific key
  const clearCache = async (key) => {
    try {
      await AsyncStorage.removeItem(key);
      await AsyncStorage.removeItem(key + CACHE_KEYS.CACHE_TIMESTAMP);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  useEffect(() => {
    // Fetch child data
    const fetchChildData = async () => {
      try {
        const user = auth().currentUser;
        if (user) {
          const cacheKey = CACHE_KEYS.CHILD_DATA + childUid;
          
          // Try to get from cache first
          const cachedData = await getFromCache(cacheKey);
          if (cachedData) {
            setChildData(cachedData);
            setIsLoadingFromCache(false);
            
            // Fetch fresh data in background
            firestore().collection("users").doc(user.uid).get()
              .then(userDoc => {
                if (userDoc.exists) {
                  const userData = userDoc.data();
                  const child = userData.children?.find((child) => child.uid === childUid);
                  if (child) {
                    setChildData(child);
                    saveToCache(cacheKey, child);
                  }
                }
              });
          } else {
            // No cache, fetch from Firestore
            const userDoc = await firestore().collection("users").doc(user.uid).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              const child = userData.children?.find((child) => child.uid === childUid);
              if (child) {
                setChildData(child);
                saveToCache(cacheKey, child);
              } else {
                Alert.alert("Error", "Child data not found.");
              }
            }
            setIsLoadingFromCache(false);
          }
        }
      } catch (error) {
        setIsLoadingFromCache(false);
        Alert.alert("Error", "Could not fetch child data. Please try again.");
      }
    };

    // Fetch profile image
    const fetchImage = async () => {
      try {
        const cacheKey = CACHE_KEYS.CHILD_IMAGE_URL + childUid;
        
        // Try to get from cache first
        const cachedUrl = await getFromCache(cacheKey);
        if (cachedUrl && typeof cachedUrl === "string" && cachedUrl.trim() !== "") {
          setImageUrl(cachedUrl);
          
          // Verify the cached URL is still valid in background
          storage()
            .ref(`profilePictures/${childUid}.png`)
            .getDownloadURL()
            .then(url => {
              if (typeof url === "string" && url.trim() !== "") {
                setImageUrl(url);
                saveToCache(cacheKey, url);
              }
            })
            .catch(() => {
              clearCache(cacheKey);
            });
        } else {
          // No cache, fetch from Storage
          const url = await storage()
            .ref(`profilePictures/${childUid}.png`)
            .getDownloadURL();
          if (typeof url === "string" && url.trim() !== "") {
            setImageUrl(url);
            saveToCache(cacheKey, url);
          } else {
            setImageUrl(null);
          }
        }
      } catch (error) {
        setImageUrl(null);
      }
    };

    // Fetch data and image immediately
    fetchChildData();
    fetchImage();

    // Set up interval to check for image updates every 30 seconds
    const intervalId = setInterval(fetchImage, 30000);

    // Cleanup interval on component unmount or childUid change
    return () => clearInterval(intervalId);
  }, [childUid]);

  const handleEditPhoto = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setShowPhotoModal(true);
  };

  const handlePhotoUpload = async () => {
    setShowPhotoModal(false);
    try {
      // Clear the image cache when uploading new photo
      const cacheKey = CACHE_KEYS.CHILD_IMAGE_URL + childUid;
      await clearCache(cacheKey);
      
      const storagePath = `profilePictures/${childUid}.png`;
      const newUrl = await storage().ref(storagePath).getDownloadURL();
      if (typeof newUrl === "string" && newUrl.trim() !== "") {
        setImageUrl(newUrl);
        saveToCache(cacheKey, newUrl);
      } else {
        setImageUrl(null);
      }
    } catch (error) {
      setImageUrl(null);
    }
  };

  if (!childData) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>
          {isLoadingFromCache ? "Loading..." : "Loading..."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.header}>
          <BackArrow onPress={() => navigation.goBack()} />
          <Text style={[styles.accountInfo, styles.text]}>Child Account Info</Text>
        </View>

        <View style={styles.profileImageContainer}>
          <ProfileImageExpander
            imageUrl={imageUrl}
            size={100}
            finalSize={300}
            borderRadius={50}
            style={styles.profileImage}
          />
          <TouchableOpacity
            style={styles.editIconContainer}
            onPress={handleEditPhoto}
            activeOpacity={0.7}
            accessibilityLabel="Edit Profile Picture"
          >
            <Icon name="pencil" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{childData.name || "First Last"}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{childData.DOB || "Date of Birth"}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{childData.rank || "Rank"}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{childData.church || "Church 1"}</Text>
        </View>

        <Text style={styles.disclaimer}>
          To change any child information, please remove the child and add them again.
        </Text>
      </ScrollView>

      <PhotoInput
        visible={showPhotoModal}
        onClose={handlePhotoUpload}
        userId={childUid}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  scrollViewContent: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  text: {
    color: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  accountInfo: {
    fontSize: 24,
    marginLeft: 16,
  },
  profileImageContainer: {
    alignItems: "center",
    marginBottom: 20,
    position: "relative",
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#8e8e93",
  },
  editIconContainer: {
    position: "absolute",
    top: -5,
    right: "50%",
    marginRight: -55,
    backgroundColor: "#147efb",
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  infoBlock: {
    backgroundColor: "#2e2e2e",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: "#fff",
  },
  disclaimer: {
    fontSize: 14,
    color: "#ff6347",
    textAlign: "center",
    marginTop: 20,
    paddingHorizontal: 16,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
  },
});

export default ChildAccountInfo;