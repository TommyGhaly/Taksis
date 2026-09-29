import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  updateDoc,
  writeBatch,
} from "@react-native-firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import BackArrow from "../../components/backArrow";
import PhotoInput from "../../components/photoInput";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import Avatar from "../../components/Avatar";
import SkeletonScreen from "../../components/Skeleton";
import * as avatarCache from "../../utils/avatarCache";
import { LIST_PERF } from "../../utils/listConfig";
import {
  isAttendanceDateKey,
  dateKeyToSortable,
} from "../../utils/dateKeys";

// On an iPad this screen sits in the centered column MainContainer wraps it
// in, so the page itself just fills that. The modal card is capped on its
// own, since a Modal renders at the window root, outside the column.
// (This used to be `window width >= 768`, read at import — which missed an
// iPad mini in portrait and went stale on rotation.)
const MODAL_WIDTH = { maxWidth: 600, alignSelf: "center", width: "100%" };

/**
 * One attendance record: date on the left, status pill on the right.
 *
 * This was an inline `renderItem` closure with no memo, so every parent render
 * rebuilt every mounted cell. See the note at
 * screens/SundaySchool/SundaySchoolAttendance.js:94 for why VirtualizedList makes
 * that so expensive — its CellRenderer is not memoized against parent re-renders.
 */
const AttendanceHistoryRow = React.memo(({ date, status }) => (
  <View style={styles.attendanceItem}>
    <Text style={styles.dateText}>{date}</Text>
    <View
      style={[
        styles.statusContainer,
        status === false ? styles.absent : styles.present,
      ]}
    >
      <Text style={styles.statusText}>
        {status === false ? "Absent" : status === true ? "Present" : "No Status"}
      </Text>
    </View>
  </View>
));
AttendanceHistoryRow.displayName = "AttendanceHistoryRow";

// Module-level so the props keep a stable identity across renders.
const renderAttendanceRow = ({ item }) => (
  <AttendanceHistoryRow date={item.date} status={item.status} />
);
const attendanceKeyExtractor = (item) => item.date;
/**
 * Typed-as-you-go formatters for the two fields with a shape the rest of the app
 * relies on.
 *
 * Birthdays are stored as MM-DD-YYYY (that is what the add-student form
 * validates, see screens/SundaySchool/SundaySchoolAttendance.js:700) and phone
 * numbers were being stored however they were typed. Servants filling these in
 * are not going to remember a format, so the field inserts the separators for
 * them: they type digits, they cannot produce a value that reads back wrong.
 */
