import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  FlatList,
  Modal,
  Image,
} from "react-native";
import firestore, { FieldValue } from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import {
  removeServer as removeServerAPI,
  addServer as addServerAPI,
  switchServers as switchServersAPI,
} from "../components/functionCalls";
import IndividualProfile from "../components/individualProfile";

// Import ONLY specific caching functions (not hooks to avoid re-render loops)
import { FirestoreCache, StorageCache } from "../utils/cacheManager";

// Date format constants
const DATE_FORMATS = {
  SCHEDULE: 'MM-DD-YY',  // Format used for schedule IDs
  LAST_SERVE: 'MM-DD-YY', // Format stored in user's lastServe field
};

// Readings configuration
const readings = [
  "matins",
  "third",
  "sixth",
  "pauline",
  "catholic",
  "praxis",
  "gospel",
  "water",
  "wine",
];

const displayNames = {
  matins: "Matins Gospel",
  third: "Third Hour Gospel",
  sixth: "Sixth Hour Gospel",
  pauline: "Pauline Epistle",
  catholic: "Catholic Epistle",
  praxis: "Praxis",
  gospel: "Gospel",
  water: "Water",
  wine: "Wine",
};

// ===== Date Utility Functions =====

/**
 * Parse a date string in the specified format
 * @param {string} dateStr - Date string to parse
 * @param {string} format - Format of the date string ('MM-DD-YY' or 'DD-MM-YY')
 * @returns {Date|null} - Parsed date or null if invalid
 */
const parseDate = (dateStr, format) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  
  let day, month, year;
  
  if (format === DATE_FORMATS.SCHEDULE) {
    // MM-DD-YY format
    month = parseInt(parts[0], 10);
    day = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  } else if (format === DATE_FORMATS.LAST_SERVE) {
    // DD-MM-YY format
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  } else {
    return null;
  }
  
  // Validate parsed values
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  
  // Convert 2-digit year to 4-digit year (assume 2000s)
  const fullYear = year < 100 ? 2000 + year : year;
  
  // Create and validate date
  const date = new Date(fullYear, month - 1, day);
  
  // Check if date is valid (handles cases like Feb 31)
  if (date.getFullYear() !== fullYear || 
      date.getMonth() !== month - 1 || 
      date.getDate() !== day) {
    return null;
  }
  
  return date;
};

/**
 * Format a Date object to the specified string format
 * @param {Date} date - Date to format
 * @param {string} format - Target format ('MM-DD-YY' or 'DD-MM-YY')
 * @returns {string} - Formatted date string
 */
const formatDate = (date, format = DATE_FORMATS.SCHEDULE) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  
  if (format === DATE_FORMATS.SCHEDULE) {
    return `${month}-${day}-${year}`;
  } else if (format === DATE_FORMATS.LAST_SERVE) {
    return `${day}-${month}-${year}`;
  }
  
  return '';
};

/**
 * Get the start of the week (Sunday) for a given date
 * @param {Date} date - Input date
 * @returns {Date} - Sunday of that week
 */
const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
};

/**
 * Generate an array of week dates starting from a given date
 * @param {Date} startDate - Starting date
 * @param {number} count - Number of weeks to generate
 * @returns {string[]} - Array of formatted week dates
 */
const generateWeeks = (startDate, count = 5) => {
  const weeks = [];
  const weekStart = getWeekStart(startDate);
  
  for (let i = 0; i < count; i++) {
    const weekDate = new Date(weekStart);
    weekDate.setDate(weekStart.getDate() + (i * 7));
    weeks.push(formatDate(weekDate, DATE_FORMATS.SCHEDULE));
  }
  
  return weeks;
};

/**
 * Calculate the number of weeks between two dates
 * @param {string} lastServeStr - Last serve date in DD-MM-YY format
 * @param {string} targetWeekStr - Target week date in MM-DD-YY format
 * @returns {number|null} - Number of weeks between dates
 */
const calculateWeeksBetween = (lastServeStr, targetWeekStr) => {
  if (!lastServeStr || !targetWeekStr) return null;
  
  const lastServeDate = parseDate(lastServeStr, DATE_FORMATS.LAST_SERVE);
  const targetDate = parseDate(targetWeekStr, DATE_FORMATS.SCHEDULE);
  
  if (!lastServeDate || !targetDate) return null;
  
  // Calculate difference in milliseconds
  const diffMs = targetDate.getTime() - lastServeDate.getTime();
  
  // Convert to days and then weeks
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  
  return diffWeeks;
};

