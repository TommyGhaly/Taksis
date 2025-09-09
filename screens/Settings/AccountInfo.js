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
import ProfileImageExpander from "../../components/ProfileImageExpander";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import storage from "@react-native-firebase/storage";
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
  USER_DATA: 'user_data_',
  IMAGE_URL: 'image_url_',
  CACHE_TIMESTAMP: '_timestamp'
};

// Cache duration (3 days in milliseconds)
const CACHE_DURATION = 3 * 24 * 60 * 60 * 1000;

const AccountInfo = ({ navigation }) => {
  const [userData, setUserData] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(true);
  const user = auth().currentUser;

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
    const fetchUserData = async () => {
      try {
        if (user) {
          const cacheKey = CACHE_KEYS.USER_DATA + user.uid;
          
          // Try to get from cache first
          const cachedData = await getFromCache(cacheKey);
          if (cachedData) {
            setUserData(cachedData);
            setIsLoadingFromCache(false);
            
            // Fetch fresh data in background
            firestore()
              .collection("users")
              .doc(user.uid)
              .get()
              .then(userDoc => {
                if (userDoc.exists) {
                  const freshData = userDoc.data();
                  setUserData(freshData);
                  saveToCache(cacheKey, freshData);
                }
              });
          } else {
            // No cache, fetch from Firestore
            const userDoc = await firestore()
              .collection("users")
              .doc(user.uid)
              .get();
            if (userDoc.exists) {
              const freshData = userDoc.data();
              setUserData(freshData);
              saveToCache(cacheKey, freshData);
            }
            setIsLoadingFromCache(false);
          }
        }
      } catch (error) {
        setIsLoadingFromCache(false);
        Alert.alert("Error", "Failed to fetch user data. Please try again.");
      }
    };

    fetchUserData();
  }, [user]);

  useEffect(() => {
    if (user?.uid) {
      const fetchImage = async () => {
        try {
          const cacheKey = CACHE_KEYS.IMAGE_URL + user.uid;
          
          // Try to get from cache first
          const cachedUrl = await getFromCache(cacheKey);
          if (cachedUrl && typeof cachedUrl === "string" && cachedUrl.trim() !== "") {
            setImageUrl(cachedUrl);
            
            // Verify the cached URL is still valid in background
            storage()
              .ref(`profilePictures/${user.uid}.png`)
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
              .ref(`profilePictures/${user.uid}.png`)
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

      // Fetch image immediately
      fetchImage();

      // Set up interval to check for updates every 30 seconds
      const intervalId = setInterval(fetchImage, 30000);

      // Cleanup interval on component unmount or user change
      return () => clearInterval(intervalId);
    } else {
      setImageUrl(null);
    }
  }, [user]);

  const handleEditPhoto = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setShowPhotoModal(true);
  };

  const handlePhotoUpload = async () => {
    setShowPhotoModal(false);
    try {
      // Clear the image cache when uploading new photo
      const cacheKey = CACHE_KEYS.IMAGE_URL + user.uid;
      await clearCache(cacheKey);
      
      const storagePath = `profilePictures/${user.uid}.png`;
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

  if (!userData) {
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
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <BackArrow />
          <Text style={[styles.accountInfo, styles.text]}>Account info</Text>
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
          <Text style={styles.infoText}>{userData.name || "First Last"}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>
            {userData.email || "example@gmail.com"}
          </Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{userData.phone || "1234567890"}</Text>
        </View>
        {/* Conditionally render the Rank field if the user is a deacon */}
        {userData.isDeacon && (
          <View style={styles.infoBlock}>
            <Text style={styles.infoText}>{userData.rank || "Deacon"}</Text>
          </View>
        )}
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{userData.church || "Church 1"}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{userData.DOB || "Date of Birth"}</Text>
        </View>
        {/* Conditionally render the Children heading and list if children exist */}
        {userData.children && userData.children.length > 0 && (
          <>
            <Text style={[styles.childHeading, styles.text]}>Children</Text>
            {(userData.children || []).map((child, index) => (
              <TouchableOpacity
                key={index}
                style={styles.childInfo}
                onPress={() =>
                  navigation.navigate("ChildAccountInfo", {
                    childUid: child.uid,
                  })
                }
              >
                <Text style={styles.infoText}>
                  {child.name || `Child ${index + 1} First Last`}
                </Text>
                <Image
                  style={styles.vectorIcon}
                  resizeMode="cover"
                  source={require("../../assets/vector.png")}
                />
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      <PhotoInput
        visible={showPhotoModal}
        onClose={handlePhotoUpload}
        userId={user?.uid}
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
    marginLeft: 16, // Creates spacing between the back arrow and the title
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
  childHeading: {
    fontSize: 18,
    marginTop: 20,
    marginBottom: 12,
  },
  childInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2e2e2e",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  vectorIcon: {
    width: 8,
    height: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginTop: 5,
    borderWidth: 1,
    borderColor: "#333333",
  },
  profileImageContainer: {
    alignItems: "center",
    marginBottom: 30,
    position: "relative",
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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    fontSize: 16,
    color: "#aaa",
  },
});

export default AccountInfo;