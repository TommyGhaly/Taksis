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
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';

const CacheUtils = {
  async get(key) {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed.data;
        }
      }
    } catch (error) {
      console.log('Cache read error:', error);
    }
    return null;
  },
  async set(key, data) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (error) {
      console.log('Cache write error:', error);
    }
  },
  async remove(key) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.log('Cache remove error:', error);
    }
  }
};

const AlhanAttendance = () => {
  const navigation = useNavigation();
  const user = auth().currentUser;
  
  const [userData, setUserData] = useState(null);
  const [studentsByGrade, setStudentsByGrade] = useState({});
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentGrade, setNewStudentGrade] = useState("");
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
  const cacheKeys = useRef({ user: null, students: {}, profilePics: null });

  useEffect(() => {
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
        profilePics: `alhan_profile_pics_${user.uid}`
      };
      loadCachedData();
      await generatePreviousSaturdays();
      setupUserListener();
      setTimeout(() => {
        if (isMounted.current) setLoading(false);
      }, 300);
    };
    initializeApp();
    return () => {
      isMounted.current = false;
      if (userUnsubscribe.current) userUnsubscribe.current();
      studentUnsubscribes.current.forEach(unsubscribe => unsubscribe());
      studentUnsubscribes.current = [];
    };
  }, [user]);

  const loadCachedData = async () => {
    try {
      const [cachedUser, cachedProfilePics] = await Promise.all([
        CacheUtils.get(cacheKeys.current.user),
        CacheUtils.get(cacheKeys.current.profilePics)
      ]);
      if (cachedUser && isMounted.current) {
        setUserData(cachedUser);
        if (cachedUser.alhanGrades?.length > 0) {
          setNewStudentGrade(cachedUser.alhanGrades[0]);
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
      if (cachedProfilePics && isMounted.current) setProfilePictureUrls(cachedProfilePics);
    } catch (error) {
      console.log('Error loading cached data:', error);
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
          await CacheUtils.set(cacheKeys.current.user, newUserData);
          if (newUserData.alhanGrades?.length > 0) {
            setNewStudentGrade(prevGrade => {
              if (newUserData.alhanGrades.includes(prevGrade)) return prevGrade;
              return newUserData.alhanGrades[0];
            });
          } else {
            setNewStudentGrade("");
          }
        },
        (error) => {
          if (isMounted.current) Alert.alert("Error", error.message);
        }
      );
  };

  useEffect(() => {
    if (!userData?.church || !userData?.alhanGrades?.length) {
      setStudentsByGrade({});
      studentUnsubscribes.current.forEach(unsubscribe => unsubscribe());
      studentUnsubscribes.current = [];
      return;
    }
    setStudentsByGrade(prevStudents => {
      const updatedStudents = {};
      userData.alhanGrades.forEach(grade => {
        if (prevStudents[grade]) updatedStudents[grade] = prevStudents[grade];
      });
      return updatedStudents;
    });
    studentUnsubscribes.current.forEach(unsubscribe => unsubscribe());
    studentUnsubscribes.current = [];
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
            students.sort((a, b) => a.name.localeCompare(b.name));
            setStudentsByGrade((prev) => ({ ...prev, [grade]: students }));
            await CacheUtils.set(cacheKey, students);
          },
          (error) => {
            if (isMounted.current) Alert.alert("Error", `Failed to load students for ${grade}: ${error.message}`);
          }
        );
    });
    studentUnsubscribes.current = newUnsubscribes;
    fetchProfilePictureUrls();
    return () => {
      studentUnsubscribes.current.forEach(unsubscribe => unsubscribe());
      studentUnsubscribes.current = [];
    };
  }, [userData?.church, userData?.alhanGrades?.join(",")]);

  const fetchProfilePictureUrls = async () => {
    if (!userData?.church || !userData?.alhanGrades?.length) return;
    try {
      const allStudents = [];
      await Promise.all(
        userData.alhanGrades.map(async (grade) => {
          const snapshot = await firestore()
            .collection("churches")
            .doc(userData.church)
            .collection("Hymns Class")
            .doc(grade)
            .collection("students")
            .get();
          const students = snapshot.docs.map((doc) => ({ uid: doc.id, grade, ...doc.data() }));
          allStudents.push(...students);
        })
      );

      // Fetch profile pictures progressively instead of blocking on Promise.all
      const fetchBatch = async (batch) => {
        const batchUrls = {};
        await Promise.all(
          batch.map(async (student) => {
            if (student.uid) {
              try {
                const url = await storage().ref(`profilePictures/${student.uid}.png`).getDownloadURL();
                batchUrls[student.uid] = typeof url === "string" && url.trim() ? url : null;
              } catch (error) {
                batchUrls[student.uid] = null;
              }
            }
          })
        );
        return batchUrls;
      };

      // Fetch in batches of 10 to progressively update UI
      const batchSize = 10;
      for (let i = 0; i < allStudents.length; i += batchSize) {
        const batch = allStudents.slice(i, i + batchSize);
        const batchUrls = await fetchBatch(batch);
        if (isMounted.current) {
          setProfilePictureUrls(prev => ({ ...prev, ...batchUrls }));
        }
      }

      // Cache all URLs at once
      if (isMounted.current) {
        await CacheUtils.set(cacheKeys.current.profilePics, profilePictureUrls);
      }
    } catch (error) {
      console.error("Error fetching profile pictures:", error);
    }
  };

  useEffect(() => {
    if (!userData?.church || !userData?.alhanGrades?.length) return;
    const intervalId = setInterval(fetchProfilePictureUrls, 30000);
    return () => clearInterval(intervalId);
  }, [userData?.church, userData?.alhanGrades?.join(",")]);

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

  const getNextSaturday = () => {
    const today = new Date();
    const currentDay = today.getDay();
    if (currentDay === 6) return formatDate(today);
    const nextSaturday = new Date(today);
    nextSaturday.setDate(today.getDate() + (6 - currentDay));
    return formatDate(nextSaturday);
  };

  const formatDate = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  const formatGrade = (grade) => {
    if (isNaN(parseInt(grade))) return grade;
    const num = parseInt(grade);
    const suffix = num === 1 ? "st" : num === 2 ? "nd" : num === 3 ? "rd" : "th";
    return `${num}${suffix} Grade`;
  };

  const handleAttendance = (student, status) => {
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
    if (!userData?.alhanGrades?.includes(newStudentGrade)) {
      Alert.alert("Error", "You are no longer assigned to this grade");
      setNewStudentGrade(userData?.alhanGrades?.[0] || "");
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
        name: newStudentName,
        uid: newStudentRef.id,
        phone: "",
        address: "",
        description: "",
        birthday: "",
      });
      setModalVisible(false);
      setNewStudentName("");
      setNewStudentGrade(userData?.alhanGrades[0] || "");
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
      return sections.filter(section => section.data.length > 0);
    }
    return sections;
  }, [userData?.alhanGrades, filteredStudentsByGrade, searchQuery]);

  const scrollToGrade = useCallback((grade) => {
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
  }, [gradeSections]);

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setDateModalVisible(false);
  };

  const handleJumpToCurrentWeek = () => {
    setSelectedDate(getNextSaturday());
    setDateModalVisible(false);
  };

  const renderGrade = useMemo(
    () =>
      ({ item }) => {
        if (searchQuery.trim()) {
          const hasStudents = gradeSections.some(section => section.title === item && section.data.length > 0);
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

  const renderDate = useMemo(
    () =>
      ({ item }) => (
        <TouchableOpacity style={styles.dateItem} onPress={() => handleDateSelect(item)} activeOpacity={0.7}>
          <Text style={styles.dateText}>{item}</Text>
        </TouchableOpacity>
      ),
    []
  );

  const renderStudent = useCallback(
    ({ item: student }) => {
      const dateKey = selectedDate || getNextSaturday();
      const isPastDate = selectedDate && selectedDate !== getNextSaturday();
      return (
        <View key={student.uid} style={styles.studentContainer}>
          <View style={styles.studentHeader}>
            <Image
              style={styles.profilePicture}
              source={profilePictureUrls[student.uid] ? { uri: profilePictureUrls[student.uid] } : require("../../assets/default_profile.png")}
              resizeMode="cover"
              defaultSource={require("../../assets/default_profile.png")}
              onError={() => setProfilePictureUrls((prev) => ({ ...prev, [student.uid]: null }))}
            />
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{student.name} - {formatGrade(student.grade)}</Text>
              <TouchableOpacity
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                onPress={() => {
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
                }}
                disabled={isNavigating}
              >
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
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
                      student[dateKey] === true ? "#147EFB" : student[dateKey] === false ? "#ff3b30" : "rgba(255,255,255,0.1)",
                  },
                ]}
              >
                <Text style={styles.attendanceStatusText}>
                  {student[dateKey] === true ? "Present" : student[dateKey] === false ? "Absent" : "Not Recorded"}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.attendanceButtons}>
              <TouchableOpacity
                style={[styles.attendanceButton, { backgroundColor: student[dateKey] === false ? "#ff3b30" : "rgba(255,255,255,0.08)" }]}
                onPress={() => handleAttendance(student, false)}
                activeOpacity={0.7}
              >
                <Text style={styles.attendanceButtonText}>Absent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.attendanceButton, { backgroundColor: student[dateKey] === true ? "#147EFB" : "rgba(255,255,255,0.08)" }]}
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

  if (loading && !userData && Object.keys(studentsByGrade).length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#147EFB" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!userData || !userData.alhanGrades || userData.alhanGrades.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="musical-notes-outline" size={64} color="rgba(255,255,255,0.3)" />
        <Text style={styles.message}>Contact your church's alhan admin to get assigned a Hymns class.</Text>
      </View>
    );
  }

  const dateKey = selectedDate || getNextSaturday();

  return (
    <View style={styles.container}>
      {isNavigating && (
        <View style={styles.navigatingOverlay}>
          <ActivityIndicator size="large" color="#147EFB" />
        </View>
      )}

      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.titleContainer} onPress={() => setDateModalVisible(true)} activeOpacity={0.7}>
          <Text style={styles.title}>{dateKey}</Text>
          <Ionicons name="calendar-outline" size={18} color="rgba(255,255,255,0.6)" style={styles.calendarIcon} />
        </TouchableOpacity>
      </View>

      <View style={styles.gradesContainer}>
        <FlatList
          data={searchQuery.trim() ? gradeSections.map(section => section.title) : userData.alhanGrades}
          renderItem={renderGrade}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gradesList}
        />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" style={styles.searchIcon} />
        <TextInput
          style={styles.searchBar}
          placeholder="Search students..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

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
        extraData={profilePictureUrls}
        onScrollToIndexFailed={(info) => {
          const wait = new Promise(resolve => setTimeout(resolve, 500));
          wait.then(() => {
            if (sectionListRef.current && info.index >= 0 && info.index < gradeSections.length) {
              sectionListRef.current.scrollToLocation({ sectionIndex: info.index, itemIndex: 1, animated: false, viewPosition: 0 });
            }
          });
        }}
      />

      <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)} activeOpacity={0.7}>
        <Ionicons name="add" size={20} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.addButtonText}>Add Student</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {submitting ? (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="large" color="#147EFB" />
                <Text style={styles.loadingText}>Adding Student...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>Add New Student</Text>
                <Text style={styles.modalSubtitle}>Enter the student's details below</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    autoCapitalize="words"
                    placeholder="Student name"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={newStudentName}
                    onChangeText={setNewStudentName}
                  />
                  <Picker
                    selectedValue={newStudentGrade}
                    onValueChange={(itemValue) => setNewStudentGrade(itemValue)}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    {userData?.alhanGrades?.map((grade) => (
                      <Picker.Item key={grade} label={formatGrade(grade)} value={grade} />
                    ))}
                  </Picker>
                </View>
                <TouchableOpacity
                  style={[styles.modalButton, submitting && { opacity: 0.5 }]}
                  onPress={addStudent}
                  activeOpacity={0.7}
                  disabled={submitting}
                >
                  <Text style={styles.modalButtonText}>Add Student</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setModalVisible(false)} disabled={submitting} style={styles.cancelTouchable}>
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
            <Text style={styles.modalTitle}>Select Week</Text>
            <Text style={styles.modalSubtitle}>View attendance for a previous week</Text>
            <TouchableOpacity style={styles.modalButton} onPress={handleJumpToCurrentWeek} activeOpacity={0.7}>
              <Text style={styles.modalButtonText}>Jump to This Week</Text>
            </TouchableOpacity>
            <FlatList
              data={previousSaturdays}
              renderItem={renderDate}
              keyExtractor={(item) => item}
              style={styles.dateList}
              showsVerticalScrollIndicator={false}
            />
            <TouchableOpacity onPress={() => setDateModalVisible(false)} style={styles.cancelTouchable}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
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
  headerRow: {
    marginBottom: 8,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: 0.3,
  },
  calendarIcon: {
    marginLeft: 8,
  },
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 34,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  searchIcon: {
    marginRight: 6,
  },
  searchBar: {
    flex: 1,
    color: "#fff",
    fontSize: 13,
    paddingVertical: 0,
  },
  gradeHeader: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4d9cff",
    marginBottom: 10,
    backgroundColor: "#121212",
    paddingVertical: 6,
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
    fontWeight: "600",
    color: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
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
  addButton: {
    backgroundColor: "#147EFB",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: 12,
    marginBottom: 16,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
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
  modalLoadingContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  modalTitle: {
    fontSize: 22,
    color: "#fff",
    fontWeight: "600",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    marginBottom: 24,
    textAlign: "center",
  },
  inputContainer: {
    width: "100%",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    color: "#fff",
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    fontSize: 16,
  },
  picker: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  pickerItem: {
    color: "#fff",
    fontSize: 16,
  },
  modalButton: {
    width: "100%",
    backgroundColor: "#147EFB",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
  cancelTouchable: {
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#ff3b30",
    fontWeight: "600",
  },
  dateList: {
    width: "100%",
    maxHeight: 280,
    marginBottom: 16,
  },
  dateItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  dateText: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
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