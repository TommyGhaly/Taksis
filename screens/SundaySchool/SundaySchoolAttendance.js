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
  PixelRatio,
} from "react-native";
import { BlurView } from "expo-blur";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import * as Haptics from "react-native-haptic-feedback";
import { Ionicons } from "@expo/vector-icons";
import Avatar from "../../components/Avatar";
import * as avatarCache from "../../utils/avatarCache";
import { makeScreenCache } from "../../utils/screenCache";
import { LIST_PERF, REMOVE_CLIPPED_ANDROID_ONLY } from "../../utils/listConfig";
import {
  makeSectionListGetItemLayout,
  makeRowHeightAudit,
} from "../../utils/sectionListLayout";
import { shortDateLabel } from "../../utils/dateKeys";
import SkeletonScreen from "../../components/Skeleton";
import { useAfterInteractions } from "../../hooks/useAfterInteractions";
import useDeferredSearch from "../../hooks/useDeferredSearch";

const { height } = Dimensions.get("window");

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

const getNextSunday = () => {
  const today = new Date();
  const currentDay = today.getDay();
  if (currentDay === 0) return formatDate(today);
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + (7 - currentDay));
  return formatDate(nextSunday);
};

const formatGrade = (grade) => {
  if (isNaN(parseInt(grade))) return grade;
  const num = parseInt(grade);
  const suffix = num === 1 ? "st" : num === 2 ? "nd" : num === 3 ? "rd" : "th";
  return `${num}${suffix} Grade`;
};

// The deferred-write rationale that used to live here now lives in
// utils/screenCache.js, alongside the four admin screens that were missing it.
const CacheUtils = makeScreenCache();

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

// RN scales a declared lineHeight by the OS font scale (allowFontScaling defaults
// to on), so the height arithmetic has to scale it too or every constant below is
// wrong for anyone using large text.
//
// The ceil-to-whole-pixel is not cosmetic either. Native rounds a scaled line box
// UP to the device pixel grid, and modelling that as plain multiplication (or as
// roundToNearestPixel) leaves each row a fraction of a point short — which then
// accumulates down the list. Verified on device: at a 0.94 font scale a declared
// 20pt line renders as exactly 19.0, and 14pt as 13.333, which is what ceil gives
// and rounding does not.
const FONT_SCALE = PixelRatio.getFontScale();
const PX = PixelRatio.get();
const LH = (v) => Math.ceil(v * FONT_SCALE * PX) / PX;

// studentContainer: 1px border top and bottom, 14 padding all round, the header
// row (the avatar wins over the name line and the chevron), then the attendance
// block, then its own margin.
//
// The two isPastDate branches are height-identical — a status pill and a pair of
// buttons both being marginTop 12 + paddingVertical 12 + a 14pt line — so one
// constant covers both and rows do not change height when the week does.
const ATTENDANCE_BLOCK_H = 12 + 24 + LH(STATUS_LINE);
const ROW_H =
  2 + 28 + Math.max(44, LH(STUDENT_NAME_LINE)) + ATTENDANCE_BLOCK_H + 10;

// gradeHeaderRow: 6 padding top and bottom, 10 margin below, around the taller of
// the title line and the Add pill. The "Servants" section renders no Add pill, so
// its header is genuinely shorter than the grade headers.
const HDR_H_WITH_PILL = 12 + Math.max(LH(GRADE_HEADER_LINE), ADD_PILL_H) + 10;
const HDR_H_PLAIN = 12 + LH(GRADE_HEADER_LINE) + 10;

const getItemLayout = makeSectionListGetItemLayout({
  getItemHeight: () => ROW_H,
  getSectionHeaderHeight: (section) =>
    section.title === "Servants" ? HDR_H_PLAIN : HDR_H_WITH_PILL,
});

const auditStudentRow = makeRowHeightAudit("StudentRow", ROW_H, 10);

// Grade chips are plain strings and are their own key.
const chipKeyExtractor = (item) => item;

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


