import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  where,
} from "@react-native-firebase/firestore";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { LIST_PERF } from "../utils/listConfig";
import { longDateLabelWithYear, parseDateKey } from "../utils/dateKeys";

// Written by the functions - see backend/functions/files/audit.py for the shape.
export const AUDIT_COLLECTION = "scheduleAudit";
const ALL_WEEKS_LIMIT = 150;

export const ACTION_LABELS = {
  switch_server: "Swapped servers",
  remove_server: "Removed from altar",
  add_server: "Added to altar",
  approve_replacement: "Replacement assigned",
  marked_unavailable: "Marked unavailable",
  left_schedules: "Left the schedule",
  rebalance: "Altar resized",
  generated: "Week generated",
  schedule_created: "Week generated",
  schedule_archived: "Week archived",
  availability_response: "Availability answer",
  reminder_sent: "Reminder sent",
  schedule_changed: "Schedule changed",
};

export const ACTION_ICONS = {
  switch_server: "swap-horizontal",
  remove_server: "account-minus",
  add_server: "account-plus",
  approve_replacement: "account-check",
  marked_unavailable: "account-cancel",
  left_schedules: "exit-run",
  rebalance: "tune-vertical",
  generated: "calendar-plus",
  schedule_created: "calendar-plus",
  schedule_archived: "archive",
  availability_response: "message-reply-text",
  reminder_sent: "bell-ring",
  schedule_changed: "pencil",
};

const ROLE_NAMES = {
  matins: "Matins Gospel",
  third: "Third Hour",
  sixth: "Sixth Hour",
  pauline: "Pauline",
  catholic: "Catholic",
  praxis: "Praxis",
  gospel: "Gospel",
  water: "Water",
  wine: "Wine",
  altar: "Altar",
  extra: "Not serving",
};

export const STATUS = {
  confirmed: { label: "Confirmed", color: "#34c759" },
  unsure: { label: "Unsure", color: "#ff9500" },
  unavailable: { label: "Unavailable", color: "#ff3b30" },
};

const ACTOR_KINDS = {
  admin: "Admin",
  user: "User",
  self: "Self",
  system: "Automatic",
  unknown: "Unknown",
};

const roleName = (role) =>
  role ? ROLE_NAMES[role] || role : "Off the schedule";

export const statusLabel = (status) => STATUS[status]?.label || "No answer";

export const weekLabel = (week) =>
  week && parseDateKey(week) ? longDateLabelWithYear(week) : week || "All weeks";

const formatWhen = (date) =>
  date
    ? date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "Pending";

/**
 * One entry, normalised from the two halves the functions write: the
 * endpoint's (action, actor, summary, affected) and the trigger's (changes,
 * inferredAction, inferredActor). Either may be missing.
 */
// The functions write the triggering action's id into rebalance summaries
// ("after remove_server"); say it in words instead, for old entries too.
const REBALANCE_CAUSES = {
  add_server: "an altar server was added",
  remove_server: "an altar server was removed",
};

const summaryFor = (action, data) => {
  if (action === "rebalance" && data.details?.altarServers != null) {
    const cause = REBALANCE_CAUSES[data.details.cause] || "an edit";
    return `Altar set to ${data.details.altarServers} servers after ${cause}`;
  }
  return data.summary;
};

export const normalise = (snap) => {
  const data = snap.data() || {};
  const action = data.action || data.inferredAction || "schedule_changed";
  const actor = data.actor || data.inferredActor || null;
  return {
    id: snap.id,
    path: snap.ref?.path,
    raw: data,
    week: data.week,
    at: data.at?.toDate ? data.at.toDate() : null,
    action,
    actor,
    summary: summaryFor(action, data),
    affected: data.affected || [],
    changes: data.changes || [],
    details: data.details || {},
  };
};

const StatusPill = ({ status }) => (
  <View style={[styles.pill, { borderColor: STATUS[status]?.color || "#555" }]}>
    <Text style={[styles.pillText, { color: STATUS[status]?.color || "#888" }]}>
      {statusLabel(status)}
    </Text>
  </View>
);

