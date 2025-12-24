import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
  StyleSheet,
} from "react-native";

// Date format constants
const DATE_FORMATS = {
  SCHEDULE: 'MM-DD-YY',
  LAST_SERVE: 'MM-DD-YY',
};

// ===== Date Utility Functions =====

const parseDate = (dateStr, format) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  
  let day, month, year;
  if (format === DATE_FORMATS.SCHEDULE) {
    month = parseInt(parts[0], 10);
    day = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  } else if (format === DATE_FORMATS.LAST_SERVE) {
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
  } else {
    return null;
  }
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  
  const fullYear = year < 100 ? 2000 + year : year;
  const date = new Date(fullYear, month - 1, day);
  
  if (date.getFullYear() !== fullYear || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
};

const calculateWeeksBetween = (lastServeStr, targetWeekStr) => {
  if (!lastServeStr || !targetWeekStr) return null;
  const lastServeDate = parseDate(lastServeStr, DATE_FORMATS.LAST_SERVE);
  const targetDate = parseDate(targetWeekStr, DATE_FORMATS.SCHEDULE);
  if (!lastServeDate || !targetDate) return null;
  
  const diffMs = targetDate.getTime() - lastServeDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
};

const getColorForWeeks = (weeks) => {
  if (weeks === null || weeks === undefined || weeks < 0) return '#666';
  
  const colorStops = [
    { weeks: 0, color: '#ff3b30' },
    { weeks: 1, color: '#ff3b30' },
    { weeks: 2, color: '#ff6b30' },
    { weeks: 3, color: '#ff9500' },
    { weeks: 4, color: '#ffcc00' },
    { weeks: 6, color: '#c7dc00' },
    { weeks: 8, color: '#76d600' },
    { weeks: Infinity, color: '#34c759' },
  ];
  
  for (const stop of colorStops) {
    if (weeks <= stop.weeks) return stop.color;
  }
  return '#34c759';
};

const getWeeksDisplayText = (weeks) => {
  if (weeks === null) return 'No data';
  if (weeks < 0) return `Will serve in ${Math.abs(weeks)} week${Math.abs(weeks) === 1 ? '' : 's'}`;
  if (weeks === 0) return 'Serving this week';
  if (weeks === 1) return 'Served 1 week ago';
  return `Served ${weeks} weeks ago`;
};

// ===== Component =====

const ServerSelectionModal = ({
  visible,
  onClose,
  onSelect,
  servers = [],
  imageUrls = {},
  lastServeData = {},
  nextServeData = {},
  selectedWeek,
  title = "Select Server",
  showNextServe = false, // For readers, show secondary "serving in X weeks" info
}) => {
  const renderItem = ({ item }) => {
    const weeksSinceLastServe = calculateWeeksBetween(lastServeData[item.uid], selectedWeek);
    const indicatorColor = getColorForWeeks(weeksSinceLastServe);
    const displayText = getWeeksDisplayText(weeksSinceLastServe);
    
    // Secondary info for readers
    let secondaryInfo = null;
    if (showNextServe && nextServeData[item.uid]) {
      const weeksUntilNext = calculateWeeksBetween(selectedWeek, nextServeData[item.uid]);
      if (weeksUntilNext !== null && weeksUntilNext >= 0) {
        if (weeksUntilNext === 0) secondaryInfo = 'Serving next week';
        else if (weeksUntilNext === 1) secondaryInfo = 'Serving in 1 week';
        else if (weeksUntilNext <= 8) secondaryInfo = `Serving in ${weeksUntilNext} weeks`;
      }
    }
    
    return (
      <TouchableOpacity
        style={styles.modalItemContainer}
        onPress={() => onSelect(item)}
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
            <View style={styles.serveInfoContainer}>
              <Text style={[styles.primaryServeText, { color: indicatorColor }]}>
                {displayText}
              </Text>
              {secondaryInfo && (
                <Text style={styles.secondaryServeText}>{secondaryInfo}</Text>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={styles.modalWrapper}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
                <Text style={styles.modalCloseX}>×</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={servers}
              keyExtractor={(item) => item.uid}
              showsVerticalScrollIndicator={false}
              renderItem={renderItem}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No servers available</Text>
                </View>
              }
            />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
    shadowOffset: { width: 0, height: 10 },
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
  serveInfoContainer: {
    marginTop: 2,
  },
  primaryServeText: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: "600",
  },
  secondaryServeText: {
    fontSize: 11,
    marginTop: 1,
    color: "#888",
    fontWeight: "400",
  },
  separator: {
    height: 1,
    backgroundColor: "#2a2a2a",
    marginHorizontal: 20,
  },
  emptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#666",
    fontSize: 16,
  },
});

export default ServerSelectionModal;