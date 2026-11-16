import * as React from "react";
import { useState, useEffect } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  Switch,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme, useThemePrefs, GlassSurface } from "../theme";
import { useNavigation } from "@react-navigation/native";
import {
  deleteDoc,
  doc as firestoreDoc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
} from "@react-native-firebase/firestore";
import { deleteUser, getAuth, signOut } from "@react-native-firebase/auth";
import { useUser, clearCachedProfile } from "../UserContext";
import { callFunction } from "./functionCalls";
import { getMessaging, getToken } from "@react-native-firebase/messaging";
import Avatar from "./Avatar";
import * as avatarCache from "../utils/avatarCache";

// One tappable settings card. The TouchableOpacity is outside the glass so the
// press fade dims the whole pane, glass included.
function SettingsRow({ label, onPress }) {
  const styles = useStyles();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <GlassSurface style={styles.card} interactive>
        <Text style={styles.cardText}>{label}</Text>
      </GlassSurface>
    </TouchableOpacity>
  );
}

const APPEARANCE_OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

function Segmented({ options, value, onChange, disabled = false }) {
  const styles = useStyles();
  return (
    <View style={[styles.segmented, disabled && styles.segmentedDisabled]}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.segment, selected && styles.segmentSelected]}
            onPress={() => onChange(opt.value)}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected, disabled }}
          >
            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function glassHint(intensity) {
  if (intensity < 0.2) return "Clear — content shows through strongly";
  if (intensity < 0.6) return "Frosted glass tab bar, headers and cards";
  return "Tinted — a solid wash for easier reading";
}

// Like iOS's own Liquid Glass setting: a switch, and while it's on, a slider
// from Clear to Tinted. The slider tracks its own value while dragging and only
// saves on release — every glass surface in the app redraws on a change, and
// doing that per drag frame would stutter.
function LiquidGlassSetting() {
  const styles = useStyles();
  const theme = useTheme();
  const { prefs, updatePrefs, glassAvailable } = useThemePrefs();
  const enabled = glassAvailable && prefs.glassEnabled;
  const [dragValue, setDragValue] = useState(null);
  const intensity = dragValue ?? prefs.glassIntensity;

  return (
    <GlassSurface style={styles.card}>
      <View style={styles.switchRow}>
        <View style={styles.switchLabel}>
          <Text style={styles.cardText}>Liquid Glass</Text>
          <Text style={styles.cardSubtext}>
            {!glassAvailable ? "Requires iOS 26 or later" : enabled ? glassHint(intensity) : "Off — solid surfaces"}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={(v) => updatePrefs({ glassEnabled: v })}
          disabled={!glassAvailable}
          trackColor={{ true: theme.accent }}
          accessibilityLabel="Liquid Glass"
        />
      </View>

      {enabled && (
        <View style={styles.sliderRow}>
          <Ionicons name="water-outline" size={18} color={theme.textSecondary} />
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            value={prefs.glassIntensity}
            onValueChange={setDragValue}
            onSlidingComplete={(v) => {
              updatePrefs({ glassIntensity: Math.round(v * 100) / 100 });
              setDragValue(null);
            }}
            minimumTrackTintColor={theme.accent}
            maximumTrackTintColor={theme.fillStrong}
            accessibilityLabel="Liquid Glass intensity"
          />
          <Ionicons name="water" size={18} color={theme.textSecondary} />
        </View>
      )}
      {enabled && (
        <View style={styles.sliderLabels}>
          <Text style={styles.sliderLabel}>Clear</Text>
          <Text style={styles.sliderLabel}>Tinted</Text>
        </View>
      )}
    </GlassSurface>
  );
}

// Appearance + Liquid Glass. Both apply instantly — every screen reads its
// colors from the theme, so there's nothing to restart.
function DisplaySettings() {
  const styles = useStyles();
  const { prefs, updatePrefs } = useThemePrefs();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Display</Text>

      <GlassSurface style={styles.card}>
        <Text style={styles.cardText}>Appearance</Text>
        <Segmented
          options={APPEARANCE_OPTIONS}
          value={prefs.appearance}
          onChange={(appearance) => updatePrefs({ appearance })}
        />
      </GlassSurface>

      {Platform.OS === "ios" && <LiquidGlassSetting />}
    </View>
  );
}

