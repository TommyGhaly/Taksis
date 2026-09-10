import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, Switch, Modal,
  StyleSheet, StatusBar, Platform,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import { doc, getFirestore, onSnapshot, updateDoc } from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import Avatar from "../../components/Avatar";
import SkeletonScreen from "../../components/Skeleton";
import useAfterInteractions from "../../hooks/useAfterInteractions";
import * as avatarCache from "../../utils/avatarCache";
import {
  expandReadings, isAssignableSlot, isPsalmSlot,
  hasLanguagePicker, effectiveLanguage, langShort,
  READING_META,
} from "../Pascha/PaschaReadingUtils";

// ── Tokens ────────────────────────────────────────────────────────────────────
const BG      = "#0f0f0f";
const CARD    = "#1c1c1e";
const CARD2   = "#2c2c2e";
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

// Coptic rKeys — these always render orange regardless of anything else
const COPTIC_RKEYS = new Set([
  "prophecies_coptic",
  "gospel_coptic",
  "gospels_coptic",
]);

// ── Font size multiplier (mirrors PaschaManager) ──────────────────────────────
const DEFAULT_FONT_MULTIPLIERS = { small: 0.85, medium: 1.0, large: 1.18 };

function resolvedFontScale(fontSizeScale, fontSizeMultipliers) {
  const map = fontSizeMultipliers != null ? fontSizeMultipliers : DEFAULT_FONT_MULTIPLIERS;
  const result = map[fontSizeScale];
  return result != null ? result : 1.0;
}

function sf(base, multiplier) {
  return Math.round(base * multiplier * 10) / 10;
}

