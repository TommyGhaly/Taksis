import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  TextInput,
  Keyboard,
  Animated,
  PixelRatio,
} from "react-native";
import { BlurView } from "expo-blur";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import PhotoInput from "../../components/photoInput";
import Avatar from "../../components/Avatar";
import AlphabetIndexBar from "../../components/AlphabetIndexBar";
import SkeletonScreen from "../../components/Skeleton";
import * as avatarCache from "../../utils/avatarCache";
import { LIST_PERF, REMOVE_CLIPPED_ANDROID_ONLY } from "../../utils/listConfig";
import {
  makeSectionListGetItemLayout,
  makeRowHeightAudit,
} from "../../utils/sectionListLayout";
import { makeScreenCache } from "../../utils/screenCache";
import useAfterInteractions from "../../hooks/useAfterInteractions";
import useDeferredSearch from "../../hooks/useDeferredSearch";

// Simple cache utilities
const CacheUtils = makeScreenCache();

// Haptic feedback options
const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// Grades list
const gradesList = [
  "Pre-School - Age 3",
  "Pre-School - Age 4",
  "Kindergarten",
  "1st Grade",
  "2nd Grade",
  "3rd Grade",
  "4th Grade",
  "5th Grade",
  "6th Grade",
  "7th Grade",
  "8th Grade",
  "9th Grade",
  "10th Grade",
  "11th Grade",
  "12th Grade",
  "College",
];

// Responsive design helper
const { width, height } = Dimensions.get("window");
const isTablet = Platform.isPad || (width >= 768 && height >= 768);
const scale = isTablet ? 1.2 : 1;
const paddingHorizontal = isTablet ? 32 : 16;
const indexBarWidth = isTablet ? 32 : 24;

// Line boxes for the two lines in a teacher card, and for the section header.
// ROW_H / HDR_H below are derived from these — change a font size without
// revisiting them and the __DEV__ drift warning in TeacherRow will say so.
const NAME_LINE = 20;
const DETAIL_LINE = 17;
const HEADER_LINE = 26;
// The delete button's tallest child is an Ionicons glyph, whose box JS cannot
// compute. Pinned to what it already measured so the row height is knowable.
const ACTION_BUTTON_H = 40;

// RN scales a declared lineHeight by the OS font scale (allowFontScaling defaults
// to on), so the height arithmetic has to scale it too or every constant below is
// wrong for anyone using large text.
const FONT_SCALE = PixelRatio.getFontScale();
const LH = (v) => v * FONT_SCALE;

// teacherCard is a column: 1px border top and bottom, 16*scale padding all round,
// then the teacherInfo row (the taller of the avatar and the two-line text
// block) plus its margin, then the pinned delete button, then the card's margin.
const TEXT_BLOCK_H = LH(NAME_LINE * scale) + 4 * scale + LH(DETAIL_LINE * scale);
const ROW_H =
  2 +
  32 * scale +
  Math.max(48 * scale, TEXT_BLOCK_H) +
  12 * scale +
  ACTION_BUTTON_H * scale +
  12 * scale;
// sectionHeader: 8*scale padding top and bottom around one 22*scale line.
const HDR_H = 16 * scale + LH(HEADER_LINE * scale);

const getItemLayout = makeSectionListGetItemLayout({
  getItemHeight: () => ROW_H,
  getSectionHeaderHeight: () => HDR_H,
});

const auditTeacherRow = makeRowHeightAudit("TeacherRow", ROW_H, 12 * scale);

/**
 * One roster row, memoized on the teacher doc.
 *
 * The row used to be an inline closure rebuilt on every parent render, so any
 * unrelated state change re-rendered every mounted cell — with a 48px avatar in
 * each one, that showed up as a stutter mid-scroll.
 */
