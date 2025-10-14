import * as React from "react";
import { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import storage from "@react-native-firebase/storage";
import { useUser } from "../UserContext";
import { callFunction, removeFamilySchedule } from "./functionCalls";
import { deleteUser } from "@react-native-firebase/auth";
import messaging from "@react-native-firebase/messaging";
import ProfileImageExpander from "./ProfileImageExpander";
import AsyncStorage from '@react-native-async-storage/async-storage';

const defaultProfileImage = require("../assets/default_profile.png");

const SettingsContent = () => {
  const { signUp, setSignUp } = useUser(true);
  const navigation = useNavigation();
  const [userRoles, setUserRoles] = useState({ name: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [suggestion, setSuggestion] = useState("");

  // Profile picture cache management
  const CACHE_DURATION = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
  const CACHE_KEY_PREFIX = 'profilePicture_';
  const CACHE_TIMESTAMP_PREFIX = 'profilePictureTimestamp_';

  const getCacheKey = (userId) => `${CACHE_KEY_PREFIX}${userId}`;
  const getTimestampKey = (userId) => `${CACHE_TIMESTAMP_PREFIX}${userId}`;

  const saveToCache = async (userId, url) => {
    try {
      await AsyncStorage.setItem(getCacheKey(userId), url);
      await AsyncStorage.setItem(getTimestampKey(userId), Date.now().toString());
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  };

  const getFromCache = async (userId) => {
    try {
      const cachedUrl = await AsyncStorage.getItem(getCacheKey(userId));
      const timestamp = await AsyncStorage.getItem(getTimestampKey(userId));
      
      if (cachedUrl && timestamp) {
        const age = Date.now() - parseInt(timestamp);
        if (age < CACHE_DURATION) {
          return cachedUrl;
        }
      }
      return null;
    } catch (error) {
      console.error('Error reading from cache:', error);
      return null;
    }
  };

  const clearCache = async (userId) => {
    try {
      await AsyncStorage.removeItem(getCacheKey(userId));
      await AsyncStorage.removeItem(getTimestampKey(userId));
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  useEffect(() => {
    const user = auth().currentUser;
    if (user) {
      // Fetch user data
      const unsubscribe = firestore()
        .collection("users")
        .doc(user.uid)
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              setUserRoles(doc.data());
            }
          },
          (error) => {
            console.error('Error fetching user data:', error);
          }
        );

      // Fetch profile picture with caching
      const fetchImage = async (forceRefresh = false) => {
        try {
          // First, try to get from cache if not forcing refresh
          if (!forceRefresh) {
            const cachedUrl = await getFromCache(user.uid);
            if (cachedUrl) {
              setImageUrl(cachedUrl);
              // Still fetch from storage to check for updates
              fetchFromStorage(false);
              return;
            }
          }

          // If no cache or force refresh, fetch from storage
          await fetchFromStorage(true);
        } catch (error) {
          setImageUrl(null);
        }
      };

      const fetchFromStorage = async (updateUI = true) => {
        try {
          const url = await storage().ref(`profilePictures/${user.uid}.png`).getDownloadURL();
          if (typeof url === "string" && url.trim() !== "") {
            // Check if URL has changed
            const cachedUrl = await getFromCache(user.uid);
            if (url !== cachedUrl) {
              await saveToCache(user.uid, url);
              if (updateUI) {
                setImageUrl(url);
              }
            }
          } else {
            await clearCache(user.uid);
            if (updateUI) {
              setImageUrl(null);
            }
          }
        } catch (error) {
          // Profile picture doesn't exist
          await clearCache(user.uid);
          if (updateUI) {
            setImageUrl(null);
          }
        }
      };

      // Initial fetch
      fetchImage();

      // Poll for changes every 10 seconds
      const intervalId = setInterval(() => {
        fetchImage(false);
      }, 10000);

      return () => {
        clearInterval(intervalId);
        unsubscribe();
      };
    }
  }, []);

  const wait = (time) =>
    new Promise((resolve) => setTimeout(resolve, time * 1000));

  const handleSignOut = async () => {
    try {
      const user = auth().currentUser;
      if (user) {
        const token = await messaging().getToken();
        const userDocRef = firestore().collection("users").doc(user.uid);
        const userDoc = await userDocRef.get();
        if (userDoc.exists) {
          const fcmTokens = userDoc.data().fcmTokens || [];
          if (fcmTokens.includes(token)) {
            await userDocRef.update({
              fcmTokens: fcmTokens.filter((t) => t !== token),
            });
          }
        }
        // Clear cache on sign out
        await clearCache(user.uid);
      }
    } catch (error) {
      console.error('Error during sign out:', error);
    } finally {
      setSignUp(true);
      auth().signOut();
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              const user = auth().currentUser;
              if (user) {
                await removeFamilySchedule(
                  user,
                  userRoles.church,
                  "https://remove-family-schedules-hy6oofbihq-uc.a.run.app"
                );
                await callFunction(
                  user,
                  "https://delete-user-hy6oofbihq-uc.a.run.app"
                );
                try {
                  await storage().ref(`profilePictures/${user.uid}.png`).delete();
                } catch (error) {
                  console.error('Error deleting profile picture:', error);
                }
                // Clear cache on account deletion
                await clearCache(user.uid);
                setSignUp(false);
                await firestore().collection("users").doc(user.uid).delete();
                await wait(2);
                await deleteUser(user);
                Alert.alert("Success", "Your account has been deleted.");
              }
            } catch (error) {
              console.error('Error deleting account:', error);
              await handleSignOut();
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSubmitSuggestion = async () => {
    if (suggestion.trim() === "") {
      Alert.alert("Error", "Please enter a suggestion.");
      return;
    }
    setIsLoading(true);
    try {
      const user = auth().currentUser;
      if (user && userRoles.name) {
        const suggestionDocRef = firestore().collection("suggestions").doc(userRoles.name);
        const doc = await suggestionDocRef.get();
        let suggestions = doc.exists ? doc.data().suggestions || [] : [];
        suggestions.push(suggestion);
        await suggestionDocRef.set({ suggestions }, { merge: true });
        Alert.alert("Success", "Your suggestion has been submitted!");
        setSuggestion("");
        setModalVisible(false);
      }
    } catch (error) {
      console.error('Error submitting suggestion:', error);
      Alert.alert("Error", "Failed to submit suggestion. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
      
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>App Suggestions</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your suggestion"
              placeholderTextColor="#888"
              value={suggestion}
              onChangeText={setSuggestion}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleSubmitSuggestion}
              >
                <Text style={styles.modalButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.profileSection}>
        <ProfileImageExpander
          imageUrl={imageUrl}
          defaultImage={defaultProfileImage}
          size={60}
          finalSize={300}
          borderRadius={30}
          style={styles.profileImage}
        />
        <Text style={styles.userName}>{userRoles.name}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity 
          style={styles.option} 
          onPress={() => navigation.navigate("AccountInfo")}
        >
          <Text style={styles.optionText}>Account info</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.option} 
          onPress={() => navigation.navigate("ChangeName")}
        >
          <Text style={styles.optionText}>Change name</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.option} 
          onPress={() => navigation.navigate("ChangeEmail")}
        >
          <Text style={styles.optionText}>Change email</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.option} 
          onPress={() => navigation.navigate("ChangeNumber")}
        >
          <Text style={styles.optionText}>Change phone number</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.option} 
          onPress={() => navigation.navigate("ChangeAge")}
        >
          <Text style={styles.optionText}>Change date of birth</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.option} 
          onPress={() => navigation.navigate("ChangePhoto")}
        >
          <Text style={styles.optionText}>Change profile picture</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.option} 
          onPress={() => navigation.navigate("ChangePassword")}
        >
          <Text style={styles.optionText}>Change password</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Role</Text>
        <TouchableOpacity 
          style={styles.option} 
          onPress={() => navigation.navigate("ChangeRank")}
        >
          <Text style={styles.optionText}>Change deacon rank</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.option} 
          onPress={() => navigation.navigate("ChangeRoles")}
        >
          <Text style={styles.optionText}>Change church services that apply to you</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.option} 
          onPress={() => navigation.navigate("RequestServants")}
        >
          <Text style={styles.optionText}>Apply to be a servants meeting tracker</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Children</Text>
        <TouchableOpacity 
          style={styles.option} 
          onPress={() => navigation.navigate("ChangeChildren")}
        >
          <Text style={styles.optionText}>Change your children</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.option} 
          onPress={() => navigation.navigate("AddChild")}
        >
          <Text style={styles.optionText}>Add child</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Church Adjustments</Text>
        <TouchableOpacity 
          style={styles.option} 
          onPress={() => navigation.navigate("ChangeChurch")}
        >
          <Text style={styles.optionText}>Change church</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.option} 
          onPress={() => navigation.navigate("RequestAdmin")}
        >
          <Text style={styles.optionText}>Apply for admin</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Adjustments</Text>
        <TouchableOpacity 
          style={styles.option} 
          onPress={() => navigation.navigate("HomeScreenSelector")}
        >
          <Text style={styles.optionText}>Change home screen</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.option} 
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.optionText}>App suggestions</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Log out</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteAccount} onPress={handleDeleteAccount}>
        <Text style={styles.deleteAccountText}>Delete Account</Text>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingHorizontal: 16,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalContent: {
    backgroundColor: "#2e2e2e",
    borderRadius: 10,
    padding: 20,
    width: "80%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 15,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 5,
    padding: 10,
    fontSize: 16,
    color: "#000",
    marginBottom: 20,
    minHeight: 100,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 5,
    alignItems: "center",
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: "#888",
  },
  submitButton: {
    backgroundColor: "#147efb",
  },
  modalButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "bold",
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 20,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#333333",
  },
  userName: {
    fontSize: 28,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
    marginLeft: 8,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    color: "#4d9cff",
    marginBottom: 10,
    fontWeight: "bold",
  },
  option: {
    backgroundColor: "#2e2e2e",
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionText: {
    fontSize: 16,
    color: "#fff",
  },
  signOut: {
    backgroundColor: "#147efb",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  signOutText: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "bold",
  },
  deleteAccount: {
    backgroundColor: "#ff3b30",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  deleteAccountText: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "bold",
  },
  bottomPadding: {
    height: 40,
  },
});

export default SettingsContent;