const SettingsContent = () => {
  const styles = useStyles();
  const theme = useTheme();
  const { signUp, setSignUp } = useUser();
  const navigation = useNavigation();
  const [userRoles, setUserRoles] = useState({ name: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [suggestion, setSuggestion] = useState("");

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;

    return onSnapshot(
      firestoreDoc(getFirestore(), "users", user.uid),
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
      const user = getAuth().currentUser;
      if (user) {
        const token = await getToken(getMessaging());
        const userDocRef = firestoreDoc(getFirestore(), "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists) {
          const fcmTokens = userDoc.data().fcmTokens || [];
          if (fcmTokens.includes(token)) {
            await updateDoc(userDocRef, { fcmTokens: fcmTokens.filter((t) => t !== token) });
          }
        }
        await avatarCache.clearAll();
        await clearCachedProfile();
      }
    } catch (error) {
      console.error("Error during sign out:", error);
    } finally {
      setSignUp(true);
      signOut(getAuth());
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
            const user = getAuth().currentUser;
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
              await deleteDoc(firestoreDoc(getFirestore(), "users", user.uid));
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
      const user = getAuth().currentUser;
      if (user && userRoles.name) {
        const suggestionDocRef = firestoreDoc(getFirestore(), "suggestions", userRoles.name);
        const doc = await getDoc(suggestionDocRef);
        let suggestions = doc.exists ? doc.data().suggestions || [] : [];
        suggestions.push(suggestion);
        await setDoc(suggestionDocRef, { suggestions }, { merge: true });
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
      {/* In a Modal so the overlay is sized to the screen, not to the
          ScrollView's full content height. */}
      <Modal animationType="fade" transparent={true} visible={isLoading} onRequestClose={() => {}}>
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </Modal>

      <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <GlassSurface style={styles.modalContent}>
            <Text style={styles.modalTitle}>App Suggestions</Text>
            <Text style={styles.modalSubtitle}>Help us improve by sharing your ideas</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your suggestion..."
              placeholderTextColor={theme.placeholder}
              keyboardAppearance={theme.keyboardAppearance}
              value={suggestion}
              onChangeText={setSuggestion}
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setModalVisible(false)}>
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.submitButtonModal]} onPress={handleSubmitSuggestion}>
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </GlassSurface>
        </View>
      </Modal>
      <View style={styles.profileSection}>
        <Avatar
          uid={getAuth().currentUser?.uid}
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
        <SettingsRow onPress={() => navigation.navigate("AccountInfo")} label="Account info" />
        <SettingsRow onPress={() => navigation.navigate("ChangeName")} label="Change name" />
        <SettingsRow onPress={() => navigation.navigate("ChangeEmail")} label="Change email" />
        <SettingsRow onPress={() => navigation.navigate("ChangeNumber")} label="Change phone number" />
        <SettingsRow onPress={() => navigation.navigate("ChangeAge")} label="Change date of birth" />
        <SettingsRow onPress={() => navigation.navigate("ChangePhoto")} label="Change profile picture" />
        <SettingsRow onPress={() => navigation.navigate("ChangePassword")} label="Change password" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Role</Text>
        <SettingsRow onPress={() => navigation.navigate("ChangeRank")} label="Change deacon rank" />
        <SettingsRow onPress={() => navigation.navigate("ChangeRoles")} label="Change church services that apply to you" />
        <SettingsRow onPress={() => navigation.navigate("RequestServants")} label="Apply to be a servants meeting tracker" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Children</Text>
        <SettingsRow onPress={() => navigation.navigate("ChangeChildren")} label="Change your children" />
        <SettingsRow onPress={() => navigation.navigate("AddChild")} label="Add child" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Church Adjustments</Text>
        <SettingsRow onPress={() => navigation.navigate("ChangeChurch")} label="Change church" />
        <SettingsRow onPress={() => navigation.navigate("RegisterVehicle")} label="Register vehicle" />
        <SettingsRow onPress={() => navigation.navigate("RequestAdmin")} label="Apply for admin" />
      </View>

      <DisplaySettings />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Adjustments</Text>
        <SettingsRow onPress={() => navigation.navigate("HomeScreenSelector")} label="Change home screen" />
        <SettingsRow onPress={() => setModalVisible(true)} label="App suggestions" />
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

const useStyles = makeStyles((t) => ({
  container: {
    flex: 1,
    backgroundColor: t.background,
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: t.overlay,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: t.overlay,
  },
  modalContent: {
    backgroundColor: t.surface,
    borderRadius: 14,
    padding: 28,
    width: "85%",
    maxWidth: 400,
    alignItems: "center",
    borderWidth: 1,
    borderColor: t.border,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: t.text,
    marginBottom: 8,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  modalSubtitle: {
    fontSize: 15,
    color: t.textSecondary,
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    width: "100%",
    backgroundColor: t.fill,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: t.text,
    marginBottom: 20,
    minHeight: 120,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: t.border,
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
    backgroundColor: t.fillStrong,
  },
  submitButtonModal: {
    backgroundColor: t.accent,
  },
  buttonText: {
    fontSize: 16,
    color: t.text,
    fontWeight: "600",
  },
  header: {
    fontSize: 36,
    color: t.text,
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
    color: t.text,
    flex: 1,
    left: 10
  },
  section: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    color: t.accentText,
    marginBottom: 14,
    fontWeight: "600",
  },
  card: {
    backgroundColor: t.surface,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: t.border,
  },
  cardText: {
    fontSize: 18,
    color: t.text,
    fontWeight: "600",
  },
  signOut: {
    backgroundColor: t.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginHorizontal: 20,
    alignItems: "center",
    marginTop: 10,
  },
  signOutText: {
    fontSize: 16,
    color: t.onAccent,
    fontWeight: "600",
  },
  deleteAccount: {
    backgroundColor: t.danger,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    marginHorizontal: 20,
    alignItems: "center",
    marginTop: 12,
  },
  deleteAccountText: {
    fontSize: 16,
    color: t.onAccent,
    fontWeight: "600",
  },
  bottomPadding: {
    height: 40,
  },
  cardSubtext: {
    fontSize: 13,
    color: t.textSecondary,
    marginTop: 2,
  },
  segmentedDisabled: {
    opacity: 0.4,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  switchLabel: {
    flex: 1,
    marginRight: 12,
  },
  sliderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  slider: {
    flex: 1,
    marginHorizontal: 10,
    height: 36,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sliderLabel: {
    fontSize: 12,
    color: t.textSecondary,
  },
  segmented: {
    flexDirection: "row",
    marginTop: 12,
    backgroundColor: t.fill,
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  segmentSelected: {
    backgroundColor: t.accent,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: "600",
    color: t.textSecondary,
  },
  segmentTextSelected: {
    color: t.onAccent,
  },
  submitButtonText: {
    fontSize: 16,
    color: t.onAccent,
    fontWeight: "600",
  },
}));

export default SettingsContent;