/**
 * Get display color based on weeks since last served
 * @param {number|null} weeks - Number of weeks
 * @returns {string} - Hex color code
 */
const getColorForWeeks = (weeks) => {
  if (weeks === null || weeks === undefined) return '#666';
  
  // Future service (negative weeks)
  if (weeks < 0) return '#666';
  
  // Color gradient from red (recent) to green (long ago)
  const colorStops = [
    { weeks: 0, color: '#ff3b30' },  // Red - serving this week
    { weeks: 1, color: '#ff3b30' },  // Red - very recent
    { weeks: 2, color: '#ff6b30' },  // Orange-red
    { weeks: 3, color: '#ff9500' },  // Orange
    { weeks: 4, color: '#ffcc00' },  // Yellow-orange
    { weeks: 6, color: '#c7dc00' },  // Yellow-green
    { weeks: 8, color: '#76d600' },  // Light green
    { weeks: Infinity, color: '#34c759' } // Green - 9+ weeks
  ];
  
  for (const stop of colorStops) {
    if (weeks <= stop.weeks) {
      return stop.color;
    }
  }
  
  return '#34c759'; // Default green
};

/**
 * Get human-readable text for weeks since last served
 * @param {number|null} weeks - Number of weeks
 * @returns {string} - Display text
 */
const getWeeksDisplayText = (weeks) => {
  if (weeks === null) return 'No data';
  if (weeks < 0) return `Will serve in ${Math.abs(weeks)} week${Math.abs(weeks) === 1 ? '' : 's'}`;
  if (weeks === 0) return 'Serving this week';
  if (weeks === 1) return 'Served 1 week ago';
  return `Served ${weeks} weeks ago`;
};

/**
 * Format week display for UI
 * @param {string} weekStr - Week string in MM-DD-YY format
 * @returns {string} - Formatted display string
 */
