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
  PixelRatio,
} from "react-native";
import { BlurView } from "expo-blur";
import { useNavigation } from "@react-navigation/native";
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
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
import useResponsiveLayout from "../../hooks/useResponsiveLayout";
import useDeferredSearch from "../../hooks/useDeferredSearch";


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

// College Youth Meeting attendance. This screen is Sunday School's attendance
// screen with the grades and the Servants section taken out: one roster, shared
// by everyone an admin has given the Youth Meeting Manager role (`youthAdmin`)
// in Admin Manager — the same way Servants Meeting trackers are assigned. Every
// attendee is added by hand, like Sunday School students.
//
// The roster lives where a grade would in Sunday School's tree —
// churches/{c}/College Youth Meeting/Youth/students — so IndividualAttendance,
// which addresses a doc by `category` + `grade`, reads and edits it unchanged.
const CATEGORY = "College Youth Meeting";
const GROUP = "Youth";

// The meeting is on Fridays (0 = Sunday). Attendance is keyed by this week's
// meeting date, the way Sunday School keys by Sunday.
const MEETING_DAY = 5;
const MEETING_DAY_NAME = "Friday";

const getNextMeetingDate = () => {
  const today = new Date();
  const next = new Date(today);
  next.setDate(today.getDate() + ((MEETING_DAY - today.getDay() + 7) % 7));
  return formatDate(next);
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
// Line boxes are ~1.3x their font size. At ~1.2x (their old values) iOS
// clipped the descenders of g/y/p/j, most visibly in names.
const STUDENT_NAME_LINE = 22;
const STATUS_LINE = 19;
const GRADE_HEADER_LINE = 24;
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
// the title line and the Add pill.
const HDR_H = 12 + Math.max(LH(GRADE_HEADER_LINE), ADD_PILL_H) + 10;

// ---------- This month's birthdays ----------
//
// A section above the roster listing everyone whose saved birthday falls in the
// current month, or — flipped with the toggle in its header — next month. Its
// rows are compact and its header carries the toggle instead of an Add pill, so
// both get their own pinned heights.
const BIRTHDAYS = "Birthdays";
const BDAY_NAME_LINE = 21;
const BDAY_DETAIL_LINE = 18;
// birthdayRow: 1px border top and bottom, 12 padding all round, the taller of
// the 40pt avatar and the two text lines, then its own margin.
const BDAY_ROW_H =
  2 + 24 + Math.max(40, LH(BDAY_NAME_LINE) + 2 + LH(BDAY_DETAIL_LINE)) + 8;
// The month toggle's tallest child is text, but it is pinned like the Add pill
// so the header height does not depend on the font's natural line box.
const MONTH_TOGGLE_H = 28;
const HDR_H_BDAY = 12 + Math.max(LH(GRADE_HEADER_LINE), MONTH_TOGGLE_H) + 10;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Birthdays are entered as MM-DD-YYYY, but older or hand-edited docs may use
// slashes or leave the year off; accept those rather than silently dropping
// someone from the list. Returns { month: 1-12, day, year | null } or null.
const parseBirthday = (raw) => {
  const m = /^\s*(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2}|\d{4}))?\s*$/.exec(raw || "");
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let year = m[3] ? parseInt(m[3], 10) : null;
  if (year !== null && year < 100) year += 2000;
  return { month, day, year };
};

const getItemLayout = makeSectionListGetItemLayout({
  getItemHeight: (item) => (item?.isBirthday ? BDAY_ROW_H : ROW_H),
  getSectionHeaderHeight: (section) =>
    section.title === BIRTHDAYS ? HDR_H_BDAY : HDR_H,
});

const auditStudentRow = makeRowHeightAudit("StudentRow", ROW_H, 10);
const auditBirthdayRow = makeRowHeightAudit("BirthdayRow", BDAY_ROW_H, 8);


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
            name wrapped to a second line, which made the card taller for some
            people than others. See ROW_H.
          */}
          <Text style={styles.studentName} numberOfLines={1}>
            {person.name}
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

