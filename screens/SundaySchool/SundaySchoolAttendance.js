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
import AsyncStorage from '@react-native-async-storage/async-storage';

// Simple cache utilities
const CacheUtils = {
  async get(key) {
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Check if cache is still valid (24 hours)
        if (Date.now() - parsed.timestamp < 72 * 60 * 60 * 1000) {
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
      await AsyncStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
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

const SundaySchoolAttendance = () => {
  const navigation = useNavigation();
  const user = auth().currentUser;
  
  // Core state
  const [userData, setUserData] = useState(null);
  const [studentsByGrade, setStudentsByGrade] = useState({});
  const [servants, setServants] = useState([]);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentGrade, setNewStudentGrade] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [previousSundays, setPreviousSundays] = useState([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userGrades, setUserGrades] = useState([]);
  
  // Refs
  const sectionListRef = useRef(null);
  const isMounted = useRef(true);
  const studentUnsubscribes = useRef([]);
  const userUnsubscribe = useRef(null);
  const cacheKeys = useRef({
    user: null,
    students: {},
    servants: null,
    profilePics: null
  });

  // Initialize and load cached data immediately
  useEffect(() => {
    isMounted.current = true;
    
    const initializeApp = async () => {
      if (!user) {
        Alert.alert("Error", "No user found.");
        setLoading(false);
        return;
      }

      // Set cache keys
      cacheKeys.current = {
        user: `user_${user.uid}`,
        students: {},
        servants: `servants_${user.uid}`,
        profilePics: `profile_pics_${user.uid}`
      };

      // Load cached data immediately (non-blocking)
      loadCachedData();
      
      // Generate previous Sundays
      await generatePreviousSundays();
      
      // Set up real-time listeners
      setupUserListener();
      
      // Mark loading as complete after a short delay
      setTimeout(() => {
        if (isMounted.current) {
          setLoading(false);
        }
      }, 300);
    };

    initializeApp();

    return () => {
      isMounted.current = false;
      if (userUnsubscribe.current) {
        userUnsubscribe.current();
      }
      studentUnsubscribes.current.forEach(unsubscribe => unsubscribe());
      studentUnsubscribes.current = [];
    };
  }, [user]);

  // Load cached data without blocking
  const loadCachedData = async () => {
    try {
      // Load all cached data in parallel
      const [cachedUser, cachedServants, cachedProfilePics] = await Promise.all([
        CacheUtils.get(cacheKeys.current.user),
        CacheUtils.get(cacheKeys.current.servants),
        CacheUtils.get(cacheKeys.current.profilePics)
      ]);

      if (cachedUser && isMounted.current) {
        setUserData(cachedUser);
        if (cachedUser.ssGrades?.length > 0) {
          setNewStudentGrade(cachedUser.ssGrades[0]);
          
          // Load cached students for each grade
          const cachedStudents = {};
          await Promise.all(
            cachedUser.ssGrades.map(async (grade) => {
              const cacheKey = `students_${user.uid}_${grade}`;
              cacheKeys.current.students[grade] = cacheKey;
              const cached = await CacheUtils.get(cacheKey);
              if (cached) {
                cachedStudents[grade] = cached;
              }
            })
          );
          
          if (Object.keys(cachedStudents).length > 0 && isMounted.current) {
            setStudentsByGrade(cachedStudents);
          }
        }
      }

      if (cachedServants && isMounted.current) {
        setServants(cachedServants);
      }

      if (cachedProfilePics && isMounted.current) {
        setProfilePictureUrls(cachedProfilePics);
      }
    } catch (error) {
      console.log('Error loading cached data:', error);
    }
  };

  // Set up user listener
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
          
          // Cache user data
          await CacheUtils.set(cacheKeys.current.user, newUserData);
          
          // Update new student grade default
          if (newUserData.ssGrades?.length > 0) {
            setNewStudentGrade(prevGrade => {
              if (newUserData.ssGrades.includes(prevGrade)) {
                return prevGrade;
              }
              return newUserData.ssGrades[0];
            });
          } else {
            setNewStudentGrade("");
          }
        },
        (error) => {
          if (isMounted.current) {
            Alert.alert("Error", error.message);
          }
        }
      );
  };

  // Subscribe to students based on current ssGrades
  useEffect(() => {
    if (!userData?.church || !userData?.ssGrades?.length) {
      setStudentsByGrade({});
      studentUnsubscribes.current.forEach(unsubscribe => unsubscribe());
      studentUnsubscribes.current = [];
      return;
    }

    // Clean up removed grades
    setStudentsByGrade(prevStudents => {
      const updatedStudents = {};
      userData.ssGrades.forEach(grade => {
        if (prevStudents[grade]) {
          updatedStudents[grade] = prevStudents[grade];
        }
      });
      return updatedStudents;
    });

    // Unsubscribe from previous listeners
    studentUnsubscribes.current.forEach(unsubscribe => unsubscribe());
    studentUnsubscribes.current = [];

    // Set up new listeners for current grades
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
          async (snapshot) => {
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
            
            // Cache the students data
            await CacheUtils.set(cacheKey, students);
          },
          (error) => {
            if (isMounted.current) {
              Alert.alert("Error", `Failed to load students for ${grade}: ${error.message}`);
            }
          }
        );
    });

    studentUnsubscribes.current = newUnsubscribes;

    // Fetch profile pictures
    fetchProfilePictureUrls();

    return () => {
      studentUnsubscribes.current.forEach(unsubscribe => unsubscribe());
      studentUnsubscribes.current = [];
    };
  }, [userData?.church, userData?.ssGrades?.join(",")]);

  // Fetch profile pictures with caching
  const fetchProfilePictureUrls = async () => {
    if (!userData?.church || !userData?.ssGrades?.length) return;
    
    try {
      // Get all students from current grades
      const allStudents = [];
      await Promise.all(
        userData.ssGrades.map(async (grade) => {
          const snapshot = await firestore()
            .collection("churches")
            .doc(userData.church)
            .collection("Sunday School")
            .doc(grade)
            .collection("students")
            .get();
          
          const students = snapshot.docs.map((doc) => ({
            uid: doc.id,
            grade,
            ...doc.data(),
          }));
          allStudents.push(...students);
        })
      );

      // Get all servants
      const servantsSnapshot = await firestore()
        .collection("churches")
        .doc(userData.church)
        .collection("Sunday School")
        .doc("Servants")
        .collection("Servants")
        .get();
      
      const allServants = servantsSnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      }));

      // Fetch all profile pictures at once
      const urls = {};
      await Promise.all([
        ...allStudents.map(async (student) => {
          if (student.uid) {
            try {
              const url = await storage()
                .ref(`profilePictures/${student.uid}.png`)
                .getDownloadURL();
              urls[student.uid] = typeof url === "string" && url.trim() ? url : null;
            } catch (error) {
              urls[student.uid] = null;
            }
          }
        }),
        ...allServants.map(async (servant) => {
          if (servant.uid) {
            try {
              const url = await storage()
                .ref(`profilePictures/${servant.uid}.png`)
                .getDownloadURL();
              urls[servant.uid] = typeof url === "string" && url.trim() ? url : null;
            } catch (error) {
              urls[servant.uid] = null;
            }
          }
        })
      ]);
      
      if (isMounted.current) {
        setProfilePictureUrls(urls);
        // Cache profile picture URLs
        await CacheUtils.set(cacheKeys.current.profilePics, urls);
      }
    } catch (error) {
      console.error("Error fetching profile pictures:", error);
    }
  };

  // Set up interval for profile picture updates
  useEffect(() => {
    if (!userData?.church || !userData?.ssGrades?.length) return;

    const intervalId = setInterval(fetchProfilePictureUrls, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [userData?.church, userData?.ssGrades?.join(",")]);

  // Optimized servants subscription with caching
  useEffect(() => {
    if (!userData?.church || !userData?.ssGrades?.length || !user) {
      setServants([]);
      setUserGrades([]);
      return;
    }

    const gradeFields = ["preSchoolAge3", "preSchoolAge4", "kindergarten", "college"];
    for (let i = 1; i <= 12; i++) {
      gradeFields.push(i.toString());
    }

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
            // Find current user's servant document first
            const currentUserServant = snapshot.docs.find(doc => doc.id === user.uid);
            if (!currentUserServant) {
              setServants([]);
              setUserGrades([]);
              return;
            }

            const currentUserData = currentUserServant.data();
            
            // Get the grades the current user teaches
            const userGradesList = gradeFields.filter(field => currentUserData[field] === true);
            setUserGrades(userGradesList);

            // Only show servants if user has assigned grades
            if (!userData.ssGrades?.length || userGradesList.length === 0) {
              setServants([]);
              return;
            }

            // Create a Set for faster lookup
            const userGradesSet = new Set(userGradesList);

            // Find all servants who share at least one grade (including current user)
            const servantsWithSharedGrades = snapshot.docs
              .filter(doc => {
                const servantData = doc.data();
                // Check if this servant shares any grade with the current user
                return gradeFields.some(field => 
                  userGradesSet.has(field) && servantData[field] === true
                );
              })
              .map(doc => ({
                uid: doc.id,
                isServant: true,
                isCurrentUser: doc.id === user.uid,
                ...doc.data()
              }));

            // Sort servants by name, but put current user first
            servantsWithSharedGrades.sort((a, b) => {
              if (a.isCurrentUser) return -1;
              if (b.isCurrentUser) return 1;
              return (a.name || '').localeCompare(b.name || '');
            });

            setServants(servantsWithSharedGrades);
            
            // Cache servants data
            await CacheUtils.set(cacheKeys.current.servants, servantsWithSharedGrades);
          } catch (error) {
            console.error("Error processing servants:", error);
            setServants([]);
          }
        },
        (error) => {
          if (isMounted.current) {
            console.error("Error fetching servants:", error);
            setServants([]);
          }
        }
      );

    return () => unsubscribe();
  }, [userData?.church, userData?.ssGrades?.join(","), user]);

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

  const handleAttendance = (person, status) => {
    if (selectedDate && selectedDate !== getNextSunday()) return;
    Haptics.trigger("impactLight");
    const dateKey = getNextSunday();
    
    if (person.isServant) {
      // Update servant attendance
      firestore()
        .collection("churches")
        .doc(userData?.church)
        .collection("Sunday School")
        .doc("Servants")
        .collection("Servants")
        .doc(person.uid)
        .update({
          [dateKey]: status,
        });
    } else {
      // Update student attendance
      firestore()
        .collection("churches")
        .doc(userData?.church)
        .collection("Sunday School")
        .doc(person.grade)
        .collection("students")
        .doc(person.uid)
        .update({
          [dateKey]: status,
        });
    }
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
    
    // Verify the grade is still assigned to the user
    if (!userData?.ssGrades?.includes(newStudentGrade)) {
      Alert.alert("Error", "You are no longer assigned to this grade");
      setNewStudentGrade(userData?.ssGrades?.[0] || "");
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
      });
      setModalVisible(false);
      setNewStudentName("");
      setNewStudentGrade(userData?.ssGrades[0] || "");
      
      // Clear cache for this grade to force refresh
      await CacheUtils.remove(cacheKeys.current.students[newStudentGrade]);
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
    
    // Only include grades that the user is currently assigned to
    if (userData?.ssGrades) {
      userData.ssGrades.forEach((grade) => {
        filtered[grade] = (studentsByGrade[grade] || []).filter((student) =>
          student.name.toLowerCase().includes(lower)
        );
      });
    }
    
    return filtered;
  }, [studentsByGrade, searchQuery, userData?.ssGrades]);

  // Filtered servants based on search query
  const filteredServants = useMemo(() => {
    if (!searchQuery.trim()) return servants;
    const lower = searchQuery.toLowerCase();
    return servants.filter((servant) =>
      (servant.name || '').toLowerCase().includes(lower)
    );
  }, [servants, searchQuery]);

  // Prepare sections for SectionList
  const gradeSections = useMemo(() => {
    if (!userData?.ssGrades) return [];
    
    const sections = userData.ssGrades.map((grade) => ({
      title: grade,
      data: filteredStudentsByGrade[grade] || [],
    }));
    
    // Add servants section at the end if there are any
    if (filteredServants.length > 0) {
      sections.push({
        title: "Servants",
        data: filteredServants,
      });
    }
    
    // When searching, only include sections that have data
    if (searchQuery.trim()) {
      return sections.filter(section => section.data.length > 0);
    }
    
    return sections;
  }, [userData?.ssGrades, filteredStudentsByGrade, filteredServants, searchQuery]);

  // Fixed scroll to section to handle servants properly
  const scrollToSection = useCallback((sectionTitle) => {
    if (!sectionListRef.current) return;
    
    // Find the section index in the actual rendered sections
    const sectionIndex = gradeSections.findIndex((section) => section.title === sectionTitle);
    
    if (sectionIndex >= 0) {
      // Use a small timeout to ensure the list has rendered
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
            // Fallback: try scrolling to the beginning of the section
            console.log("Scroll to location failed, trying fallback");
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
    setSelectedDate(getNextSunday());
    setDateModalVisible(false);
  };

  const renderGrade = useMemo(
    () =>
      ({ item }) => {
        // When searching, only show grades that have matching students
        if (searchQuery.trim() && item !== "Servants") {
          const hasStudents = gradeSections.some(section => section.title === item && section.data.length > 0);
          if (!hasStudents) return null;
        }
        
        // For servants, only show if there are servants
        if (item === "Servants" && filteredServants.length === 0) return null;
        
        return (
          <TouchableOpacity
            style={styles.gradeTag}
            onPress={() => scrollToSection(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.gradeTagText}>
              {item === "Servants" ? "Servants" : formatGrade(item)}
            </Text>
          </TouchableOpacity>
        );
      },
    [searchQuery, gradeSections, filteredServants, scrollToSection]
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
    ({ item: person, section }) => {
      const dateKey = selectedDate || getNextSunday();
      const isPastDate = selectedDate && selectedDate !== getNextSunday();
      const isServant = person.isServant || false;
      
      return (
        <View key={person.uid} style={styles.studentContainer}>
          <View style={styles.studentHeader}>
            <Image
              style={styles.profilePicture}
              source={
                profilePictureUrls[person.uid]
                  ? { uri: profilePictureUrls[person.uid] }
                  : require("../../assets/default_profile.png")
              }
              defaultSource={require("../../assets/default_profile.png")}
              resizeMode="cover"
              onError={() =>
                setProfilePictureUrls((prev) => ({
                  ...prev,
                  [person.uid]: null,
                }))
              }
            />
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>
                {person.name} {isServant ? (person.isCurrentUser ? "(You)" : "") : `- ${formatGrade(person.grade)}`}
              </Text>
              <TouchableOpacity
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                onPress={() => {
                  if (!userData) {
                    Alert.alert("Error", "User data not loaded.");
                    return;
                  }
                  
                  if (!userData.ssGrades) {
                    console.log('userData structure:', userData);
                    Alert.alert("Error", "Sunday School grades not loaded. Check console for userData structure.");
                    return;
                  }
                  
                  setIsNavigating(true);
                  
                  if (isServant) {
                    navigation.navigate("ServantAttendance", {
                      church: userData.church,
                      servantId: person.uid,
                    });
                  } else {
                    navigation.navigate("IndividualAttendance", {
                      church: userData.church,
                      category: "Sunday School",
                      grade: person.grade,
                      studentId: person.uid,
                      userGrades: userData?.ssGrades || [], // Pass grades the user teaches with fallback
                    });
                  }
                  
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
                      person[dateKey] === true
                        ? "#147efb"
                        : person[dateKey] === false
                        ? "#D32F2F"
                        : "#444",
                  },
                ]}
              >
                <Text style={styles.attendanceStatusText}>
                  {person[dateKey] === true
                    ? "Present"
                    : person[dateKey] === false
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
                      person[dateKey] === false ? "#D32F2F" : "#444",
                  },
                ]}
                onPress={() => handleAttendance(person, false)}
                activeOpacity={0.7}
              >
                <Text style={styles.attendanceButtonText}>Absent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.attendanceButton,
                  {
                    backgroundColor:
                      person[dateKey] === true ? "#147efb" : "#444",
                  },
                ]}
                onPress={() => handleAttendance(person, true)}
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

  // Show minimal loading only on first load
  if (loading && !userData && Object.keys(studentsByGrade).length === 0) {
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

  // Create grades list with servants at the end
  const allSections = searchQuery.trim() 
    ? gradeSections.map(section => section.title)
    : [...(userData.ssGrades || []), ...(servants.length > 0 ? ["Servants"] : [])];

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
          data={allSections}
          renderItem={renderGrade}
          keyExtractor={(item) => item}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gradesList}
          getItemLayout={(data, index) => ({
            length: 50,
            offset: 50 * index,
            index,
          })}
        />
      </View>
      {/* Thinner Search Bar below grade tags, matching AlhanAttendance */}
      <TextInput
        style={styles.searchBar}
        placeholder="Search students & servants..."
        placeholderTextColor="#888"
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCorrect={false}
        autoCapitalize="none"
        accessible={true}
        accessibilityLabel="Search students and servants"
      />
      <SectionList
        ref={sectionListRef}
        sections={gradeSections}
        keyExtractor={(item) => item.uid}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.gradeHeader}>
            {title === "Servants" ? "Servants" : formatGrade(title)}
          </Text>
        )}
        renderItem={renderStudent}
        ListEmptyComponent={
          <Text style={styles.noStudentsText}>
            {searchQuery.trim() ? 'No students or servants found matching your search' : 'No students in this grade'}
          </Text>
        }
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={true}
        extraData={profilePictureUrls}
        onScrollToIndexFailed={(info) => {
          const wait = new Promise(resolve => setTimeout(resolve, 500));
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