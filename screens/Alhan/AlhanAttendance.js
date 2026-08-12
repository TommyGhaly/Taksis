import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  FlatList,
  SectionList,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Animated,
  ScrollView,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import * as Haptics from "react-native-haptic-feedback";
import { Ionicons } from "@expo/vector-icons";
import Avatar from "../../components/Avatar";
import * as avatarCache from "../../utils/avatarCache";
import { makeScreenCache, HOUR } from "../../utils/screenCache";
import { LIST_PERF, REMOVE_CLIPPED_ANDROID_ONLY } from "../../utils/listConfig";
import { shortDateLabel } from "../../utils/dateKeys";
import SkeletonScreen from "../../components/Skeleton";
import { useAfterInteractions } from "../../hooks/useAfterInteractions";

const { height } = Dimensions.get("window");

// 24h rather than the 72h the other screens use. Preserved deliberately — this is
// the one screen that diverged, and collapsing it would change its behavior.
const CacheUtils = makeScreenCache({ ttlMs: 24 * HOUR });

// ---------- Input formatting helpers ----------
const formatPhoneInput = (raw) => {
  const digits = (raw || "").replace(/\D/g, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const formatBirthdayInput = (raw) => {
  const digits = (raw || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
};


/* ── Pure date/label helpers ───────────────────────────────────────────────────
 * Hoisted out of the component: they close over nothing, and redefining them on
 * every render made them unusable as dependencies for the memoized row below.
 */
const formatDate = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
};

const getNextSaturday = () => {
  const today = new Date();
  const currentDay = today.getDay();
  if (currentDay === 6) return formatDate(today);
  const nextSaturday = new Date(today);
  nextSaturday.setDate(today.getDate() + (6 - currentDay));
  return formatDate(nextSaturday);
};

const formatGrade = (grade) => {
  if (isNaN(parseInt(grade))) return grade;
  const num = parseInt(grade);
  const suffix = num === 1 ? "st" : num === 2 ? "nd" : num === 3 ? "rd" : "th";
  return `${num}${suffix} Grade`;
};

// ---------- Fixed row metrics ----------
//
// Nothing on this screen scales with device class — every dimension in the
// StyleSheet is a literal — so these are plain numbers.
//
// STUDENT_NAME_LINE and STATUS_LINE are explicit because a Text with no
// lineHeight gets the font's natural line box, which JS cannot compute and which
// differs between iOS and Android. ADD_PILL_H is pinned because the pill's
// tallest child is an Ionicons glyph, whose box is likewise not computable.
// ROW_H / HDR_H below are derived from all three.
const STUDENT_NAME_LINE = 19;
const STATUS_LINE = 17;
const GRADE_HEADER_LINE = 22;
const ADD_PILL_H = 26;

/**
 * One attendance row, memoized.
 *
 * This was an inline closure inside a `useCallback` renderItem. VirtualizedList's
 * CellRenderer is not memoized against parent re-renders, so every parent render
 * re-ran it for *every* mounted cell — each rebuilding an <Avatar> (which carries
 * a useSyncExternalStore subscription plus two effects) and three TouchableOpacity
 * trees. With windowSize at its default 21 that is ~150 live cells rebuilt on
 * every state change, and this screen re-renders once per grade listener on load.
 */
const StudentRow = React.memo(({ student, dateKey, isPastDate, isNavigating, onOpen, onAttendance }) => {
  const status = student[dateKey];

  return (
    <View style={styles.studentContainer}>
      {/* Whole row is tappable — avatar, name and chevron all open the student. */}
      <TouchableOpacity
        style={styles.studentHeader}
        activeOpacity={0.7}
        onPress={() => onOpen(student)}
        disabled={isNavigating}
      >
        <Avatar
          uid={student.uid}
          user={student}
          size={44}
          borderRadius={22}
          style={styles.profilePicture}
          showBorder={false}
        />
        <View style={styles.studentInfo}>
          {/*
            Capped to one line: this is `flex: 1` next to a chevron, and a long
            name plus the trailing grade suffix wrapped to a second line, which
            made the card taller for some students than others. See ROW_H.
          */}
          <Text style={styles.studentName} numberOfLines={1}>
            {student.name} - {formatGrade(student.grade)}
          </Text>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
        </View>
      </TouchableOpacity>
      {isPastDate ? (
        <View style={styles.attendanceStatusContainer}>
          <View
            style={[
              styles.attendanceStatus,
              {
                backgroundColor:
                  status === true
                    ? "#147EFB"
                    : status === false
                    ? "#ff3b30"
                    : "rgba(255,255,255,0.1)",
              },
            ]}
          >
            <Text style={styles.attendanceStatusText}>
              {status === true ? "Present" : status === false ? "Absent" : "Not Recorded"}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.attendanceButtons}>
          <TouchableOpacity
            style={[
              styles.attendanceButton,
              { backgroundColor: status === false ? "#ff3b30" : "rgba(255,255,255,0.08)" },
            ]}
            onPress={() => onAttendance(student, false)}
            activeOpacity={0.7}
          >
            <Text style={styles.attendanceButtonText}>Absent</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.attendanceButton,
              { backgroundColor: status === true ? "#147EFB" : "rgba(255,255,255,0.08)" },
            ]}
            onPress={() => onAttendance(student, true)}
            activeOpacity={0.7}
          >
            <Text style={styles.attendanceButtonText}>Present</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});
StudentRow.displayName = "StudentRow";

const GradeHeader = React.memo(({ title, onAdd }) => (
  <View style={styles.gradeHeaderRow}>
    <Text style={styles.gradeHeader}>{formatGrade(title)}</Text>
    <TouchableOpacity
      style={styles.addPill}
      onPress={() => onAdd(title)}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="add" size={14} color="#147EFB" />
      <Text style={styles.addPillText}>Add</Text>
    </TouchableOpacity>
  </View>
));
GradeHeader.displayName = "GradeHeader";


/**
 * One row in the week picker, memoized.
 *
 * Was an inline `renderItem` closure that called the date formatter per row per
 * render. The label now arrives precomputed and cached (see utils/dateKeys.js).
 */
const WeekRow = React.memo(({ label, selected, dateKey, onPress }) => (
  <TouchableOpacity
    style={[styles.weekRow, selected && styles.weekRowSelected]}
    onPress={() => onPress(dateKey)}
    activeOpacity={0.7}
  >
    <Text style={[styles.weekRowText, selected && styles.weekRowTextSelected]}>
      {label}
    </Text>
    {selected ? (
      <Ionicons name="checkmark-circle" size={20} color="#147EFB" />
    ) : (
      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.25)" />
    )}
  </TouchableOpacity>
));
WeekRow.displayName = "WeekRow";

const weekKeyExtractor = (item) => item;

const AlhanAttendance = () => {
  const navigation = useNavigation();
  const user = auth().currentUser;

  const [userData, setUserData] = useState(null);
  const [studentsByGrade, setStudentsByGrade] = useState({});
  const [loading, setLoading] = useState(true);

  // Add-student modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentGrade, setNewStudentGrade] = useState("");
  const [newStudentPhone, setNewStudentPhone] = useState("");
  const [newStudentBirthday, setNewStudentBirthday] = useState("");
  const [newStudentAddress, setNewStudentAddress] = useState("");
  const [newStudentDescription, setNewStudentDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [selectedDate, setSelectedDate] = useState(null);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [previousSaturdays, setPreviousSaturdays] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const sectionListRef = useRef(null);
  const isMounted = useRef(true);
  const studentUnsubscribes = useRef([]);
  const userUnsubscribe = useRef(null);
  const cacheKeys = useRef({ user: null, students: {} });
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

  // Hold every read until the drawer/tab transition has finished animating.
  const ready = useAfterInteractions();

  useEffect(() => {
    if (!ready) return;
    isMounted.current = true;
    const initializeApp = async () => {
      if (!user) {
        Alert.alert("Error", "No user found.");
        setLoading(false);
        return;
      }
      cacheKeys.current = {
        user: `alhan_user_${user.uid}`,
        students: {},
      };
      // Await the cache read rather than sitting on a fixed 300ms timer: the
      // gate below keys off `userData`, so we only need the cached doc to have
      // landed (usually a couple of ms) before dropping the skeleton.
      await loadCachedData();
      await generatePreviousSaturdays();
      setupUserListener();
      // Deliberately NOT flipping loading here — that only meant the local
      // cache read finished. The skeleton stays until the students snapshot
      // actually delivers (below), or until we know none is coming.
    };
    initializeApp();
    return () => {
      isMounted.current = false;
      if (userUnsubscribe.current) userUnsubscribe.current();
      studentUnsubscribes.current.forEach((unsubscribe) => unsubscribe());
      studentUnsubscribes.current = [];
    };
  }, [user, ready]);

  const loadCachedData = async () => {
    try {
      const cachedUser = await CacheUtils.get(cacheKeys.current.user);
      if (cachedUser && isMounted.current) {
        setUserData(cachedUser);
        if (cachedUser.alhanGrades?.length > 0) {
          const cachedStudents = {};
          await Promise.all(
            cachedUser.alhanGrades.map(async (grade) => {
              const cacheKey = `alhan_students_${user.uid}_${grade}`;
              cacheKeys.current.students[grade] = cacheKey;
              const cached = await CacheUtils.get(cacheKey);
              if (cached) cachedStudents[grade] = cached;
            })
          );
          if (Object.keys(cachedStudents).length > 0 && isMounted.current) {
            setStudentsByGrade(cachedStudents);
          }
        }
      }
    } catch (error) {
      console.log("Error loading cached data:", error);
    }
  };

  const setupUserListener = () => {
    userUnsubscribe.current = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        async (doc) => {
          if (!isMounted.current) return;
          if (!doc.exists) {
            Alert.alert("Error", "User not found.");
            return;
          }
          const newUserData = doc.data();
          setUserData(newUserData);
          CacheUtils.set(cacheKeys.current.user, newUserData);
        },
        (error) => {
          if (isMounted.current) Alert.alert("Error", error.message);
        }
      );
  };

  // One state update per tick, however many grade listeners deliver together.
  //
  // Each grade gets its own unbounded onSnapshot, and a teacher can be assigned to
  // 16 of them. Applying each snapshot directly meant up to 16 back-to-back
  // setStates on a cold load — 16 full re-renders, each rebuilding every mounted
  // cell and re-deriving the sections. Batching them into a single flush is what
  // leaves the JS thread free enough to accept a tap on the header or tab bar
  // while the read is still finishing.
  const pendingGrades = useRef({});
  const flushScheduled = useRef(false);

  // ── What keeps the skeleton up until the content is actually there ───────────
  //
  // `loading` used to be cleared by the first flush, i.e. by whichever grade's
  // snapshot happened to arrive first. A teacher assigned to 16 grades therefore
  // lost the skeleton after grade 1 and watched the other 15 pop in behind an
  // already-rendered screen. That is the "animation only runs until the screen is
  // rendered" problem — the animation was fine, the skeleton was leaving early.
  const expectedGrades = useRef(0);
  const reportedGrades = useRef(new Set());

  const maybeFinishLoading = useCallback(() => {
    if (!isMounted.current) return;
    if (reportedGrades.current.size < expectedGrades.current) return;
    setLoading(false);
  }, []);

  const queueGradeUpdate = useCallback((grade, students) => {
    pendingGrades.current[grade] = students;
    // Counted here rather than in the flush so an error path can mark a grade
    // reported without having any students to apply.
    reportedGrades.current.add(grade);
    if (flushScheduled.current) return;
    flushScheduled.current = true;

    setTimeout(() => {
      flushScheduled.current = false;
      const batch = pendingGrades.current;
      pendingGrades.current = {};
      if (!isMounted.current) return;
      setStudentsByGrade((prev) => ({ ...prev, ...batch }));
      maybeFinishLoading();
    }, 0);
  }, [maybeFinishLoading]);

  useEffect(() => {
    if (!userData?.church || !userData?.alhanGrades?.length) {
      // Nothing will be delivered for this user — drop the skeleton so the
      // empty state can show instead of shimmering forever.
      if (userData) setLoading(false);
      setStudentsByGrade({});
      studentUnsubscribes.current.forEach((unsubscribe) => unsubscribe());
      studentUnsubscribes.current = [];
      return;
    }
    setStudentsByGrade((prevStudents) => {
      const updatedStudents = {};
      userData.alhanGrades.forEach((grade) => {
        if (prevStudents[grade]) updatedStudents[grade] = prevStudents[grade];
      });
      return updatedStudents;
    });
    studentUnsubscribes.current.forEach((unsubscribe) => unsubscribe());
    studentUnsubscribes.current = [];
    // Reset the tally for this set of grades before attaching listeners.
    expectedGrades.current = userData.alhanGrades.length;
    reportedGrades.current = new Set();
    const newUnsubscribes = userData.alhanGrades.map((grade) => {
      const cacheKey = `alhan_students_${user.uid}_${grade}`;
      cacheKeys.current.students[grade] = cacheKey;
      return firestore()
        .collection("churches")
        .doc(userData.church)
        .collection("Hymns Class")
        .doc(grade)
        .collection("students")
        .onSnapshot(
          async (snapshot) => {
            if (!isMounted.current) return;
            const students = snapshot.docs.map((doc) => ({ uid: doc.id, grade, ...doc.data() }));
            // (a.name || "") — a student doc with no `name` used to throw here and
            // take the whole snapshot handler down with it.
            students.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            // Queued, not applied: see queueGradeUpdate. A teacher assigned to 16
            // grades has 16 of these listeners all delivering at once.
            queueGradeUpdate(grade, students);
            // Adopt any photoURL already on these docs — no Storage request.
            avatarCache.primeMany(students);
            CacheUtils.set(cacheKey, students);
          },
          (error) => {
            if (!isMounted.current) return;
            // Count the failure as reported, otherwise one unreadable grade would
            // hold the skeleton up forever waiting on a snapshot that won't come.
            reportedGrades.current.add(grade);
            maybeFinishLoading();
            Alert.alert("Error", `Failed to load students for ${grade}: ${error.message}`);
          }
        );
    });
    studentUnsubscribes.current = newUnsubscribes;
    return () => {
      studentUnsubscribes.current.forEach((unsubscribe) => unsubscribe());
      studentUnsubscribes.current = [];
    };
  }, [userData?.church, userData?.alhanGrades?.join(","), queueGradeUpdate, maybeFinishLoading]);

  const generatePreviousSaturdays = async () => {
    const today = new Date();
    const saturdays = [];
    let currentDate = new Date(today);
    const currentYear = today.getFullYear();
    const september11ThisYear = new Date(currentYear, 8, 11);
    const cutoffDate = today < september11ThisYear ? new Date(currentYear - 1, 8, 11) : september11ThisYear;
    const currentDay = currentDate.getDay();
    const daysSinceSaturday = currentDay === 6 ? 0 : currentDay < 6 ? currentDay + 1 : currentDay - 6;
    currentDate.setDate(currentDate.getDate() - daysSinceSaturday);
    while (currentDate >= cutoffDate) {
      saturdays.push(formatDate(currentDate));
      currentDate.setDate(currentDate.getDate() - 7);
    }
    setPreviousSaturdays(saturdays);
  };

  const handleAttendance = useCallback((student, status) => {
    if (selectedDate && selectedDate !== getNextSaturday()) return;
    Haptics.trigger("impactLight");
    const dateKey = getNextSaturday();
    firestore()
      .collection("churches")
      .doc(userData?.church)
      .collection("Hymns Class")
      .doc(student.grade)
      .collection("students")
      .doc(student.uid)
      .update({ [dateKey]: status });
  }, [selectedDate, userData?.church]);

  // Open the add-student modal pre-locked to the tapped grade.
  // useCallback so the memoized section header isn't invalidated every render.
  const openAddStudentModal = useCallback((grade) => {
    Haptics.trigger("impactLight");
    setNewStudentGrade(grade);
    setNewStudentName("");
    setNewStudentPhone("");
    setNewStudentBirthday("");
    setNewStudentAddress("");
    setNewStudentDescription("");
    setModalVisible(true);
  }, []);

  const addStudent = async () => {
    if (!newStudentName.trim()) {
      Alert.alert("Error", "Please enter a student name");
      return;
    }
    if (!newStudentGrade) {
      Alert.alert("Error", "No grade selected");
      return;
    }
    if (!userData?.alhanGrades?.includes(newStudentGrade)) {
      Alert.alert("Error", "You are no longer assigned to this grade");
      return;
    }
    // Validate birthday format if provided: MM-DD-YYYY
    const trimmedBirthday = newStudentBirthday.trim();
    if (trimmedBirthday && !/^\d{2}-\d{2}-\d{4}$/.test(trimmedBirthday)) {
      Alert.alert("Invalid Birthday", "Please use the format MM-DD-YYYY, or leave it blank.");
      return;
    }

    setSubmitting(true);
    const newStudentRef = firestore()
      .collection("churches")
      .doc(userData?.church)
      .collection("Hymns Class")
      .doc(newStudentGrade)
      .collection("students")
      .doc();
    try {
      await newStudentRef.set({
        name: newStudentName.trim(),
        uid: newStudentRef.id,
        phone: newStudentPhone.trim(),
        address: newStudentAddress.trim(),
        description: newStudentDescription.trim(),
        birthday: trimmedBirthday,
      });
      setModalVisible(false);
      setNewStudentName("");
      setNewStudentPhone("");
      setNewStudentBirthday("");
      setNewStudentAddress("");
      setNewStudentDescription("");
      await CacheUtils.remove(cacheKeys.current.students[newStudentGrade]);
    } catch (error) {
      Alert.alert("Error", "Failed to add student");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStudentsByGrade = useMemo(() => {
    if (!searchQuery.trim()) return studentsByGrade;
    const lower = searchQuery.toLowerCase();
    const filtered = {};
    if (userData?.alhanGrades) {
      userData.alhanGrades.forEach((grade) => {
        filtered[grade] = (studentsByGrade[grade] || []).filter((student) =>
          student.name.toLowerCase().includes(lower)
        );
      });
    }
    return filtered;
  }, [studentsByGrade, searchQuery, userData?.alhanGrades]);

  const gradeSections = useMemo(() => {
    if (!userData?.alhanGrades) return [];
    const sections = userData.alhanGrades.map((grade) => ({
      title: grade,
      data: filteredStudentsByGrade[grade] || [],
    }));
    if (searchQuery.trim()) {
      return sections.filter((section) => section.data.length > 0);
    }
    return sections;
  }, [userData?.alhanGrades, filteredStudentsByGrade, searchQuery]);

  const scrollToGrade = useCallback(
    (grade) => {
      if (!sectionListRef.current) return;
      const sectionIndex = gradeSections.findIndex((section) => section.title === grade);
      if (sectionIndex >= 0) {
        setTimeout(() => {
          if (sectionListRef.current && isMounted.current) {
            try {
              sectionListRef.current.scrollToLocation({
                sectionIndex,
                itemIndex: 1,
                animated: true,
                viewPosition: 0,
                viewOffset: 0,
              });
            } catch (error) {
              console.log("Scroll to location failed");
            }
          }
        }, 150);
      }
    },
    [gradeSections]
  );

  const handleJumpToCurrentWeek = () => {
    setSelectedDate(null);
    setDateModalVisible(false);
  };

  const handleWeekPress = useCallback((date) => {
    setSelectedDate(date);
    setDateModalVisible(false);
  }, []);

  const renderWeek = useCallback(
    ({ item }) => (
      <WeekRow
        label={shortDateLabel(item)}
        selected={selectedDate === item}
        dateKey={item}
        onPress={handleWeekPress}
      />
    ),
    [selectedDate, handleWeekPress]
  );

  const renderGrade = useMemo(
    () =>
      ({ item }) => {
        if (searchQuery.trim()) {
          const hasStudents = gradeSections.some((section) => section.title === item && section.data.length > 0);
          if (!hasStudents) return null;
        }
        return (
          <TouchableOpacity style={styles.gradeTag} onPress={() => scrollToGrade(item)} activeOpacity={0.7}>
            <Text style={styles.gradeTagText}>{formatGrade(item)}</Text>
          </TouchableOpacity>
        );
      },
    [searchQuery, gradeSections, scrollToGrade]
  );

  // Declared above renderStudent because they appear in its dependency array —
  // referencing a `const` from a dep array before its declaration is a TDZ error.
  const dateKey = selectedDate || getNextSaturday();
  const isCurrentWeek = !selectedDate || selectedDate === getNextSaturday();

  // Hoisted out of the row so the memoized StudentRow gets a stable callback
  // instead of a fresh closure on every parent render.
  const openStudent = useCallback((student) => {
    if (!userData) {
      Alert.alert("Error", "User data not loaded.");
      return;
    }
    if (!userData.alhanGrades) {
      Alert.alert("Error", "Alhan grades not loaded.");
      return;
    }
    setIsNavigating(true);
    navigation.navigate("IndividualAttendance", {
      church: userData.church,
      category: "Hymns Class",
      grade: student.grade,
      studentId: student.uid,
      userGrades: userData?.alhanGrades || [],
    });
    setTimeout(() => setIsNavigating(false), 1000);
  }, [userData, navigation]);

  const renderStudent = useCallback(
    ({ item: student }) => (
      <StudentRow
        student={student}
        dateKey={dateKey}
        isPastDate={!isCurrentWeek}
        isNavigating={isNavigating}
        onOpen={openStudent}
        onAttendance={handleAttendance}
      />
    ),
    [dateKey, isCurrentWeek, isNavigating, openStudent, handleAttendance]
  );

  const keyExtractor = useCallback((item) => item.uid, []);

  // Both of these were inline literals on the SectionList, so every parent render
  // handed it new identities and it re-rendered every mounted cell.
  const renderGradeHeader = useCallback(
    ({ section: { title } }) => <GradeHeader title={title} onAdd={openAddStudentModal} />,
    [openAddStudentModal]
  );

  const listEmpty = useMemo(
    () => (
      <Text style={styles.noStudentsText}>
        {searchQuery.trim()
          ? "No students found matching your search"
          : "No students in this grade"}
      </Text>
    ),
    [searchQuery]
  );

  /**
   * Grade chips for the horizontal selector.
   *
   * Was `data={searchQuery.trim() ? gradeSections.map(...) : userData.alhanGrades}`
   * inline in the JSX, so the search branch handed the FlatList a brand-new array
   * on every render and re-rendered every chip. `userData` may be null up here,
   * above the early returns, hence the optional access.
   */
  const gradeChips = useMemo(
    () =>
      searchQuery.trim()
        ? gradeSections.map((section) => section.title)
        : userData?.alhanGrades || [],
    [searchQuery, gradeSections, userData?.alhanGrades]
  );

  // Skeleton covers the navigation transition AND the whole read. Falling
  // through while `userData` is still null used to flash the "no class
  // assigned" empty state before the data had a chance to arrive.
  if (!ready || loading || !userData) {
    return <SkeletonScreen variant="list" count={8} />;
  }

  if (!userData || !userData.alhanGrades || userData.alhanGrades.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="musical-notes-outline" size={64} color="rgba(255,255,255,0.3)" />
        <Text style={styles.message}>Contact your church's alhan admin to get assigned a Hymns class.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isNavigating && (
        <View style={styles.navigatingOverlay}>
          <ActivityIndicator size="large" color="#147EFB" />
        </View>
      )}

      {/* ---------- Week selector ---------- */}
      <TouchableOpacity
        style={styles.weekSelector}
        onPress={() => setDateModalVisible(true)}
        activeOpacity={0.7}
      >
        <View style={styles.weekSelectorLeft}>
          <Ionicons name="calendar-outline" size={20} color="#147EFB" />
          <View style={styles.weekSelectorTextWrap}>
            <Text style={styles.weekSelectorLabel}>{isCurrentWeek ? "This Week" : "Viewing"}</Text>
            <Text style={styles.weekSelectorDate}>{shortDateLabel(dateKey)}</Text>
          </View>
        </View>
        <View style={styles.weekSelectorRight}>
          <Text style={styles.weekSelectorChange}>Change</Text>
          <Ionicons name="chevron-down" size={14} color="#147EFB" style={{ marginLeft: 4 }} />
        </View>
      </TouchableOpacity>

      <View style={styles.gradesContainer}>
        <FlatList
          data={gradeChips}
          renderItem={renderGrade}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gradesList}
        />
      </View>

      <SectionList
        ref={sectionListRef}
        sections={gradeSections}
        keyExtractor={keyExtractor}
        renderSectionHeader={renderGradeHeader}
        renderItem={renderStudent}
        ListEmptyComponent={listEmpty}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={true}
        {...LIST_PERF}
        // Android only: on iOS this has a history of blanking cells and breaking
        // touch targets, and a floating search bar overlays this list.
        removeClippedSubviews={REMOVE_CLIPPED_ANDROID_ONLY}
        contentContainerStyle={styles.sectionListContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onScrollToIndexFailed={(info) => {
          const wait = new Promise((resolve) => setTimeout(resolve, 500));
          wait.then(() => {
            if (sectionListRef.current && info.index >= 0 && info.index < gradeSections.length) {
              sectionListRef.current.scrollToLocation({
                sectionIndex: info.index,
                itemIndex: 1,
                animated: false,
                viewPosition: 0,
              });
            }
          });
        }}
      />

      {/* ---------- Floating bottom search bar ---------- */}
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
                placeholder="Search students"
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

      {/* ---------- Add Student modal ---------- */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalContentLarge}>
            {submitting ? (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="large" color="#147EFB" />
                <Text style={styles.loadingText}>Adding Student...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>Add Student</Text>
                <Text style={styles.modalSubtitle}>Name and grade are saved — everything else is optional</Text>

                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {/* Name (required) */}
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>Name</Text>
                    <View style={styles.requiredBadge}>
                      <Text style={styles.requiredBadgeText}>Required</Text>
                    </View>
                  </View>
                  <TextInput
                    style={styles.input}
                    autoCapitalize="words"
                    autoFocus
                    placeholder="Student name"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={newStudentName}
                    onChangeText={setNewStudentName}
                    returnKeyType="next"
                  />

                  {/* Grade — segmented chip selector */}
                  <View style={[styles.fieldLabelRow, { marginTop: 18 }]}>
                    <Text style={styles.fieldLabel}>Grade</Text>
                    <Text style={styles.fieldHint}>Tap to change</Text>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.gradeChipsScroll}
                    keyboardShouldPersistTaps="handled"
                  >
                    {userData?.alhanGrades?.map((grade) => {
                      const isSelected = grade === newStudentGrade;
                      return (
                        <TouchableOpacity
                          key={grade}
                          style={[styles.gradeChip, isSelected && styles.gradeChipSelected]}
                          onPress={() => {
                            Haptics.trigger("selection");
                            setNewStudentGrade(grade);
                          }}
                          activeOpacity={0.7}
                        >
                          {isSelected && (
                            <Ionicons
                              name="checkmark"
                              size={14}
                              color="#147EFB"
                              style={styles.gradeChipIcon}
                            />
                          )}
                          <Text style={[styles.gradeChipText, isSelected && styles.gradeChipTextSelected]}>
                            {formatGrade(grade)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Phone (optional) */}
                  <View style={[styles.fieldLabelRow, { marginTop: 18 }]}>
                    <Text style={styles.fieldLabel}>Phone</Text>
                    <View style={styles.optionalBadge}>
                      <Text style={styles.optionalBadgeText}>Optional</Text>
                    </View>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="(555) 123-4567"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={newStudentPhone}
                    onChangeText={(t) => setNewStudentPhone(formatPhoneInput(t))}
                    keyboardType="phone-pad"
                    returnKeyType="next"
                  />

                  {/* Birthday (optional) */}
                  <View style={[styles.fieldLabelRow, { marginTop: 18 }]}>
                    <Text style={styles.fieldLabel}>Birthday</Text>
                    <View style={styles.optionalBadge}>
                      <Text style={styles.optionalBadgeText}>Optional</Text>
                    </View>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="MM-DD-YYYY"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={newStudentBirthday}
                    onChangeText={(t) => setNewStudentBirthday(formatBirthdayInput(t))}
                    keyboardType="number-pad"
                    maxLength={10}
                    returnKeyType="next"
                  />

                  {/* Address (optional) */}
                  <View style={[styles.fieldLabelRow, { marginTop: 18 }]}>
                    <Text style={styles.fieldLabel}>Address</Text>
                    <View style={styles.optionalBadge}>
                      <Text style={styles.optionalBadgeText}>Optional</Text>
                    </View>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="123 Main St, City, State"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={newStudentAddress}
                    onChangeText={setNewStudentAddress}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />

                  {/* Description (optional) */}
                  <View style={[styles.fieldLabelRow, { marginTop: 18 }]}>
                    <Text style={styles.fieldLabel}>Description</Text>
                    <View style={styles.optionalBadge}>
                      <Text style={styles.optionalBadgeText}>Optional</Text>
                    </View>
                  </View>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    placeholder="Notes about the student"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={newStudentDescription}
                    onChangeText={setNewStudentDescription}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </ScrollView>

                <TouchableOpacity
                  style={[styles.modalButton, submitting && { opacity: 0.5 }]}
                  onPress={addStudent}
                  activeOpacity={0.7}
                  disabled={submitting}
                >
                  <Text style={styles.modalButtonText}>Add Student</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  disabled={submitting}
                  style={styles.cancelTouchable}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ---------- Week picker modal ---------- */}
      <Modal visible={dateModalVisible} transparent animationType="fade" onRequestClose={() => setDateModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.weekModalCard}>
            {/* Header */}
            <View style={styles.weekModalHeader}>
              <View>
                <Text style={styles.weekModalTitle}>Select a week</Text>
                <Text style={styles.weekModalSubtitle}>Tap any Saturday to view its attendance</Text>
              </View>
              <TouchableOpacity
                style={styles.weekModalClose}
                onPress={() => setDateModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            {/* Jump to this week */}
            <TouchableOpacity
              style={[styles.thisWeekRow, isCurrentWeek && styles.weekRowSelected]}
              onPress={handleJumpToCurrentWeek}
              activeOpacity={0.7}
            >
              <View style={styles.thisWeekIcon}>
                <Ionicons name="today-outline" size={18} color="#147EFB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.thisWeekTitle}>This week</Text>
                <Text style={styles.thisWeekDate}>{shortDateLabel(getNextSaturday())}</Text>
              </View>
              {isCurrentWeek && <Ionicons name="checkmark-circle" size={20} color="#147EFB" />}
            </TouchableOpacity>

            <View style={styles.weekModalDivider}>
              <Text style={styles.weekModalDividerText}>Previous weeks</Text>
            </View>

            {/* Scrollable list */}
            <View style={styles.weekListWrap}>
              <FlatList
                {...LIST_PERF}
                data={previousSaturdays}
                keyExtractor={weekKeyExtractor}
                style={styles.dateList}
                showsVerticalScrollIndicator={true}
                indicatorStyle="white"
                renderItem={renderWeek}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#121212",
  },

  // ---------- Week selector ----------
  weekSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  weekSelectorLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  weekSelectorTextWrap: {
    marginLeft: 12,
  },
  weekSelectorLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  weekSelectorDate: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
    marginTop: 2,
  },
  weekSelectorRight: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(20, 126, 251, 0.15)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  weekSelectorChange: {
    fontSize: 13,
    color: "#147EFB",
    fontWeight: "600",
  },

  // ---------- Week picker modal (redesigned) ----------
  weekModalCard: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#1a1a1a",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    maxHeight: height * 0.78,
  },
  weekModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  weekModalTitle: { fontSize: 20, color: "#fff", fontWeight: "700" },
  weekModalSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4 },
  weekModalClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  thisWeekRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 4,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  thisWeekIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(20,126,251,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  thisWeekTitle: { fontSize: 15, color: "#fff", fontWeight: "600" },
  thisWeekDate: { fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 1 },
  weekModalDivider: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 },
  weekModalDividerText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  weekListWrap: { position: "relative", flexShrink: 1 },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  weekRowSelected: { backgroundColor: "rgba(20,126,251,0.15)", borderColor: "rgba(20,126,251,0.4)" },
  weekRowText: { fontSize: 15, color: "#fff", fontWeight: "500" },
  weekRowTextSelected: { color: "#fff", fontWeight: "700" },

  // ---------- Grade tags ----------
  gradesContainer: {
    height: 34,
    marginBottom: 8,
  },
  gradesList: {
    alignItems: "center",
  },
  gradeTag: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  gradeTagText: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "600",
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

  // ---------- List ----------
  sectionListContent: {
    paddingBottom: 110,
  },
  gradeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#121212",
    paddingVertical: 6,
    marginBottom: 10,
  },
  gradeHeader: {
    fontSize: 18,
    lineHeight: GRADE_HEADER_LINE,
    fontWeight: "600",
    color: "#4d9cff",
  },
  addPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: ADD_PILL_H,
    backgroundColor: "rgba(20, 126, 251, 0.15)",
    borderRadius: 999,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(20, 126, 251, 0.3)",
  },
  addPillText: {
    fontSize: 12,
    color: "#147EFB",
    fontWeight: "600",
    marginLeft: 3,
  },
  studentContainer: {
    backgroundColor: "#1a1a1a",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  studentHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  profilePicture: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  studentInfo: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  studentName: {
    fontSize: 16,
    lineHeight: STUDENT_NAME_LINE,
    color: "#fff",
    fontWeight: "600",
    flex: 1,
  },
  attendanceButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 10,
  },
  attendanceButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  attendanceButtonText: {
    fontSize: 14,
    lineHeight: STATUS_LINE,
    fontWeight: "600",
    color: "#fff",
  },
  attendanceStatusContainer: {
    marginTop: 12,
  },
  attendanceStatus: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  attendanceStatusText: {
    fontSize: 14,
    lineHeight: STATUS_LINE,
    fontWeight: "600",
    color: "#fff",
  },

  // ---------- Misc / modals ----------
  loadingText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
    paddingHorizontal: 40,
  },
  message: {
    fontSize: 16,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 24,
  },
  noStudentsText: {
    fontSize: 15,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginVertical: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  modalContent: {
    width: "85%",
    maxWidth: 360,
    padding: 28,
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
  },
  // Larger variant for the multi-field add-student modal
  modalContentLarge: {
    width: "90%",
    maxWidth: 420,
    maxHeight: "85%",
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  modalScroll: {
    width: "100%",
    marginBottom: 16,
  },
  modalScrollContent: {
    paddingBottom: 4,
  },
  modalLoadingContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  modalTitle: {
    fontSize: 22,
    color: "#fff",
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 18,
    textAlign: "center",
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  fieldHint: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "500",
  },
  requiredBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 59, 48, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.3)",
  },
  requiredBadgeText: {
    fontSize: 10,
    color: "#ff453a",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  optionalBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  optionalBadgeText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    width: "100%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    color: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 70,
    paddingTop: 12,
  },
  gradeChipsScroll: {
    flexDirection: "row",
    paddingVertical: 2,
    paddingRight: 4,
    gap: 8,
  },
  gradeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  gradeChipSelected: {
    backgroundColor: "rgba(20, 126, 251, 0.18)",
    borderColor: "#147EFB",
    shadowColor: "#147EFB",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  gradeChipIcon: {
    marginRight: 5,
  },
  gradeChipText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    fontWeight: "600",
  },
  gradeChipTextSelected: {
    color: "#147EFB",
    fontWeight: "700",
  },
  modalButton: {
    width: "100%",
    backgroundColor: "#147EFB",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  cancelTouchable: {
    paddingVertical: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 15,
    color: "#ff3b30",
    fontWeight: "600",
  },
  dateList: {
    width: "100%",
    paddingHorizontal: 16,
  },
  navigatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
});

export default AlhanAttendance;