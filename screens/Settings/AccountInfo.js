import * as React from "react";
import { useState, useEffect, useRef } from "react";
import {
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
  Animated,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getFirestore, onSnapshot } from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import PhotoInput from "../../components/photoInput";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import Avatar from "../../components/Avatar";
import * as avatarCache from "../../utils/avatarCache";
import { makeStyles, useTheme, GlassSurface, useTabBarInset } from "../../theme";

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const CACHE_KEYS = {
  USER_DATA: 'user_data_',
  CACHE_TIMESTAMP: '_timestamp'
};

const CACHE_DURATION = 3 * 24 * 60 * 60 * 1000;

const AccountInfo = ({ navigation }) => {
  const styles = useStyles();
  const t = useTheme();
  const tabBarInset = useTabBarInset();
  const [userData, setUserData] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [isLoadingFromCache, setIsLoadingFromCache] = useState(true);
  const user = getAuth().currentUser;

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

  // Paint from cache, then stay live: this screen used to read once on mount,
  // so a change made elsewhere (an admin edit, a role change) didn't show up
  // until the 3-day cache expired.
  useEffect(() => {
    if (!user) return;
    const cacheKey = CACHE_KEYS.USER_DATA + user.uid;
    let gotLive = false;
    getFromCache(cacheKey).then((cachedData) => {
      if (!cachedData || gotLive) return;
      setUserData(cachedData);
      // Adopt photoURL from the doc we already have — no Storage request.
      avatarCache.primeFromUser({ uid: user.uid, ...cachedData });
      setIsLoadingFromCache(false);
    });
    const unsubscribe = onSnapshot(
      doc(getFirestore(), "users", user.uid),
      (userDoc) => {
        gotLive = true;
        if (userDoc.exists) {
          const freshData = userDoc.data();
          setUserData(freshData);
          avatarCache.primeFromUser({ uid: user.uid, ...freshData });
          saveToCache(cacheKey, freshData);
        }
        setIsLoadingFromCache(false);
      },
      (error) => {
        console.warn("Account info listener failed:", error);
        setIsLoadingFromCache(false);
      }
    );
    return () => unsubscribe();
  }, [user?.uid]);

  const handleEditPhoto = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setShowPhotoModal(true);
  };

  const handlePhotoUpload = async () => {
    setShowPhotoModal(false);
    // PhotoInput already wrote the new url + version into avatarCache, so
    // there is nothing to do here. Invalidating would discard that fresh value.
  };

  if (!userData) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const InfoCard = ({ label, value }) => (
    <GlassSurface style={styles.infoCard}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </GlassSurface>
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
          <Ionicons name="chevron-back" size={22} color={t.text} />
        </Pressable>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerSubtext}>PROFILE</Text>
          <Text style={styles.headerTitle}>Account Info</Text>
        </View>
      </Animated.View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + tabBarInset }]} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={{
            transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }],
            opacity: contentAnim,
          }}
        >
          <View style={styles.profileSection}>
            <View style={styles.profileImageWrapper}>
              <Avatar
                uid={user?.uid}
                user={userData}
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
                <Ionicons name="pencil" size={16} color={t.onAccent} />
              </TouchableOpacity>
            </View>
            <Text style={styles.profileName}>{userData.name || "User"}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            <InfoCard label="Email" value={userData.email || "Not set"} />
            <InfoCard label="Phone" value={userData.phone || "Not set"} />
            <InfoCard label="Date of Birth" value={userData.DOB || "Not set"} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Church Information</Text>
            <InfoCard label="Church" value={userData.church || "Not set"} />
            {userData.isDeacon && (
              <InfoCard label="Rank" value={userData.rank || "Deacon"} />
            )}
          </View>

          {userData.children && userData.children.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Children</Text>
              {userData.children.map((child, index) => (
                <Pressable
                  key={index}
                  style={({ pressed }) => [
                    { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                  ]}
                  onPress={() => navigation.navigate("ChildAccountInfo", { childUid: child.uid })}
                >
                  <GlassSurface style={styles.childCard} interactive>
                    <Text style={styles.childName}>{child.name || `Child ${index + 1}`}</Text>
                    <Ionicons name="chevron-forward" size={20} color={t.textTertiary} />
                  </GlassSurface>
                </Pressable>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <PhotoInput visible={showPhotoModal} onClose={handlePhotoUpload} userId={user?.uid} />
    </View>
  );
};

const useStyles = makeStyles((t) => ({
  container: {
    flex: 1,
    backgroundColor: t.background,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 55 : 35,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.fill,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    marginRight: 36,
  },
  headerSubtext: {
    fontSize: 11,
    color: t.isDark ? "#555" : t.textTertiary,
    letterSpacing: 3,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 24,
    color: t.text,
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
    backgroundColor: t.accent,
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: t.background,
  },
  profileName: {
    fontSize: 24,
    color: t.text,
    fontWeight: "600",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    color: t.accentText,
    marginBottom: 14,
    fontWeight: "600",
  },
  infoCard: {
    backgroundColor: t.surface,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: t.border,
  },
  infoLabel: {
    fontSize: 12,
    color: t.textSecondary,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  infoValue: {
    fontSize: 17,
    color: t.text,
    fontWeight: "600",
  },
  childCard: {
    backgroundColor: t.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  childName: {
    fontSize: 17,
    color: t.text,
    fontWeight: "600",
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: t.background,
  },
  loadingText: {
    fontSize: 16,
    color: t.textSecondary,
  },
}));

export default AccountInfo;