const formatWeekDisplay = (weekStr) => {
  if (!weekStr) return "Select Week";
  const date = parseDate(weekStr, DATE_FORMATS.SCHEDULE);
  if (!date) return "Invalid Date";
  
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// ===== Main Component =====

const EditSchedule = () => {
  const user = auth().currentUser;

  // DISABLE ALL CACHING - GO BACK TO ORIGINAL APPROACH TO STOP OVERHEATING
  // No cached hooks - using direct Firebase calls only

  // State
  const [churchId, setChurchId] = useState(null);
  const [week, setWeek] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [showWeekSelector, setShowWeekSelector] = useState(false);
  const [servers, setServers] = useState([]);
  const [assignedReaders, setAssignedReaders] = useState({});
  const [assignedServers, setAssignedServers] = useState({});
  const [altarServers, setAltarServers] = useState([]);
  const [currentReaders, setCurrentReaders] = useState({});
  const [availableServers, setAvailableServers] = useState([]);
  const [serverDropdownIndex, setServerDropdownIndex] = useState(null);
  const [readerDropdownIndex, setReaderDropdownIndex] = useState(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [imageUrls, setImageUrls] = useState({});
  const [altarServersCount, setAltarServersCount] = useState(0);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [lastServeData, setLastServeData] = useState({});
  const [userListeners, setUserListeners] = useState([]);
  
  const scrollViewRef = useRef(null);

  // ===== Effects =====

  // Fetch user's church ID (ORIGINAL APPROACH)
  useEffect(() => {
    const unsubscribeUser = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        (doc) => {
          if (doc.exists) {
            const userData = doc.data();
            if (userData?.church && userData.church !== churchId) {
              setChurchId(userData.church);
            }
          }
        },
        (error) => {
          console.error("Error fetching user data:", error);
        }
      );
    return () => unsubscribeUser();
  }, [user.uid, churchId]);

  // Fetch church data (altar servers count) (ORIGINAL APPROACH)
  useEffect(() => {
    if (churchId) {
      const unsubscribeChurch = firestore()
        .collection("churches")
        .doc(churchId)
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              const churchData = doc.data();
              setAltarServersCount(churchData?.altarServers || 0);
            }
          },
          (error) => {
            console.error("Error fetching church data:", error);
          }
        );
      return () => unsubscribeChurch();
    }
  }, [churchId]);

  // Fetch earliest schedule and generate weeks (with lazy caching)
  useEffect(() => {
    if (!churchId) return;

    const fetchEarliestSchedule = async () => {
      try {
        // First, try to get from cache for instant loading
        const cacheKey = `${churchId}_schedule_list`;
        let cachedSchedules = null;
        
        try {
          // Attempt to get cached schedule list (non-blocking)
          const cachedData = await FirestoreCache.getCollection(
            `churches/${churchId}/schedule`, 
            {}, 
            { forceRefresh: false }
          );
          if (cachedData && cachedData.length > 0) {
            cachedSchedules = cachedData;
          }
        } catch (cacheError) {
          // Cache failed, continue with direct fetch
        }

        // Always fetch fresh data in parallel (for real-time updates)
        const schedulesRef = firestore()
          .collection("churches")
          .doc(churchId)
          .collection("schedule");

        const snapshot = await schedulesRef.get();

        if (snapshot.empty) {
          // No schedules exist, start from next Sunday
          const today = new Date();
          const nextSunday = getWeekStart(today);
          if (nextSunday <= today) {
            nextSunday.setDate(nextSunday.getDate() + 7);
          }
          
          const weeks = generateWeeks(nextSunday, 5);
          setAvailableWeeks(weeks);
          return;
        }

        // Find the earliest Sunday from existing schedules
        const scheduleDates = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            date: parseDate(doc.id, DATE_FORMATS.SCHEDULE)
          }))
          .filter((item) => item.date !== null)
          .sort((a, b) => a.date - b.date);

        if (scheduleDates.length === 0) {
          // Invalid schedule dates, fallback to next Sunday
          const today = new Date();
          const nextSunday = getWeekStart(today);
          if (nextSunday <= today) {
            nextSunday.setDate(nextSunday.getDate() + 7);
          }
          
          const weeks = generateWeeks(nextSunday, 5);
          setAvailableWeeks(weeks);
          return;
        }

        // Find the first Sunday or generate from the earliest date
        let earliestSunday = scheduleDates.find(d => d.date.getDay() === 0)?.date;
        
        if (!earliestSunday) {
          // No Sunday found, get the Sunday of the week containing the earliest date
          earliestSunday = getWeekStart(scheduleDates[0].date);
        }

        const weeks = generateWeeks(earliestSunday, 5);
        setAvailableWeeks(weeks);
        
        // Background caching: Cache the schedule data (non-blocking)
        setTimeout(async () => {
          try {
            await FirestoreCache.getCollection(
              `churches/${churchId}/schedule`,
              {},
              { forceRefresh: true } // Update cache with fresh data
            );
          } catch (error) {
            // Ignore cache errors - don't affect UI
          }
        }, 100);
        
      } catch (error) {
        console.error("Error fetching schedules:", error);
        // Fallback to next Sunday
        const today = new Date();
        const nextSunday = getWeekStart(today);
        if (nextSunday <= today) {
          nextSunday.setDate(nextSunday.getDate() + 7);
        }
        
        const weeks = generateWeeks(nextSunday, 5);
        setAvailableWeeks(weeks);
      }
    };

    fetchEarliestSchedule();
  }, [churchId]);

  // Set initial week
  useEffect(() => {
    if (availableWeeks.length > 0 && !selectedWeek) {
      setSelectedWeek(availableWeeks[0]);
    }
  }, [availableWeeks, selectedWeek]);

  // Query schedule and set up user listeners
  useEffect(() => {
    if (!churchId || !selectedWeek) return;

    const schedulesRef = firestore()
      .collection("churches")
      .doc(churchId)
      .collection("schedule");

    const unsubscribe = schedulesRef.onSnapshot((snapshot) => {
      const scheduleDoc = snapshot.docs.find(
        (doc) => doc.id === selectedWeek
      );

      if (scheduleDoc) {
        setWeek(selectedWeek);
        const scheduleData = scheduleDoc.data();

        // Process readers
        const readersObj = {};
        const readersDisplay = {};
        readings.forEach((reading) => {
          const reader = scheduleData[reading];
          readersObj[reading] = reader;
          readersDisplay[displayNames[reading]] =
            reader?.name || "Select Reader";
        });
        setCurrentReaders(readersObj);
        setAssignedReaders(readersDisplay);

        // Process altar servers
        const fetchedAltarServers = scheduleData.altar || [];
        setAltarServers(fetchedAltarServers);
        const initialServerAssignments = {};
        fetchedAltarServers.forEach((server, index) => {
          initialServerAssignments[index] = server.name;
        });
        setAssignedServers(initialServerAssignments);
        setServers(
          fetchedAltarServers.map((_, index) => `Altar Server ${index + 1}`)
        );

        // Process available servers
        const extraServers = scheduleData.extra || [];
        const filteredExtraServers = extraServers
          .filter((server) => server.name !== "N/A" && server.uid)
          .sort((a, b) => {
            const nameA = a.name.split(" ")[0].toLowerCase();
            const nameB = b.name.split(" ")[0].toLowerCase();
            return nameA.localeCompare(nameB);
          });
        setAvailableServers(filteredExtraServers);

        // Set up realtime listeners for user data
        setupUserListeners(filteredExtraServers);
      } else {
        // No schedule exists for this week
        resetScheduleData();
      }
    });

    return () => {
      unsubscribe();
      cleanupUserListeners();
    };
  }, [churchId, selectedWeek]);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      cleanupUserListeners();
    };
  }, []);

  // ===== Helper Functions =====

  const setupUserListeners = (servers) => {
    // Clean up any existing listeners
    cleanupUserListeners();
    
    const newListeners = [];
    
    servers.forEach((server) => {
      // Fetch profile picture with lazy caching
      const storagePath = `profilePictures/${server.uid}.png`;
      
      // Background caching: Try cache first, then fetch if needed
      setTimeout(async () => {
        try {
          const cachedUrl = await StorageCache.getDownloadURL(storagePath);
          setImageUrls((prev) => ({ ...prev, [server.uid]: cachedUrl }));
        } catch (error) {
          // Cache failed, try direct fetch
          storage()
            .ref(storagePath)
            .getDownloadURL()
            .then((url) => {
              setImageUrls((prev) => ({ ...prev, [server.uid]: url }));
              // Store in cache for next time (background)
              setTimeout(() => {
                StorageCache.getDownloadURL(storagePath, { forceRefresh: true }).catch(() => {});
              }, 100);
            })
            .catch(() => {
              // Silent fail - use default image
            });
        }
      }, server === servers[0] ? 0 : Math.random() * 500); // Stagger requests to avoid overload
      
      // Set up realtime listener for user's lastServe
      const unsubscribe = firestore()
        .collection("users")
        .doc(server.uid)
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              const userData = doc.data();
              if (userData.lastServe) {
                setLastServeData((prev) => ({
                  ...prev,
                  [server.uid]: userData.lastServe,
                }));
              } else {
                // Remove from lastServeData if no longer has lastServe
                setLastServeData((prev) => {
                  const newData = { ...prev };
                  delete newData[server.uid];
                  return newData;
                });
              }
            }
          },
          (error) => {
            console.error("Error listening to user:", server.uid, error);
          }
        );
      
      newListeners.push(unsubscribe);
    });
    
    setUserListeners(newListeners);
  };

  const cleanupUserListeners = () => {
    userListeners.forEach((unsubscribe) => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    });
    setUserListeners([]);
  };

  const resetScheduleData = () => {
    setWeek(selectedWeek);
    setCurrentReaders({});
    setAssignedReaders({});
    setAltarServers([]);
    setAssignedServers({});
    setServers([]);
    setAvailableServers([]);
    setImageUrls({});
    setLastServeData({});
    cleanupUserListeners();
  };

  // ===== Event Handlers =====

  const handleWeekSelect = (week) => {
    setSelectedWeek(week);
    setShowWeekSelector(false);
  };

  const openProfile = (userId) => {
    if (!userId) return;
    setSelectedUserId(userId);
    setProfileModalVisible(true);
  };

  const closeProfile = () => {
    setSelectedUserId(null);
    setProfileModalVisible(false);
  };

  const assignReader = async (index, newReader) => {
    if (!week) return;
    
    const readingKey = readings[index];
    const oldReader = currentReaders[readingKey];
    if (!oldReader || !oldReader.uid) return;
    
    try {
      await switchServersAPI(
        user,
        churchId,
        week,
        oldReader.uid,
        newReader.uid,
        "https://switch-server-hy6oofbihq-uc.a.run.app"
      );
    } catch (error) {
      console.error("Error assigning reader:", error);
    }
    setReaderDropdownIndex(null);
  };

  const assignServer = async (index, newServer) => {
    if (!week) return;
    
    const oldServer = altarServers[index];
    if (!oldServer || !oldServer.uid) return;
    
    try {
      await switchServersAPI(
        user,
        churchId,
        week,
        oldServer.uid,
        newServer.uid,
        "https://switch-server-hy6oofbihq-uc.a.run.app"
      );
    } catch (error) {
      console.error("Error assigning server:", error);
    }
    setServerDropdownIndex(null);
  };

  const handleAddServer = async () => {
    if (!churchId || !week || servers.length >= 6) return;
    
    try {
      await addServerAPI(
        user,
        churchId,
        week,
        "https://add-server-hy6oofbihq-uc.a.run.app"
      );
      
      const churchRef = firestore().collection("churches").doc(churchId);
      await churchRef.update({
        altarServers: FieldValue.increment(1),
      });
      
      scrollViewRef.current?.scrollToEnd({ animated: false });
    } catch (error) {
      console.error("Error adding server:", error);
    }
  };

  const removeServerFromSchedule = async (index) => {
    if (!churchId || !week) return;
    
    const serverToRemove = altarServers[index];
    if (!serverToRemove || !serverToRemove.uid) return;
    
    try {
      await removeServerAPI(
        user,
        churchId,
        week,
        serverToRemove.uid,
        "https://remove-server-hy6oofbihq-uc.a.run.app"
      );
      
      const churchRef = firestore().collection("churches").doc(churchId);
      await churchRef.update({
        altarServers: FieldValue.increment(-1),
      });
    } catch (error) {
      console.error("Error removing server:", error);
    }
  };

  // ===== Render Functions =====

  const renderServerItem = ({ item }) => {
    const weeksSince = calculateWeeksBetween(lastServeData[item.uid], selectedWeek);
    const indicatorColor = getColorForWeeks(weeksSince);
    const displayText = getWeeksDisplayText(weeksSince);
    
    return (
      <TouchableOpacity
        style={styles.modalItemContainer}
        onPress={() => assignServer(serverDropdownIndex, item)}
        activeOpacity={0.7}
      >
        <View style={styles.modalItemContent}>
          <View style={styles.profilePicContainer}>
            <Image
              source={
                imageUrls[item.uid]
                  ? { uri: imageUrls[item.uid] }
                  : require("../assets/default_profile.png")
              }
              style={styles.profilePic}
              defaultSource={require("../assets/default_profile.png")}
            />
            <View style={[styles.statusIndicator, { backgroundColor: indicatorColor }]} />
          </View>
          <View style={styles.serverInfo}>
            <Text style={styles.modalItem}>{item.name}</Text>
            <Text style={[styles.lastServeText, { color: indicatorColor }]}>
              {displayText}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderReaderItem = ({ item }) => {
    const weeksSince = calculateWeeksBetween(lastServeData[item.uid], selectedWeek);
    const indicatorColor = getColorForWeeks(weeksSince);
    const displayText = getWeeksDisplayText(weeksSince);
    
    return (
      <TouchableOpacity
        style={styles.modalItemContainer}
        onPress={() => assignReader(readerDropdownIndex, item)}
        activeOpacity={0.7}
      >
        <View style={styles.modalItemContent}>
          <View style={styles.profilePicContainer}>
            <Image
              source={
                imageUrls[item.uid]
                  ? { uri: imageUrls[item.uid] }
                  : require("../assets/default_profile.png")
              }
              style={styles.profilePic}
              defaultSource={require("../assets/default_profile.png")}
            />
            <View style={[styles.statusIndicator, { backgroundColor: indicatorColor }]} />
          </View>
          <View style={styles.serverInfo}>
            <Text style={styles.modalItem}>{item.name}</Text>
            <Text style={[styles.lastServeText, { color: indicatorColor }]}>
              {displayText}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ===== Main Render =====

  // Removed cached loading states - using original approach

  return (
    <View style={styles.container}>
      {/* Week Selector Header */}
      {availableWeeks.length > 0 && (
        <View style={styles.headerContainer}>
          <TouchableOpacity
            style={styles.weekSelector}
            onPress={() => setShowWeekSelector(true)}
            activeOpacity={0.8}
          >
            <View style={styles.weekSelectorContent}>
              <Text style={styles.weekLabel}>Week of</Text>
              <Text style={styles.weekSelectorText}>
                {formatWeekDisplay(selectedWeek)}
              </Text>
            </View>
            <View style={styles.weekSelectorIconContainer}>
              <Text style={styles.weekSelectorIcon}>▼</Text>
            </View>
          </TouchableOpacity>
          
          {/* Removed refresh button */}
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 90 }}
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
      >
        {/* Readers Section */}
        <View style={{ marginBottom: 10, marginTop: 10 }}>
          <Text style={styles.sectionHeader}>Assign Readers</Text>
        </View>
        {readings.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.listItem}
            onPress={() => openProfile(currentReaders[item]?.uid)}
            disabled={!currentReaders[item]?.uid}
            activeOpacity={1}
          >
            <View style={styles.listItemContent}>
              <Text
                style={[
                  styles.itemText,
                  !currentReaders[item]?.uid && styles.disabledText,
                ]}
              >
                {displayNames[item]}
              </Text>
              <View style={styles.dropdownContainer}>
                <TouchableOpacity
                  style={styles.dropdown}
                  onPress={() => setReaderDropdownIndex(index)}
                >
                  <Text style={styles.dropdownText}>
                    {assignedReaders[displayNames[item]] || "Select Reader"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {/* Altar Servers Section */}
        <View style={styles.sectionHeaderContainer}>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Text style={styles.sectionHeader}>Altar Servers</Text>
            <View style={styles.serverInfoContainer}>
              <Text style={styles.serverCountText}>
                {altarServersCount} additional servers
              </Text>
              <TouchableOpacity
                onPress={() => setShowInfoModal(true)}
                style={styles.infoButton}
              >
                <Text style={styles.infoIcon}>ⓘ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        {servers.map((_, index) => (
          <TouchableOpacity
            key={index}
            style={styles.listItem}
            onPress={() => openProfile(altarServers[index]?.uid)}
            disabled={!altarServers[index]?.uid}
            activeOpacity={1}
          >
            <View style={styles.listItemContent}>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setServerDropdownIndex(index)}
              >
                <Text
                  style={[
                    styles.dropdownText,
                    !altarServers[index]?.uid && styles.disabledText,
                  ]}
                >
                  {assignedServers[index] || "Select Server"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeServerFromSchedule(index)}>
                <Text style={styles.removeButton}>Remove</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Add Server Button */}
      <TouchableOpacity style={styles.addButton} onPress={handleAddServer}>
        <Text style={styles.addButtonText}>Add Server</Text>
      </TouchableOpacity>

      {/* Server Selection Modal */}
      <Modal
        visible={serverDropdownIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setServerDropdownIndex(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setServerDropdownIndex(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalWrapper}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Server</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setServerDropdownIndex(null)}
                >
                  <Text style={styles.modalCloseX}>×</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={availableServers}
                keyExtractor={(item) => item.uid}
                showsVerticalScrollIndicator={false}
                renderItem={renderServerItem}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Reader Selection Modal */}
      <Modal
        visible={readerDropdownIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setReaderDropdownIndex(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setReaderDropdownIndex(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalWrapper}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Reader</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setReaderDropdownIndex(null)}
                >
                  <Text style={styles.modalCloseX}>×</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={availableServers}
                keyExtractor={(item) => item.uid}
                showsVerticalScrollIndicator={false}
                renderItem={renderReaderItem}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Week Selection Modal */}
      <Modal
        visible={showWeekSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWeekSelector(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowWeekSelector(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalWrapper}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Week</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowWeekSelector(false)}
                >
                  <Text style={styles.modalCloseX}>×</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={availableWeeks}
                keyExtractor={(item) => item}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.modalItemContainer,
                      selectedWeek === item && styles.selectedWeekItem,
                    ]}
                    onPress={() => handleWeekSelect(item)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.modalItem,
                        selectedWeek === item && styles.selectedWeekText,
                      ]}
                    >
                      {formatWeekDisplay(item)}
                    </Text>
                    {selectedWeek === item && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Info Modal */}
      <Modal
        visible={showInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfoModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowInfoModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.infoModalWrapper}>
            <View style={styles.infoModalContent}>
              <View style={styles.infoModalHeader}>
                <Text style={styles.infoModalTitle}>Additional Servers</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowInfoModal(false)}
                >
                  <Text style={styles.modalCloseX}>×</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.infoModalText}>
                When you add or remove altar servers, the change automatically
                applies to all future weeks to maintain consistency across your
                church's schedule.
                {"\n\n"}
                This ensures that the same number of server positions are
                available each week, making it easier to plan and assign servers
                for upcoming services.
              </Text>
              <TouchableOpacity
                style={styles.infoModalButton}
                onPress={() => setShowInfoModal(false)}
              >
                <Text style={styles.infoModalButtonText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Individual Profile Modal */}
      <IndividualProfile
        userId={selectedUserId}
        show={profileModalVisible}
        onClose={closeProfile}
        church={churchId}
        week={selectedWeek}
        currentEditingWeek={selectedWeek}
        family={null}
        url="https://unavailable-for-week-hy6oofbihq-uc.a.run.app"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
  },
  headerContainer: {
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  scrollView: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: 20,
    color: "#4d9cff",
    fontWeight: "bold",
  },
  sectionHeaderContainer: {
    marginBottom: 10,
    marginTop: 10,
  },
  serverInfoContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginLeft: 12,
  },
  serverCountText: {
    fontSize: 13,
    color: "#999",
    fontStyle: "italic",
  },
  infoButton: {
    padding: 2,
    marginLeft: 4,
  },
  infoIcon: {
    fontSize: 14,
    color: "#147efb",
    fontWeight: "bold",
  },
  listItem: {
    backgroundColor: "#1e1e1e",
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  listItemContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemText: {
    color: "#bbb",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledText: {
    color: "#666",
  },
  dropdownContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  dropdown: {
    backgroundColor: "#333",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignSelf: "flex-start",
  },
  dropdownText: {
    color: "#fff",
    fontSize: 16,
  },
  removeButton: {
    color: "#ff3b30",
    fontSize: 16,
  },
  addButton: {
    backgroundColor: "#147efb",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
  },
  addButtonText: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "bold",
  },
  weekSelector: {
    backgroundColor: "#1e1e1e",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#333",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  weekSelectorContent: {
    flex: 1,
  },
  weekLabel: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  weekSelectorText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  weekSelectorIconContainer: {
    backgroundColor: "#2a2a2a",
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  weekSelectorIcon: {
    color: "#147efb",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalWrapper: {
    width: "90%",
    maxHeight: "70%",
  },
  modalContent: {
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
    backgroundColor: "#252525",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseX: {
    color: "#999",
    fontSize: 24,
    fontWeight: "300",
  },
  modalItemContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  modalItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  profilePicContainer: {
    position: "relative",
  },
  profilePic: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#2a2a2a",
    backgroundColor: "#2a2a2a",
  },
  statusIndicator: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#1e1e1e",
  },
  serverInfo: {
    marginLeft: 14,
    flex: 1,
  },
  modalItem: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  lastServeText: {
    fontSize: 13,
    marginTop: 3,
    fontWeight: "500",
  },
  separator: {
    height: 1,
    backgroundColor: "#2a2a2a",
    marginHorizontal: 20,
  },
  checkmark: {
    color: "#147efb",
    fontSize: 18,
    fontWeight: "bold",
  },
  selectedWeekItem: {
    backgroundColor: "rgba(20, 126, 251, 0.1)",
  },
  selectedWeekText: {
    color: "#147efb",
    fontWeight: "700",
  },
  closeButton: {
    color: "#ff3b30",
    fontSize: 18,
    textAlign: "center",
    marginTop: 10,
  },
  infoModalWrapper: {
    width: "85%",
    maxWidth: 400,
  },
  infoModalContent: {
    backgroundColor: "#1e1e1e",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  infoModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#2a2a2a",
    backgroundColor: "#252525",
  },
  infoModalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  infoModalText: {
    color: "#ddd",
    fontSize: 16,
    lineHeight: 24,
    padding: 20,
  },
  infoModalButton: {
    backgroundColor: "#147efb",
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  infoModalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default EditSchedule;