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
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import storage from "@react-native-firebase/storage";
import * as Haptics from "react-native-haptic-feedback";
import Icon from "react-native-vector-icons/MaterialIcons";

const SundaySchoolAttendance = () => {
  const navigation = useNavigation();
  const user = auth().currentUser;
  const [studentsByGrade, setStudentsByGrade] = useState({});
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentGrade, setNewStudentGrade] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [previousSundays, setPreviousSundays] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const sectionListRef = useRef(null);
  const isMounted = useRef(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    isMounted.current = true;

    const fetchData = async () => {
      if (!user) {
        Alert.alert("Error", "No user found.");
        setLoading(false);
        return () => {};
      }

      try {
        // Fetch user data once
        const userDoc = await firestore()
          .collection("users")
          .doc(user.uid)
          .get();
        if (!isMounted.current) return;
        if (!userDoc.exists) {
          Alert.alert("Error", "User not found.");
          setLoading(false);
          return () => {};
        }
        const localUserData = userDoc.data();
        setUserData(localUserData);
        setNewStudentGrade(localUserData.ssGrades[0] || "");

        if (!localUserData.ssGrades?.length) {
          setLoading(false);
          return () => {};
        }

        // Generate previous Sundays
        await generatePreviousSundays();

        // Set up persistent snapshot listener for all grades
        const gradeStudents = {};
        localUserData.ssGrades.forEach((grade) => {
          gradeStudents[grade] = [];
        });

        const unsubscribes = localUserData.ssGrades.map((grade) =>
          firestore()
            .collection("churches")
            .doc(localUserData.church)
            .collection("Sunday School")
            .doc(grade)
            .collection("students")
            .onSnapshot(
              (snapshot) => {
                if (!isMounted.current) return;
                const students = snapshot.docs.map((doc) => ({
                  uid: doc.id,
                  grade,
                  ...doc.data(),
                }));
                students.sort((a, b) => a.name.localeCompare(b.name));

                setStudentsByGrade((prev) => ({
                  ...prev,
                  [grade]: students,
                }));

                // Fetch profile pictures for new students
                fetchProfilePictures(students);
              },
              (error) => {
                if (isMounted.current) {
                  Alert.alert("Error", `Failed to load students for ${grade}: ${error.message}`);
                }
              }
            )
        );

        setLoading(false);

        // Return cleanup function to unsubscribe listeners
        return () => {
          isMounted.current = false;
          unsubscribes.forEach((unsubscribe) => unsubscribe());
        };
      } catch (error) {
        if (isMounted.current) {
          Alert.alert("Error", error.message);
          setLoading(false);
        }
        return () => {};
      }
    };

    fetchData();

    return () => {
      isMounted.current = false;
    };
  }, [user]);

  const generatePreviousSundays = async () => {
    const today = new Date();
    const sundays = [];
    let currentDate = new Date(today);

    const currentYear = today.getFullYear();
    const september11ThisYear = new Date(currentYear, 8, 11);
    const cutoffDate =
      today < september11ThisYear
        ? new Date(currentYear - 1, 8, 11)
        : september11ThisYear;

    const day = currentDate.getDay();
    const diffToSunday = day === 0 ? 0 : day;
    currentDate.setDate(currentDate.getDate() - diffToSunday);

    while (currentDate >= cutoffDate) {
      sundays.push(formatDate(currentDate));
      currentDate.setDate(currentDate.getDate() - 7);
    }

    setPreviousSundays(sundays);
  };

  const fetchProfilePictures = async (students) => {
    const urls = { ...profilePictureUrls };
    const studentsToFetch = students.filter(
      (student) => !urls[student.uid]
    );

    await Promise.all(
      studentsToFetch.map(async (student) => {
        try {
          const url = await storage()
            .ref(`profilePictures/${student.uid}.png`)
            .getDownloadURL();
          urls[student.uid] = typeof url === "string" && url.trim() ? url : null;
        } catch {
          urls[student.uid] = null;
        }
      })
    );
    if (isMounted.current) {
      setProfilePictureUrls(urls);
    }
  };

  const getNextSunday = () => {
    const today = new Date();
    const currentDay = today.getDay();
    if (currentDay === 0) return formatDate(today);
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + (7 - currentDay));
    return formatDate(nextSunday);
  };

  const formatDate = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  const formatGrade = (grade) => {
    if (isNaN(parseInt(grade))) {
      return grade;
    }
    const num = parseInt(grade);
    const suffix =
      num === 1 ? "st" : num === 2 ? "nd" : num === 3 ? "rd" : "th";
    return `${num}${suffix} Grade`;
  };

  const handleAttendance = (student, status) => {
    if (selectedDate && selectedDate !== getNextSunday()) return;
    Haptics.trigger("impactLight");
    const dateKey = getNextSunday();
    firestore()
      .collection("churches")
      .doc(userData?.church)
      .collection("Sunday School")
      .doc(student.grade)
      .collection("students")
      .doc(student.uid)
      .update({
        [dateKey]: status,
      });
  };

  const addStudent = async () => {
    if (!newStudentName.trim()) {
      Alert.alert("Error", "Please enter a student name");
      return;
    }
    if (!newStudentGrade) {
      Alert.alert("Error", "Please select a grade");
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
        name: newStudentName,
        uid: newStudentRef.id,
        phone: "",
        address: "",
        description: "",
        birthday: "",
        grade: newStudentGrade,
      });
      setModalVisible(false);
      setNewStudentName("");
      setNewStudentGrade(userData?.ssGrades[0] || "");
    } catch (error) {
      Alert.alert("Error", "Failed to add student");
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered students by grade based on search query
  const filteredStudentsByGrade = useMemo(() => {
    if (!searchQuery.trim()) return studentsByGrade;
    const lower = searchQuery.toLowerCase();
    const filtered = {};
    Object.keys(studentsByGrade).forEach((grade) => {
      filtered[grade] = (studentsByGrade[grade] || []).filter((student) =>
        student.name.toLowerCase().includes(lower)
      );
    });
    return filtered;
  }, [studentsByGrade, searchQuery]);

  // Prepare sections for SectionList
  const gradeSections = useMemo(() => {
    if (!userData?.ssGrades) return [];
    const sections = userData.ssGrades.map((grade) => ({
      title: grade,
      data: filteredStudentsByGrade[grade] || [],
    }));
    
    // When searching, only include sections that have students
    if (searchQuery.trim()) {
      return sections.filter(section => section.data.length > 0);
    }
    
    return sections;
  }, [userData, filteredStudentsByGrade, searchQuery]);

  // Scroll to section header for grade
  const scrollToGrade = (grade) => {
    if (!sectionListRef.current || !gradeSections.length) return;
    const sectionIndex = gradeSections.findIndex((section) => section.title === grade);
    if (sectionIndex >= 0) {
      sectionListRef.current.scrollToLocation({
        sectionIndex,
        itemIndex: 1,
        animated: true,
        viewPosition: 0,
      });
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setDateModalVisible(false);
  };

  const handleJumpToCurrentWeek = () => {
    setSelectedDate(getNextSunday());
    setDateModalVisible(false);
  };

  const renderGrade = useMemo(
    () =>
      ({ item }) => {
        // Only show grade tag if it has students or if no search is active
        const hasStudents = searchQuery.trim() 
          ? gradeSections.some(section => section.title === item && section.data.length > 0)
          : true;
        
        if (!hasStudents) return null;
        
        return (
          <TouchableOpacity
            style={styles.gradeTag}
            onPress={() => scrollToGrade(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.gradeTagText}>{formatGrade(item)}</Text>
          </TouchableOpacity>
        );
      },
    [searchQuery, gradeSections]
  );

  const renderDate = useMemo(
    () =>
      ({ item }) => (
        <TouchableOpacity
          style={styles.dateItem}
          onPress={() => handleDateSelect(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.dateText}>{item}</Text>
        </TouchableOpacity>
      ),
    []
  );

  const renderStudent = useCallback(
    ({ item: student, section }) => {
      const dateKey = selectedDate || getNextSunday();
      const isPastDate = selectedDate && selectedDate !== getNextSunday();
      return (
        <View key={student.uid} style={styles.studentContainer}>
          <View style={styles.studentHeader}>
            <Image
              style={styles.profilePicture}
              source={
                profilePictureUrls[student.uid]
                  ? { uri: profilePictureUrls[student.uid] }
                  : require("../../assets/default_profile.png")
              }
              defaultSource={require("../../assets/default_profile.png")}
              resizeMode="cover"
              onError={() =>
                setProfilePictureUrls((prev) => ({
                  ...prev,
                  [student.uid]: null,
                }))
              }
            />
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>
                {student.name} - {formatGrade(student.grade)}
              </Text>
              <TouchableOpacity
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                onPress={() => {
                  if (!userData) {
                    Alert.alert("Error", "User data not loaded.");
                    return;
                  }
                  setIsNavigating(true);
                  navigation.navigate("IndividualAttendance", {
                    church: userData.church,
                    category: "Sunday School",
                    grade: student.grade,
                    studentId: student.uid,
                  });
                  setTimeout(() => setIsNavigating(false), 1000);
                }}
                disabled={isNavigating}
              >
                <Image
                  source={require("../../assets/vector.png")}
                  style={styles.icon}
                />
              </TouchableOpacity>
            </View>
          </View>
          {isPastDate ? (
            <View style={styles.attendanceStatusContainer}>
              <View
                style={[
                  styles.attendanceStatus,
                  {
                    backgroundColor:
                      student[dateKey] === true
                        ? "#147efb"
                        : student[dateKey] === false
                        ? "#D32F2F"
                        : "#444",
                  },
                ]}
              >
                <Text style={styles.attendanceStatusText}>
                  {student[dateKey] === true
                    ? "Present"
                    : student[dateKey] === false
                    ? "Absent"
                    : "Not Recorded"}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.attendanceButtons}>
              <TouchableOpacity
                style={[
                  styles.attendanceButton,
                  {
                    backgroundColor:
                      student[dateKey] === false ? "#D32F2F" : "#444",
                  },
                ]}
                onPress={() => handleAttendance(student, false)}
                activeOpacity={0.7}
              >
                <Text style={styles.attendanceButtonText}>Absent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.attendanceButton,
                  {
                    backgroundColor:
                      student[dateKey] === true ? "#147efb" : "#444",
                  },
                ]}
                onPress={() => handleAttendance(student, true)}
                activeOpacity={0.7}
              >
                <Text style={styles.attendanceButtonText}>Present</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    },
    [profilePictureUrls, userData, selectedDate, isNavigating]
  );

  const memoizedProfilePictureUrls = useMemo(
    () => profilePictureUrls,
    [profilePictureUrls]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#147efb" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!userData || !userData.ssGrades || userData.ssGrades.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>
          Contact your church's servants admin to get assigned a Sunday School
          class.
        </Text>
      </View>
    );
  }

  const dateKey = selectedDate || getNextSunday();
  const isPastDate = selectedDate && selectedDate !== getNextSunday();

  return (
    <View style={styles.container}>
      {isNavigating && (
        <View style={styles.navigatingOverlay}>
          <ActivityIndicator size="large" color="#147efb" />
          <Text style={styles.loadingText}>Navigating...</Text>
        </View>
      )}
      <TouchableOpacity
        style={styles.titleContainer}
        onPress={() => setDateModalVisible(true)}
        activeOpacity={0.7}
        accessible={true}
        accessibilityLabel="Select previous week"
      >
        <Text style={styles.title}>{dateKey}</Text>
        <Icon
          name="calendar-today"
          size={24}
          color="#fff"
          style={styles.calendarIcon}
        />
      </TouchableOpacity>
      <View style={styles.gradesContainer}>
        <FlatList
          data={searchQuery.trim() ? gradeSections.map(section => section.title) : userData.ssGrades}
          renderItem={renderGrade}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gradesList}
        />
      </View>
      {/* Thinner Search Bar below grade tags, matching AlhanAttendance */}
      <TextInput
        style={styles.searchBar}
        placeholder="Search students..."
        placeholderTextColor="#888"
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCorrect={false}
        autoCapitalize="none"
        accessible={true}
        accessibilityLabel="Search students"
      />
      <SectionList
        ref={sectionListRef}
        sections={gradeSections}
        keyExtractor={(item) => item.uid}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.gradeHeader}>{formatGrade(title)}</Text>
        )}
        renderItem={renderStudent}
        ListEmptyComponent={
          <Text style={styles.noStudentsText}>
            {searchQuery.trim() ? 'No students found matching your search' : 'No students in this grade'}
          </Text>
        }
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={true}
      />

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.addButtonText}>Add Student</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            {submitting ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#147efb" />
                <Text style={styles.loadingText}>Adding Student...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>Add New Student</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    autoCapitalize="words"
                    placeholder="Enter student name"
                    placeholderTextColor="#888"
                    value={newStudentName}
                    onChangeText={setNewStudentName}
                    accessible={true}
                    accessibilityLabel="Enter student name"
                  />
                  <Picker
                    selectedValue={newStudentGrade}
                    onValueChange={(itemValue) => setNewStudentGrade(itemValue)}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    {userData?.ssGrades?.map((grade) => (
                      <Picker.Item
                        key={grade}
                        label={formatGrade(grade)}
                        value={grade}
                      />
                    ))}
                  </Picker>
                </View>
                <TouchableOpacity
                  style={[styles.modalButton, submitting && { opacity: 0.5 }]}
                  onPress={addStudent}
                  activeOpacity={0.7}
                  disabled={submitting}
                  accessible={true}
                  accessibilityLabel="Add student"
                >
                  <Text style={styles.modalButtonText}>Add Student</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  accessible={true}
                  accessibilityLabel="Cancel adding student"
                  disabled={submitting}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={dateModalVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Previous Week</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleJumpToCurrentWeek}
              activeOpacity={0.7}
              accessible={true}
              accessibilityLabel="Jump to current week"
            >
              <Text style={styles.modalButtonText}>Jump to This Week</Text>
            </TouchableOpacity>
            <FlatList
              data={previousSundays}
              renderItem={renderDate}
              keyExtractor={(item) => item}
              style={styles.dateList}
              showsVerticalScrollIndicator={false}
            />
            <TouchableOpacity
              onPress={() => setDateModalVisible(false)}
              accessible={true}
              accessibilityLabel="Close date selector"
            >
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#121212" },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  calendarIcon: {
    marginLeft: 10,
  },
  gradesContainer: {
    height: 48,
    marginBottom: 2,
    justifyContent: "center",
  },
  gradesList: {
    alignItems: "center",
  },
  gradeTag: {
    backgroundColor: "#2a2a2a",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 10,
  },
  gradeTagText: {
    fontSize: 16,
    color: "#ccc",
    fontWeight: "600",
  },
  gradeHeader: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ccc",
    marginTop: 0,
    marginBottom: 10,
    backgroundColor: "#121212",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  studentContainer: {
    backgroundColor: "#1e1e1e",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  studentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  profilePicture: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#333333",
    marginRight: 12,
  },
  studentInfo: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  studentName: { fontSize: 20, color: "#ffffff", fontWeight: "600" },
  icon: { width: 8, height: 15 },
  attendanceButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 15,
  },
  attendanceButton: {
    flex: 1,
    borderRadius: 10,
    marginHorizontal: 5,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  attendanceButtonText: { fontSize: 16, fontWeight: "bold", color: "#ffffff" },
  attendanceStatusContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 15,
  },
  attendanceStatus: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  attendanceStatusText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    fontSize: 18,
    color: "#fff",
    marginTop: 10,
  },
  addButton: {
    backgroundColor: "#147efb",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: 20,
    width: "100%",
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  addButtonText: { fontSize: 18, fontWeight: "bold", color: "#ffffff" },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  modalContent: {
    width: 340,
    padding: 25,
    backgroundColor: "#1e1e1e",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#333",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 15,
  },
  modalTitle: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 20,
  },
  picker: {
    width: "100%",
    backgroundColor: "#2a2a2a",
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#444",
  },
  pickerItem: {
    color: "#e0e0e0",
    fontSize: 18,
    fontWeight: "700",
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
  modalButton: {
    width: "100%",
    backgroundColor: "#147efb",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  modalButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#f44336",
    marginTop: 15,
    fontWeight: "600",
  },
  message: {
    fontSize: 18,
    color: "#b0b0b0",
    textAlign: "center",
    marginVertical: 10,
  },
  noStudentsText: {
    fontSize: 18,
    color: "#b0b0b0",
    textAlign: "center",
    marginVertical: 10,
  },
  dateList: {
    width: "100%",
    maxHeight: 300,
    marginBottom: 20,
  },
  dateItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#444",
  },
  dateText: {
    fontSize: 18,
    color: "#fff",
    textAlign: "center",
  },
  navigatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  searchBar: {
    width: "100%",
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#232323",
    color: "#fff",
    borderRadius: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#444",
    fontSize: 14,
    marginTop: 8,
  },
});

export default SundaySchoolAttendance;