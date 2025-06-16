import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Image,
  SectionList,
  Dimensions,
  Platform,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import * as Haptics from "react-native-haptic-feedback";
import storage from "@react-native-firebase/storage";

// Responsive design helper (for section headers, index bar, and list padding)
const { width, height } = Dimensions.get('window');
const isTablet = Platform.isPad || (width >= 768 && height >= 768);
const scale = isTablet ? 1.2 : 1;
const paddingHorizontal = isTablet ? 32 : 16;
const indexBarWidth = isTablet ? 32 : 24;

const ServantsAttendance = ({ navigation }) => {
  const user = auth().currentUser;
  const [servants, setServants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [sections, setSections] = useState([]);
  const [availableLetters, setAvailableLetters] = useState([]);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerHeightRef = useRef(0);
  const sectionListRef = useRef(null);

  useEffect(() => {
    const unsubscribeUserData = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot((userDoc) => {
        if (userDoc.exists) {
          setUserData(userDoc.data());
        } else {
          Alert.alert("Error", "User not found.");
        }
      });

    return () => unsubscribeUserData();
  }, [user.uid]);

  useEffect(() => {
    if (!userData) return;

    const fetchProfilePictures = async (servantList) => {
      const urls = {};
      await Promise.all(
        servantList.map(async (servant) => {
          try {
            const url = await storage()
              .ref(`profilePictures/${servant.uid}.png`)
              .getDownloadURL();
            urls[servant.uid] = typeof url === 'string' && url.trim() ? url : null;
          } catch (error) {
            console.warn(`Failed to fetch profile picture for ${servant.uid}:`, error);
            urls[servant.uid] = null;
          }
        })
      );
      setProfilePictureUrls(urls);
    };

    const servantsMeetingRef = firestore()
      .collection("churches")
      .doc(userData.church)
      .collection("Servants Meeting");

    const unsubscribeServants = servantsMeetingRef.onSnapshot(async (snapshot) => {
      let servantsData = snapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      }));

      // Sort servants alphabetically
      servantsData.sort((a, b) => a.name.localeCompare(b.name));

      const dateKey = getNextSunday();
      const servantsWithAttendance = await Promise.all(
        servantsData.map(async (servant) => {
          const attendanceDoc = await firestore()
            .collection("churches")
            .doc(userData.church)
            .collection("Servants Meeting")
            .doc(servant.uid)
            .get();

          const attendanceStatus = attendanceDoc.exists
            ? attendanceDoc.data()[dateKey]
            : null;

          return {
            ...servant,
            attendance: attendanceStatus,
          };
        })
      );

      // Fetch profile pictures
      fetchProfilePictures(servantsWithAttendance);

      // Group servants by first letter
      const grouped = servantsWithAttendance.reduce((acc, servant) => {
        const firstLetter = servant.name.charAt(0).toUpperCase() || 'Other';
        if (!acc[firstLetter]) acc[firstLetter] = [];
        acc[firstLetter].push(servant);
        return acc;
      }, {});

      // Convert to SectionList format
      const sectionData = Object.keys(grouped)
        .sort()
        .map((letter) => ({
          title: letter,
          data: grouped[letter],
        }));

      setServants(servantsWithAttendance);
      setSections(sectionData);
      setAvailableLetters(Object.keys(grouped).sort());
      setLoading(false);
    });

    return () => unsubscribeServants();
  }, [userData]);

  const scrollToSection = (letter) => {
    const sectionIndex = sections.findIndex((s) => s.title === letter);
    if (sectionIndex < 0 || !sectionListRef.current) return;

    sectionListRef.current.scrollToLocation({
      sectionIndex,
      itemIndex: 1,
      animated: false,
      viewPosition: 0,
      viewOffset: headerHeight,
    });
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

  const handleAttendance = (servantID, status) => {
    Haptics.trigger("impactLight");
    const dateKey = getNextSunday();
    
    firestore()
      .collection("churches")
      .doc(userData.church)
      .collection("Servants Meeting")
      .doc(servantID)
      .update({
        [dateKey]: status,
      })
      .then(() => {
        setServants((prev) =>
          prev.map((servant) =>
            servant.uid === servantID
              ? { ...servant, attendance: status }
              : servant
          )
        );
      });
  };

  const renderServant = ({ item: servant }) => (
    <View style={styles.servantCard}>
      <View style={styles.servantInfo}>
        <View style={styles.servantImageContainer}>
          <Image
            style={styles.servantImage}
            source={
              profilePictureUrls[servant.uid]
                ? { uri: profilePictureUrls[servant.uid] }
                : require("../../assets/default_profile.png")
            }
            defaultSource={require("../../assets/default_profile.png")}
            onError={() => {
              setProfilePictureUrls(prev => ({
                ...prev,
                [servant.uid]: null
              }));
            }}
          />
        </View>
        <View style={styles.servantDetails}>
          <View style={styles.studentHeader}>
            <Text style={styles.studentName}>{servant.name}</Text>
            <TouchableOpacity
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              onPress={() =>
                navigation.navigate("IndividualServant", {
                  church: userData.church,
                  servantID: servant.uid,
                })
              }
            >
              <Image
                source={require("../../assets/vector.png")}
                style={styles.icon}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.attendanceButtons}>
            <TouchableOpacity
              style={[
                styles.attendanceButton,
                servant.attendance === false && styles.absentSelected,
              ]}
              onPress={() => handleAttendance(servant.uid, false)}
            >
              <Text style={styles.attendanceButtonText}>Absent</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.attendanceButton,
                servant.attendance === true && styles.presentSelected,
              ]}
              onPress={() => handleAttendance(servant.uid, true)}
            >
              <Text style={styles.attendanceButtonText}>Present</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  const renderSectionHeader = ({ section: { title } }) => (
    <View
      style={styles.sectionHeader}
      onLayout={(event) => {
        const { height } = event.nativeEvent.layout;
        if (height > 0 && headerHeightRef.current !== height) {
          headerHeightRef.current = height;
          setHeaderHeight(height);
        }
      }}
    >
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>
        Attendance for the week of {getNextSunday()}
      </Text>

      <View style={styles.listWrapper}>
        <SectionList
          ref={sectionListRef}
          sections={sections}
          renderItem={renderServant}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.noStudentsText}>Church has no servants</Text>
          }
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={true}
        />
        <View style={[styles.indexBar, { width: indexBarWidth }]}>
          {availableLetters.map((letter) => (
            <View
              key={letter}
              style={styles.indexItem}
              onTouchStart={() => {
                scrollToSection(letter);
                Haptics.trigger("impactLight");
              }}
            >
              <Text style={[styles.indexText, { fontSize: 18 * scale }]}>{letter}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#121212" },
  headerText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 30,
  },
  listWrapper: {
    flex: 1,
    flexDirection: "row",
    paddingRight: 0,
  },
  listContainer: {
    flexGrow: 1,
    paddingRight: indexBarWidth,
  },
  servantCard: {
    backgroundColor: "#1E1E1E",
    borderRadius: 12,
    padding: 16,
    paddingRight: 24,
    marginBottom: 15,
    marginRight: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  servantInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  servantImageContainer: {
    marginRight: 12,
  },
  servantImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#333333",
  },
  servantDetails: {
    flex: 1,
  },
  studentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  studentName: { 
    fontSize: 18, 
    fontWeight: "600", 
    color: "#FFFFFF" 
  },
  icon: { width: 8, height: 15 },
  attendanceButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  attendanceButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
    marginHorizontal: 5,
    backgroundColor: "#444",
  },
  presentSelected: { backgroundColor: "#147efb" },
  absentSelected: { backgroundColor: "#D32F2F" },
  attendanceButtonText: { 
    fontSize: 16, 
    fontWeight: "bold", 
    color: "#FFFFFF" 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    color: "#fff",
    marginTop: 10,
  },
  noStudentsText: {
    fontSize: 18,
    color: "#fff",
    textAlign: "center",
    marginTop: 20,
  },
  sectionHeader: {
    backgroundColor: "transparent",
    paddingVertical: 8 * scale,
    paddingHorizontal: 12 * scale,
  },
  sectionHeaderText: {
    fontSize: 18 * scale,
    fontWeight: "600",
    color: "#fff",
  },
  indexBar: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
  },
  indexItem: {
    paddingVertical: 2 * scale,
    backgroundColor: "#121212",
    borderRadius: 4,
    marginVertical: 2 * scale,
  },
  indexText: {
    color: "#147efb",
    fontWeight: "600",
  },
});

export default ServantsAttendance;