const actorLine = (actor) => {
  if (!actor) return "Unknown";
  if (actor.inferred) return `${actor.name} (or their parent)`;
  return actor.name || "Unknown";
};

const fallbackSummary = (entry) => {
  const { changes, action } = entry;
  if (action === "availability_response" && changes.length === 1) {
    return `${changes[0].name} answered ${statusLabel(changes[0].statusAfter)}`;
  }
  if (action === "schedule_archived") return "Moved to the archive after Sunday";
  if (changes.length) return `${changes.length} ${changes.length === 1 ? "person" : "people"} affected`;
  return "";
};

export const AuditRow = React.memo(({ entry, showWeek, onDelete }) => {
  const [open, setOpen] = useState(false);
  const hasDetail = entry.affected.length > 0 || entry.changes.length > 0;
  const replacement = entry.details?.suggestedReplacement;

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={hasDetail ? 0.7 : 1}
      onPress={() => hasDetail && setOpen((o) => !o)}
    >
      <View style={styles.rowHeader}>
        <View style={styles.iconCircle}>
          <Icon name={ACTION_ICONS[entry.action] || "pencil"} size={18} color="#4d9cff" />
        </View>
        <View style={styles.rowTitleBlock}>
          <Text style={styles.rowTitle}>{ACTION_LABELS[entry.action] || entry.action}</Text>
          <Text style={styles.rowMeta}>
            {formatWhen(entry.at)}
            {showWeek && entry.week ? ` · ${weekLabel(entry.week)}` : ""}
          </Text>
        </View>
        {onDelete && (
          <TouchableOpacity
            onPress={() => onDelete(entry)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.deleteButton}
            accessibilityLabel="Delete entry"
          >
            <Icon name="trash-can-outline" size={19} color="#ff453a" />
          </TouchableOpacity>
        )}
        {hasDetail && (
          <Icon name={open ? "chevron-up" : "chevron-down"} size={20} color="#666" />
        )}
      </View>

      <Text style={styles.summary}>{entry.summary || fallbackSummary(entry)}</Text>

      <Text style={styles.actor}>
        By {actorLine(entry.actor)}
        {entry.actor?.kind ? ` · ${ACTOR_KINDS[entry.actor.kind] || entry.actor.kind}` : ""}
      </Text>

      {open && entry.affected.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Before this change</Text>
          {entry.affected.map((p) => (
            <View key={`a-${p.uid}`} style={styles.personBlock}>
              <View style={styles.personRow}>
                <Text style={styles.personName}>{p.name || "Unknown"}</Text>
                <StatusPill status={p.status} />
              </View>
              <Text style={styles.personMeta}>{roleName(p.role)}</Text>
              {p.declaredUnavailable && (
                <Text style={styles.flag}>Had marked this week as unavailable</Text>
              )}
              {p.unavailableRequest && (
                <Text style={styles.flag}>
                  Open unavailable request for {roleName(p.unavailableRequest.role)}
                  {p.unavailableRequest.suggestedReplacement?.name
                    ? ` · suggested ${p.unavailableRequest.suggestedReplacement.name}`
                    : ""}
                </Text>
              )}
            </View>
          ))}
          {entry.action === "approve_replacement" && replacement?.name && (
            <Text style={styles.personMeta}>
              {entry.details.acceptedSuggestion
                ? `Took the suggested replacement (${replacement.name})`
                : `Chose someone other than the suggestion (${replacement.name})`}
            </Text>
          )}
        </View>
      )}

      {open && entry.changes.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>What changed</Text>
          {entry.changes.map((c) => (
            <View key={`c-${c.uid}`} style={styles.changeRow}>
              <Text style={styles.personName}>{c.name}</Text>
              <Text style={styles.changeText}>
                {c.from === c.to
                  ? `${statusLabel(c.statusBefore)} → ${statusLabel(c.statusAfter)}`
                  : `${roleName(c.from)} → ${roleName(c.to)}`}
              </Text>
            </View>
          ))}
        </View>
      )}

      {open && entry.action === "reminder_sent" && entry.details?.message && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Message</Text>
          <Text style={styles.personMeta}>{entry.details.message}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});
