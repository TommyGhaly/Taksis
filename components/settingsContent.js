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
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useUser, clearCachedProfile } from "../UserContext";
import { callFunction } from "./functionCalls";
import { deleteUser } from "@react-native-firebase/auth";
import messaging from "@react-native-firebase/messaging";
import Avatar from "./Avatar";
import * as avatarCache from "../utils/avatarCache";

const SettingsContent = () => {
  const { signUp, setSignUp } = useUser();
  const navigation = useNavigation();
  const [userRoles, setUserRoles] = useState({ name: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [suggestion, setSuggestion] = useState("");

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) return;

    return firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        (doc) => {
          if (doc.exists) {
            const data = doc.data();
            setUserRoles(data);
            // Adopt photoURL from the doc we're already reading — no Storage
            // request, and it updates the moment the photo changes.
            avatarCache.primeFromUser({ uid: user.uid, ...data });
          }
        },
        (error) => console.error("Error fetching user data:", error)
      );
  }, []);

  const wait = (time) => new Promise((resolve) => setTimeout(resolve, time * 1000));

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
            await userDocRef.update({ fcmTokens: fcmTokens.filter((t) => t !== token) });
          }
        }
        await avatarCache.clearAll();
        await clearCachedProfile();
      }
    } catch (error) {
      console.error("Error during sign out:", error);
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
            const user = auth().currentUser;
            if (!user) {
              Alert.alert("Error", "User not authenticated. Please sign in again.");
              return;
            }
            setIsLoading(true);
            try {
              await callFunction(user, "https://remove-family-schedules-hy6oofbihq-uc.a.run.app", { uid: user.uid, church: userRoles.church }, "Failed to remove family from schedules.");
              await callFunction(user, "https://delete-user-hy6oofbihq-uc.a.run.app", {}, "Failed to delete user.");
              // The user doc is deleted just below, so clearing photoURL is
              // usually redundant — but if any step of this teardown fails the
              // account survives, and it must not survive pointing at a photo
              // that no longer exists.
              try {
                await avatarCache.removePhoto(user.uid);
              } catch (error) {
                console.error("Error deleting profile picture:", error);
              }
              await avatarCache.clearAll();
              await clearCachedProfile();
              setSignUp(false);
              await firestore().collection("users").doc(user.uid).delete();
              await wait(2);
              await deleteUser(user);
              Alert.alert("Success", "Your account has been deleted.");
            } catch (error) {
              console.error("Error deleting account:", error);
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
      console.error("Error submitting suggestion:", error);
      Alert.alert("Error", "Failed to submit suggestion. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#147EFB" />
        </View>
      )}

      <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>App Suggestions</Text>
            <Text style={styles.modalSubtitle}>Help us improve by sharing your ideas</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your suggestion..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={suggestion}
              onChangeText={setSuggestion}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setModalVisible(false)}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.submitButtonModal]} onPress={handleSubmitSuggestion}>
                <Text style={styles.buttonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <View style={styles.profileSection}>
        <Avatar
          uid={auth().currentUser?.uid}
          user={userRoles}
          size={60}
          finalSize={300}
          borderRadius={30}
          style={styles.profileImage}
          expandable
        />
        <Text style={styles.userName}>{userRoles.name}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("AccountInfo")}>
          <Text style={styles.cardText}>Account info</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("ChangeName")}>
          <Text style={styles.cardText}>Change name</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("ChangeEmail")}>
          <Text style={styles.cardText}>Change email</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("ChangeNumber")}>
          <Text style={styles.cardText}>Change phone number</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("ChangeAge")}>
          <Text style={styles.cardText}>Change date of birth</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("ChangePhoto")}>
          <Text style={styles.cardText}>Change profile picture</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("ChangePassword")}>
          <Text style={styles.cardText}>Change password</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Role</Text>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("ChangeRank")}>
          <Text style={styles.cardText}>Change deacon rank</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("ChangeRoles")}>
          <Text style={styles.cardText}>Change church services that apply to you</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("RequestServants")}>
          <Text style={styles.cardText}>Apply to be a servants meeting tracker</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Children</Text>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("ChangeChildren")}>
          <Text style={styles.cardText}>Change your children</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("AddChild")}>
          <Text style={styles.cardText}>Add child</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Church Adjustments</Text>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("ChangeChurch")}>
          <Text style={styles.cardText}>Change church</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("RegisterVehicle")}>
          <Text style={styles.cardText}>Register vehicle</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("RequestAdmin")}>
          <Text style={styles.cardText}>Apply for admin</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Adjustments</Text>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("HomeScreenSelector")}>
          <Text style={styles.cardText}>Change home screen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.card} onPress={() => setModalVisible(true)}>
          <Text style={styles.cardText}>App suggestions</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Log out</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteAccount} onPress={handleDeleteAccount}>
        <Text style={styles.deleteAccountText}>Delete Account</Text>
      </TouchableOpacity>

      <View style={styles.bottomPadding} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
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
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 28,
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 8,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  modalSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: "#fff",
    marginBottom: 20,
    minHeight: 120,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  submitButtonModal: {
    backgroundColor: "#147EFB",
  },
  buttonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
  header: {
    fontSize: 36,
    color: "#fff",
    textAlign: "center",
    marginTop: 20,
    marginBottom: 8,
    fontWeight: "300",
    letterSpacing: 1,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 10,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 14,
  },
  userName: {
    fontSize: 24,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
    left: 10
  },
  section: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    color: "#4d9cff",
    marginBottom: 14,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#1a1a1a",
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  cardText: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
  },
  signOut: {
    backgroundColor: "#147EFB",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginHorizontal: 20,
    alignItems: "center",
    marginTop: 10,
  },
  signOutText: {
    fontSize: 16,
    color: "#ffffff",
    fontWeight: "600",
  },
  deleteAccount: {
    backgroundColor: "#ff3b30",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginHorizontal: 20,
    alignItems: "center",
    marginTop: 12,
  },
  deleteAccountText: {
    fontSize: 16,
    color: "#ffffff",
    fontWeight: "600",
  },
  bottomPadding: {
    height: 40,
  },
});

export default SettingsContent;