// ── Day helpers ───────────────────────────────────────────────────────────────
function buildAllDays(shell) {
  if (!shell?.days) return [];
  return shell.days.map(d => ({
    id:           d.id,
    label:        d.label,
    easterOffset: d.easterOffset,
    shortLabel:   d.label,
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

function buildReadingLabel(row) {
  const meta = READING_META[row.rKey] || { label: row.rKey };
  if (row.rKey === "homily")     return `Homily — ${row.author || row.refText}`;
  if (row.rKey === "exposition") return "Exposition";
  if (row.index != null)         return `${meta.label} ${row.index + 1}`;
  return meta.label;
}

// ── Settings Sheet (home page variant: font size + hide names only) ───────────
const HomeSettingsSheet = ({ visible, fontSizeScale, hideNames, onSetFontSize, onToggleHideNames, onClose }) => (
  <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
    <View style={ss.backdrop}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      <View style={ss.sheet}>
        <View style={ss.handle} />
        <View style={ss.hdr}>
          <Text style={ss.hdrTitle}>Settings</Text>
          <TouchableOpacity style={ss.xBtn} onPress={onClose} activeOpacity={0.7}>
            <Icon name="close" size={17} color={T2} />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 12 }}>

          <View style={ss.card}>
            <View style={ss.row}>
              <View style={[ss.iconBox, { backgroundColor: BLUE_D }]}>
                <Icon name={hideNames ? "account-off-outline" : "account-outline"} size={19} color={BLUE2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ss.label}>Hide Reader Names</Text>
                <Text style={ss.desc}>
                  {hideNames ? "Reader names are hidden" : "Reader names are visible"}
                </Text>
              </View>
              <Switch
                value={hideNames}
                onValueChange={onToggleHideNames}
                trackColor={{ true: BLUE }}
              />
            </View>
          </View>

          <View style={ss.card}>
            <View style={ss.row}>
              <View style={[ss.iconBox, { backgroundColor: "rgba(167,139,250,0.12)" }]}>
                <Icon name="format-size" size={19} color="#a78bfa" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={ss.label}>Font Size</Text>
                <Text style={ss.desc}>{fontSizeScale.charAt(0).toUpperCase() + fontSizeScale.slice(1)}</Text>
              </View>
            </View>
            <View style={ss.fontSizeRow}>
              {["small", "medium", "large"].map(size => (
                <TouchableOpacity key={size} onPress={() => onSetFontSize(size)}
                  style={[ss.fontSizeBtn, fontSizeScale === size && ss.fontSizeBtnActive]}
                  activeOpacity={0.7}>
                  <Text style={[ss.fontSizeBtnTxt, fontSizeScale === size && ss.fontSizeBtnTxtActive,
                    { fontSize: size === "small" ? 12 : size === "large" ? 16 : 13 }]}>
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </ScrollView>
      </View>
    </View>
  </Modal>
);
const ss = StyleSheet.create({
  backdrop:             { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  sheet:                { backgroundColor: CARD, borderTopLeftRadius: 26, borderTopRightRadius: 26,
                          maxHeight: "90%", paddingBottom: Platform.OS === "ios" ? 34 : 20 },
  handle:               { width: 38, height: 4, borderRadius: 2, backgroundColor: SEP,
                          alignSelf: "center", marginTop: 12 },
  hdr:                  { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                          paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: SEP },
  hdrTitle:             { fontSize: 20, fontWeight: "700", color: T1 },
  xBtn:                 { width: 32, height: 32, borderRadius: 16, backgroundColor: CARD2,
                          justifyContent: "center", alignItems: "center" },
  card:                 { backgroundColor: CARD2, borderRadius: 14, padding: 16 },
  row:                  { flexDirection: "row", alignItems: "center", gap: 12, paddingRight: 4 },
  iconBox:              { width: 40, height: 40, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  label:                { fontSize: 15, fontWeight: "600", color: T1 },
  desc:                 { fontSize: 13, color: T2, marginTop: 2 },
  fontSizeRow:          { flexDirection: "row", gap: 10, marginTop: 12 },
  fontSizeBtn:          { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: CARD, alignItems: "center" },
  fontSizeBtnActive:    { backgroundColor: "rgba(167,139,250,0.2)", borderWidth: 1, borderColor: "rgba(167,139,250,0.4)" },
  fontSizeBtnTxt:       { fontSize: 13, fontWeight: "600", color: T2 },
  fontSizeBtnTxtActive: { color: "#a78bfa", fontWeight: "700" },
});

// ── Day Tab Bar ───────────────────────────────────────────────────────────────
const DayTabBar = ({ allDays, selectedId, easterDate, schedule, uid, onSelect, fontScale = 1 }) => (
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
          <Text
            style={[dt.label, active && dt.labelActive, { fontSize: sf(11, fontScale) }]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >{day.shortLabel}</Text>
          {dateStr && <Text style={[dt.date, active && dt.dateActive, { fontSize: sf(9, fontScale) }]}>{dateStr}</Text>}
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
const ReadingCard = ({ row, hourAssignments, uid, isFullSchedule, isMine, hideNames, fontScale = 1 }) => {
  const isCopticRow = COPTIC_RKEYS.has(row.rKey);
  const meta        = READING_META[row.rKey] || { label: row.rKey, icon: "book-outline", color: T2 };
  const isPsalm     = isPsalmSlot(row.rKey);
  const isExp       = row.rKey === "exposition";

  const accentColor = isCopticRow ? COPTIC_COLOR : meta.color;
  const accentBg    = isCopticRow ? COPTIC_BG    : meta.color + "1a";

  const label     = buildReadingLabel(row);
  const readers   = isPsalm ? (hourAssignments.psalm_readers || []) : [];
  const assignee  = !isPsalm ? (hourAssignments[row.slotKey] || null) : null;
  const hasAssign = isPsalm ? readers.length > 0 : !!assignee;
  const showNames = !hideNames && (isFullSchedule || isMine);
  const showLang  = isMine && hasLanguagePicker(row.rKey) && !isCopticRow;

  return (
    <View style={[rdc.card, isMine && rdc.cardMine, isCopticRow && rdc.cardCoptic]}>
      <View style={rdc.header}>
        <View style={[rdc.iconWrap, { backgroundColor: accentBg }]}>
          <Icon name={meta.icon} size={15} color={accentColor} />
        </View>

        <Text style={[rdc.typeLabel, { color: accentColor, fontSize: sf(11, fontScale) }]}>{label}</Text>

        {isCopticRow && (
          <View style={rdc.copticBadge}>
            <Text style={[rdc.copticBadgeTxt, { fontSize: sf(9, fontScale) }]}>COPTIC</Text>
          </View>
        )}

        {showLang && (
          <View style={rdc.langBadge}>
            <Text style={[rdc.langBadgeTxt, { fontSize: sf(9, fontScale) }]}>{langShort(effectiveLanguage(row, hourAssignments))}</Text>
          </View>
        )}

        {isMine && <View style={rdc.youPill}><Text style={[rdc.youTxt, { fontSize: sf(9, fontScale) }]}>You</Text></View>}
      </View>

      {!!row.refText && row.rKey !== "homily" && !isExp && (
        <Text style={[rdc.ref, { fontSize: sf(14, fontScale) }]}>{row.refText}</Text>
      )}

      {!!row.location && (
        <View style={rdc.locationRow}>
          <Icon name="map-marker-outline" size={11} color={T3} />
          <Text style={[rdc.loc, { fontSize: sf(11, fontScale) }]}>{row.location}</Text>
        </View>
      )}

      {hasAssign && showNames && (
        <View style={rdc.assigneeRow}>
          {isPsalm ? readers.map((r, i) => (
            <View key={r.uid || i} style={[rdc.chip, r.uid === uid && rdc.chipMe, isCopticRow && rdc.chipCoptic]}>
              <Avatar uid={r.uid} size={16} showBorder={false} style={rdc.chipAvatar} />
              <Text style={[rdc.chipName, r.uid === uid && rdc.chipNameMe, isCopticRow && rdc.chipNameCoptic,
                { fontSize: sf(11, fontScale) }]}
                numberOfLines={1}>{r.name}</Text>
            </View>
          )) : (
            <View style={[rdc.chip, isMine && rdc.chipMe, isCopticRow && rdc.chipCoptic]}>
              <Avatar uid={assignee.uid} size={16} showBorder={false} style={rdc.chipAvatar} />
              <Text style={[rdc.chipName, isMine && rdc.chipNameMe, isCopticRow && rdc.chipNameCoptic,
                { fontSize: sf(11, fontScale) }]}
                numberOfLines={1}>{assignee.name}</Text>
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
  copticBadge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: "rgba(245,158,11,0.20)", borderWidth: 1, borderColor: COPTIC_BORDER },
  copticBadgeTxt:  { fontSize: 9, fontWeight: "800", color: COPTIC_COLOR, letterSpacing: 0.5 },
  langBadge:       { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, backgroundColor: GLASS2 },
  langBadgeTxt:    { fontSize: 9, fontWeight: "700", color: T3, letterSpacing: 0.3 },
  youPill:         { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: BLUE_D, borderWidth: 1, borderColor: "rgba(59,130,246,0.3)" },
  youTxt:          { fontSize: 9, fontWeight: "700", color: BLUE2, letterSpacing: 0.4 },
  ref:             { fontSize: 14, color: T1, fontWeight: "300", lineHeight: 21, marginBottom: 3 },
  locationRow:     { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 3 },
  loc:             { fontSize: 11, color: T3, fontWeight: "400" },
  assigneeRow:     { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: SEP },
  chip:            { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: GLASS2, borderWidth: 1, borderColor: SEP, borderRadius: 20, paddingVertical: 3, paddingHorizontal: 8 },
  chipAvatar:      { backgroundColor: GLASS2 },
  chipMe:          { backgroundColor: BLUE_D, borderColor: "rgba(59,130,246,0.3)" },
  chipCoptic:      { backgroundColor: COPTIC_BG, borderColor: COPTIC_BORDER },
  chipName:        { fontSize: 11, fontWeight: "500", color: T2, maxWidth: 100 },
  chipNameMe:      { color: BLUE2, fontWeight: "600" },
  chipNameCoptic:  { color: COPTIC_COLOR, fontWeight: "600" },
});

// ── Single Hour Page ──────────────────────────────────────────────────────────
const HourPage = ({ hour, ha, uid, isFullSchedule, hideNames, pageWidth, pageLabel, fontScale = 1 }) => {
  const mySlotSet  = getMySlots(hour, ha, uid);
  const hasMe      = mySlotSet.size > 0;
  const assignable = expandReadings(hour, ha).filter(r => isAssignableSlot(r.rKey) || isPsalmSlot(r.rKey));
  return (
    <View style={{ width: pageWidth }}>
      <View style={pg.hourHeader}>
        <View style={[pg.hourAccent, { backgroundColor: hasMe ? BLUE : "rgba(255,255,255,0.15)" }]} />
        <View style={{ flex: 1 }}>
          <Text style={[pg.hourLabel, { fontSize: sf(17, fontScale) }]}>{hour.label}</Text>
          {hasMe && (
            <Text style={[pg.hourSub, { fontSize: sf(12, fontScale) }]}>
              {mySlotSet.size} reading{mySlotSet.size !== 1 ? "s" : ""} for you
            </Text>
          )}
        </View>
        <Text style={[pg.pageCount, { fontSize: sf(11, fontScale) }]}>{pageLabel}</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pg.cardsScroll}>
        {assignable.length === 0
          ? <View style={pg.emptyHour}><Text style={[pg.emptyHourTxt, { fontSize: sf(13, fontScale) }]}>No assigned readings</Text></View>
          : assignable.map(row => (
            <ReadingCard
              key={row.slotKey}
              row={row}
              hourAssignments={ha}
              uid={uid}
              isFullSchedule={isFullSchedule}
              isMine={mySlotSet.has(row.slotKey)}
              hideNames={hideNames}
              fontScale={fontScale}
            />
          ))
        }
      </ScrollView>
    </View>
  );
};

// ── Hour Pager ────────────────────────────────────────────────────────────────
const HourPagerController = ({ hours, daySchedule, uid, isFullSchedule, hideNames, targetHourId, fontScale = 1 }) => {
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
        <Text style={[pg.emptyTxt, { fontSize: sf(14, fontScale) }]}>No readings assigned for this day</Text>
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
            fontScale={fontScale}
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
const TimelineDayCard = ({ day, daySchedule, easterDate, uid, isLast, onHourPress, fontScale = 1 }) => {
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
  const total = myHours.reduce((a, h) => a + h.rows.length, 0);

  const allTypes = [...new Set(myHours.flatMap(h => h.rows.map(r => r.rKey)))];

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
              <Text style={[tl.dayLabel, { fontSize: sf(16, fontScale) }]}>{day.label}</Text>
              {dateStr && <Text style={[tl.dateStr, { fontSize: sf(12, fontScale) }]}>{dateStr}</Text>}
            </View>
            <View style={tl.badge}><Text style={[tl.badgeNum, { fontSize: sf(15, fontScale) }]}>{total}</Text></View>
          </View>
          <View style={tl.pillRow}>
            {allTypes.map(rKey => {
              const m           = READING_META[rKey] || { icon: "book-outline", color: T3, label: rKey };
              const isCopticKey = COPTIC_RKEYS.has(rKey);
              return (
                <View key={rKey} style={[
                  tl.pill,
                  { backgroundColor: m.color + "18", borderColor: m.color + "45" },
                  isCopticKey && tl.pillCoptic,
                ]}>
                  <Icon name={m.icon} size={10} color={m.color} />
                  <Text style={[tl.pillTxt, { color: m.color, fontSize: sf(10, fontScale) }]}>{m.label}</Text>
                </View>
              );
            })}
          </View>
        </TouchableOpacity>
        {myHours.map(({ hour, rows }, hi) => (
          <TouchableOpacity key={hour.id}
            style={[tl.hourRow, hi > 0 && { borderTopWidth: 1, borderTopColor: SEP }]}
            onPress={() => onHourPress(day.id, hour.id)} activeOpacity={0.7}>
            <Text style={[tl.hourLabel, { fontSize: sf(13, fontScale) }]}>{hour.label}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={[tl.hourCount, { fontSize: sf(12, fontScale) }]}>{rows.length} {rows.length === 1 ? "reading" : "readings"}</Text>
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
  pillCoptic:  { borderWidth: 1.5 },
  pillTxt:     { fontSize: 10, fontWeight: "500", letterSpacing: 0.3 },
  hourRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 9 },
  hourLabel:   { fontSize: 13, color: T2, fontWeight: "400" },
  hourCount:   { fontSize: 12, color: BLUE2, fontWeight: "400" },
});

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PaschaHomePage() {
  const isMounted = useRef(true);

  // Hold the four Firestore listeners below until the drawer/stack transition
  // has finished animating — they otherwise stall it mid-slide.
  const ready = useAfterInteractions();

  const [uid, setUid]               = useState(null);
  const [churchId, setChurchId]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [scheduleShell, setScheduleShell] = useState(null);
  const [assignees, setAssignees]   = useState({});
  // `assignees` is {} both before the schedule doc is read and when nobody is
  // assigned, so track the read separately — otherwise "Not yet scheduled"
  // paints while the snapshot is still in flight.
  const [assigneesLoaded, setAssigneesLoaded] = useState(false);
  const [easterDate, setEasterDate] = useState(null);
  const [fullScheduleOn, setFullScheduleOn] = useState(false);
  const [myReadingsOn, setMyReadingsOn]     = useState(false);
  const [hideNames, setHideNames]   = useState(false);
  const [nav, setNav]               = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fontSizeScale, setFontSizeScale] = useState("medium");
  const [fontSizeMultipliers, setFontSizeMultipliers] = useState(DEFAULT_FONT_MULTIPLIERS);

  const isFullSchedule = fullScheduleOn;
  const fontScale = resolvedFontScale(fontSizeScale, fontSizeMultipliers);

  const allDays  = useMemo(() => buildAllDays(scheduleShell), [scheduleShell]);
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
    if (!ready) return;
    isMounted.current = true;
    const user = getAuth().currentUser;
    if (!user) return;
    setUid(user.uid);
    const unsub = onSnapshot(doc(getFirestore(), "users", user.uid), doc => {
      if (!isMounted.current || !doc.exists) return;
      const data = doc.data();
      // Free: this doc is already being read, so adopt its photoURL.
      avatarCache.primeFromUser({ uid: user.uid, ...data });
      setChurchId(data.church || null);
      setHideNames(data.paschaHideNames ?? false);
      setFontSizeScale(data.paschaFontSize ?? "medium");
    });
    return () => { isMounted.current = false; unsub(); };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    if (!churchId) return;
    const unsubShell = onSnapshot(
      doc(
        getFirestore(),
        "churches",
        churchId,
        "pascha",
        "schedule_config"
      ),
      doc => {
        if (!isMounted.current) return;
        if (doc.exists) setScheduleShell(doc.data());
      }
    );
    const unsubConfig = onSnapshot(
      doc(getFirestore(), "churches", churchId, "pascha", "config"),
      doc => {
        if (!isMounted.current) return;
        setLoading(false);
        if (!doc.exists) return;
        const d = doc.data();
        setFullScheduleOn(d.fullScheduleVisible ?? false);
        setMyReadingsOn(d.myReadingsVisible ?? false);
        setEasterDate(d.easterDate ?? null);
        if (d.fontSizeMultipliers) setFontSizeMultipliers(d.fontSizeMultipliers);
      }
    );
    const unsubSchedule = onSnapshot(
      doc(getFirestore(), "churches", churchId, "pascha", "schedule"),
      doc => {
        if (!isMounted.current) return;
        setAssignees(doc.exists ? doc.data() : {});
        setAssigneesLoaded(true);
      }
    );
    return () => { unsubShell(); unsubConfig(); unsubSchedule(); };
  }, [churchId, ready]);

  const persistHideNames = useCallback(async (next) => {
    setHideNames(next);
    if (uid) {
      await updateDoc(doc(getFirestore(), "users", uid), { paschaHideNames: next }).catch(() => {});
    }
  }, [uid]);

  const persistFontSize = useCallback(async (size) => {
    setFontSizeScale(size);
    if (uid) {
      await updateDoc(doc(getFirestore(), "users", uid), { paschaFontSize: size }).catch(() => {});
    }
  }, [uid]);

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

  if (!ready || loading || !scheduleShell || !assigneesLoaded) {
    // Header + a stack of day cards — the same shape the schedule lands in.
    return <SkeletonScreen variant="cards" count={6} />;
  }

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
            <Text style={[mn.eyebrow, { fontSize: sf(11, fontScale) }]}>
              {isFullSchedule ? "FULL SCHEDULE" : "MY READINGS"}
            </Text>
            <Text style={[mn.title, { fontSize: sf(26, fontScale) }]} numberOfLines={1}>{dayDef.label}</Text>
            {dateStr && <Text style={[mn.subtitle, { fontSize: sf(13, fontScale) }]}>{dateStr}</Text>}
          </View>
          <TouchableOpacity style={mn.cogBtn} onPress={() => setSettingsOpen(true)} activeOpacity={0.7}>
            <Icon name="cog-outline" size={18} color={T2} />
          </TouchableOpacity>
        </View>
        <View style={{ height: 74 }}>
          <DayTabBar allDays={allDays} selectedId={nav.dayId} easterDate={easterDate}
            schedule={schedule} uid={uid} onSelect={goToDay} fontScale={fontScale} />
        </View>
        <HourPagerController
          key={`${nav.dayId}__${nav.hourId || "0"}`}
          hours={dayDef.hours || []}
          daySchedule={daySchedule}
          uid={uid}
          isFullSchedule={isFullSchedule}
          hideNames={hideNames}
          targetHourId={nav.hourId}
          fontScale={fontScale}
        />
        <HomeSettingsSheet
          visible={settingsOpen}
          fontSizeScale={fontSizeScale}
          hideNames={hideNames}
          onSetFontSize={persistFontSize}
          onToggleHideNames={persistHideNames}
          onClose={() => setSettingsOpen(false)}
        />
      </View>
    );
  }

  return (
    <View style={mn.container}>
      <StatusBar barStyle="light-content" />
      <View style={mn.header}>
        <View style={{ flex: 1 }}>
          <Text style={[mn.eyebrow, { fontSize: sf(11, fontScale) }]}>HOLY WEEK  ·  PASCHA</Text>
          <Text style={[mn.title, { fontSize: sf(26, fontScale) }]}>{isFullSchedule ? "Schedule" : "My Readings"}</Text>
        </View>
        <TouchableOpacity style={mn.cogBtn} onPress={() => setSettingsOpen(true)} activeOpacity={0.7}>
          <Icon name="cog-outline" size={20} color={T2} />
        </TouchableOpacity>
      </View>
      <View style={{ height: 74 }}>
        <DayTabBar allDays={allDays} selectedId={null} easterDate={easterDate}
          schedule={schedule} uid={uid} onSelect={goToDay} fontScale={fontScale} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 56, paddingTop: 8 }}>
        {showContent && totalMyReadings > 0 && (
          <View style={ov.summaryRow}>
            <View style={ov.summaryPill}>
              <Icon name="cross" size={12} color={BLUE2} />
              <Text style={[ov.summaryTxt, { fontSize: sf(12, fontScale) }]}>
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
              <Text style={[ov.emptyTitle, { fontSize: sf(18, fontScale) }]}>Not yet scheduled</Text>
              <Text style={[ov.emptySub, { fontSize: sf(14, fontScale) }]}>Your assigned readings will appear here once the schedule is set.</Text>
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
                  fontScale={fontScale}
                />
              ))}
            </View>
          )
        ) : (
          <View style={ov.empty}>
            <View style={ov.emptyIconWrap}><Icon name="cross" size={28} color={T3} /></View>
            <Text style={[ov.emptyTitle, { fontSize: sf(18, fontScale) }]}>Schedule not yet available</Text>
            <Text style={[ov.emptySub, { fontSize: sf(14, fontScale) }]}>Check back closer to Holy Week.</Text>
          </View>
        )}
      </ScrollView>
      <HomeSettingsSheet
        visible={settingsOpen}
        fontSizeScale={fontSizeScale}
        hideNames={hideNames}
        onSetFontSize={persistFontSize}
        onToggleHideNames={persistHideNames}
        onClose={() => setSettingsOpen(false)}
      />
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
  header:              { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8, gap: 12 },
  backBtn:             { width: 36, height: 36, borderRadius: 18, backgroundColor: GLASS, borderWidth: 1, borderColor: SEP, justifyContent: "center", alignItems: "center" },
  cogBtn:              { width: 40, height: 40, borderRadius: 20, backgroundColor: GLASS, borderWidth: 1, borderColor: SEP, justifyContent: "center", alignItems: "center" },
  eyebrow:             { fontSize: 11, fontWeight: "500", color: BLUE, letterSpacing: 1.8, marginBottom: 2 },
  title:               { fontSize: 26, fontWeight: "200", color: T1, letterSpacing: -0.6 },
  subtitle:            { fontSize: 13, color: "rgba(241,245,249,0.45)", fontWeight: "400", marginTop: 2 },
});