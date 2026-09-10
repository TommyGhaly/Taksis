import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { deleteDoc, doc, getFirestore, onSnapshot } from "@react-native-firebase/firestore";
import BackArrow from "../../components/backArrow";
import Avatar from "../../components/Avatar";
import SkeletonScreen from "../../components/Skeleton";
import * as avatarCache from "../../utils/avatarCache";
import { LIST_PERF } from "../../utils/listConfig";
import { isAttendanceDateKey, dateKeyToSortable } from "../../utils/dateKeys";

// Hoisted out of the render body — these never change for the life of the screen.
const SCREEN_WIDTH = Dimensions.get("window").width;
const IS_TABLET = SCREEN_WIDTH >= 768;
const CONTAINER_WIDTH = IS_TABLET
  ? { maxWidth: 600, alignSelf: "center", width: "100%" }
  : { width: "100%" };

// Hoisted: this was rebuilt inside getServantGrades on every render.
const GRADE_LABELS = {
  preSchoolAge3: "Pre-School Age 3",
  preSchoolAge4: "Pre-School Age 4",
  kindergarten: "Kindergarten",
  1: "1st Grade",
  2: "2nd Grade",
  3: "3rd Grade",
  4: "4th Grade",
  5: "5th Grade",
  6: "6th Grade",
  7: "7th Grade",
  8: "8th Grade",
  9: "9th Grade",
  10: "10th Grade",
  11: "11th Grade",
  12: "12th Grade",
  college: "College",
};

/**
 * One attendance record. Memoized for the same reason as its sibling in
 * screens/AdminScreens/IndividualAttendance.js — see the note there.
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

const ServantAttendance = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { church, servantId } = route.params;
  const [servantData, setServantData] = useState({});
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  useFocusEffect(
    useCallback(() => {
      isMounted.current = true;

      // Reset state when screen is focused
      setServantData({});
      setLoading(true);

      const fetchData = () => {
        if (!servantId) {
          Alert.alert("Error", "Servant ID is missing.");
          navigation.goBack();
          return () => {};
        }

        const servantRef = doc(
          getFirestore(),
          "churches",
          church,
          "Sunday School",
          "Servants",
          "Servants",
          servantId
        );

        // Set up real-time listener for servant data
        const unsubscribe = onSnapshot(
          servantRef,
          async (doc) => {
            if (!isMounted.current) return;
            try {
              if (doc.exists) {
                const data = doc.data();
                // Free: the doc is already here, so adopt its photoURL rather
                // than paying for a Storage round-trip on every snapshot.
                avatarCache.primeFromUser({ uid: servantId, ...data });
                setServantData(data);
              } else {
                navigation.goBack();
              }

              setLoading(false);
            } catch (error) {
              if (isMounted.current) {
                Alert.alert("Error", "Failed to load servant data.");
                setLoading(false);
              }
            }
          },
          (error) => {
            if (isMounted.current) {
              Alert.alert("Error", "Failed to load servant data.");
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
    }, [church, servantId, navigation])
  );

  /**
   * Attendance rows, newest first.
   *
   * The date-shape test is the whole filter now — the `excludeFields` list it used
   * to be paired with was redundant, since none of those names can match
   * MM-DD-YYYY. Sorting is on an integer key rather than two Dates per comparison.
   */
  const attendanceDataMemo = React.useMemo(() => {
    if (!servantData || Object.keys(servantData).length === 0) return [];
    const attendance = [];
    for (const [key, value] of Object.entries(servantData)) {
      if (isAttendanceDateKey(key)) {
        attendance.push({ date: key, status: value, sortKey: dateKeyToSortable(key) });
      }
    }
    return attendance.sort((a, b) => b.sortKey - a.sortKey);
  }, [servantData]);

  /**
   * Grades the servant teaches.
   *
   * Was a plain function called directly from the JSX, so every render rebuilt a
   * 16-entry object and ran Object.entries().forEach over it.
   */
  const servantGrades = React.useMemo(() => {
    if (!servantData) return "";
    const grades = [];
    for (const field in GRADE_LABELS) {
      if (servantData[field] === true) grades.push(GRADE_LABELS[field]);
    }
    return grades.length > 0 ? grades.join(", ") : "No grades assigned";
  }, [servantData]);

  // Delete servant record only (preserves profile picture)
  const deleteServant = async () => {
    Alert.alert(
      "Delete Servant",
      `Are you sure you want to delete ${
        servantData.name || "this servant's"
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
                "Sunday School",
                "Servants",
                "Servants",
                servantId
              ));

              Alert.alert(
                "Success",
                `${servantData.name || "Servant"}'s record has been deleted.`,
                [{ text: "OK"}]
              );
            } catch (error) {
              Alert.alert("Error", "Failed to delete servant record.");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return <SkeletonScreen variant="profile" />;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.contentContainer, CONTAINER_WIDTH]}>
        <View style={styles.buttonRow}>
          <BackArrow />
        </View>
        <Text style={styles.title}>{`${servantData.name || "Servant"}`}</Text>
        <View style={styles.profileContainer}>
          <Avatar
            uid={servantId}
            size={80}
            finalSize={300}
            borderRadius={40}
            expandable
            style={styles.profileImage}
          />
        </View>
        <Text style={styles.subtitle}>{`Teaching: ${servantGrades}`}</Text>
        <FlatList
          {...LIST_PERF}
          data={attendanceDataMemo}
          // `item.date` is unique per record. The old index-based extractor was
          // wrong on a newest-first list: adding a record reindexed every row.
          keyExtractor={attendanceKeyExtractor}
          renderItem={renderAttendanceRow}
          ListEmptyComponent={EmptyAttendance}
          contentContainerStyle={styles.attendanceContainer}
          showsVerticalScrollIndicator={false}
        />
        <TouchableOpacity
          onPress={deleteServant}
          style={styles.deleteTextContainer}
          accessible={true}
          accessibilityLabel="Delete servant record"
        >
          <Text style={styles.deleteText}>Delete Servant</Text>
        </TouchableOpacity>
      </View>
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
    justifyContent: "flex-start",
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
  profileImage: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    color: "#fff",
    fontSize: 18,
    marginTop: 10,
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
});

export default ServantAttendance;