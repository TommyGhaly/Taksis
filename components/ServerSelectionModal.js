import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  TextInput,
} from "react-native";
import Avatar from "./Avatar";
import { LIST_PERF } from "../utils/listConfig";
import { weeksBetween } from "../utils/dateKeys";

// ===== Date Utility Functions =====
//
// The local `DATE_FORMATS` / `parseDate` pair that used to live here is gone. Both
// of its format constants were the string "MM-DD-YY", so the day-first branch was
// unreachable and everything was parsed month-first anyway — see the note in
// utils/dateKeys.js. `weeksBetween(from, to)` has the same argument order and the
// same null-on-unparseable behaviour as the old `calculateWeeksBetween`.

// Hoisted out of getColorForWeeks, which reallocated this array on every call —
// and it was called once per row per render.
const COLOR_STOPS = [
  { weeks: 0, color: '#ff3b30' },
  { weeks: 1, color: '#ff3b30' },
  { weeks: 2, color: '#ff6b30' },
  { weeks: 3, color: '#ff9500' },
  { weeks: 4, color: '#ffcc00' },
  { weeks: 6, color: '#c7dc00' },
  { weeks: 8, color: '#76d600' },
  { weeks: Infinity, color: '#34c759' },
];

const getColorForWeeks = (weeks) => {
  if (weeks === null || weeks === undefined || weeks < 0) return '#666';
  for (const stop of COLOR_STOPS) {
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

/**
 * One server row.
 *
 * Everything it displays arrives precomputed. It used to be an inline `renderItem`
 * that ran the week arithmetic, the colour interpolation and the label formatting
 * for every mounted row on every render — including every keystroke in the search
 * box directly above it.
 */
const ServerRow = React.memo(({ server, indicatorColor, displayText, secondaryInfo, onPress }) => (
  <TouchableOpacity
    style={styles.modalItemContainer}
    onPress={() => onPress(server)}
    activeOpacity={0.7}
  >
    <View style={styles.modalItemContent}>
      <View style={styles.profilePicContainer}>
        <Avatar
          uid={server.uid}
          user={server}
          size={42}
          borderRadius={21}
          style={styles.profilePic}
          showBorder={false}
        />
        <View style={[styles.statusIndicator, { backgroundColor: indicatorColor }]} />
      </View>
      <View style={styles.serverInfo}>
        <Text style={styles.modalItem}>{server.name}</Text>
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
));
ServerRow.displayName = "ServerRow";

// Hoisted: as inline props these were a new identity every render.
const serverKeyExtractor = (item) => item.server.uid;
const Separator = () => <View style={styles.separator} />;

/** How long until this server serves again, or null if that isn't worth showing. */
const nextServeLabel = (selectedWeek, nextServeStr) => {
  const weeks = weeksBetween(selectedWeek, nextServeStr);
  if (weeks === null || weeks < 0 || weeks > 8) return null;
  if (weeks === 0) return 'Serving next week';
  if (weeks === 1) return 'Serving in 1 week';
  return `Serving in ${weeks} weeks`;
};

// ===== Component =====

const ServerSelectionModal = ({
  visible,
  onClose,
  onSelect,
  servers = [],
  lastServeData = {},
  nextServeData = {},
  selectedWeek,
  title = "Select Server",
  showNextServe = false,
}) => {
  const [query, setQuery] = useState("");

  /**
   * Rows with all their derived display values resolved.
   *
   * Filtering used to happen in the render body (and lowercased `query` once per
   * server rather than once), and the week/colour/label derivation happened inside
   * `renderItem`. Both are now memoized, and the derivation is keyed on the data it
   * actually depends on — so typing only re-filters, it doesn't redo the arithmetic
   * for rows that are already computed.
   */
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? servers.filter((s) => s.name?.toLowerCase().includes(q))
      : servers;

    return filtered.map((server) => {
      const weeksSinceLastServe = weeksBetween(lastServeData[server.uid], selectedWeek);
      return {
        server,
        indicatorColor: getColorForWeeks(weeksSinceLastServe),
        displayText: getWeeksDisplayText(weeksSinceLastServe),
        secondaryInfo:
          showNextServe && nextServeData[server.uid]
            ? nextServeLabel(selectedWeek, nextServeData[server.uid])
            : null,
      };
    });
  }, [query, servers, lastServeData, nextServeData, selectedWeek, showNextServe]);

  const renderItem = useCallback(
    ({ item }) => (
      <ServerRow
        server={item.server}
        indicatorColor={item.indicatorColor}
        displayText={item.displayText}
        secondaryInfo={item.secondaryInfo}
        onPress={onSelect}
      />
    ),
    [onSelect]
  );

  const listEmpty = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {query.trim() ? `No results for "${query}"` : "No servers available"}
        </Text>
      </View>
    ),
    [query]
  );

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
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
                <Text style={styles.modalCloseX}>×</Text>
              </TouchableOpacity>
            </View>

            {/* Search bar */}
            <View style={styles.searchContainer}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search..."
                placeholderTextColor="#555"
                value={query}
                onChangeText={setQuery}
                clearButtonMode="while-editing"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.clearBtn}>×</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* List */}
            <FlatList
              {...LIST_PERF}
              data={rows}
              keyExtractor={serverKeyExtractor}
              showsVerticalScrollIndicator={false}
              renderItem={renderItem}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={Separator}
              ListEmptyComponent={listEmpty}
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
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalWrapper: {
    width: "88%",
    maxHeight: "60%",
  },
  modalContent: {
    backgroundColor: "#161616",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  modalCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseX: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 20,
    fontWeight: "300",
    lineHeight: 22,
  },

  // Search bar
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    paddingHorizontal: 12,
    height: 38,
    gap: 8,
  },
  searchIcon: {
    fontSize: 16,
    color: "rgba(255,255,255,0.3)",
    marginTop: -1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#fff",
    paddingVertical: 0,
  },
  clearBtn: {
    fontSize: 18,
    color: "rgba(255,255,255,0.3)",
    fontWeight: "300",
    lineHeight: 20,
  },

  modalItemContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 18,
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
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#2a2a2a",
  },
  statusIndicator: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#161616",
  },
  serverInfo: {
    marginLeft: 13,
    flex: 1,
  },
  modalItem: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  serveInfoContainer: {
    marginTop: 2,
  },
  primaryServeText: {
    fontSize: 12,
    marginTop: 1,
    fontWeight: "500",
  },
  secondaryServeText: {
    fontSize: 11,
    marginTop: 1,
    color: "rgba(255,255,255,0.3)",
    fontWeight: "400",
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginHorizontal: 18,
  },
  emptyContainer: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
  },
});

export default ServerSelectionModal;