import * as React from "react";
import { useState, useEffect, useRef } from "react";
import {
  Text,
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
  Animated,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, getFirestore } from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import PhotoInput from "../../components/photoInput";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Avatar from "../../components/Avatar";
import * as avatarCache from "../../utils/avatarCache";

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const CACHE_KEYS = {
  CHILD_DATA: 'child_data_',
  CACHE_TIMESTAMP: '_timestamp'
};

const CACHE_DURATION = 3 * 24 * 60 * 60 * 1000;

const ChildAccountInfo = ({ route, navigation }) => {
  const { childUid } = route.params;
  const [childData, setChildData] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(true);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
      Animated.spring(contentAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
    ]).start();
  }, []);

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

  const saveToCache = async (key, data) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
      await AsyncStorage.setItem(key + CACHE_KEYS.CACHE_TIMESTAMP, Date.now().toString());
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  };

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

  useEffect(() => {
    const fetchChildData = async () => {
      try {
        const user = getAuth().currentUser;
        if (user) {
          const cacheKey = CACHE_KEYS.CHILD_DATA + childUid;
          const cachedData = await getFromCache(cacheKey);
          if (cachedData) {
            setChildData(cachedData);
            // Adopt photoURL from the doc we already have — no Storage request.
            avatarCache.primeFromUser({ uid: childUid, ...cachedData });
            setIsLoadingFromCache(false);
            getDoc(doc(getFirestore(), "users", user.uid))
              .then(userDoc => {
                if (userDoc.exists) {
                  const userData = userDoc.data();
                  const child = userData.children?.find((child) => child.uid === childUid);
                  if (child) {
                    setChildData(child);
                    avatarCache.primeFromUser({ uid: childUid, ...child });
                    saveToCache(cacheKey, child);
                  }
                }
              });
          } else {
            const userDoc = await getDoc(doc(getFirestore(), "users", user.uid));
            if (userDoc.exists) {
              const userData = userDoc.data();
              const child = userData.children?.find((child) => child.uid === childUid);
              if (child) {
                setChildData(child);
                avatarCache.primeFromUser({ uid: childUid, ...child });
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

    fetchChildData();
  }, [childUid]);

  const handleEditPhoto = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setShowPhotoModal(true);
  };

  const handlePhotoUpload = async () => {
    setShowPhotoModal(false);
    // PhotoInput already wrote the new url + version into avatarCache, so
    // there is nothing to do here. Invalidating would discard that fresh value.
  };

  if (!childData) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const InfoCard = ({ label, value }) => (
    <View style={styles.infoCard}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.headerContainer,
          {
            transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            opacity: headerAnim,
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.6 : 1 }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerSubtext}>CHILD</Text>
          <Text style={styles.headerTitle}>Account Info</Text>
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={{
            transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
            opacity: contentAnim,
          }}
        >
          <View style={styles.profileSection}>
            <View style={styles.profileImageWrapper}>
              <Avatar
                uid={childUid}
                user={childData}
                size={100}
                finalSize={300}
                borderRadius={50}
                style={styles.profileImage}
                expandable
              />
              <TouchableOpacity
                style={styles.editIconContainer}
                onPress={handleEditPhoto}
                activeOpacity={0.7}
              >
                <Ionicons name="pencil" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.profileName}>{childData.name || "Child"}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <InfoCard label="Date of Birth" value={childData.DOB || "Not set"} />
            <InfoCard label="Rank" value={childData.rank || "Not set"} />
            <InfoCard label="Church" value={childData.church || "Not set"} />
          </View>

          <View style={styles.disclaimerCard}>
            <Ionicons name="information-circle" size={20} color="#ff9500" style={{ marginRight: 10 }} />
            <Text style={styles.disclaimerText}>
              To change any child information, please remove the child and add them again.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      <PhotoInput visible={showPhotoModal} onClose={handlePhotoUpload} userId={childUid} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 50 : 30,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    marginRight: 36,
  },
  headerSubtext: {
    fontSize: 10,
    color: "#555",
    letterSpacing: 2,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "300",
    letterSpacing: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 30,
  },
  profileImageWrapper: {
    position: "relative",
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editIconContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#147EFB",
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#121212",
  },
  profileName: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "600",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    color: "#4d9cff",
    marginBottom: 14,
    fontWeight: "600",
  },
  infoCard: {
    backgroundColor: "#1a1a1a",
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  infoLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  infoValue: {
    fontSize: 17,
    color: "#fff",
    fontWeight: "600",
  },
  disclaimerCard: {
    backgroundColor: "rgba(255, 149, 0, 0.1)",
    padding: 16,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 149, 0, 0.2)",
  },
  disclaimerText: {
    fontSize: 14,
    color: "#ff9500",
    flex: 1,
    lineHeight: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.5)",
  },
});

export default ChildAccountInfo;