import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Image, ActivityIndicator, StatusBar,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import {
  expandReadings, isAssignableSlot, isPsalmSlot,
  hasLanguagePicker, effectiveLanguage, langShort,
  READING_META,
} from "../Pascha/PaschaReadingUtils";
import { DAY_SHORT_LABELS } from "../Pascha/DayConstants";

const DEFAULT_AVATAR = require("../../assets/default_profile.png");

// ── Tokens ────────────────────────────────────────────────────────────────────
const BG      = "#0f0f0f";
const GLASS   = "rgba(255,255,255,0.055)";
const GLASS2  = "rgba(255,255,255,0.09)";
const GLASS_B = "rgba(255,255,255,0.1)";
const SEP     = "rgba(255,255,255,0.07)";
const BLUE    = "#3b82f6";
const BLUE2   = "#60a5fa";
const BLUE_D  = "rgba(59,130,246,0.18)";
const T1      = "#f1f5f9";
const T2      = "rgba(241,245,249,0.58)";
const T3      = "rgba(241,245,249,0.24)";
const COPTIC_COLOR  = "#f59e0b";
const COPTIC_BG     = "rgba(245,158,11,0.10)";
const COPTIC_BORDER = "rgba(245,158,11,0.28)";

// ── Derived day helpers ───────────────────────────────────────────────────────
function buildAllDays(shell) {
  if (!shell?.days) return [];
  return shell.days.map(d => ({
    id:           d.id,
    label:        d.label,
    easterOffset: d.easterOffset,
    shortLabel:   d.shortLabel ?? (DAY_SHORT_LABELS[d.id] ?? d.label.split(" ").slice(0, 2).join(" ")),
    hours:        d.hours ?? [],
  }));
}

function calcDate(easter, offset) {
  if (!easter) return null;
  const d = new Date(easter);
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ── Slot helpers ──────────────────────────────────────────────────────────────
function getMySlots(hour, ha, uid) {
  if (!uid) return new Set();
  const slots = new Set();
  expandReadings(hour, ha).forEach(({ slotKey, rKey }) => {
    if (isPsalmSlot(rKey)) {
      if ((ha.psalm_readers || []).some(r => r.uid === uid)) slots.add(slotKey);
    } else if (isAssignableSlot(rKey)) {
      if (ha[slotKey]?.uid === uid) slots.add(slotKey);
    }
  });
  return slots;
}

function dayHasMyReading(day, ds, uid) {
  return (day.hours || []).some(h => getMySlots(h, ds[h.id] || {}, uid).size > 0);
}

function collectMyReadings(allDays, schedule, uid) {
  const result = [];
  allDays.forEach(day => {
    const ds = schedule[day.id] || {};
    const hours = [];
    (day.hours || []).forEach(h => {
      const ha = ds[h.id] || {};
      const slotSet = getMySlots(h, ha, uid);
      if (slotSet.size === 0) return;
      const rows = expandReadings(h, ha).filter(r =>
        (isAssignableSlot(r.rKey) || isPsalmSlot(r.rKey)) && slotSet.has(r.slotKey));
      if (rows.length > 0) hours.push({ hour: h, ha, rows });
    });
    if (hours.length > 0) result.push({ day, hours });
  });
  return result;
}

function getVisibleHours(hours, daySchedule) {
  return hours.filter(h => {
    const ha = daySchedule[h.id] || {};
    return expandReadings(h, ha).some(r => isAssignableSlot(r.rKey) || isPsalmSlot(r.rKey));
  });
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function useProfilePic(uid) {
  const [uri, setUri] = useState(null);
  useEffect(() => {
    if (!uid) return;
    let c = false;
    storage().ref(`profilePictures/${uid}.png`).getDownloadURL()
      .then(url => { if (!c) setUri(url); }).catch(() => {});
    return () => { c = true; };
  }, [uid]);
  return uri;
}

const Avatar = ({ uid, size = 26 }) => {
  const uri = useProfilePic(uid);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: GLASS2 }}>
      <Image source={uri ? { uri } : DEFAULT_AVATAR} style={{ width: size, height: size }} resizeMode="cover" />
    </View>
  );
};