AuditRow.displayName = "AuditRow";

const keyExtractor = (entry) => entry.id;

const ScheduleAuditModal = ({ visible, onClose, churchId, week }) => {
  const [scope, setScope] = useState("week");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!churchId) return;
    setLoading(true);
    setError(null);
    try {
      const ref = collection(getFirestore(), "churches", churchId, AUDIT_COLLECTION);
      // Week view filters on equality only and sorts here, so it needs no
      // composite index.
      const snap = await getDocs(
        scope === "week" && week
          ? query(ref, where("week", "==", week))
          : query(ref, orderBy("at", "desc"), limit(ALL_WEEKS_LIMIT))
      );
      const list = snap.docs.map(normalise);
      list.sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0));
      setEntries(list);
    } catch (err) {
      console.error("Error loading schedule audit:", err);
      setError("Couldn't load the history.");
    } finally {
      setLoading(false);
    }
  }, [churchId, week, scope]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const renderItem = useCallback(
    ({ item }) => <AuditRow entry={item} showWeek={scope === "all"} />,
    [scope]
  );

  const empty = useMemo(
    () =>
      loading ? null : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {error || "Nothing recorded yet. Changes are logged from now on."}
          </Text>
        </View>
      ),
    [loading, error]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Schedule History</Text>
            <Text style={styles.subtitle}>
              {scope === "week" ? weekLabel(week) : `Latest ${ALL_WEEKS_LIMIT} changes`}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeX}>×</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.segment}>
          {[
            ["week", "This week"],
            ["all", "All weeks"],
          ].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[styles.segmentButton, scope === key && styles.segmentActive]}
              onPress={() => setScope(key)}
            >
              <Text style={[styles.segmentText, scope === key && styles.segmentTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && entries.length === 0 ? (
          <ActivityIndicator style={styles.spinner} color="#4d9cff" />
        ) : (
          <FlatList
            {...LIST_PERF}
            data={entries}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListEmptyComponent={empty}
            onRefresh={load}
            refreshing={loading}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingTop: Platform.OS === "android" ? 24 : 0,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  title: { color: "#fff", fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
  subtitle: { color: "#8e8e93", fontSize: 14, marginTop: 2 },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeX: { color: "#aaa", fontSize: 22, lineHeight: 24 },
  segment: {
    flexDirection: "row",
    margin: 16,
    backgroundColor: "#1c1c1e",
    borderRadius: 10,
    padding: 3,
  },
  segmentButton: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  segmentActive: { backgroundColor: "#2c2c2e" },
  segmentText: { color: "#8e8e93", fontSize: 14, fontWeight: "600" },
  segmentTextActive: { color: "#fff" },
  spinner: { marginTop: 40 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  row: {
    backgroundColor: "#1c1c1e",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  rowHeader: { flexDirection: "row", alignItems: "center" },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(77,156,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowTitleBlock: { flex: 1 },
  deleteButton: { paddingHorizontal: 6, marginRight: 4 },
  rowTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  rowMeta: { color: "#8e8e93", fontSize: 13, marginTop: 1 },
  summary: { color: "#e5e5ea", fontSize: 15, marginTop: 10, lineHeight: 20 },
  actor: { color: "#8e8e93", fontSize: 13, marginTop: 6 },
  section: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
  },
  sectionLabel: {
    color: "#4d9cff",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  personBlock: { marginBottom: 10 },
  personRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  personName: { color: "#fff", fontSize: 15, fontWeight: "500", flexShrink: 1 },
  personMeta: { color: "#aeaeb2", fontSize: 13, marginTop: 2 },
  flag: { color: "#ff9500", fontSize: 13, marginTop: 3 },
  pill: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 8 },
  pillText: { fontSize: 12, fontWeight: "600" },
  changeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  changeText: { color: "#aeaeb2", fontSize: 14, marginLeft: 8, flexShrink: 1, textAlign: "right" },
  empty: { paddingTop: 60, paddingHorizontal: 30, alignItems: "center" },
  emptyText: { color: "#8e8e93", fontSize: 15, textAlign: "center" },
});

export default ScheduleAuditModal;