const formatBirthdayInput = (text) => {
  const d = String(text).replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4)}`;
};

const formatPhoneInput = (text) => {
  const d = String(text).replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

const BIRTHDAY_PATTERN = /^\d{2}-\d{2}-\d{4}$/;

/**
 * Label + hint above the input, rather than a placeholder doing both jobs.
 *
 * A placeholder disappears the moment there is a value, so a half-filled form
 * became five unlabelled boxes — you could not tell which one was the phone
 * number without clearing it.
 */
const Field = ({ label, hint, required, optional, children }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>
      {label}
      {required ? <Text style={styles.fieldRequired}> (required)</Text> : null}
      {optional ? <Text style={styles.fieldOptional}> (optional)</Text> : null}
    </Text>
    {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    {children}
  </View>
);

const EmptyAttendance = () => (
  <View style={styles.noAttendanceContainer}>
    <Text style={styles.noAttendanceText}>No attendance records available.</Text>
    <Text style={styles.noAttendanceSubtext}>
      Attendance will appear here once recorded.
    </Text>
  </View>
);

const IndividualAttendance = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { church, category, grade, studentId, userGrades } = route.params;
  const [studentData, setStudentData] = useState({});
  const [loading, setLoading] = useState(true);
  // Separate from `loading`, which gates the whole-screen skeleton. Writes have
  // to show progress *inside* the modal — flipping `loading` for them tore the
  // screen down mid-edit and snapped it back a moment later.
  const [saving, setSaving] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [photoInputVisible, setPhotoInputVisible] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [editData, setEditData] = useState({
    name: "",
    phone: "",
    address: "",
    description: "",
    birthday: "",
  });
  const [gradeChangeModalVisible, setGradeChangeModalVisible] = useState(false);
  const [selectedNewGrade, setSelectedNewGrade] = useState("");
  const [transferringStudent, setTransferringStudent] = useState(false);
  const isMounted = useRef(true);
  // Which student the state on screen belongs to.
  const loadedStudentId = useRef(null);

  // Whether the form differs from what is stored. Drives the close confirmation:
  // no edits, no interrogation.
  const isDirty = React.useMemo(() => {
    const fields = ["name", "phone", "address", "description", "birthday"];
    return fields.some(
      (f) => (editData[f] || "").trim() !== (studentData[f] || "").trim()
    );
  }, [editData, studentData]);

  // Get available grades for transfer (exclude current grade)
  const availableGrades = React.useMemo(
    () => (userGrades ? userGrades.filter((g) => g !== grade) : []),
    [userGrades, grade]
  );

  // Set once the student's document has been moved out from under the listener
  // below, so its "document is gone" branch does not race the navigation the
  // transfer does itself.
  const transferred = useRef(false);

  /**
   * Anything that has to happen *after* the modal closes.
   *
   * iOS will not present an alert while a modal is still dismissing: the
   * presentation is dropped, and because the dismissing window is still on top
   * the screen stops taking touches — which is what "it freezes after I finish
   * editing" was. The work is queued here and run once the host reports itself
   * gone (`onDismiss`, iOS only; Android dialogs do not conflict, so it runs on
   * the next frame there).
   */
  const afterClose = useRef(null);
  const afterCloseFallback = useRef(null);
  const runAfterClose = useCallback(() => {
    clearTimeout(afterCloseFallback.current);
    const fn = afterClose.current;
    afterClose.current = null;
    if (fn) fn();
  }, []);
  const closeModalThen = useCallback(
    (fn) => {
      afterClose.current = fn || null;
      setGradeChangeModalVisible(false);
      setModalVisible(false);
      if (Platform.OS !== "ios") {
        requestAnimationFrame(runAfterClose);
        return;
      }
      // Belt and braces: onDismiss not arriving would swallow the alert (and,
      // after a transfer, the navigation that goes with it). runAfterClose is
      // idempotent, so whichever fires first wins.
      clearTimeout(afterCloseFallback.current);
      afterCloseFallback.current = setTimeout(runAfterClose, 600);
    },
    [runAfterClose]
  );
  useEffect(() => () => clearTimeout(afterCloseFallback.current), []);


  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;
      transferred.current = false;

      // Close any transient UI, but keep `studentData` when re-focusing the same
      // student — the listener re-attaches to the same doc, so clearing it made
      // every return to this screen flash a skeleton over correct data. A
      // different student is a genuine cold load, so clear for that one.
      setModalVisible(false);
      setEditMode(false);
      setPhotoInputVisible(false);
      setDeletingPhoto(false);
      if (loadedStudentId.current !== studentId) {
        loadedStudentId.current = studentId;
        setStudentData({});
        setLoading(true);
        setEditData({
          name: "",
          phone: "",
          address: "",
          description: "",
          birthday: "",
        });
      }

      const fetchData = () => {
        if (!studentId) {
          Alert.alert("Error", "Student ID is missing.");
          navigation.goBack();
          return () => {};
        }

        const studentRef = doc(
          getFirestore(),
          "churches",
          church,
          category,
          grade,
          "students",
          studentId
        );

        // Set up real-time listener for student data
        const unsubscribe = onSnapshot(
          studentRef,
          async (doc) => {
            if (!isMounted.current) return;
            try {
              if (doc.exists) {
                const data = doc.data();
                setStudentData(data);
                setEditData({
                  name: data.name || "",
                  phone: data.phone || "",
                  address: data.address || "",
                  description: data.description || "",
                  birthday: data.birthday || "",
                });
              } else if (!transferred.current) {
                // A grade change deletes this document on purpose; that path
                // navigates from its own success alert, so leaving it to this
                // branch would pop the screen out from under the alert.
                navigation.goBack();
              }

              // The profile picture is resolved by <Avatar> through
              // avatarCache — no Storage round-trip to wait on here.
              setLoading(false);
            } catch (error) {
              if (isMounted.current) {
                Alert.alert("Error", "Failed to load student data.");
                setLoading(false);
              }
            }
          },
          (error) => {
            if (isMounted.current) {
              Alert.alert("Error", "Failed to load student data.");
              setLoading(false);
            }
          }
        );

        return unsubscribe;
      };

      const unsubscribe = fetchData();

      // Cleanup listener when screen is unfocused
      return () => {
        isMounted.current = false;
        if (unsubscribe) unsubscribe();
      };
    }, [church, category, grade, studentId, navigation])
  );

  /**
   * Attendance rows, newest first.
   *
   * Entries are picked by matching the MM-DD-YYYY key shape, not by excluding a
   * list of known metadata field names. The exclusion list only knew about seven
   * fields, so anything else on the document — `photoURL`, `createdAt`, or any
   * field an admin adds through DatabaseManager — became a bogus attendance row,
   * and then reached the comparator as NaN, which made the ordering of the *real*
   * rows arbitrary too. The sibling screen already did it this way.
   *
   * Sorting is on an integer key; the old comparator allocated two Date objects
   * per comparison.
   */
  const attendanceDataMemo = React.useMemo(() => {
    if (!studentData || Object.keys(studentData).length === 0) return [];
    const attendance = [];
    for (const [key, value] of Object.entries(studentData)) {
      if (isAttendanceDateKey(key)) {
        attendance.push({ date: key, status: value, sortKey: dateKeyToSortable(key) });
      }
    }
    return attendance.sort((a, b) => b.sortKey - a.sortKey);
  }, [studentData]);

  // Handle remove photo
  const handleRemovePhoto = async () => {
    if (!studentId) return;

    setDeletingPhoto(true);
    try {
      // The pointer on the *student* document has to go first. removePhoto only
      // knows about users/{uid}, so leaving `photoURL` here would let this
      // screen's own listener re-prime the cache with a url whose Storage object
      // no longer exists, and the deleted photo would appear to come back.
      try {
        await updateDoc(
          doc(
            getFirestore(),
            "churches",
            church,
            category,
            grade,
            "students",
            studentId
          ),
          {
            photoURL: deleteField(),
            photoUpdatedAt: deleteField(),
          }
        );
      } catch (e) {
        // Students added before photos were stamped have neither field.
        console.log(
          "[IndividualAttendance] could not clear photoURL:",
          e?.message
        );
      }

      // Clears the Storage object, the photoURL pointer on the user doc and the
      // local cache.
      await avatarCache.removePhoto(studentId);

      Alert.alert("Photo Removed", "The profile picture has been removed.");
    } catch (error) {
      // An already-missing object is treated as success by removePhoto, so
      // anything reaching here is a real failure.
      Alert.alert("Error", "Could not delete profile picture. Please try again.");
    } finally {
      setDeletingPhoto(false);
    }
  };

  /**
   * The photo card is rendered *inside* the student-info modal (see the note on
   * that modal), so this only has to flip one flag — nothing to sequence around
   * a modal dismissal.
   */
  const openPhotoInput = () => {
    if (deletingPhoto) return;
    setPhotoInputVisible(true);
  };

  // Ask first — the remove is immediate and there is no undo.
  const confirmRemovePhoto = () => {
    if (deletingPhoto) return;
    Alert.alert(
      "Remove this photo?",
      `${studentData.name || "This student"} will go back to the default picture. You can add a new photo any time.`,
      [
        { text: "Keep Photo", style: "cancel" },
        {
          text: "Remove Photo",
          style: "destructive",
          onPress: handleRemovePhoto,
        },
      ]
    );
  };

  /**
   * PhotoInput has already uploaded the file and published the url into this
   * device's avatarCache. Students are documents under
   * churches/{church}/{category}/{grade}/students, not users/{uid}, so
   * PhotoInput's own `users` write is a no-op for them — the fields get stamped
   * onto the student document here instead.
   *
   * `photoUpdatedAt` is the part that matters: a download URL for a fixed
   * Storage path does not change between uploads, so without a fresh version
   * token every *other* servant's device keeps showing the previous photo out of
   * its image cache.
   */
  const handlePhotoUploaded = async (downloadURL, version) => {
    if (!studentId) return;
    try {
      await updateDoc(
        doc(getFirestore(), "churches", church, category, grade, "students", studentId),
        {
          photoURL: downloadURL,
          photoUpdatedAt: version || String(Date.now()),
        }
      );
    } catch (error) {
      // The local cache already has the new photo, so this screen is correct
      // either way; a failed stamp only delays the other devices.
      console.log(
        "[IndividualAttendance] could not stamp photoURL:",
        error?.message
      );
    }
  };

  // Close the photo card. PhotoInput already wrote the new url + version into
  // avatarCache, so there is nothing to refetch here.
  const closePhotoInputModal = () => {
    setPhotoInputVisible(false);
  };

  // Format grade
  const formatGrade = (grade) => {
    const num = parseInt(grade);
    if (isNaN(num)) return grade;
    const suffix =
      num === 1 ? "st" : num === 2 ? "nd" : num === 3 ? "rd" : "th";
    return `${num}${suffix} Grade`;
  };

  // Transfer student to new grade
  const transferStudent = async () => {
    if (transferringStudent) return;
    if (!selectedNewGrade || selectedNewGrade === grade) {
      Alert.alert("Error", "Please select a different grade.");
      return;
    }

    const students = (gradeDoc) =>
      doc(getFirestore(), "churches", church, category, gradeDoc, "students", studentId);

    const source = students(grade);
    const destination = students(selectedNewGrade);

    setTransferringStudent(true);
    try {
      // Get the complete student document from current grade
      const currentDoc = await getDoc(source);

      if (!currentDoc.exists) {
        throw new Error("Student document not found");
      }

      // Written as one batch. As two separate awaits, a delete that failed after
      // the copy had landed left the student sitting in both grades, and the
      // attendance list — which reads every assigned grade — then showed and
      // marked them twice.
      const batch = writeBatch(getFirestore());
      batch.set(destination, {
        ...currentDoc.data(),
        grade: selectedNewGrade, // Update the grade field
      });
      batch.delete(source);

      // The screen's own listener is on `source`; the delete makes it report a
      // missing document, and it must not navigate before the alert below.
      transferred.current = true;
      await batch.commit();

      const movedFrom = formatGrade(grade);
      const movedTo = formatGrade(selectedNewGrade);
      // Close first, alert once the modal is actually gone — see closeModalThen.
      closeModalThen(() =>
        Alert.alert("Success", `Student moved from ${movedFrom} to ${movedTo}`, [
          {
            text: "OK",
            // The student no longer exists in this grade's view.
            onPress: () => navigation.goBack(),
          },
        ])
      );
    } catch (error) {
      transferred.current = false;
      console.error("Error transferring student:", error);
      Alert.alert("Error", "Failed to transfer student. Please try again.");
    } finally {
      setTransferringStudent(false);
    }
  };

  // Get status style
  // Save edited student data
  const saveEdits = async () => {
    if (!editData.name.trim()) {
      Alert.alert("Name Needed", "Please enter the student's name before saving.");
      return;
    }
    // Same rule the add-student form enforces. Without it, a half-typed birthday
    // saved silently and then read back as nothing anywhere else in the app.
    const birthday = editData.birthday.trim();
    if (birthday && !BIRTHDAY_PATTERN.test(birthday)) {
      Alert.alert(
        "Check the Birthday",
        "Please enter the birthday as month, day, year — for example 04-15-2016 — or leave it blank."
      );
      return;
    }
    try {
      setSaving(true);
      await updateDoc(
        doc(getFirestore(), "churches", church, category, grade, "students", studentId),
        {
          name: editData.name.trim(),
          phone: editData.phone.trim(),
          address: editData.address.trim(),
          description: editData.description.trim(),
          birthday,
        }
      );
      setEditMode(false);
      closeModalThen(() =>
        Alert.alert("Success", "Student information updated successfully.")
      );
    } catch (error) {
      Alert.alert("Error", "Failed to update student information.");
    } finally {
      setSaving(false);
    }
  };

  // Delete student and profile picture
  const deleteStudent = async () => {
    Alert.alert(
      "Delete Student",
      `Are you sure you want to delete ${
        studentData.name || "this student's"
      } record? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(
                getFirestore(),
                "churches",
                church,
                category,
                grade,
                "students",
                studentId
              ));

              try {
                await avatarCache.removePhoto(studentId);
              } catch (error) {
                // Record is already gone; a leftover photo must not block the
                // success path.
              }

              Alert.alert(
                "Success",
                `${studentData.name || "Student"}'s record has been deleted.`,
                [{ text: "OK"}]
              );
            } catch (error) {
              Alert.alert("Error", "Failed to delete student record.");
            }
          },
        },
      ]
    );
  };

  // Handle modal close
  const handleModalClose = () => {
    if (saving || transferringStudent) return;

    const discard = () => {
      setEditMode(false);
      setModalVisible(false);
      setEditData({
        name: studentData.name || "",
        phone: studentData.phone || "",
        address: studentData.address || "",
        description: studentData.description || "",
        birthday: studentData.birthday || "",
      });
    };

    // Only ask when there is actually something to lose. Asking every time
    // taught people to tap through the alert without reading it, which is how a
    // real edit ends up discarded.
    if (editMode && isDirty) {
      Alert.alert(
        "Close without saving?",
        "Your changes to this student have not been saved yet.",
        [
          { text: "Keep Editing", style: "cancel" },
          { text: "Close Without Saving", style: "destructive", onPress: discard },
        ]
      );
      return;
    }
    discard();
  };

  // Only a cold load blocks the screen; later reads paint over what's there.
  if (loading && Object.keys(studentData).length === 0) {
    // Single-student detail: avatar, name, then the attendance rows. The 80px
    // avatar matches the real one so the header doesn't resize on swap.
    return (
      <SkeletonScreen variant="profile" showHeader={false} avatarSize={80} />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <View style={styles.buttonRow}>
          <BackArrow />
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            style={styles.infoButton}
            accessible={true}
            accessibilityLabel="View and edit student information"
          >
            <Icon name="account-edit-outline" size={18} color="#fff" />
            <Text style={styles.infoButtonText}>Info & Edit</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>{`${studentData.name || "Student"}`}</Text>
        <View style={styles.profileContainer}>
            <Avatar
            uid={studentId}
            user={studentData}
            size={80}
            finalSize={300}
            borderRadius={40}
            style={styles.profileImage}
            expandable
          />
        </View>
        <Text style={styles.subtitle}>{`Grade: ${formatGrade(
          grade
        )} - Category: ${category}`}</Text>
        <FlatList
          {...LIST_PERF}
          data={attendanceDataMemo}
          // `item.date` is the natural key and is unique per record. The old
          // index-based extractor was actively wrong here: the list is sorted
          // newest-first, so recording an attendance date reindexed every row and
          // React reused the wrong cell for each one.
          keyExtractor={attendanceKeyExtractor}
          renderItem={renderAttendanceRow}
          ListEmptyComponent={EmptyAttendance}
          contentContainerStyle={styles.attendanceContainer}
          showsVerticalScrollIndicator={false}
        />
        <TouchableOpacity
          onPress={deleteStudent}
          style={styles.deleteTextContainer}
          accessible={true}
          accessibilityLabel="Delete student record"
        >
          <Text style={styles.deleteText}>Delete Student</Text>
        </TouchableOpacity>
      </View>

      {/* The grade picker below is content of *this* modal, not a second one.
          Stacked <Modal>s are where "Change Grade does nothing" came from: iOS
          will not present from a view controller that is already presenting, so
          the second modal was dropped and the tap looked dead. */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onDismiss={runAfterClose}
        onRequestClose={() => {
          // Android hardware back. Peel one layer at a time, top-most first.
          if (photoInputVisible) return closePhotoInputModal();
          if (gradeChangeModalVisible) {
            if (transferringStudent) return;
            setGradeChangeModalVisible(false);
            setSelectedNewGrade("");
            return;
          }
          handleModalClose();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <LinearGradient
            colors={["#1E1E1E", "#151515"]}
            style={[styles.modalContent, MODAL_WIDTH]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Outside the ScrollView on purpose: the way out has to stay put
                while the form scrolls. Before this the only way to close was a
                line of text at the very bottom of the form. */}
            <TouchableOpacity
              style={[styles.modalCloseButton, saving && styles.disabled]}
              onPress={handleModalClose}
              disabled={saving || transferringStudent}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessible={true}
              accessibilityLabel={editMode ? "Close without saving" : "Close"}
              accessibilityRole="button"
            >
              <Icon name="close" size={20} color="#dcdcdc" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editMode ? "Edit Student" : "Student Information"}
            </Text>
            {editMode && (
              <Text style={styles.modalSubtitle}>
                Tap Save Changes when you're done.
              </Text>
            )}
            {/* Scrollable: with a label on every field the form is taller than a
                phone screen, and a card taller than the screen leaves no way to
                reach Save. */}
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.infoContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {editMode ? (
                <>
                  <View style={styles.photoSection}>
                    <Avatar
                      uid={studentId}
                      user={studentData}
                      size={76}
                      finalSize={300}
                      borderRadius={38}
                      style={styles.modalProfilePicture}
                      expandable
                    />
                    {/* Spelled-out buttons rather than a 24px pencil badge that
                        opened an unlabelled action sheet. */}
                    <View style={styles.photoButtonRow}>
                      <TouchableOpacity
                        style={styles.photoButton}
                        onPress={openPhotoInput}
                        disabled={deletingPhoto}
                        accessible={true}
                        accessibilityLabel="Change profile picture"
                      >
                        <Icon name="camera" size={18} color="#fff" />
                        <Text style={styles.photoButtonText}>Change Photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.photoButton, styles.photoButtonDanger]}
                        onPress={confirmRemovePhoto}
                        disabled={deletingPhoto}
                        accessible={true}
                        accessibilityLabel="Remove profile picture"
                      >
                        {deletingPhoto ? (
                          <ActivityIndicator size="small" color="#ff8a80" />
                        ) : (
                          <>
                            <Icon
                              name="trash-can-outline"
                              size={18}
                              color="#ff8a80"
                            />
                            <Text
                              style={[
                                styles.photoButtonText,
                                styles.photoButtonDangerText,
                              ]}
                            >
                              Remove Photo
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Field label="Full Name" required>
                    <TextInput
                      style={styles.input}
                      value={editData.name}
                      onChangeText={(text) =>
                        setEditData((prev) => ({ ...prev, name: text }))
                      }
                      placeholder="First and last name"
                      placeholderTextColor="#888"
                      autoCapitalize="words"
                      accessible={true}
                      accessibilityLabel="Edit student name"
                    />
                  </Field>

                  <Field label="Birthday" optional>
                    <TextInput
                      style={styles.input}
                      value={editData.birthday}
                      onChangeText={(text) =>
                        setEditData((prev) => ({
                          ...prev,
                          birthday: formatBirthdayInput(text),
                        }))
                      }
                      placeholder="MM-DD-YYYY"
                      placeholderTextColor="#888"
                      keyboardType="number-pad"
                      maxLength={10}
                      accessible={true}
                      accessibilityLabel="Edit student birthday"
                    />
                  </Field>

                  <Field label="Phone Number" optional hint="A parent's number is fine.">
                    <TextInput
                      style={styles.input}
                      value={editData.phone}
                      onChangeText={(text) =>
                        setEditData((prev) => ({
                          ...prev,
                          phone: formatPhoneInput(text),
                        }))
                      }
                      placeholder="(555) 123-4567"
                      placeholderTextColor="#888"
                      keyboardType="phone-pad"
                      maxLength={14}
                      accessible={true}
                      accessibilityLabel="Edit student phone number"
                    />
                  </Field>

                  <Field label="Home Address" optional>
                    <TextInput
                      style={styles.input}
                      value={editData.address}
                      onChangeText={(text) =>
                        setEditData((prev) => ({ ...prev, address: text }))
                      }
                      placeholder="Street, city"
                      placeholderTextColor="#888"
                      accessible={true}
                      accessibilityLabel="Edit student address"
                    />
                  </Field>

                  <Field label="Notes" optional hint="Anything the servants should know.">
                    <TextInput
                      style={[styles.input, styles.descriptionInput]}
                      value={editData.description}
                      onChangeText={(text) =>
                        setEditData((prev) => ({ ...prev, description: text }))
                      }
                      placeholder="Allergies, who picks them up, siblings..."
                      placeholderTextColor="#888"
                      multiline
                      numberOfLines={4}
                      accessible={true}
                      accessibilityLabel="Edit student notes"
                    />
                  </Field>

                  {/* Grade Change Button - only show if there are available grades to move to */}
                  {availableGrades && availableGrades.length > 0 && (
                    <TouchableOpacity
                      style={styles.gradeChangeButton}
                      onPress={() => setGradeChangeModalVisible(true)}
                      accessible={true}
                      accessibilityLabel="Move student to a different grade"
                    >
                      <Icon name="swap-horizontal" size={20} color="#4d9cff" />
                      <View style={styles.gradeChangeButtonTextGroup}>
                        <Text style={styles.gradeChangeButtonText}>
                          Move to a Different Grade
                        </Text>
                        <Text style={styles.gradeChangeButtonHint}>
                          Currently in {formatGrade(grade)}
                        </Text>
                      </View>
                      <Icon name="chevron-right" size={22} color="#888" />
                    </TouchableOpacity>
                  )}

                  <LinearGradient
                    colors={["#147efb", "#0f64d2"]}
                    style={styles.modalButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <TouchableOpacity
                      onPress={saveEdits}
                      style={styles.buttonInner}
                      disabled={saving}
                      accessible={true}
                      accessibilityLabel="Save student information"
                    >
                      {saving ? (
                        <>
                          <ActivityIndicator size="small" color="#fff" />
                          <Text
                            style={[styles.modalButtonText, styles.buttonTextWithIcon]}
                          >
                            Saving...
                          </Text>
                        </>
                      ) : (
                        <>
                          <Icon name="check" size={22} color="#fff" />
                          <Text
                            style={[styles.modalButtonText, styles.buttonTextWithIcon]}
                          >
                            Save Changes
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </LinearGradient>
                  <TouchableOpacity
                    onPress={handleModalClose}
                    style={styles.secondaryButton}
                    disabled={saving}
                    accessible={true}
                    accessibilityLabel="Cancel editing"
                  >
                    <Text style={styles.cancelButtonText}>
                      Cancel — don't save
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.profilePictureContainer}>
                    <Avatar
                      uid={studentId}
                      user={studentData}
                      size={76}
                      finalSize={300}
                      borderRadius={38}
                      style={styles.modalProfilePicture}
                      expandable
                    />
                  </View>
                  <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Name</Text>
                      <Text style={styles.infoValue}>
                        {studentData.name || "N/A"}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Grade</Text>
                      <Text style={styles.infoValue}>{formatGrade(grade)}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Birthday</Text>
                      <Text style={styles.infoValue}>
                        {studentData.birthday || "N/A"}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Phone</Text>
                      <Text style={styles.infoValue}>
                        {studentData.phone || "N/A"}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Address</Text>
                      <Text style={styles.infoValue}>
                        {studentData.address || "N/A"}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Notes</Text>
                      <Text style={styles.infoValue}>
                        {studentData.description || "N/A"}
                      </Text>
                    </View>
                  </View>
                  <LinearGradient
                    colors={["#147efb", "#0f64d2"]}
                    style={styles.modalButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <TouchableOpacity
                      onPress={() => setEditMode(true)}
                      style={styles.buttonInner}
                      accessible={true}
                      accessibilityLabel="Edit student information"
                    >
                      <Icon name="pencil" size={20} color="#fff" />
                      <Text
                        style={[styles.modalButtonText, styles.buttonTextWithIcon]}
                      >
                        Edit Information
                      </Text>
                    </TouchableOpacity>
                  </LinearGradient>
                  <TouchableOpacity
                    onPress={handleModalClose}
                    style={styles.secondaryButton}
                    accessible={true}
                    accessibilityLabel="Close student information"
                  >
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </LinearGradient>
        </KeyboardAvoidingView>

        {/* Grade change: same card, same styles, laid over the edit form. */}
        {gradeChangeModalVisible && (
          <TouchableOpacity
            style={[styles.modalContainer, StyleSheet.absoluteFill]}
            activeOpacity={1}
            onPress={() => {
              if (transferringStudent) return;
              setGradeChangeModalVisible(false);
              setSelectedNewGrade("");
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              style={styles.gradeChangeModalWrapper}
            >
              {/* Sized, so the card's own width/maxHeight percentages have a
                  definite parent to resolve against instead of collapsing to
                  content size. */}
              <TouchableOpacity activeOpacity={1} style={styles.gradeChangeCardHost}>
                <LinearGradient
                  colors={["#1e1e1e", "#2a2a2a"]}
                  style={[styles.gradeChangeModalContent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.modalTitle}>Change Grade</Text>
                  <Text style={styles.gradeChangeSubtitle}>
                    Move {studentData.name} from {formatGrade(grade)} to:
                  </Text>

                  <ScrollView
                    style={styles.gradeOptionsScrollView}
                    contentContainerStyle={styles.gradeOptionsContainer}
                    showsVerticalScrollIndicator={false}
                  >
                    {availableGrades.map((availableGrade) => (
                      <TouchableOpacity
                        key={availableGrade}
                        style={[
                          styles.gradeOption,
                          selectedNewGrade === availableGrade &&
                            styles.selectedGradeOption,
                        ]}
                        onPress={() => setSelectedNewGrade(availableGrade)}
                        accessible={true}
                        accessibilityLabel={`Select ${formatGrade(availableGrade)}`}
                      >
                        <Text
                          style={[
                            styles.gradeOptionText,
                            selectedNewGrade === availableGrade &&
                              styles.selectedGradeOptionText,
                          ]}
                        >
                          {formatGrade(availableGrade)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.warningText}>
                    ⚠️ This will move all attendance data to the new grade
                  </Text>

                  <View style={styles.gradeChangeButtonsContainer}>
                    <LinearGradient
                      colors={["#147efb", "#0f64d2"]}
                      style={[
                        styles.modalButton,
                        { opacity: transferringStudent ? 0.6 : 1 },
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <TouchableOpacity
                        onPress={transferStudent}
                        style={styles.buttonInner}
                        disabled={transferringStudent || !selectedNewGrade}
                        accessible={true}
                        accessibilityLabel="Confirm grade change"
                      >
                        {transferringStudent ? (
                          <Text style={styles.modalButtonText}>Moving...</Text>
                        ) : (
                          <Text style={styles.modalButtonText}>Move Student</Text>
                        )}
                      </TouchableOpacity>
                    </LinearGradient>

                    <TouchableOpacity
                      onPress={() => {
                        setGradeChangeModalVisible(false);
                        setSelectedNewGrade("");
                      }}
                      disabled={transferringStudent}
                      accessible={true}
                      accessibilityLabel="Cancel grade change"
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        )}

        {/* Same reason as the grade picker above: the photo card is content of
            *this* modal (`inline`), not a second <Modal>. Stacked, it was never
            presented at all — "Change Profile Picture" opened nothing. */}
        <PhotoInput
          inline
          visible={photoInputVisible}
          onClose={closePhotoInputModal}
          onUploadSuccess={handlePhotoUploaded}
          userId={studentId}
        />
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
  },
  contentContainer: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 8,
    textAlign: "center",
  },
  profileContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  profilePicture: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  subtitle: {
    fontSize: 18,
    color: "#b0b0b0",
    marginBottom: 20,
    textAlign: "center",
  },
  infoButton: {
    flexDirection: "row",
    backgroundColor: "#333",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  infoButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    marginLeft: 6,
  },
  attendanceContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  attendanceItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
  },
  dateText: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "600",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: "center",
    minWidth: 120,
    minHeight: 44,
  },
  statusText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
    lineHeight: 24,
    textAlign: "center",
  },
  present: {
    backgroundColor: "#147efb",
    borderColor: "#0f64d2",
    borderWidth: 1,
  },
  absent: {
    backgroundColor: "#F44336",
    borderColor: "#D32F2F",
    borderWidth: 1,
  },
  deleteTextContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  deleteText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#F44336",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  modalContent: {
    padding: 18,
    paddingHorizontal: 20,
    // The edit form is taller than a phone screen; the ScrollView inside needs a
    // bounded parent or the card just grows off the top and bottom of the modal.
    maxHeight: "90%",
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 4,
    letterSpacing: 0.3,
    textAlign: "center",
    // Room for the close button in the corner.
    alignSelf: "stretch",
    paddingHorizontal: 36,
  },
  modalCloseButton: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#aaaaaa",
    textAlign: "center",
    marginBottom: 4,
    lineHeight: 17,
  },
  modalScroll: {
    width: "100%",
  },
  infoContainer: {
    width: "100%",
    paddingTop: 6,
    paddingBottom: 6,
  },
  // Label + hint sit above the input, so a filled-in form is still readable.
  field: {
    width: "100%",
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  fieldRequired: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ff8a80",
  },
  // "(optional)" rides on the label line instead of taking a hint line of its own.
  fieldOptional: {
    fontSize: 12,
    fontWeight: "500",
    color: "#8a8a8a",
  },
  fieldHint: {
    fontSize: 12,
    color: "#9a9a9a",
    marginBottom: 6,
    lineHeight: 16,
  },
  photoSection: {
    alignItems: "center",
    marginBottom: 14,
  },
  photoButtonRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    marginTop: 10,
  },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    marginTop: 6,
    minHeight: 40,
  },
  photoButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  photoButtonDanger: {
    borderColor: "#5a2a2a",
    backgroundColor: "#2a1e1e",
  },
  photoButtonDangerText: {
    color: "#ff8a80",
  },
  profilePictureContainer: {
    position: "relative",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalProfilePicture: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  infoCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    paddingVertical: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
    width: 88,
  },
  infoValue: {
    fontSize: 15,
    color: "#ffffff",
    flex: 1,
    flexWrap: "wrap",
  },
  input: {
    width: "100%",
    padding: 11,
    backgroundColor: "#2a2a2a",
    color: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#444",
    fontSize: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  descriptionInput: {
    height: 76,
    textAlignVertical: "top",
    paddingTop: 10,
  },
  modalButton: {
    width: "100%",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  buttonInner: {
    flexDirection: "row",
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 25,
  },
  buttonTextWithIcon: {
    marginLeft: 8,
  },
  // A bare word was being tapped; give it a real hit area.
  secondaryButton: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#cfcfcf",
    textAlign: "center",
  },
  modalButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F44336",
    textAlign: "center",
  },
  noAttendanceContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  noAttendanceText: {
    fontSize: 18,
    color: "#b0b0b0",
    textAlign: "center",
    marginBottom: 10,
  },
  noAttendanceSubtext: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
  },
  gradeChangeButton: {
    flexDirection: "row",
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 14,
    alignItems: "center",
  },
  gradeChangeButtonTextGroup: {
    flex: 1,
    marginLeft: 12,
  },
  gradeChangeButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  gradeChangeButtonHint: {
    color: "#9a9a9a",
    fontSize: 13,
    marginTop: 2,
  },
  gradeChangeModalWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  gradeChangeCardHost: {
    width: "100%",
    maxHeight: "100%",
    alignItems: "center",
  },
  gradeChangeModalContent: {
    width: "85%",
    maxWidth: 400,
    maxHeight: "80%",
    padding: 25,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#333",
    alignItems: "center",
  },
  gradeOptionsScrollView: {
    maxHeight: 300,
    width: "100%",
  },
  gradeChangeSubtitle: {
    color: "#ccc",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  gradeOptionsContainer: {
    width: "100%",
    paddingBottom: 20,
  },
  gradeOption: {
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 10,
    padding: 15,
    marginVertical: 5,
    alignItems: "center",
  },
  selectedGradeOption: {
    backgroundColor: "#147efb",
    borderColor: "#147efb",
  },
  gradeOptionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  selectedGradeOptionText: {
    color: "#fff",
    fontWeight: "bold",
  },
  warningText: {
    color: "#ffa500",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    fontStyle: "italic",
  },
  gradeChangeButtonsContainer: {
    width: "100%",
    alignItems: "center",
  },
});

export default IndividualAttendance;