const GradeHeader = React.memo(({ title, onAdd }) => (
  <View style={styles.gradeHeaderRow}>
    <Text style={styles.gradeHeader}>{title}</Text>
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

const BirthdaysHeader = React.memo(({ monthOffset, onChangeMonth }) => {
  const current = new Date().getMonth();
  const labels = [MONTH_NAMES[current], MONTH_NAMES[(current + 1) % 12]];
  return (
    <View style={styles.gradeHeaderRow}>
      <Text style={styles.gradeHeader}>{BIRTHDAYS}</Text>
      <View style={styles.monthToggle}>
        {labels.map((label, offset) => {
          const selected = offset === monthOffset;
          return (
            <TouchableOpacity
              key={offset}
              style={[styles.monthToggleOption, selected && styles.monthToggleOptionSelected]}
              onPress={() => onChangeMonth(offset)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8 }}
            >
              <Text
                style={[styles.monthToggleText, selected && styles.monthToggleTextSelected]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});
BirthdaysHeader.displayName = "BirthdaysHeader";

/** One birthday, memoized. Tapping it opens the person, like a roster row. */
const BirthdayRow = React.memo(({ person, isNavigating, onOpen }) => {
  if (person.isEmpty) {
    // Same height as a birthday row, so getItemLayout stays exact.
    return (
      <View style={[styles.birthdayRow, styles.birthdayEmpty]} onLayout={auditBirthdayRow}>
        <Text style={styles.birthdayDetail}>No birthdays in {person.monthName}</Text>
      </View>
    );
  }
  const passed = person.bdayStatus === "passed";
  const detail =
    `${MONTH_NAMES[person.bdayMonth - 1]} ${person.bdayDay}` +
    (person.bdayAge ? ` · ${passed ? "turned" : "turns"} ${person.bdayAge}` : "");
  return (
    <TouchableOpacity
      style={[styles.birthdayRow, person.bdayStatus === "today" && styles.birthdayRowToday]}
      activeOpacity={0.7}
      onPress={() => onOpen(person)}
      disabled={isNavigating}
      onLayout={auditBirthdayRow}
    >
      <Avatar
        uid={person.uid}
        user={person}
        size={40}
        borderRadius={20}
        style={[styles.birthdayAvatar, passed && styles.birthdayPassed]}
        showBorder={false}
      />
      <View style={[styles.birthdayText, passed && styles.birthdayPassed]}>
        <Text style={styles.birthdayName} numberOfLines={1}>
          {person.name}
        </Text>
        <Text style={styles.birthdayDetail} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      {person.bdayStatus === "today" ? (
        <View style={styles.todayBadge}>
          <Ionicons name="gift" size={13} color="#fff" />
          <Text style={styles.todayBadgeText}>Today</Text>
        </View>
      ) : (
        <Ionicons
          name="gift-outline"
          size={18}
          color={passed ? "rgba(255,255,255,0.25)" : "#147EFB"}
        />
      )}
    </TouchableOpacity>
  );
});
BirthdayRow.displayName = "BirthdayRow";


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

const YouthMeetingAttendance = () => {
  const navigation = useNavigation();
  const user = getAuth().currentUser;

  const [userData, setUserData] = useState(null);
  // Sunday School derives its sections from `ssGrades`; here there is exactly
  // one, and the Youth Meeting Manager role is what grants it.
  const isYouthManager = !!userData?.youthAdmin;
  const groups = useMemo(() => (isYouthManager ? [GROUP] : []), [isYouthManager]);
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
  const [previousMeetings, setPreviousMeetings] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // The TextInput below stays bound to `searchQuery` so the caret never lags.
  // Everything that describes the *result* of the search reads `search`, which
  // trails by a render under fast typing instead of re-filtering every grade and
  // re-rendering every mounted cell on each keystroke.
  const search = useDeferredSearch(searchQuery);

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
  // On an iPad this screen sits in a centered column (MainContainer wraps it);
  // this is the padding inside it, a touch roomier than a phone's.
  const { gutter, isWide } = useResponsiveLayout({ maxContentWidth: 720, phoneGutter: 16 });

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
        user: `youth_user_${user.uid}`,
        students: {},
      };
      // Await the cache read rather than sitting on a fixed 300ms timer: the
      // gate below keys off `userData`, so we only need the cached doc to have
      // landed (usually a couple of ms) before dropping the skeleton.
      await loadCachedData();
      await generatePreviousMeetings();
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
        if (cachedUser.youthAdmin) {
          const cachedStudents = {};
          await Promise.all(
            [GROUP].map(async (grade) => {
              const cacheKey = `youth_students_${user.uid}_${grade}`;
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
    userUnsubscribe.current = onSnapshot(
      doc(getFirestore(), "users", user.uid),
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
    if (!userData?.church || !groups.length) {
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
      groups.forEach((grade) => {
        if (prevStudents[grade]) updatedStudents[grade] = prevStudents[grade];
      });
      return updatedStudents;
    });
    studentUnsubscribes.current.forEach((unsubscribe) => unsubscribe());
    studentUnsubscribes.current = [];
    // Reset the tally for this set of grades before attaching listeners.
    expectedGrades.current = groups.length;
    reportedGrades.current = new Set();
    const newUnsubscribes = groups.map((grade) => {
      const cacheKey = `youth_students_${user.uid}_${grade}`;
      cacheKeys.current.students[grade] = cacheKey;
      return onSnapshot(
        collection(
          getFirestore(),
          "churches",
          userData.church,
          CATEGORY,
          grade,
          "students"
        ),
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
  }, [userData?.church, groups, queueGradeUpdate, maybeFinishLoading]);

  const generatePreviousMeetings = async () => {
    const today = new Date();
    const sundays = [];
    let currentDate = new Date(today);
    const currentYear = today.getFullYear();
    const september11ThisYear = new Date(currentYear, 8, 11);
    const cutoffDate = today < september11ThisYear ? new Date(currentYear - 1, 8, 11) : september11ThisYear;
    const day = currentDate.getDay();
    currentDate.setDate(currentDate.getDate() - ((day - MEETING_DAY + 7) % 7));
    while (currentDate >= cutoffDate) {
      sundays.push(formatDate(currentDate));
      currentDate.setDate(currentDate.getDate() - 7);
    }
    setPreviousMeetings(sundays);
  };

  const handleAttendance = useCallback((person, status) => {
    if (selectedDate && selectedDate !== getNextMeetingDate()) return;
    Haptics.trigger("impactLight");
    const dateKey = getNextMeetingDate();
    updateDoc(
      doc(
        getFirestore(),
        "churches",
        userData?.church,
        CATEGORY,
        person.grade,
        "students",
        person.uid
      ),
      { [dateKey]: status }
    );
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
      Alert.alert("Error", "Please enter a name");
      return;
    }
    if (!newStudentGrade) {
      Alert.alert("Error", "No grade selected");
      return;
    }
    if (!groups.includes(newStudentGrade)) {
      Alert.alert("Error", "You no longer have the Youth Meeting Manager role");
      return;
    }
    // Validate birthday format if provided: MM-DD-YYYY
    const trimmedBirthday = newStudentBirthday.trim();
    if (trimmedBirthday && !/^\d{2}-\d{2}-\d{4}$/.test(trimmedBirthday)) {
      Alert.alert("Invalid Birthday", "Please use the format MM-DD-YYYY, or leave it blank.");
      return;
    }

    setSubmitting(true);
    const newStudentRef = doc(collection(
      getFirestore(),
      "churches",
      userData?.church,
      CATEGORY,
      newStudentGrade,
      "students"
    ));
    try {
      await setDoc(newStudentRef, {
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
      Alert.alert("Error", "Failed to add member");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStudentsByGrade = useMemo(() => {
    if (!search.active) return studentsByGrade;
    const filtered = {};
    groups.forEach((grade) => {
      filtered[grade] = (studentsByGrade[grade] || []).filter((student) =>
        // `|| ""` guards a student doc with no name field. Every sibling
        // filter in the app guards; this one did not, so a nameless doc threw
        // inside the memo mid-keystroke and took the whole screen down.
        (student.name || "").toLowerCase().includes(search.lower)
      );
    });
    return filtered;
    // `search.lower` is trimmed. The old code guarded on `searchQuery.trim()`
    // but then matched against the *untrimmed* query, so a leading space could
    // never match anything.
  }, [studentsByGrade, search, groups]);

  // Everyone on the roster whose birthday is in the chosen month, in day order.
  // 0 is this month, 1 is next month. The month is read at render time, so it
  // rolls over on the first open of a new month without anything scheduling it.
  const [bdayMonthOffset, setBdayMonthOffset] = useState(0);
  const now = new Date();
  const monthIndex = now.getMonth() + bdayMonthOffset; // 12 = next January
  const targetMonth = (monthIndex % 12) + 1;
  const targetYear = now.getFullYear() + (monthIndex >= 12 ? 1 : 0);
  // Only this month has a "today"; next month's birthdays are all upcoming.
  const today = bdayMonthOffset === 0 ? now.getDate() : 0;
  const birthdays = useMemo(() => {
    const list = [];
    for (const grade of groups) {
      for (const person of studentsByGrade[grade] || []) {
        const b = parseBirthday(person.birthday);
        if (!b || b.month !== targetMonth) continue;
        list.push({
          ...person,
          isBirthday: true,
          bdayMonth: b.month,
          bdayDay: b.day,
          bdayAge: b.year && b.year < targetYear ? targetYear - b.year : null,
          bdayStatus: b.day === today ? "today" : b.day < today ? "passed" : "upcoming",
        });
      }
    }
    list.sort(
      (a, b) => a.bdayDay - b.bdayDay || (a.name || "").localeCompare(b.name || "")
    );
    // An empty month still shows the section, so the toggle stays reachable.
    if (list.length === 0) {
      list.push({
        uid: "none",
        isBirthday: true,
        isEmpty: true,
        monthName: MONTH_NAMES[targetMonth - 1],
      });
    }
    return list;
  }, [groups, studentsByGrade, targetMonth, today, targetYear]);

  const changeBirthdayMonth = useCallback((offset) => {
    Haptics.trigger("selection");
    setBdayMonthOffset(offset);
  }, []);

  const gradeSections = useMemo(() => {
    const sections = groups.map((grade) => ({
      title: grade,
      data: filteredStudentsByGrade[grade] || [],
    }));
    if (search.active) {
      // Searching is for finding someone on the roster; the birthday list
      // would only repeat them.
      return sections.filter((section) => section.data.length > 0);
    }
    // Hidden until there is anyone on the roster at all.
    if (sections.some((section) => section.data.length > 0)) {
      sections.unshift({ title: BIRTHDAYS, data: birthdays });
    }
    return sections;
  }, [groups, filteredStudentsByGrade, search, birthdays]);

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

  // Declared above renderStudent because they are in its dependency array — a
  // `const` referenced from a dep array before its declaration is a TDZ error.
  const dateKey = selectedDate || getNextMeetingDate();
  const isCurrentWeek = !selectedDate || selectedDate === getNextMeetingDate();

  // Navigation is hoisted out of the row so the memoized StudentRow receives a
  // stable callback instead of a fresh closure on every parent render.
  const openPerson = useCallback((person) => {
    if (!userData) {
      Alert.alert("Error", "User data not loaded.");
      return;
    }
    setIsNavigating(true);
    navigation.navigate("IndividualAttendance", {
      church: userData.church,
      category: CATEGORY,
      grade: person.grade,
      studentId: person.uid,
      userGrades: groups,
      // There are no grades here, so the profile should not show one.
      showGrade: false,
    });
    setTimeout(() => setIsNavigating(false), 1000);
  }, [userData, navigation, groups]);

  const renderStudent = useCallback(
    ({ item: person }) => person.isBirthday ? (
      <BirthdayRow person={person} isNavigating={isNavigating} onOpen={openPerson} />
    ) : (
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

  // The same person can be in both sections, so birthday rows get their own key.
  const keyExtractor = useCallback(
    (item) => (item.isBirthday ? `bday_${item.uid}` : item.uid),
    []
  );

  // Both of these were inline literals on the SectionList, so every parent render
  // handed it new identities and it re-rendered every mounted cell.
  const renderGradeHeader = useCallback(
    ({ section: { title } }) =>
      title === BIRTHDAYS ? (
        <BirthdaysHeader monthOffset={bdayMonthOffset} onChangeMonth={changeBirthdayMonth} />
      ) : (
        <GradeHeader title={title} onAdd={openAddStudentModal} />
      ),
    [openAddStudentModal, bdayMonthOffset, changeBirthdayMonth]
  );

  const listEmpty = useMemo(
    () => (
      <Text style={styles.noStudentsText}>
        {search.active
          ? "No one found matching your search"
          : "No one added yet — tap Add to start the roster"}
      </Text>
    ),
    [search]
  );

  // Skeleton covers the navigation transition AND the whole read. Falling
  // through while `userData` is still null used to flash the "ask an admin"
  // empty state before the data had a chance to arrive.
  if (!ready || loading || !userData) {
    return <SkeletonScreen variant="list" count={8} />;
  }

  if (!isYouthManager) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={64} color="rgba(255,255,255,0.3)" />
        <Text style={styles.message}>Ask your church's admin to give you the Youth Meeting Manager role.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingHorizontal: gutter }]}>
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
          isWide && { left: gutter, right: gutter },
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
                placeholder="Search attendees"
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

      {/* ---------- Add Member modal ---------- */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalContentLarge}>
            {submitting ? (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="large" color="#147EFB" />
                <Text style={styles.loadingText}>Adding Member...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>Add Member</Text>
                <Text style={styles.modalSubtitle}>Only the name is required — everything else is optional</Text>

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
                    placeholder="Full name"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={newStudentName}
                    onChangeText={setNewStudentName}
                    returnKeyType="next"
                  />

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
                    placeholder="Notes"
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
                  <Text style={styles.modalButtonText}>Add Member</Text>
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
                <Text style={styles.weekModalSubtitle}>Tap any {MEETING_DAY_NAME} to view its attendance</Text>
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
                <Text style={styles.thisWeekDate}>{shortDateLabel(getNextMeetingDate())}</Text>
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
                data={previousMeetings}
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
    // Of the overlay, so it is still right after an iPad rotates.
    maxHeight: "78%",
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
  birthdayRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  birthdayEmpty: {
    height: BDAY_ROW_H - 8,
    justifyContent: "center",
  },
  monthToggle: {
    flexDirection: "row",
    height: MONTH_TOGGLE_H,
    padding: 2,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  monthToggleOption: {
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  monthToggleOptionSelected: {
    backgroundColor: "#147EFB",
  },
  monthToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
  },
  monthToggleTextSelected: {
    color: "#fff",
  },
  birthdayRowToday: {
    backgroundColor: "rgba(20, 126, 251, 0.12)",
    borderColor: "rgba(20, 126, 251, 0.45)",
  },
  birthdayAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  birthdayPassed: {
    opacity: 0.45,
  },
  birthdayText: {
    flex: 1,
    marginRight: 10,
  },
  birthdayName: {
    fontSize: 15,
    lineHeight: BDAY_NAME_LINE,
    color: "#fff",
    fontWeight: "600",
  },
  birthdayDetail: {
    fontSize: 13,
    lineHeight: BDAY_DETAIL_LINE,
    color: "rgba(255,255,255,0.55)",
    marginTop: 2,
  },
  todayBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#147EFB",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  todayBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4,
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

export default YouthMeetingAttendance;