/**
 * One attendance row, memoized.
 *
 * This was an inline closure inside a `useCallback` renderItem. VirtualizedList's
 * CellRenderer is not memoized against parent re-renders, so every parent render
 * re-ran it for *every* mounted cell — each one rebuilding an <Avatar> (which
 * carries a useSyncExternalStore subscription plus two effects) and three
 * TouchableOpacity trees. With `windowSize` at its default 21 that meant ~150 live
 * cells rebuilt on every state change, and this screen re-renders once per grade
 * listener on load and again on every attendance write. That is what made the
 * buttons feel dead.
 *
 * Props are primitives plus stable callbacks so the memo actually holds.
 */
const StudentRow = React.memo(({ person, dateKey, isPastDate, isNavigating, onOpen, onAttendance }) => {
  const isServant = person.isServant || false;
  const status = person[dateKey];

  return (
    <View style={styles.studentContainer} onLayout={auditStudentRow}>
      {/* Whole row is tappable — avatar, name and chevron all open the person. */}
      <TouchableOpacity
        style={styles.studentHeader}
        activeOpacity={0.7}
        onPress={() => onOpen(person)}
        disabled={isNavigating}
      >
        <Avatar
          uid={person.uid}
          user={person}
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
            {person.name}{" "}
            {isServant ? (person.isCurrentUser ? "(You)" : "") : `- ${formatGrade(person.grade)}`}
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
            onPress={() => onAttendance(person, false)}
            activeOpacity={0.7}
          >
            <Text style={styles.attendanceButtonText}>Absent</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.attendanceButton,
              { backgroundColor: status === true ? "#147EFB" : "rgba(255,255,255,0.08)" },
            ]}
            onPress={() => onAttendance(person, true)}
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

const GradeHeader = React.memo(({ title, onAdd }) => {
  const isServants = title === "Servants";

  return (
    <View style={styles.gradeHeaderRow}>
      <Text style={styles.gradeHeader}>
        {isServants ? "Servants" : formatGrade(title)}
      </Text>
      {!isServants && (
        <TouchableOpacity
          style={styles.addPill}
          onPress={() => onAdd(title)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="add" size={14} color="#147EFB" />
          <Text style={styles.addPillText}>Add</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});
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

const SundaySchoolAttendance = () => {
  const navigation = useNavigation();
  const user = auth().currentUser;

  const [userData, setUserData] = useState(null);
  const [studentsByGrade, setStudentsByGrade] = useState({});
  const [servants, setServants] = useState([]);
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
  const [previousSundays, setPreviousSundays] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // The TextInput below stays bound to `searchQuery` so the caret never lags.
  // Everything that describes the *result* of the search reads `search`, which
  // trails by a render under fast typing instead of re-filtering every grade and
  // re-rendering every mounted cell on each keystroke.
  const search = useDeferredSearch(searchQuery);
  const [userGrades, setUserGrades] = useState([]);

  const sectionListRef = useRef(null);
  const isMounted = useRef(true);
  const studentUnsubscribes = useRef([]);
  const userUnsubscribe = useRef(null);
  const cacheKeys = useRef({ user: null, students: {}, servants: null });
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
        user: `user_${user.uid}`,
        students: {},
        servants: `servants_${user.uid}`,
      };
      // Await the cache read rather than sitting on a fixed 300ms timer: the
      // gate below keys off `userData`, so we only need the cached doc to have
      // landed (usually a couple of ms) before dropping the skeleton.
      await loadCachedData();
      await generatePreviousSundays();
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
      const [cachedUser, cachedServants] = await Promise.all([
        CacheUtils.get(cacheKeys.current.user),
        CacheUtils.get(cacheKeys.current.servants),
      ]);
      if (cachedUser && isMounted.current) {
        setUserData(cachedUser);
        if (cachedUser.ssGrades?.length > 0) {
          const cachedStudents = {};
          await Promise.all(
            cachedUser.ssGrades.map(async (grade) => {
              const cacheKey = `students_${user.uid}_${grade}`;
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
      if (cachedServants && isMounted.current) setServants(cachedServants);
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
  // Each grade gets its own unbounded onSnapshot, and a servant can be assigned
  // to 16 of them. Applying each snapshot directly meant up to 16 back-to-back
  // setStates on a cold load — 16 full re-renders, each rebuilding every mounted
  // cell and re-deriving the sections. Batching them into a single flush is what
  // leaves the JS thread free enough to accept a tap on the header or tab bar
  // while the read is still finishing.
  const pendingGrades = useRef({});
  const flushScheduled = useRef(false);

  // ── What keeps the skeleton up until the content is actually there ───────────
  //
  // `loading` used to be cleared by the first flush, i.e. by whichever grade's
  // snapshot happened to arrive first. A servant assigned to 16 grades therefore
  // lost the skeleton after grade 1 and watched the other 15 pop in behind an
  // already-rendered screen. That is the "animation only runs until the screen is
  // rendered" problem — the animation was fine, the skeleton was leaving early.
  //
  // Now every source has to report once before the skeleton comes down: each
  // assigned grade, plus the servants roster.
  const expectedGrades = useRef(0);
  const reportedGrades = useRef(new Set());
  const servantsReported = useRef(false);

  const maybeFinishLoading = useCallback(() => {
    if (!isMounted.current) return;
    if (reportedGrades.current.size < expectedGrades.current) return;
    if (!servantsReported.current) return;
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
    if (!userData?.church || !userData?.ssGrades?.length) {
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
      userData.ssGrades.forEach((grade) => {
        if (prevStudents[grade]) updatedStudents[grade] = prevStudents[grade];
      });
      return updatedStudents;
    });
    studentUnsubscribes.current.forEach((unsubscribe) => unsubscribe());
    studentUnsubscribes.current = [];
    // Reset the tally for this set of grades before attaching listeners.
    expectedGrades.current = userData.ssGrades.length;
    reportedGrades.current = new Set();
    const newUnsubscribes = userData.ssGrades.map((grade) => {
      const cacheKey = `students_${user.uid}_${grade}`;
      cacheKeys.current.students[grade] = cacheKey;
      return firestore()
        .collection("churches")
        .doc(userData.church)
        .collection("Sunday School")
        .doc(grade)
        .collection("students")
        .onSnapshot(
          (snapshot) => {
            if (!isMounted.current) return;
            const students = snapshot.docs.map((doc) => ({ uid: doc.id, grade, ...doc.data() }));
            // (a.name || "") — a student doc with no `name` used to throw here and
            // take the whole snapshot handler down with it.
            students.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            // Adopt any photoURL already on these docs — no Storage request.
            avatarCache.primeMany(students);
            // Queued, not applied: see queueGradeUpdate. A servant assigned to 16
            // grades has 16 of these listeners all delivering at once.
            queueGradeUpdate(grade, students);
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
  }, [userData?.church, userData?.ssGrades?.join(","), queueGradeUpdate, maybeFinishLoading]);

  useEffect(() => {
    if (!userData?.church || !userData?.ssGrades?.length || !user) {
      setServants([]);
      setUserGrades([]);
      // No servants listener is attaching, so nothing should wait on one.
      servantsReported.current = true;
      return;
    }
    servantsReported.current = false;
    const gradeFields = ["preSchoolAge3", "preSchoolAge4", "kindergarten", "college"];
    for (let i = 1; i <= 12; i++) gradeFields.push(i.toString());
    const unsubscribe = firestore()
      .collection("churches")
      .doc(userData.church)
      .collection("Sunday School")
      .doc("Servants")
      .collection("Servants")
      .onSnapshot(
        async (snapshot) => {
          if (!isMounted.current) return;
          try {
            const currentUserServant = snapshot.docs.find((doc) => doc.id === user.uid);
            if (!currentUserServant) {
              setServants([]);
              setUserGrades([]);
              return;
            }
            const currentUserData = currentUserServant.data();
            const userGradesList = gradeFields.filter((field) => currentUserData[field] === true);
            setUserGrades(userGradesList);
            if (!userData.ssGrades?.length || userGradesList.length === 0) {
              setServants([]);
              return;
            }
            const userGradesSet = new Set(userGradesList);
            const servantsWithSharedGrades = snapshot.docs
              .filter((doc) => {
                const servantData = doc.data();
                return gradeFields.some((field) => userGradesSet.has(field) && servantData[field] === true);
              })
              .map((doc) => ({ uid: doc.id, isServant: true, isCurrentUser: doc.id === user.uid, ...doc.data() }));
            servantsWithSharedGrades.sort((a, b) => {
              if (a.isCurrentUser) return -1;
              if (b.isCurrentUser) return 1;
              return (a.name || "").localeCompare(b.name || "");
            });
            setServants(servantsWithSharedGrades);
            // Adopt any photoURL already on these docs — no Storage request.
            avatarCache.primeMany(servantsWithSharedGrades);
            CacheUtils.set(cacheKeys.current.servants, servantsWithSharedGrades);
          } catch (error) {
            console.error("Error processing servants:", error);
            setServants([]);
          } finally {
            // `finally` because the try above has several early returns; the
            // skeleton must come down on every one of them, not just the happy path.
            servantsReported.current = true;
            maybeFinishLoading();
          }
        },
        (error) => {
          if (isMounted.current) {
            console.error("Error fetching servants:", error);
            setServants([]);
            servantsReported.current = true;
            maybeFinishLoading();
          }
        }
      );
    return () => unsubscribe();
  }, [userData?.church, userData?.ssGrades?.join(","), user, maybeFinishLoading]);

  const generatePreviousSundays = async () => {
    const today = new Date();
    const sundays = [];
    let currentDate = new Date(today);
    const currentYear = today.getFullYear();
    const september11ThisYear = new Date(currentYear, 8, 11);
    const cutoffDate = today < september11ThisYear ? new Date(currentYear - 1, 8, 11) : september11ThisYear;
    const day = currentDate.getDay();
    const diffToSunday = day === 0 ? 0 : day;
    currentDate.setDate(currentDate.getDate() - diffToSunday);
    while (currentDate >= cutoffDate) {
      sundays.push(formatDate(currentDate));
      currentDate.setDate(currentDate.getDate() - 7);
    }
    setPreviousSundays(sundays);
  };

  const handleAttendance = useCallback((person, status) => {
    if (selectedDate && selectedDate !== getNextSunday()) return;
    Haptics.trigger("impactLight");
    const dateKey = getNextSunday();
    if (person.isServant) {
      firestore()
        .collection("churches")
        .doc(userData?.church)
        .collection("Sunday School")
        .doc("Servants")
        .collection("Servants")
        .doc(person.uid)
        .update({ [dateKey]: status });
    } else {
      firestore()
        .collection("churches")
        .doc(userData?.church)
        .collection("Sunday School")
        .doc(person.grade)
        .collection("students")
        .doc(person.uid)
        .update({ [dateKey]: status });
    }
  }, [selectedDate, userData?.church]);

  // Open the add-student modal pre-locked to the tapped grade
  // useCallback so the memoized GradeHeader isn't invalidated every render.
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
    if (!userData?.ssGrades?.includes(newStudentGrade)) {
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
      .collection("Sunday School")
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
    if (!search.active) return studentsByGrade;
    const filtered = {};
    if (userData?.ssGrades) {
      userData.ssGrades.forEach((grade) => {
        filtered[grade] = (studentsByGrade[grade] || []).filter((student) =>
          // `|| ""` guards a student doc with no name field. Every sibling
          // filter in the app guards; this one did not, so a nameless doc threw
          // inside the memo mid-keystroke and took the whole screen down.
          (student.name || "").toLowerCase().includes(search.lower)
        );
      });
    }
    return filtered;
    // `search.lower` is trimmed. The old code guarded on `searchQuery.trim()`
    // but then matched against the *untrimmed* query, so a leading space could
    // never match anything.
  }, [studentsByGrade, search, userData?.ssGrades]);

  const filteredServants = useMemo(() => {
    if (!search.active) return servants;
    return servants.filter((servant) =>
      (servant.name || "").toLowerCase().includes(search.lower)
    );
  }, [servants, search]);

  const gradeSections = useMemo(() => {
    if (!userData?.ssGrades) return [];
    const sections = userData.ssGrades.map((grade) => ({
      title: grade,
      data: filteredStudentsByGrade[grade] || [],
    }));
    if (filteredServants.length > 0) {
      sections.push({ title: "Servants", data: filteredServants });
    }
    if (search.active) {
      return sections.filter((section) => section.data.length > 0);
    }
    return sections;
  }, [userData?.ssGrades, filteredStudentsByGrade, filteredServants, search]);

  /**
   * Jump to a grade. Three things went away here, all consequences of the list
   * now having a getItemLayout:
   *
   *  - The 150ms setTimeout existed to give the target grade a chance to render
   *    before the jump. The offset is now known without rendering anything, so
   *    the delay was pure lag on every chip tap.
   *  - `animated: true` scrolled the viewport through every row in between,
   *    which forced the render window to sweep the whole range — the single
   *    biggest reason jumping to a far grade felt slow. Now false, matching
   *    every other list in the app.
   *  - The try/catch was dead: scrollToLocation does not throw for an in-range
   *    index, and out-of-range is what the guard below is for.
   */
  const scrollToSection = useCallback(
    (sectionTitle) => {
      if (!sectionListRef.current) return;
      const sectionIndex = gradeSections.findIndex((section) => section.title === sectionTitle);
      if (sectionIndex < 0) return;
      sectionListRef.current.scrollToLocation({
        sectionIndex,
        // 0 is the section header's own slot; 1 would be data item 0.
        itemIndex: 0,
        animated: false,
        viewPosition: 0,
        viewOffset: 0,
      });
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

  /**
   * Which grade chips survive the current search.
   *
   * `null` means "no search, everything is visible". Precomputed as a Set because
   * renderGrade used to run a `gradeSections.some(...)` scan per chip per render —
   * O(chips x sections) every time anything on the screen changed.
   */
  const visibleChipTitles = useMemo(() => {
    if (!search.active) return null;
    const visible = new Set();
    for (const section of gradeSections) {
      if (section.data.length > 0) visible.add(section.title);
    }
    return visible;
  }, [search, gradeSections]);

  const renderGrade = useCallback(
    ({ item }) => {
      if (visibleChipTitles && item !== "Servants" && !visibleChipTitles.has(item)) {
        return null;
      }
      if (item === "Servants" && filteredServants.length === 0) return null;
      return (
        <TouchableOpacity style={styles.gradeTag} onPress={() => scrollToSection(item)} activeOpacity={0.7}>
          <Text style={styles.gradeTagText}>{item === "Servants" ? "Servants" : formatGrade(item)}</Text>
        </TouchableOpacity>
      );
    },
    [visibleChipTitles, filteredServants.length, scrollToSection]
  );

  // Declared above renderStudent because they are in its dependency array — a
  // `const` referenced from a dep array before its declaration is a TDZ error.
  const dateKey = selectedDate || getNextSunday();
  const isCurrentWeek = !selectedDate || selectedDate === getNextSunday();

  // Navigation is hoisted out of the row so the memoized StudentRow receives a
  // stable callback instead of a fresh closure on every parent render.
  const openPerson = useCallback((person) => {
    if (!userData) {
      Alert.alert("Error", "User data not loaded.");
      return;
    }
    if (!userData.ssGrades) {
      Alert.alert("Error", "Sunday School grades not loaded.");
      return;
    }
    setIsNavigating(true);
    if (person.isServant) {
      navigation.navigate("ServantAttendance", { church: userData.church, servantId: person.uid });
    } else {
      navigation.navigate("IndividualAttendance", {
        church: userData.church,
        category: "Sunday School",
        grade: person.grade,
        studentId: person.uid,
        userGrades: userData?.ssGrades || [],
      });
    }
    setTimeout(() => setIsNavigating(false), 1000);
  }, [userData, navigation]);

  const renderStudent = useCallback(
    ({ item: person }) => (
      <StudentRow
        person={person}
        dateKey={dateKey}
        isPastDate={!isCurrentWeek}
        isNavigating={isNavigating}
        onOpen={openPerson}
        onAttendance={handleAttendance}
      />
    ),
    [dateKey, isCurrentWeek, isNavigating, openPerson, handleAttendance]
  );

  const keyExtractor = useCallback((item) => item.uid, []);

  // Both of these were inline literals on the SectionList, so every parent render
  // handed it new identities and it re-rendered every mounted cell.
  const renderGradeHeader = useCallback(
    ({ section: { title } }) => (
      <GradeHeader title={title} onAdd={openAddStudentModal} />
    ),
    [openAddStudentModal]
  );

  const listEmpty = useMemo(
    () => (
      <Text style={styles.noStudentsText}>
        {search.active
          ? "No students or servants found matching your search"
          : "No students in this grade"}
      </Text>
    ),
    [search]
  );

  /**
   * Grade chips for the horizontal selector.
   *
   * Was computed in the render body below the early returns, so it allocated a new
   * array every render and handed the FlatList a new `data` identity each time —
   * which re-rendered every chip. Hoisted above the early returns so it can be a
   * hook at all; `userData` may still be null up here, hence the optional access.
   */
  const allSections = useMemo(
    () =>
      search.active
        ? gradeSections.map((section) => section.title)
        : [
            ...(userData?.ssGrades || []),
            ...(servants.length > 0 ? ["Servants"] : []),
          ],
    [search, gradeSections, userData?.ssGrades, servants.length]
  );

  // Skeleton covers the navigation transition AND the whole read. Falling
  // through while `userData` is still null used to flash the "contact your
  // servants admin" empty state before the data had a chance to arrive.
  if (!ready || loading || !userData) {
    return <SkeletonScreen variant="list" count={8} />;
  }

  if (!userData || !userData.ssGrades || userData.ssGrades.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="school-outline" size={64} color="rgba(255,255,255,0.3)" />
        <Text style={styles.message}>Contact your church's servants admin to get assigned a Sunday School class.</Text>
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
          data={allSections}
          renderItem={renderGrade}
          // Hoisted: an inline arrow here was a new identity every render.
          // Deliberately no {...LIST_PERF} — this row holds at most 17 chips and
          // fits its whole dataset in a screen or two, so initialNumToRender: 10
          // would make the later chips visibly pop in for no benefit.
          keyExtractor={chipKeyExtractor}
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
        // touch targets, and this screen has a floating search bar overlaying the
        // list.
        removeClippedSubviews={REMOVE_CLIPPED_ANDROID_ONLY}
        contentContainerStyle={styles.sectionListContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        // Every row is a fixed height, so the offset of any grade is known
        // without having rendered it — which is what makes a grade chip land
        // instantly and exactly.
        //
        // This replaces a 500ms retry handler that could not have worked: it
        // received `info.index`, a *flat* index across all sections, and passed
        // it straight back as a `sectionIndex` after bounds-checking it against
        // gradeSections.length. Flat indices are almost always larger than the
        // section count, so the retry usually did nothing and otherwise jumped to
        // the wrong grade. The failure path is unreachable once getItemLayout is
        // set (VirtualizedList guards it on exactly that), so it is gone.
        getItemLayout={getItemLayout}
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
                placeholder="Search students & servants"
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
                    {userData?.ssGrades?.map((grade) => {
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
                <Text style={styles.weekModalSubtitle}>Tap any Sunday to view its attendance</Text>
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
                <Text style={styles.thisWeekDate}>{shortDateLabel(getNextSunday())}</Text>
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
                data={previousSundays}
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

export default SundaySchoolAttendance;