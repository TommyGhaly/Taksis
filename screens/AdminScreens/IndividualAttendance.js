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
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
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

// Hoisted out of the render body: this was `Dimensions.get("window")` on every
// render, and the values it derives never change for the life of the screen.
const SCREEN_WIDTH = Dimensions.get("window").width;
const IS_TABLET = SCREEN_WIDTH >= 768;
const CONTAINER_WIDTH = IS_TABLET
  ? { maxWidth: 600, alignSelf: "center", width: "100%" }
  : { width: "100%" };

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

        const studentRef = firestore()
          .collection("churches")
          .doc(church)
          .collection(category)
          .doc(grade)
          .collection("students")
          .doc(studentId);

        // Set up real-time listener for student data
        const unsubscribe = studentRef.onSnapshot(
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
      // Clears the Storage object, the photoURL pointer on the user doc and the
      // local cache. Skipping the doc fields would leave every screen re-priming
      // a url whose object no longer exists.
      await avatarCache.removePhoto(studentId);

      Alert.alert("Success", "Profile picture deleted successfully");
    } catch (error) {
      // An already-missing object is treated as success by removePhoto, so
      // anything reaching here is a real failure.
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

  // Handle photo upload
  const handlePhotoUpload = async (imageUri) => {
    if (!studentId || studentId === "undefined") {
      Alert.alert("Error", "Invalid or missing Student ID.");
      return;
    }
    try {
      setSaving(true);
      const ref = storage().ref(`profilePictures/${studentId}.png`);
      await ref.putFile(imageUri);
      const url = await ref.getDownloadURL();
      // Publish the new url straight into the cache with a fresh version token
      // so every Avatar for this uid repaints without another Storage read.
      avatarCache.set(studentId, url);
      setPhotoInputVisible(false);
      Alert.alert("Success", "Profile picture updated successfully.");
    } catch (error) {
      Alert.alert("Error", "Failed to upload profile picture.");
    } finally {
      setSaving(false);
    }
  };

  // Close photo input modal. PhotoInput already wrote the new url + version
  // into avatarCache, so there is nothing to refetch here.
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
      firestore()
        .collection("churches")
        .doc(church)
        .collection(category)
        .doc(gradeDoc)
        .collection("students")
        .doc(studentId);

    const source = students(grade);
    const destination = students(selectedNewGrade);

    setTransferringStudent(true);
    try {
      // Get the complete student document from current grade
      const currentDoc = await source.get();

      if (!currentDoc.exists) {
        throw new Error("Student document not found");
      }

      // Written as one batch. As two separate awaits, a delete that failed after
      // the copy had landed left the student sitting in both grades, and the
      // attendance list — which reads every assigned grade — then showed and
      // marked them twice.
      const batch = firestore().batch();
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
      Alert.alert("Error", "Student name is required.");
      return;
    }
    try {
      setSaving(true);
      await firestore()
        .collection("churches")
        .doc(church)
        .collection(category)
        .doc(grade)
        .collection("students")
        .doc(studentId)
        .update({
          name: editData.name.trim(),
          phone: editData.phone.trim(),
          address: editData.address.trim(),
          description: editData.description.trim(),
          birthday: editData.birthday.trim(),
        });
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
              await firestore()
                .collection("churches")
                .doc(church)
                .collection(category)
                .doc(grade)
                .collection("students")
                .doc(studentId)
                .delete();

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
    if (editMode) {
      Alert.alert(
        "Discard Changes?",
        "You have unsaved changes. Are you sure you want to cancel?",
        [
          { text: "Continue Editing", style: "cancel" },
          {
            text: "Discard",
            onPress: () => {
              setEditMode(false);
              setModalVisible(false);
              setEditData({
                name: studentData.name || "",
                phone: studentData.phone || "",
                address: studentData.address || "",
                description: studentData.description || "",
                birthday: studentData.birthday || "",
              });
            },
          },
        ]
      );
    } else {
      setModalVisible(false);
    }
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
      <View style={[styles.contentContainer, CONTAINER_WIDTH]}>
        <View style={styles.buttonRow}>
          <BackArrow />
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            style={styles.infoButton}
            accessible={true}
            accessibilityLabel="View student information"
          >
            <Text style={styles.infoButtonText}>i</Text>
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
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <LinearGradient
            colors={["#1E1E1E", "#151515"]}
            style={[styles.modalContent, CONTAINER_WIDTH]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.modalTitle}>Student Information</Text>
            <View style={styles.infoContainer}>
              {editMode ? (
                <>
                  <View style={styles.profilePictureContainer}>
                    <Avatar
                      uid={studentId}
                      user={studentData}
                      size={100}
                      finalSize={300}
                      borderRadius={50}
                      style={styles.modalProfilePicture}
                      expandable
                    />
                    <TouchableOpacity
                      style={styles.editPhotoIcon}
                      onPress={handleEditProfilePicture}
                      disabled={deletingPhoto}
                      accessible={true}
                      accessibilityLabel="Edit profile picture"
                    >
                      <Icon name="pencil" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={editData.name}
                    onChangeText={(text) =>
                      setEditData({ ...editData, name: text })
                    }
                    placeholder="Name"
                    placeholderTextColor="#888"
                    autoCapitalize="words"
                    accessible={true}
                    accessibilityLabel="Edit student name"
                  />
                  <TextInput
                    style={styles.input}
                    value={editData.birthday}
                    onChangeText={(text) =>
                      setEditData({ ...editData, birthday: text })
                    }
                    placeholder="Birthday (e.g., MM-DD-YYYY)"
                    placeholderTextColor="#888"
                    accessible={true}
                    accessibilityLabel="Edit student birthday"
                  />
                  <TextInput
                    style={styles.input}
                    value={editData.phone}
                    onChangeText={(text) =>
                      setEditData({ ...editData, phone: text })
                    }
                    placeholder="Phone (optional)"
                    placeholderTextColor="#888"
                    keyboardType="phone-pad"
                    accessible={true}
                    accessibilityLabel="Edit student phone number"
                  />
                  <TextInput
                    style={styles.input}
                    value={editData.address}
                    onChangeText={(text) =>
                      setEditData({ ...editData, address: text })
                    }
                    placeholder="Address (optional)"
                    placeholderTextColor="#888"
                    accessible={true}
                    accessibilityLabel="Edit student address"
                  />
                  <TextInput
                    style={[styles.input, styles.descriptionInput]}
                    value={editData.description}
                    onChangeText={(text) =>
                      setEditData({ ...editData, description: text })
                    }
                    placeholder="Description (optional)"
                    placeholderTextColor="#888"
                    multiline
                    numberOfLines={4}
                    accessible={true}
                    accessibilityLabel="Edit student description"
                  />
                  
                  {/* Grade Change Button - only show if there are available grades to move to */}
                  {availableGrades && availableGrades.length > 0 && (
                    <TouchableOpacity
                      style={styles.gradeChangeButton}
                      onPress={() => setGradeChangeModalVisible(true)}
                      accessible={true}
                      accessibilityLabel="Change student grade"
                    >
                      <Text style={styles.gradeChangeButtonText}>
                        Change Grade (Currently: {formatGrade(grade)})
                      </Text>
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
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.modalButtonText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </LinearGradient>
                  <TouchableOpacity
                    onPress={handleModalClose}
                    accessible={true}
                    accessibilityLabel="Cancel editing"
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.profilePictureContainer}>
                    <Avatar
                      uid={studentId}
                      user={studentData}
                      size={100}
                      finalSize={300}
                      borderRadius={50}
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
                      <Text style={styles.infoLabel}>Description</Text>
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
                      <Text style={styles.modalButtonText}>Edit</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                  <TouchableOpacity
                    onPress={handleModalClose}
                    accessible={true}
                    accessibilityLabel="Close student information"
                  >
                    <Text style={styles.cancelButtonText}>Close</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
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
      </Modal>

      <Modal visible={photoInputVisible} transparent animationType="fade">
        <PhotoInput
          visible={photoInputVisible}
          onClose={closePhotoInputModal}
          onSave={handlePhotoUpload}
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
    backgroundColor: "#333",
    width: 24,
    height: 24,
    borderRadius: 12,
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
    fontSize: 16,
    fontWeight: "bold",
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
    padding: 25,
    paddingHorizontal: 35,
    borderRadius: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 15,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  infoContainer: {
    width: "100%",
    marginBottom: 20,
  },
  profilePictureContainer: {
    position: "relative",
    alignSelf: "center",
    marginBottom: 20,
  },
  modalProfilePicture: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  editPhotoIcon: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#147efb",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fff",
  },
  infoCard: {
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    paddingVertical: 5,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    width: 100,
  },
  infoValue: {
    fontSize: 16,
    color: "#ffffff",
    flex: 1,
    flexWrap: "wrap",
  },
  input: {
    width: "100%",
    padding: 12,
    backgroundColor: "#2a2a2a",
    color: "#fff",
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#444",
    fontSize: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: "top",
    paddingTop: 12,
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
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 25
  },
  modalButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#F44336",
    marginTop: 10,
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
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 10,
    padding: 12,
    marginVertical: 10,
    alignItems: "center",
  },
  gradeChangeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
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