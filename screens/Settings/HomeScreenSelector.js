import * as React from "react";
import { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
  Platform,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import BackArrow from "../../components/backArrow";

// Import actual screen components
import HomeScreen from "../Home/HomeScreen";
import SundaySchoolAttendance from "../SundaySchool/SundaySchoolAttendance";
import AlhanAttendance from "../Alhan/AlhanAttendance";
import ServantsAttendance from "../ServantsMeeting/ServantsAttendance";
import DeaconEdits from "../AdminScreens/DeaconEdits";
import TrafficManager from "../AdminScreens/TrafficManager";
import ServantsAdmin from "../AdminScreens/ServantsAdmin";
import AlhanAdmin from "../AdminScreens/AlhanAdmin";
import PaschaManager from "../AdminScreens/PaschaManager";
import AdminManager from "../AdminScreens/AdminManager";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const previewSize = (screenWidth - 60) / 2; // 2 columns with padding

// Wrapper component to disable scrolling in previews
const PreviewWrapper = ({ children }) => {
  React.useEffect(() => {
    global.isInPreviewMode = true;
    return () => {
      global.isInPreviewMode = false;
    };
  }, []);

  return <>{children}</>;
};

// Component that loads the screen asynchronously
const AsyncPreview = ({ component: Component, screenId }) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate async loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.previewWrapper}>
      {isLoading ? (
        <View style={styles.previewLoadingContainer}>
          <ActivityIndicator size="small" color="#666" />
        </View>
      ) : (
        <View style={styles.previewScreen} pointerEvents="none">
          <PreviewWrapper>
            <Component isPreview={true} />
          </PreviewWrapper>
        </View>
      )}
    </View>
  );
};

const HomeScreenSelector = () => {
  const navigation = useNavigation();
  const [userRoles, setUserRoles] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedScreen, setSelectedScreen] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Define all available screens with their requirements
  const screenOptions = [
    {
      id: "schedule",
      name: "Deacon Service Schedule",
      caption: "View and manage deacon schedules",
      component: HomeScreen,
      available: true, // Always available
    },
    {
      id: "sundaySchoolAttendance",
      name: "Sunday School Attendance",
      caption: "Track Sunday school attendance",
      component: SundaySchoolAttendance,
      available: userRoles.isSSTeacher,
    },
    {
      id: "hymnsClassAttendance",
      name: "Hymns Class Attendance",
      caption: "Track hymns class attendance",
      component: AlhanAttendance,
      available: userRoles.isAlhan,
    },
    {
      id: "servantsMeetingTracker",
      name: "Servants Meeting Tracker",
      caption: "Track servants meeting attendance",
      component: ServantsAttendance,
      available: userRoles.isServant,
    },
    {
      id: "editDeacons",
      name: "Edit Deacons",
      caption: "Manage deacon information",
      component: DeaconEdits,
      available: userRoles.admin,
    },
    {
      id: "trafficManager",
      name: "Traffic Manager",
      caption: "Manage traffic coordination",
      component: TrafficManager,
      available: userRoles.trafficAdmin,
    },
    {
      id: "paschaManager",
      name: "Pascha Manager",
      caption: "Manage Holy Week readings schedule",
      component: PaschaManager,
      available: userRoles.paschaAdmin,
    },
    {
      id: "servantsManager",
      name: "Servants Manager",
      caption: "Manage Sunday school servants",
      component: ServantsAdmin,
      available: userRoles.ssAdmin,
    },
    {
      id: "alhanManager",
      name: "Alhan Manager",
      caption: "Manage hymns class",
      component: AlhanAdmin,
      available: userRoles.alhanAdmin,
    },
    {
      id: "adminManager",
      name: "Admin Manager",
      caption: "Super admin controls",
      component: AdminManager,
      available: userRoles.superAdmin,
    },
  ];

  useEffect(() => {
    const user = auth().currentUser;
    if (user) {
      const unsubscribe = firestore()
        .collection("users")
        .doc(user.uid)
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              const data = doc.data();
              setUserRoles(data);
              setSelectedScreen(data.homeScreen || "schedule");
              setIsLoading(false);
            }
          },
          (error) => {
            console.error("Error fetching user data:", error);
            setIsLoading(false);
          },
        );

      return () => unsubscribe();
    }
  }, []);

  const handleSaveSelection = async () => {
    if (!selectedScreen) {
      Alert.alert("Error", "Please select a home screen");
      return;
    }

    setIsSaving(true);
    try {
      const user = auth().currentUser;
      if (user) {
        await firestore().collection("users").doc(user.uid).update({
          homeScreen: selectedScreen,
        });
        navigation.goBack();
        Alert.alert("Success", "Home screen preference saved successfully!");
      }
    } catch (error) {
      console.error("Error saving home screen preference:", error);
      Alert.alert("Error", "Failed to save preference. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const renderScreenPreview = (screen) => {
    if (!screen.available) return null;

    const isSelected = selectedScreen === screen.id;

    return (
      <TouchableOpacity
        key={screen.id}
        style={[styles.previewContainer, isSelected && styles.selectedPreview]}
        onPress={() => setSelectedScreen(screen.id)}
        activeOpacity={0.8}
      >
        <View
          style={[styles.previewCard, isSelected && styles.selectedPreviewCard]}
        >
          <AsyncPreview component={screen.component} screenId={screen.id} />
          {isSelected && (
            <View style={styles.selectedOverlay}>
              <View style={styles.checkmark}>
                <Text style={styles.checkmarkText}>✓</Text>
              </View>
            </View>
          )}
        </View>
        <Text style={styles.screenName}>{screen.name}</Text>
        <Text style={styles.screenCaption}>{screen.caption}</Text>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#147EFB" />
        </View>
      </SafeAreaView>
    );
  }

  const availableScreens = screenOptions.filter((screen) => screen.available);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.innerContainer}>
        <View style={styles.header}>
          <Pressable
            style={styles.backArrow}
            onPress={() => navigation.goBack()}
          >
            <BackArrow />
          </Pressable>
          <Text style={styles.title}>Choose Your Home Screen</Text>
          <Text style={styles.subtitle}>
            Select which screen you'd like to see when you open the app
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
        >
          <View style={styles.previewGrid}>
            {availableScreens.map(renderScreenPreview)}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSaveSelection}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Selection</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    marginBottom: 10,
  },
  backArrow: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "600",
    color: "#F0F0F0",
    marginBottom: 8,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
    lineHeight: 22,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  previewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  previewContainer: {
    width: previewSize,
    marginBottom: 24,
    alignItems: "center",
  },
  selectedPreview: {
    transform: [{ scale: 1.02 }],
  },
  previewCard: {
    width: previewSize,
    height: previewSize * 1.6,
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    marginBottom: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#2A2A2A",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  selectedPreviewCard: {
    borderColor: "#147EFB",
    borderWidth: 3,
  },
  previewWrapper: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },
  previewLoadingContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
  },
  previewScreen: {
    width: screenWidth,
    height: screenHeight,
    transform: [{ scale: previewSize / screenWidth }],
    transformOrigin: "top left",
  },
  selectedOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(20, 126, 251, 0.1)",
    justifyContent: "flex-end",
    alignItems: "flex-end",
    padding: 12,
  },
  checkmark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#147EFB",
    justifyContent: "center",
    alignItems: "center",
  },
  checkmarkText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  screenName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F0F0F0",
    marginBottom: 4,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  screenCaption: {
    fontSize: 12,
    color: "#888",
    textAlign: "center",
    paddingHorizontal: 8,
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
  saveButton: {
    backgroundColor: "#333",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 0,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
});

export default HomeScreenSelector;