// ── Day Tab Bar ───────────────────────────────────────────────────────────────
const DayTabBar = ({ allDays, selectedId, easterDate, schedule, uid, onSelect }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false}
    contentContainerStyle={dt.content} style={dt.bar}>
    {allDays.map(day => {
      const hasMe  = dayHasMyReading(day, schedule[day.id] || {}, uid);
      const active = day.id === selectedId;
      const dateStr = easterDate
        ? new Date(new Date(easterDate).setDate(new Date(easterDate).getDate() + day.easterOffset))
            .toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : null;
      return (
        <TouchableOpacity key={day.id} onPress={() => onSelect(day.id)}
          style={[dt.tab, active && dt.tabActive]} activeOpacity={0.75}>
          {hasMe && <View style={dt.dot} />}
          <Text style={[dt.label, active && dt.labelActive]} numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}>{day.shortLabel}</Text>
          {dateStr && <Text style={[dt.date, active && dt.dateActive]}>{dateStr}</Text>}
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);
const dt = StyleSheet.create({
  bar:         { backgroundColor: "transparent" },
  content:     { paddingHorizontal: 16, paddingVertical: 10, gap: 6, flexDirection: "row" },
  tab:         { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, backgroundColor: GLASS, borderWidth: 1, borderColor: SEP, alignItems: "center", minWidth: 64, height: 58 },
  tabActive:   { backgroundColor: BLUE_D, borderColor: "rgba(59,130,246,0.4)" },
  dot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: BLUE2, marginBottom: 3 },
  label:       { fontSize: 11, fontWeight: "500", color: T2, textAlign: "center" },
  labelActive: { color: BLUE2, fontWeight: "600" },
  date:        { fontSize: 9, color: "rgba(241,245,249,0.5)", marginTop: 2 },
  dateActive:  { color: "rgba(96,165,250,0.85)" },
});

// ── Reading Card ──────────────────────────────────────────────────────────────
const ReadingCard = ({ row, hourAssignments, uid, isFullSchedule, isMine, hideNames }) => {
  const meta        = READING_META[row.rKey] || { label: row.rKey, icon: "book-outline", color: T2 };
  const isPsalm     = isPsalmSlot(row.rKey);
  const isHom       = row.rKey === "homily";
  const isExp       = row.rKey === "exposition";
  const isCopticRow = row.isCoptic === true;

  // ── Label (Coptic gospel gets its own distinct label) ──────────────────────
  let label;
  if (isHom) {
    label = `Homily — ${row.author || row.refText}`;
  } else if (isExp) {
    label = "Exposition";
  } else if (isCopticRow && (row.rKey === "gospel_coptic" || row.rKey === "gospels_coptic")) {
    label = row.index != null ? `Gospel (Coptic) ${row.index + 1}` : "Gospel (Coptic)";
  } else if (row.index != null) {
    label = `${meta.label} ${row.index + 1}`;
  } else {
    label = meta.label;
  }

  const readers   = isPsalm ? (hourAssignments.psalm_readers || []) : [];
  const assignee  = !isPsalm ? (hourAssignments[row.slotKey] || null) : null;
  const hasAssign = isPsalm ? readers.length > 0 : !!assignee;
  const showNames = !hideNames && (isFullSchedule || isMine);
  const showLang  = isMine && hasLanguagePicker(row.rKey) && !isCopticRow;

  return (
    <View style={[rdc.card, isMine && rdc.cardMine, isCopticRow && rdc.cardCoptic]}>
      <View style={rdc.header}>
        <View style={[rdc.iconWrap, { backgroundColor: isCopticRow ? COPTIC_BG : meta.color + "1a" }]}>
          <Icon name={meta.icon} size={15} color={isCopticRow ? COPTIC_COLOR : meta.color} />
        </View>
        <Text style={[rdc.typeLabel, { color: isCopticRow ? COPTIC_COLOR : meta.color }]}>{label}</Text>
        {isCopticRow && (
          <View style={rdc.copticBadge}>
            <Text style={rdc.copticBadgeTxt}>COPTIC</Text>
          </View>
        )}
        {showLang && (
          <View style={rdc.langBadge}>
            <Text style={rdc.langBadgeTxt}>{langShort(effectiveLanguage(row, hourAssignments))}</Text>
          </View>
        )}
        {isMine && <View style={rdc.youPill}><Text style={rdc.youTxt}>You</Text></View>}
      </View>

      {!!row.refText && !isHom && !isExp && (
        <Text style={rdc.ref}>{row.refText}</Text>
      )}
      {!!row.location && <Text style={rdc.loc}>{row.location}</Text>}

      {hasAssign && showNames && (
        <View style={rdc.assigneeRow}>
          {isPsalm ? readers.map((r, i) => (
            <View key={r.uid || i} style={[
              rdc.chip,
              r.uid === uid && rdc.chipMe,
              isCopticRow && rdc.chipCoptic,
            ]}>
              <Avatar uid={r.uid} size={16} />
              <Text style={[
                rdc.chipName,
                r.uid === uid && rdc.chipNameMe,
                isCopticRow && rdc.chipNameCoptic,
              ]} numberOfLines={1}>{r.name}</Text>
            </View>
          )) : (
            <View style={[rdc.chip, isMine && rdc.chipMe, isCopticRow && rdc.chipCoptic]}>
              <Avatar uid={assignee.uid} size={16} />
              <Text style={[
                rdc.chipName,
                isMine && rdc.chipNameMe,
                isCopticRow && rdc.chipNameCoptic,
              ]} numberOfLines={1}>{assignee.name}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};
const rdc = StyleSheet.create({
  card:            { backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_B, borderRadius: 14, padding: 14, marginBottom: 8 },
  cardMine:        { borderColor: "rgba(59,130,246,0.3)", backgroundColor: "rgba(59,130,246,0.07)" },
  cardCoptic:      { borderColor: COPTIC_BORDER, backgroundColor: COPTIC_BG },
  header:          { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 8 },
  iconWrap:        { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  typeLabel:       { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", flex: 1 },
  copticBadge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: "rgba(245,158,11,0.15)", borderWidth: 1, borderColor: COPTIC_BORDER },
  copticBadgeTxt:  { fontSize: 9, fontWeight: "800", color: COPTIC_COLOR, letterSpacing: 0.5 },
  langBadge:       { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, backgroundColor: GLASS2 },
  langBadgeTxt:    { fontSize: 9, fontWeight: "700", color: T3, letterSpacing: 0.3 },
  youPill:         { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: BLUE_D, borderWidth: 1, borderColor: "rgba(59,130,246,0.3)" },
  youTxt:          { fontSize: 9, fontWeight: "700", color: BLUE2, letterSpacing: 0.4 },
  ref:             { fontSize: 14, color: T1, fontWeight: "300", lineHeight: 21, marginBottom: 3 },
  loc:             { fontSize: 11, color: T2, fontWeight: "400" },
  assigneeRow:     { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: SEP },
  chip:            { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: GLASS2, borderWidth: 1, borderColor: SEP, borderRadius: 20, paddingVertical: 3, paddingHorizontal: 8 },
  chipMe:          { backgroundColor: BLUE_D, borderColor: "rgba(59,130,246,0.3)" },
  chipCoptic:      { backgroundColor: COPTIC_BG, borderColor: COPTIC_BORDER },
  chipName:        { fontSize: 11, fontWeight: "500", color: T2, maxWidth: 100 },
  chipNameMe:      { color: BLUE2, fontWeight: "600" },
  chipNameCoptic:  { color: COPTIC_COLOR, fontWeight: "600" },
});

// ── Single Hour Page ──────────────────────────────────────────────────────────
const HourPage = ({ hour, ha, uid, isFullSchedule, hideNames, pageWidth, pageLabel }) => {
  const mySlotSet  = getMySlots(hour, ha, uid);
  const hasMe      = mySlotSet.size > 0;
  const assignable = expandReadings(hour, ha).filter(r => isAssignableSlot(r.rKey) || isPsalmSlot(r.rKey));
  return (
    <View style={{ width: pageWidth }}>
      <View style={pg.hourHeader}>
        <View style={[pg.hourAccent, { backgroundColor: hasMe ? BLUE : "rgba(255,255,255,0.15)" }]} />
        <View style={{ flex: 1 }}>
          <Text style={pg.hourLabel}>{hour.label}</Text>
          {hasMe && (
            <Text style={pg.hourSub}>
              {mySlotSet.size} reading{mySlotSet.size !== 1 ? "s" : ""} for you
            </Text>
          )}
        </View>
        <Text style={pg.pageCount}>{pageLabel}</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pg.cardsScroll}>
        {assignable.length === 0
          ? <View style={pg.emptyHour}><Text style={pg.emptyHourTxt}>No assigned readings</Text></View>
          : assignable.map(row => (
            <ReadingCard
              key={row.slotKey}
              row={row}
              hourAssignments={ha}
              uid={uid}
              isFullSchedule={isFullSchedule}
              isMine={mySlotSet.has(row.slotKey)}
              hideNames={hideNames}
            />
          ))
        }
      </ScrollView>
    </View>
  );
};

// ── Hour Pager ────────────────────────────────────────────────────────────────
const HourPagerController = ({ hours, daySchedule, uid, isFullSchedule, hideNames, targetHourId }) => {
  const { width } = useWindowDimensions();
  const visibleHours = useMemo(() => getVisibleHours(hours, daySchedule), [hours, daySchedule]);

  const targetIdx = useMemo(() => {
    if (!targetHourId) return 0;
    const idx = visibleHours.findIndex(h => h.id === targetHourId);
    return idx >= 0 ? idx : 0;
  }, [targetHourId, visibleHours]);

  const [page, setPage] = useState(targetIdx);
  const clamped = Math.min(page, Math.max(0, visibleHours.length - 1));

  const scrollRef = useRef(null);
  const setRefs = useCallback(node => {
    scrollRef.current = node;
    if (node && targetIdx > 0) node.scrollTo({ x: targetIdx * width, animated: false });
  }, [targetIdx, width]);

  const goTo = useCallback(idx => {
    if (idx < 0 || idx >= visibleHours.length) return;
    scrollRef.current?.scrollTo({ x: idx * width, animated: true });
    setPage(idx);
  }, [visibleHours.length, width]);

  if (visibleHours.length === 0) {
    return (
      <View style={pg.empty}>
        <Icon name="cross" size={28} color={T3} />
        <Text style={pg.emptyTxt}>No readings assigned for this day</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={pg.nav}>
        <TouchableOpacity onPress={() => goTo(clamped - 1)} disabled={clamped === 0}
          style={[pg.navBtn, clamped === 0 && pg.navBtnDisabled]} activeOpacity={0.7}>
          <Icon name="chevron-left" size={18} color={clamped === 0 ? T3 : T1} />
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pg.dotsContent}>
          {visibleHours.map((h, i) => {
            const hha    = daySchedule[h.id] || {};
            const hasMe  = getMySlots(h, hha, uid).size > 0;
            const active = i === clamped;
            return (
              <TouchableOpacity key={h.id} onPress={() => goTo(i)} style={pg.dotBtn} activeOpacity={0.7}>
                <View style={[
                  pg.dotPill,
                  active && pg.dotPillActive,
                  hasMe && pg.dotPillMe,
                  active && hasMe && pg.dotPillMeActive,
                ]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity
          onPress={() => goTo(clamped + 1)}
          disabled={clamped >= visibleHours.length - 1}
          style={[pg.navBtn, clamped >= visibleHours.length - 1 && pg.navBtnDisabled]}
          activeOpacity={0.7}>
          <Icon name="chevron-right" size={18} color={clamped >= visibleHours.length - 1 ? T3 : T1} />
        </TouchableOpacity>
      </View>
      <ScrollView
        ref={setRefs}
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          if (idx >= 0 && idx < visibleHours.length) setPage(idx);
        }}
        scrollEventThrottle={16}
      >
        {visibleHours.map(hour => (
          <HourPage
            key={hour.id}
            hour={hour}
            ha={daySchedule[hour.id] || {}}
            uid={uid}
            isFullSchedule={isFullSchedule}
            hideNames={hideNames}
            pageWidth={width}
            pageLabel={`${clamped + 1} / ${visibleHours.length}`}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const pg = StyleSheet.create({
  nav:             { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  navBtn:          { width: 36, height: 36, borderRadius: 18, backgroundColor: GLASS, borderWidth: 1, borderColor: SEP, justifyContent: "center", alignItems: "center" },
  navBtnDisabled:  { opacity: 0.3 },
  dotsContent:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 6 },
  dotBtn:          { padding: 4 },
  dotPill:         { width: 6, height: 6, borderRadius: 3, backgroundColor: T3 },
  dotPillActive:   { width: 18, backgroundColor: T2 },
  dotPillMe:       { backgroundColor: "rgba(59,130,246,0.4)" },
  dotPillMeActive: { width: 18, backgroundColor: BLUE2 },
  hourHeader:      { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
  hourAccent:      { width: 3, height: 20, borderRadius: 2 },
  hourLabel:       { fontSize: 17, fontWeight: "300", color: T1, letterSpacing: -0.3 },
  hourSub:         { fontSize: 12, color: BLUE2, marginTop: 2, fontWeight: "400" },
  pageCount:       { fontSize: 11, color: T3, fontWeight: "400" },
  cardsScroll:     { paddingHorizontal: 16, paddingBottom: 32 },
  empty:           { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 48 },
  emptyTxt:        { fontSize: 14, color: T2, fontWeight: "300" },
  emptyHour:       { padding: 24, alignItems: "center" },
  emptyHourTxt:    { fontSize: 13, color: T3, fontWeight: "400" },
});

// ── Timeline Day Card ─────────────────────────────────────────────────────────
const TimelineDayCard = ({ day, daySchedule, easterDate, uid, isLast, onHourPress }) => {
  const dateStr = easterDate ? calcDate(easterDate, day.easterOffset) : null;
  const myHours = [];
  (day.hours || []).forEach(h => {
    const ha      = daySchedule[h.id] || {};
    const slotSet = getMySlots(h, ha, uid);
    if (slotSet.size === 0) return;
    const rows = expandReadings(h, ha).filter(r =>
      (isAssignableSlot(r.rKey) || isPsalmSlot(r.rKey)) && slotSet.has(r.slotKey));
    if (rows.length > 0) myHours.push({ hour: h, rows });
  });
  const total    = myHours.reduce((a, h) => a + h.rows.length, 0);
  const allTypes = [...new Set(myHours.flatMap(h => h.rows.map(r => {
    const base = r.rKey.replace(/_coptic$/, "").replace(/_vernacular$/, "");
    return READING_META[base] ? base : r.rKey;
  })))];

  const handleCardPress = () => {
    if (myHours.length > 0) onHourPress(day.id, myHours[0].hour.id);
  };

  return (
    <View style={tl.entry}>
      <View style={tl.spineCol}>
        <View style={tl.node} />
        {!isLast && <View style={tl.line} />}
      </View>
      <View style={tl.card}>
        <TouchableOpacity onPress={handleCardPress} activeOpacity={0.78}>
          <View style={tl.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={tl.dayLabel}>{day.label}</Text>
              {dateStr && <Text style={tl.dateStr}>{dateStr}</Text>}
            </View>
            <View style={tl.badge}><Text style={tl.badgeNum}>{total}</Text></View>
          </View>
          <View style={tl.pillRow}>
            {allTypes.map(rKey => {
              const m = READING_META[rKey] || { icon: "book-outline", color: T3, label: rKey };
              return (
                <View key={rKey} style={[tl.pill, { backgroundColor: m.color + "14", borderColor: m.color + "40" }]}>
                  <Icon name={m.icon} size={10} color={m.color} />
                  <Text style={[tl.pillTxt, { color: m.color }]}>{m.label}</Text>
                </View>
              );
            })}
          </View>
        </TouchableOpacity>
        {myHours.map(({ hour, rows }, hi) => (
          <TouchableOpacity key={hour.id}
            style={[tl.hourRow, hi > 0 && { borderTopWidth: 1, borderTopColor: SEP }]}
            onPress={() => onHourPress(day.id, hour.id)} activeOpacity={0.7}>
            <Text style={tl.hourLabel}>{hour.label}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={tl.hourCount}>{rows.length} {rows.length === 1 ? "reading" : "readings"}</Text>
              <Icon name="chevron-right" size={13} color={BLUE2} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
const tl = StyleSheet.create({
  entry:       { flexDirection: "row", paddingHorizontal: 20, marginBottom: 4 },
  spineCol:    { width: 24, alignItems: "center", paddingTop: 18 },
  node:        { width: 10, height: 10, borderRadius: 5, backgroundColor: BLUE, borderWidth: 2, borderColor: "rgba(59,130,246,0.35)", zIndex: 1 },
  line:        { flex: 1, width: 1.5, backgroundColor: "rgba(59,130,246,0.2)", marginTop: 4 },
  card:        { flex: 1, marginLeft: 12, marginBottom: 14, borderRadius: 20, backgroundColor: GLASS, borderWidth: 1, borderColor: GLASS_B, overflow: "hidden" },
  cardHeader:  { flexDirection: "row", alignItems: "flex-start", padding: 16, paddingBottom: 10, gap: 10 },
  dayLabel:    { fontSize: 16, fontWeight: "300", color: T1, letterSpacing: -0.2, marginBottom: 3 },
  dateStr:     { fontSize: 12, color: T2, fontWeight: "400" },
  badge:       { minWidth: 32, height: 32, borderRadius: 16, backgroundColor: BLUE_D, borderWidth: 1, borderColor: "rgba(59,130,246,0.3)", justifyContent: "center", alignItems: "center", paddingHorizontal: 8 },
  badgeNum:    { fontSize: 15, fontWeight: "300", color: BLUE2 },
  pillRow:     { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 16, paddingBottom: 12 },
  pill:        { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  pillTxt:     { fontSize: 10, fontWeight: "500", letterSpacing: 0.3 },
  hourRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 9 },
  hourLabel:   { fontSize: 13, color: T2, fontWeight: "400" },
  hourCount:   { fontSize: 12, color: BLUE2, fontWeight: "400" },
});

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PaschaHomePage() {
  const isMounted = useRef(true);
  const [uid, setUid]               = useState(null);
  const [churchId, setChurchId]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [scheduleShell, setScheduleShell] = useState(null);
  const [assignees, setAssignees]   = useState({});
  const [easterDate, setEasterDate] = useState(null);
  const [fullScheduleOn, setFullScheduleOn] = useState(false);
  const [myReadingsOn, setMyReadingsOn]     = useState(false);
  const [hideNames, setHideNames]   = useState(false);
  const [nav, setNav]               = useState(null);

  const isFullSchedule = fullScheduleOn;

  const allDays = useMemo(() => buildAllDays(scheduleShell), [scheduleShell]);
  const daysById = useMemo(() => Object.fromEntries(allDays.map(d => [d.id, d])), [allDays]);
  const schedule = useMemo(() => {
    const merged = {};
    allDays.forEach(day => {
      merged[day.id] = {};
      (day.hours || []).forEach(h => {
        merged[day.id][h.id] = { ...(assignees[day.id]?.[h.id] ?? {}) };
      });
    });
    return merged;
  }, [allDays, assignees]);

  useEffect(() => {
    isMounted.current = true;
    const user = auth().currentUser;
    if (!user) return;
    setUid(user.uid);
    const unsub = firestore().collection("users").doc(user.uid).onSnapshot(doc => {
      if (!isMounted.current || !doc.exists) return;
      setChurchId(doc.data().church || null);
      setHideNames(doc.data().paschaHideNames ?? false);
    });
    return () => { isMounted.current = false; unsub(); };
  }, []);

  useEffect(() => {
    if (!churchId) return;

    const unsubShell = firestore()
      .collection("churches").doc(churchId)
      .collection("pascha").doc("schedule_config")
      .onSnapshot(doc => {
        if (!isMounted.current) return;
        if (doc.exists) setScheduleShell(doc.data());
      });

    const unsubConfig = firestore()
      .collection("churches").doc(churchId)
      .collection("pascha").doc("config")
      .onSnapshot(doc => {
        if (!isMounted.current) return;
        setLoading(false);
        if (!doc.exists) return;
        const d = doc.data();
        setFullScheduleOn(d.fullScheduleVisible ?? false);
        setMyReadingsOn(d.myReadingsVisible ?? false);
        setEasterDate(d.easterDate ?? null);
        setHideNames(d.paschaHideNames ?? false);
      });

    const unsubSchedule = firestore()
      .collection("churches").doc(churchId)
      .collection("pascha").doc("schedule")
      .onSnapshot(doc => {
        if (!isMounted.current) return;
        setAssignees(doc.exists ? doc.data() : {});
      });

    return () => { unsubShell(); unsubConfig(); unsubSchedule(); };
  }, [churchId]);

  const myReadingsData = useMemo(
    () => collectMyReadings(allDays, schedule, uid),
    [allDays, schedule, uid]
  );
  const totalMyReadings = myReadingsData.reduce((acc, d) =>
    acc + d.hours.reduce((a, h) => a + h.rows.length, 0), 0);

  const goToHour = useCallback((dayId, hourId) => setNav({ dayId, hourId }), []);
  const goToDay  = useCallback((dayId) => setNav({ dayId, hourId: null }), []);
  const goBack   = useCallback(() => setNav(null), []);

  const showContent = isFullSchedule || myReadingsOn;

  if (loading || !scheduleShell) {
    return (
      <View style={mn.loadingWrap}>
        <ActivityIndicator color={BLUE} size="large" />
      </View>
    );
  }

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (nav) {
    const dayDef = daysById[nav.dayId];
    if (!dayDef) { setNav(null); return null; }
    const daySchedule = schedule[nav.dayId] || {};
    const dateStr     = easterDate ? calcDate(easterDate, dayDef.easterOffset) : null;

    return (
      <View style={mn.container}>
        <StatusBar barStyle="light-content" />
        <View style={mn.header}>
          <TouchableOpacity style={mn.backBtn} onPress={goBack} activeOpacity={0.7}>
            <Icon name="arrow-left" size={18} color={T1} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={mn.eyebrow}>{isFullSchedule ? "FULL SCHEDULE" : "MY READINGS"}</Text>
            <Text style={mn.title} numberOfLines={1}>{dayDef.label}</Text>
            {dateStr && <Text style={mn.subtitle}>{dateStr}</Text>}
          </View>
          <TouchableOpacity
            style={[mn.nameToggleBtn, hideNames && mn.nameToggleBtnActive]}
            onPress={async () => {
              const next = !hideNames;
              setHideNames(next);
              if (uid) {
                await firestore().collection("users").doc(uid)
                  .update({ paschaHideNames: next }).catch(() => {});
              }
            }}
            activeOpacity={0.75}>
            <Icon name={hideNames ? "account-off-outline" : "account-outline"} size={16}
              color={hideNames ? BLUE2 : T2} />
          </TouchableOpacity>
        </View>
        <View style={{ height: 74 }}>
          <DayTabBar
            allDays={allDays}
            selectedId={nav.dayId}
            easterDate={easterDate}
            schedule={schedule}
            uid={uid}
            onSelect={goToDay}
          />
        </View>
        <HourPagerController
          key={`${nav.dayId}__${nav.hourId || "0"}`}
          hours={dayDef.hours || []}
          daySchedule={daySchedule}
          uid={uid}
          isFullSchedule={isFullSchedule}
          hideNames={hideNames}
          targetHourId={nav.hourId}
        />
      </View>
    );
  }

  // ── Overview ────────────────────────────────────────────────────────────────
  return (
    <View style={mn.container}>
      <StatusBar barStyle="light-content" />
      <View style={mn.header}>
        <View style={{ flex: 1 }}>
          <Text style={mn.eyebrow}>HOLY WEEK  ·  PASCHA</Text>
          <Text style={mn.title}>{isFullSchedule ? "Schedule" : "My Readings"}</Text>
        </View>
      </View>
      <View style={{ height: 74 }}>
        <DayTabBar
          allDays={allDays}
          selectedId={null}
          easterDate={easterDate}
          schedule={schedule}
          uid={uid}
          onSelect={goToDay}
        />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 56, paddingTop: 8 }}>
        {showContent && totalMyReadings > 0 && (
          <View style={ov.summaryRow}>
            <View style={ov.summaryPill}>
              <Icon name="cross" size={12} color={BLUE2} />
              <Text style={ov.summaryTxt}>
                {totalMyReadings} reading{totalMyReadings !== 1 ? "s" : ""}
                {" · "}
                {myReadingsData.length} day{myReadingsData.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
        )}
        {showContent ? (
          totalMyReadings === 0 ? (
            <View style={ov.empty}>
              <View style={ov.emptyIconWrap}><Icon name="cross" size={28} color={T3} /></View>
              <Text style={ov.emptyTitle}>Not yet scheduled</Text>
              <Text style={ov.emptySub}>
                Your assigned readings will appear here once the schedule is set.
              </Text>
            </View>
          ) : (
            <View style={{ paddingTop: 8 }}>
              {myReadingsData.map(({ day }, i) => (
                <TimelineDayCard
                  key={day.id}
                  day={day}
                  daySchedule={schedule[day.id] || {}}
                  easterDate={easterDate}
                  uid={uid}
                  isLast={i === myReadingsData.length - 1}
                  onHourPress={goToHour}
                />
              ))}
            </View>
          )
        ) : (
          <View style={ov.empty}>
            <View style={ov.emptyIconWrap}><Icon name="cross" size={28} color={T3} /></View>
            <Text style={ov.emptyTitle}>Schedule not yet available</Text>
            <Text style={ov.emptySub}>Check back closer to Holy Week.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const ov = StyleSheet.create({
  summaryRow:    { paddingHorizontal: 20, marginBottom: 6 },
  summaryPill:   { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: BLUE_D, borderWidth: 1, borderColor: "rgba(59,130,246,0.25)" },
  summaryTxt:    { fontSize: 12, color: BLUE2, fontWeight: "400" },
  empty:         { alignItems: "center", padding: 56, gap: 12 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: GLASS, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: SEP },
  emptyTitle:    { fontSize: 18, fontWeight: "300", color: T1, letterSpacing: -0.2 },
  emptySub:      { fontSize: 14, color: T2, textAlign: "center", lineHeight: 21, maxWidth: 260, fontWeight: "400" },
});
const mn = StyleSheet.create({
  container:           { flex: 1, backgroundColor: BG },
  loadingWrap:         { flex: 1, backgroundColor: BG, justifyContent: "center", alignItems: "center" },
  header:              { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8, gap: 12 },
  backBtn:             { width: 36, height: 36, borderRadius: 18, backgroundColor: GLASS, borderWidth: 1, borderColor: SEP, justifyContent: "center", alignItems: "center" },
  eyebrow:             { fontSize: 11, fontWeight: "500", color: BLUE, letterSpacing: 1.8, marginBottom: 2 },
  title:               { fontSize: 26, fontWeight: "200", color: T1, letterSpacing: -0.6 },
  subtitle:            { fontSize: 13, color: "rgba(241,245,249,0.45)", fontWeight: "400", marginTop: 2 },
  nameToggleBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: GLASS, borderWidth: 1, borderColor: SEP, justifyContent: "center", alignItems: "center" },
  nameToggleBtnActive: { backgroundColor: BLUE_D, borderColor: "rgba(59,130,246,0.4)" },
});