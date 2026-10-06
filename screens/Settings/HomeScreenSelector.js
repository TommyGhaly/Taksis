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
  useWindowDimensions,
  InteractionManager,
  SafeAreaView,
  Platform,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { doc, getFirestore, onSnapshot, updateDoc } from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import BackArrow from "../../components/backArrow";
import SkeletonScreen from "../../components/Skeleton";
import { PreviewModeProvider } from "../../components/PreviewMode";
import { useContentWidth, WIDE_MIN } from "../../hooks/useResponsiveLayout";

// Import actual screen components
import HomeScreen from "../Home/HomeScreen";
import SundaySchoolAttendance from "../SundaySchool/SundaySchoolAttendance";
import AlhanAttendance from "../Alhan/AlhanAttendance";
import YouthMeetingAttendance from "../YouthMeeting/YouthMeetingAttendance";
import ServantsAttendance from "../ServantsMeeting/ServantsAttendance";
import DeaconEdits from "../AdminScreens/DeaconEdits";
import TrafficManager from "../AdminScreens/TrafficManager";
import ServantsAdmin from "../AdminScreens/ServantsAdmin";
import AlhanAdmin from "../AdminScreens/AlhanAdmin";
import PaschaManager from "../AdminScreens/PaschaManager";
import AdminManager from "../AdminScreens/AdminManager";

const PREVIEW_BORDER_WIDTH = 3;
const GRID_PADDING = 20; // innerContainer's horizontal padding
const GRID_GAP = 20;

/**
 * Card and preview geometry for the width this screen actually has.
 *
 * This used to be module-level arithmetic on Dimensions.get("window"), which on
 * an iPad was both too wide (Settings sits in a centered column there, so two
 * window-sized halves overflowed it) and stale after a rotation. Each preview
 * renders its screen at the size that screen really gets — the column's width
 * by the window's height — and scales that down into the card.
 */
const usePreviewGeometry = () => {
  const contentWidth = useContentWidth();
  const { height: windowHeight } = useWindowDimensions();
  const columns = contentWidth >= WIDE_MIN ? 3 : 2;
  // Floored, not fractional: the card clips a scaled-down subtree, and a
  // half-point frame puts every rounded corner and text baseline inside it on a
  // sub-pixel boundary.
  const size = Math.floor(
    (contentWidth - GRID_PADDING * 2 - GRID_GAP * (columns - 1)) / columns
  );
  // The card's border eats into the box the preview is clipped to, so the
  // downscale targets the inner width — otherwise the right edge of the screen
  // is cropped off inside the card.
  const innerWidth = size - PREVIEW_BORDER_WIDTH * 2;
  const scale = innerWidth / contentWidth;
  // Memoized so screenStyle keeps its identity between renders — ScreenPreview
  // is memo'd, and a fresh style object would re-render every mounted screen
  // each time a card is tapped.
  return React.useMemo(() => ({
    size,
    // Phone-tall at most; a landscape iPad screen is squatter than that and
    // the card follows it rather than leaving a blank band at the bottom.
    cardHeight: Math.round(Math.min(size * 1.6, windowHeight * scale + PREVIEW_BORDER_WIDTH * 2)),
    screenStyle: {
      width: contentWidth,
      height: windowHeight,
      transform: [{ scale }],
      transformOrigin: "top left",
    },
  }), [size, scale, contentWidth, windowHeight]);
};

// Gap between two preview mounts. Every card gets a real screen, but mounting
// ten of them in one frame locks the JS thread long enough that the grid can't
// be scrolled while it happens — so they come up one at a time instead.
const MOUNT_STAGGER_MS = 220;

// One card. `live` flips on when the stagger queue reaches this card; until then
// it shows the skeleton so the grid is laid out and scrollable immediately.
// memo'd because selecting a card re-renders the selector, and without this
// every already-mounted screen would re-render along with it.
const ScreenPreview = React.memo(({ component: Component, live, screenStyle }) => {
  if (!live) {
    return (
      <View style={styles.previewWrapper} pointerEvents="none">
        <SkeletonScreen variant="block" />
      </View>
    );
  }

  return (
    <View style={styles.previewWrapper}>
      <View style={screenStyle} pointerEvents="none">
        <PreviewModeProvider>
          <Component isPreview={true} />
        </PreviewModeProvider>
      </View>
    </View>
  );
});
ScreenPreview.displayName = "ScreenPreview";

/**
 * Reveals `total` previews one at a time, returning how many are live.
 *
 * Revealed cards are never un-revealed, and the order never depends on the
 * current selection — tapping a card must not remount anything.
 */
const useStaggeredMounts = (total, start) => {
  const [liveCount, setLiveCount] = useState(0);

  useEffect(() => {
    if (!start || liveCount >= total) return;

    let timer;
    // Let the scene's own entrance transition finish before the first mount.
    const handle = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(
        () => setLiveCount((c) => c + 1),
        liveCount === 0 ? 0 : MOUNT_STAGGER_MS,
      );
    });

    return () => {
      handle.cancel();
      clearTimeout(timer);
    };
  }, [start, liveCount, total]);

  return liveCount;
};

const HomeScreenSelector = () => {
  const navigation = useNavigation();
  const preview = usePreviewGeometry();
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
      id: "youthMeetingAttendance",
      name: "College Youth Attendance",
      caption: "Track College Youth Meeting attendance",
      component: YouthMeetingAttendance,
      available: userRoles.youthAdmin,
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

  const availableScreens = screenOptions.filter((screen) => screen.available);
  const liveCount = useStaggeredMounts(availableScreens.length, !isLoading);

  useEffect(() => {
    const user = getAuth().currentUser;
    if (user) {
      const unsubscribe = onSnapshot(
        doc(getFirestore(), "users", user.uid),
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
        }
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
      const user = getAuth().currentUser;
      if (user) {
        await updateDoc(doc(getFirestore(), "users", user.uid), {
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

  const renderScreenPreview = (screen, index) => {
    const isSelected = selectedScreen === screen.id;

    return (
      <TouchableOpacity
        key={screen.id}
        style={[styles.previewContainer, { width: preview.size }]}
        onPress={() => setSelectedScreen(screen.id)}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.previewCard,
            { width: preview.size, height: preview.cardHeight },
            isSelected && styles.selectedPreviewCard,
          ]}
        >
          {/* Every card mounts its real screen, staggered by liveCount. These
              are live mounts, so anything a screen does on mount that isn't
              read-only display work has to opt out via `useIsPreview()` —
              modals, alerts, writes, permission prompts. */}
          <ScreenPreview
            component={screen.component}
            live={index < liveCount}
            screenStyle={preview.screenStyle}
          />
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
        <SkeletonScreen variant="cards" count={4} />
      </SafeAreaView>
    );
  }

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
    columnGap: GRID_GAP,
  },
  previewContainer: {
    marginBottom: 24,
    alignItems: "center",
  },
  previewCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 16,
    marginBottom: 8,
    overflow: "hidden",
    // Constant in both states. Changing the width on selection moves the
    // content box by a point, which re-clips and re-rasterizes the scaled
    // screen inside at a different sub-pixel offset.
    borderWidth: PREVIEW_BORDER_WIDTH,
    borderColor: "#2A2A2A",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  selectedPreviewCard: {
    borderColor: "#147EFB",
  },
  previewWrapper: {
    width: "100%",
    height: "100%",
    overflow: "hidden",
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