const TeacherRow = React.memo(({ item, onPress, onRemove }) => (
  <TouchableOpacity
    style={styles.teacherCard}
    onPress={() => onPress(item)}
    activeOpacity={0.7}
    onLayout={auditTeacherRow}
  >
    <View style={styles.teacherInfo}>
      <View style={styles.teacherImageContainer}>
        <Avatar
          uid={item.id}
          user={item}
          size={48 * scale}
          borderRadius={24 * scale}
          style={styles.teacherImage}
          showBorder={false}
        />
      </View>
      {/*
        Both capped to one line: a joined list of assigned classes wrapped to a
        second line for anyone teaching more than two or three, which made the
        card height vary per row. See ROW_H.
      */}
      <View style={styles.teacherTextInfo}>
        <Text style={styles.teacherName} numberOfLines={1}>
          {item.name || "Unknown"}
        </Text>
        <Text style={styles.teacherGrades} numberOfLines={1}>
          {Array.isArray(item.alhanGrades) && item.alhanGrades.length > 0
            ? item.alhanGrades.join(", ")
            : "No classes assigned"}
        </Text>
      </View>
    </View>
    <View style={styles.buttonContainer}>
      <TouchableOpacity
        style={[styles.actionButton, styles.deleteButton]}
        onPress={() => onRemove(item.id)}
      >
        <Ionicons name="trash" size={20 * scale} color="#fff" />
        <Text style={styles.buttonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
));
TeacherRow.displayName = "TeacherRow";

const SectionHeader = React.memo(({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionHeaderText}>{title}</Text>
  </View>
));
SectionHeader.displayName = "SectionHeader";

const AlhanAdmin = () => {
  // Core state
  const [church, setChurch] = useState(null);
  const [teachers, setTeachers] = useState([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedGrades, setSelectedGrades] = useState([]);
  const [photoInputVisible, setPhotoInputVisible] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // The TextInput below stays bound to `searchQuery` so the caret never lags.
  // Everything that describes the *result* of the search reads `search`, which
  // trails by a render under fast typing instead of re-grouping the whole roster
  // and re-rendering every mounted cell on each keystroke.
  const search = useDeferredSearch(searchQuery);

  // Hold the skeleton until the navigation transition finishes, so the snapshot
  // work below doesn't compete with the animation on the JS thread.
  const ready = useAfterInteractions();

  // Refs
  const sectionListRef = useRef(null);
  const isMounted = useRef(true);
  const userUnsubscribe = useRef(null);
  const teachersUnsubscribe = useRef(null);
  // The church the roster listener is currently attached to.
  const attachedChurch = useRef(null);
  const cacheKeys = useRef({
    church: null,
    teachers: null
  });
  const searchInputRef = useRef(null);
  const keyboardOffset = useRef(new Animated.Value(0)).current;

  // Lift the floating search bar above the keyboard
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: e.endCoordinates.height,
        duration: Platform.OS === "ios" ? e.duration || 250 : 200,
        useNativeDriver: false,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: Platform.OS === "ios" ? e.duration || 250 : 200,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardOffset]);

  // Initialize and load cached data immediately
  useEffect(() => {
    if (!ready) return;
    isMounted.current = true;

    const initializeApp = async () => {
      const user = auth().currentUser;
      if (!user) {
        setLoading(false);
        Alert.alert("Error", "No user authenticated.");
        return;
      }

      // Set cache keys
      cacheKeys.current = {
        church: `alhan_admin_church_${user.uid}`,
        teachers: `alhan_admin_teachers_${user.uid}`
      };

      // Load cached data immediately (non-blocking)
      loadCachedData();
      
      // Set up real-time listeners
      setupUserChurchListener();
      
      // No timer: the skeleton stays up until the teachers snapshot actually
      // delivers. A 300ms timer used to hide it mid-flight, flashing an
      // empty screen before the real data landed.
    };

    initializeApp();

    return () => {
      isMounted.current = false;
      if (userUnsubscribe.current) {
        userUnsubscribe.current();
      }
      if (teachersUnsubscribe.current) {
        teachersUnsubscribe.current();
      }
    };
  }, [ready]);

  // Load cached data without blocking
  const loadCachedData = async () => {
    try {
      // Load all cached data in parallel
      const [cachedChurch, cachedTeachers] = await Promise.all([
        CacheUtils.get(cacheKeys.current.church),
        CacheUtils.get(cacheKeys.current.teachers)
      ]);

      if (cachedChurch && isMounted.current) {
        setChurch(cachedChurch);
      }

      if (cachedTeachers && isMounted.current) {
        setTeachers(cachedTeachers);
        // Cached docs carry photoURL, so avatars paint with no Storage calls.
        avatarCache.primeMany(cachedTeachers);
      }
    } catch (error) {
      console.log('Error loading cached data:', error);
    }
  };

  // Set up user church listener
  const setupUserChurchListener = () => {
    const user = auth().currentUser;
    
    userUnsubscribe.current = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        async (doc) => {
          if (!isMounted.current) return;
          
          if (doc.exists) {
            const userChurch = doc.data().church || null;
            setChurch(userChurch);
            
            // Cache church data
            CacheUtils.set(cacheKeys.current.church, userChurch);
            
            // Set up teachers listener when church is available. Only re-attach
            // when the church actually changed — re-attaching on every write to
            // your own user doc tore down the roster listener and replayed a full
            // snapshot, re-rendering the whole list each time.
            if (userChurch) {
              if (attachedChurch.current !== userChurch) {
                attachedChurch.current = userChurch;
                setupTeachersListener(userChurch);
              }
            } else {
              attachedChurch.current = null;
              setLoading(false);
            }
          } else {
            setLoading(false);
          }
        },
        (error) => {
          if (isMounted.current) {
            setLoading(false);
            Alert.alert("Error", "Failed to fetch church data.");
          }
        }
      );
  };

  // Set up teachers listener
  const setupTeachersListener = (churchId) => {
    // Clear previous listener if exists
    if (teachersUnsubscribe.current) {
      teachersUnsubscribe.current();
    }

    teachersUnsubscribe.current = firestore()
      .collection("users")
      .where("church", "==", churchId)
      .where("isAlhan", "==", true)
      .onSnapshot(
        async (querySnapshot) => {
          if (!isMounted.current) return;
          
          // One pass, one doc.data() per doc. The third .map this replaces
          // re-derived `name` through `querySnapshot.docs.find(...)` — a linear
          // scan plus another deserialization per teacher — to produce a value
          // the `...doc.data()` spread had already set. O(n²) dead work.
          // Sort key computed once per doc, not inside the comparator. Each
          // `doc` property read goes through @react-native-firebase's
          // deprecation Proxy, so each one is touched exactly once.
          const teacherList = querySnapshot.docs
            .map((doc) => {
              const data = doc.data();
              // String() keeps the comparator total against a non-string `name`.
              const name = String(data.name ?? "");
              const id = doc.id;
              return { item: { ...data, id, name }, key: name.trim().toLowerCase(), id };
            })
            .sort(
              (a, b) =>
                a.key.localeCompare(b.key) ||
                (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
            )
            .map((entry) => entry.item);

          setTeachers(teacherList);

          // These docs already carry photoURL, so priming the avatar cache
          // here costs no extra requests and replaces the old per-user
          // getDownloadURL() fan-out plus its 30s refetch timer.
          avatarCache.primeMany(teacherList);

          // Real data is on screen — only now drop the skeleton.
          setLoading(false);

          // Cache teachers data
          CacheUtils.set(cacheKeys.current.teachers, teacherList);
        },
        (error) => {
          if (isMounted.current) {
            setLoading(false);
            Alert.alert("Error", "Could not fetch teachers.");
          }
        }
      );
  };

  // Build sections from teachers + searchQuery.
  //
  // Derived with useMemo, not state-in-an-effect. An effect runs *after* the
  // render that set `teachers`, so in that first frame `teachers` was full while
  // `sections` was still [] — and the "No teachers found." branch below painted
  // before the effect caught up. Deriving it keeps the two consistent within a
  // single render.
  const sections = useMemo(() => {
    if (teachers.length === 0) return [];

    const filtered = search.active
      ? teachers.filter((t) => (t.name || "").toLowerCase().includes(search.lower))
      : teachers;

    // Group by first letter (A-Z or #)
    const grouped = filtered.reduce((acc, teacher) => {
      const firstChar = (teacher.name || '').charAt(0).toUpperCase();
      const firstLetter = /^[A-Z]$/.test(firstChar) ? firstChar : "#";
      if (!acc[firstLetter]) acc[firstLetter] = [];
      acc[firstLetter].push(teacher);
      return acc;
    }, {});

    // Convert to SectionList format - put # at the end
    return Object.keys(grouped)
      .sort((a, b) => {
        if (a === '#') return 1;
        if (b === '#') return -1;
        return a.localeCompare(b);
      })
      .map((letter) => ({
        title: letter,
        data: grouped[letter],
      }));
  }, [teachers, search]);

  const availableLetters = useMemo(
    () => sections.map((section) => section.title).sort(),
    [sections]
  );

  // Handle remove photo
  const handleRemovePhoto = async () => {
    if (!selectedTeacher?.id) return;

    setDeletingPhoto(true);
    try {
      // Clears the Storage object, the photoURL pointer on the user doc, and
      // the cache — so a stale URL can't be re-primed by the next snapshot.
      await avatarCache.removePhoto(selectedTeacher.id);
      Alert.alert("Success", "Profile picture deleted successfully");
    } catch (error) {
      Alert.alert("Error", "Could not delete profile picture. Please try again.");
    } finally {
      setDeletingPhoto(false);
    }
  };

  // Handle edit profile picture
  const handleEditProfilePicture = () => {
    Alert.alert(
      "Edit Profile Picture",
      "Choose an option",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Change Photo",
          onPress: () => setPhotoInputVisible(true),
        },
        {
          text: "Remove Photo",
          style: "destructive",
          onPress: handleRemovePhoto,
        },
      ],
      { cancelable: true }
    );
  };

  // Open edit modal
  const openEditModal = useCallback((teacher) => {
    if (!teacher?.id) return;
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setSelectedTeacher(teacher);
    setSelectedGrades(
      Array.isArray(teacher.alhanGrades) ? teacher.alhanGrades : []
    );
    setModalVisible(true);
  }, []);

  // Open photo input modal
  const openPhotoInputModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setPhotoInputVisible(true);
  };

  // Close edit modal
  const closeEditModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setModalVisible(false);
    setSelectedTeacher(null);
    setSelectedGrades([]);
  };

  // Close photo input modal
  const closePhotoInputModal = () => {
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions);
    setPhotoInputVisible(false);
    // PhotoInput writes the new URL straight into avatarCache (and onto the
    // user doc), so there is nothing to refetch on close.
  };

  // Save classes
  const saveClasses = async () => {
    if (!selectedTeacher) return;

    try {
      await firestore().collection("users").doc(selectedTeacher.id).update({
        alhanGrades: selectedGrades,
      });
      // Clear teachers cache to force refresh
      await CacheUtils.remove(cacheKeys.current.teachers);
      closeEditModal();
    } catch (error) {
      Alert.alert("Error", "Could not save classes. Please try again.");
    }
  };

  // Remove teacher
  const removeTeacher = useCallback(async (teacherId) => {
    try {
      await firestore().collection("users").doc(teacherId).update({
        isAlhan: false,
        alhanGrades: [],
      });
      // Clear teachers cache to force refresh
      await CacheUtils.remove(cacheKeys.current.teachers);
    } catch (error) {
      Alert.alert("Error", "Could not remove teacher. Please try again.");
    }
  }, []);

  // Scroll to section
  const scrollToSection = (letter) => {
    const sectionIndex = sections.findIndex((s) => s.title === letter);
    if (sectionIndex < 0 || !sectionListRef.current) {
      return;
    }
    sectionListRef.current.scrollToLocation({
      sectionIndex,
      // 0 is the section header's own slot. This used to be 1, which targets
      // data item 0 and only lands on the header because sticky-header handling
      // subtracts the header's height back off — which in turn needed the
      // header's frame to be known. 0 addresses it directly.
      itemIndex: 0,
      animated: false,
      viewPosition: 0,
      viewOffset: 0,
    });
  };

  // Render section header
  const renderSectionHeader = useCallback(
    ({ section: { title } }) => <SectionHeader title={title} />,
    []
  );

  // Render teacher item
  const renderTeacher = useCallback(
    ({ item }) => (
      <TeacherRow item={item} onPress={openEditModal} onRemove={removeTeacher} />
    ),
    [openEditModal, removeTeacher]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  // A roster of person cards — rows land in place of these. Gated on the
  // teacher list rather than on `church`: church resolves from cache first, and
  // dropping the skeleton then flashed "No teachers found." until the snapshot
  // landed.
  if (!ready || (loading && teachers.length === 0)) {
    return (
      <SkeletonScreen
        variant="personCards"
        count={isTablet ? 10 : 8}
        showHeader={false}
        paddingHorizontal={paddingHorizontal}
        paddingTop={20}
        // Matches listContainer's inset for the alphabet index bar.
        bodyStyle={{ paddingRight: 32 }}
        header={
          <Text style={[styles.header, { fontSize: 24 * scale }]}>
            Manage Alhan
          </Text>
        }
      />
    );
  }

  return (
    <View style={[styles.container, { paddingHorizontal }]}>
      <Text style={[styles.header, { fontSize: 24 * scale }]}>
        Manage Alhan
      </Text>
      {sections.length === 0 ? (
        <Text style={[styles.noData, { fontSize: 16 * scale }]}>
          {search.active ? "No teachers match your search." : "No teachers found."}
        </Text>
      ) : (
        <View style={styles.listWrapper}>
          <SectionList
            ref={sectionListRef}
            sections={sections}
            renderItem={renderTeacher}
            renderSectionHeader={renderSectionHeader}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={true}
            {...LIST_PERF}
            // Every row is a fixed height, so the offset of any letter is known
            // without having rendered it. This is what makes the A-Z bar land
            // instantly instead of failing: the handler that used to sit here
            // swallowed the failure and left the list where it was, so tapping a
            // far letter did nothing. It is unreachable once getItemLayout is
            // set (VirtualizedList guards the whole failure path on it), so it is
            // gone rather than kept as a silent catch-all.
            getItemLayout={getItemLayout}
            // Android only: on iOS this blanked rows once the list was scrolled
            // past a screen or two. See utils/listConfig.js.
            removeClippedSubviews={REMOVE_CLIPPED_ANDROID_ONLY}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          />
          {/* Gated on the deferred value so the bar and the list change together. */}
          {sections.length > 0 && !search.active && (
            <View style={{ position: 'absolute', top: 100 * scale, right: 0, width: 30 }}>
              <AlphabetIndexBar 
                onLetterChange={scrollToSection} 
                availableLetters={availableLetters}
              />
            </View>
          )}
        </View>
      )}

      {/* ---------- Floating bottom search bar with system material ---------- */}
      <Animated.View
        style={[
          styles.floatingBarWrapper,
          { transform: [{ translateY: Animated.multiply(keyboardOffset, -1) }] },
        ]}
        pointerEvents="box-none"
      >
        <BlurView
          tint="systemChromeMaterialDark"
          intensity={80}
          style={styles.floatingBlur}
        >
          <View style={styles.floatingInner}>
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={16} color="rgba(255,255,255,0.55)" style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchBar}
                placeholder="Search teachers"
                placeholderTextColor="rgba(255,255,255,0.55)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
            </View>
          </View>
        </BlurView>
      </Animated.View>

      {selectedTeacher && (
        <Modal visible={modalVisible} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <View style={styles.headerContent}>
                  <View style={styles.profileImageContainer}>
                    <Avatar
                      uid={selectedTeacher.id}
                      user={selectedTeacher}
                      size={80}
                      finalSize={300}
                      borderRadius={40}
                      style={styles.profileImage}
                      expandable
                    />
                    <TouchableOpacity
                      style={styles.editProfilePictureButton}
                      onPress={handleEditProfilePicture}
                      disabled={deletingPhoto}
                    >
                      <Ionicons
                        name="pencil"
                        size={16 * scale}
                        color="#147efb"
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.modalTitle, { fontSize: 18 * scale }]}>
                    Assign Classes for {selectedTeacher?.name}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={closeEditModal}
                >
                  <Ionicons name="close" size={24 * scale} color="#fff" />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={styles.modalScrollContent}
              >
                <View style={styles.modalContent}>
                  {/* Fixed 16-item list inside a ScrollView: virtualization was
                      already disabled via scrollEnabled={false}, so a plain map
                      is cheaper and avoids the nested-VirtualizedList warning. */}
                  <View style={styles.gradesList}>
                    {gradesList.map((grade) => (
                      <TouchableOpacity
                        key={grade}
                        style={[
                          styles.gradeItem,
                          selectedGrades.includes(grade) &&
                            styles.gradeItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedGrades((prev) => {
                            const toggled = prev.includes(grade)
                              ? prev.filter((g) => g !== grade)
                              : [...prev, grade];
                            return gradesList.filter((g) =>
                              toggled.includes(g)
                            );
                          });
                        }}
                      >
                        <Text
                          style={[styles.gradeText, { fontSize: 16 * scale }]}
                        >
                          {grade}
                        </Text>
                        {selectedGrades.includes(grade) && (
                          <Ionicons
                            name="checkmark-circle"
                            size={20 * scale}
                            color="#147efb"
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={closeEditModal}
                >
                  <Text
                    style={[styles.modalButtonText, { fontSize: 16 * scale }]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={saveClasses}
                >
                  <Text
                    style={[styles.modalButtonText, { fontSize: 16 * scale }]}
                  >
                    Confirm
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      {selectedTeacher && (
        <PhotoInput
          visible={photoInputVisible}
          onClose={closePhotoInputModal}
          userId={selectedTeacher.id}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingTop: 20,
  },
  header: {
    fontWeight: "600",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  listWrapper: {
    flex: 1,
    position: 'relative',
  },
  listContainer: {
    paddingBottom: 110, // leave room for the floating bar
    flexGrow: 1,
    paddingRight: 32,
  },
  teacherCard: {
    flexDirection: "column",
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 16 * scale,
    marginBottom: 12 * scale,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  teacherInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12 * scale,
  },
  teacherImageContainer: {
    marginRight: 14 * scale,
  },
  teacherImage: {
    width: 48 * scale,
    height: 48 * scale,
    borderRadius: 24 * scale,
  },
  teacherTextInfo: {
    flex: 1,
  },
  // Explicit lineHeights are load-bearing: a Text without one gets the font's
  // natural line box, which JS cannot compute and which differs across platforms.
  teacherName: {
    fontSize: 17 * scale,
    lineHeight: NAME_LINE * scale,
    fontWeight: "600",
    color: "#fff",
  },
  teacherGrades: {
    fontSize: 14 * scale,
    lineHeight: DETAIL_LINE * scale,
    color: "rgba(255,255,255,0.5)",
    marginTop: 4 * scale,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12 * scale,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: ACTION_BUTTON_H * scale,
    paddingHorizontal: 16 * scale,
    borderRadius: 14,
  },
  deleteButton: {
    backgroundColor: "#ff3b30",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14 * scale,
    fontWeight: "600",
    marginLeft: 6 * scale,
  },
  noData: {
    textAlign: "center",
    color: "rgba(255,255,255,0.5)",
    marginTop: 20,
    fontSize: 16 * scale,
  },
  sectionHeader: {
    backgroundColor: "transparent",
    paddingVertical: 8 * scale,
    paddingHorizontal: 4,
  },
  sectionHeaderText: {
    fontSize: 22 * scale,
    lineHeight: HEADER_LINE * scale,
    fontWeight: "600",
    color: "#fff",
  },

  // ---------- Floating bottom search ----------
  floatingBarWrapper: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: Platform.OS === "ios" ? 28 : 16,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingBlur: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: Platform.OS === "android" ? "rgba(28,28,30,0.92)" : "transparent",
  },
  floatingInner: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchBar: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    paddingVertical: 0,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    width: "85%",
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
  },
  modalScrollView: {
    flexGrow: 1,
  },
  modalScrollContent: {
    paddingBottom: 16 * scale,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16 * scale,
    backgroundColor: "#147EFB",
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  profileImageContainer: {
    position: "relative",
    marginBottom: 12 * scale,
  },
  profileImage: {
    width: 80 * scale,
    height: 80 * scale,
    borderRadius: 40 * scale,
    borderWidth: 2,
    borderColor: "#fff",
  },
  editProfilePictureButton: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 6 * scale,
  },
  modalTitle: {
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  modalContent: {
    padding: 16 * scale,
  },
  closeButton: {
    position: "absolute",
    top: 16 * scale,
    right: 16 * scale,
    padding: 4 * scale,
  },
  gradesList: {
    paddingHorizontal: 16 * scale,
  },
  gradeItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14 * scale,
    paddingHorizontal: 16 * scale,
    borderRadius: 14,
    marginBottom: 8 * scale,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  gradeItemSelected: {
    backgroundColor: "rgba(20, 126, 251, 0.15)",
    borderColor: "rgba(20, 126, 251, 0.3)",
  },
  gradeText: {
    color: "#fff",
    fontWeight: "500",
  },
  indexBar: {
    position: "absolute",
    right: 0,
    top: (Platform.OS === 'ios' ? 140 : 120),
    height: height - (Platform.OS === 'ios' ? 200 : 180),
    width: indexBarWidth,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "space-evenly",
    zIndex: 1,
  },
  modalButtons: {
    flexDirection: "row",
    padding: 16 * scale,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    justifyContent: "space-between",
    gap: 12 * scale,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14 * scale,
    borderRadius: 14,
    alignItems: "center",
  },
  saveButton: {
    backgroundColor: "#147EFB",
  },
  cancelButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});

export default AlhanAdmin;