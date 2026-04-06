import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  StyleSheet, ActivityIndicator, Image, Platform,
  FlatList, Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import {
  expandReadings, countSlots, dayProgress as dayTotals,
  isAssignableSlot, isPsalmSlot, hasLanguagePicker, effectiveLanguage, langShort,
  psalmReadersKey, READING_META,
} from "../screens/Pascha/PaschaReadingUtils";

const DEFAULT_AVATAR = require("../assets/default_profile.png");
const { width: SCREEN_W } = Dimensions.get("window");

// ── Tokens ────────────────────────────────────────────────────────────────────
const BG      = "#0f0f0f";
const CARD    = "#1c1c1e";
const CARD2   = "#2c2c2e";
const CARD3   = "#3a3a3c";
const SEP     = "rgba(255,255,255,0.08)";
const BLUE    = "#0a84ff";
const BLUEDIM = "rgba(10,132,255,0.15)";
const GREEN   = "#30d158";
const ORANGE  = "#ff9f0a";
const T1      = "#ffffff";
const T2      = "rgba(255,255,255,0.65)";
const T3      = "rgba(255,255,255,0.28)";
const COPTIC_COLOR  = "#f59e0b";
const COPTIC_BG     = "rgba(245,158,11,0.10)";
const COPTIC_BORDER = "rgba(245,158,11,0.28)";

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildAllDays(shell) {
  if (!shell?.days) return [];
  return shell.days.map(d => ({
    id:           d.id,
    label:        d.label,
    easterOffset: d.easterOffset,
    shortLabel:   d.shortLabel ?? d.label.split(" ").slice(0, 2).join(" "),
    hours:        d.hours ?? [],
  }));
}

function calcDate(easter, offset) {
  if (!easter) return null;
  const d = new Date(easter);
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmtDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Archive docs store a merged schedule[dayId][hourId][slotKey].
// We need to reconstruct allDays from the archived shell if present,
// falling back to the schedule's keys.
function allDaysFromArchive(arc) {
  if (arc.shell?.days) return buildAllDays(arc.shell);
  // Legacy: no shell stored — derive day list from schedule keys
  const ids = Object.keys(arc.schedule || {});
  return ids.map(id => ({
    id,
    label:        id.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    easterOffset: 0,
    shortLabel:   id.split("_").slice(0, 2).join(" "),
    hours:        Object.keys((arc.schedule || {})[id] || {}).map(hid => ({ id: hid, label: hid, readings: {} })),
  }));
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function useProfilePic(uid) {
  const [uri, setUri] = useState(null);
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    storage().ref(`profilePictures/${uid}.png`).getDownloadURL()
      .then(url => { if (!cancelled) setUri(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [uid]);
  return uri;
}

const Avatar = ({ uid, size = 24, style }) => {
  const uri = useProfilePic(uid);
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: CARD3 }, style]}>
      <Image source={uri ? { uri } : DEFAULT_AVATAR} style={{ width: size, height: size }} resizeMode="cover" />
    </View>
  );
};

// ── Reading row ───────────────────────────────────────────────────────────────
const ReadingRow = ({ row, hourAssignments, isLast }) => {
  const meta         = READING_META[row.rKey] || { label: row.rKey, icon: "book-outline", color: T2 };
  const isPsalm      = isPsalmSlot(row.rKey);
  const isHom        = row.rKey === "homily";
  const isExp        = row.rKey === "exposition";
  const isCopticRow  = row.isCoptic === true;

  let label;
  if (isHom)              label = `Homily — ${row.author || row.refText}`;
  else if (isExp)         label = "Exposition";
  else if (row.index != null) label = `${meta.label} ${row.index + 1}`;
  else                    label = meta.label;

  const psalmReaders = isPsalm ? (hourAssignments.psalm_readers || []) : [];
  const assignee     = !isPsalm ? (hourAssignments[row.slotKey] || null) : null;
  const hasAssign    = isPsalm ? psalmReaders.length > 0 : !!assignee;

  return (
    <View style={[rr.row, !isLast && rr.border]}>
      <View style={[rr.iconBox, { backgroundColor: isCopticRow ? COPTIC_BG : meta.color + "20" }]}>
        <Icon name={meta.icon} size={12} color={isCopticRow ? COPTIC_COLOR : meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[rr.type, { color: isCopticRow ? COPTIC_COLOR : meta.color }]}>{label}</Text>
          {isCopticRow
            ? <View style={rr.copticBadge}><Text style={rr.copticBadgeTxt}>COPTIC</Text></View>
            : hasLanguagePicker(row.rKey) && (
                <View style={rr.langBadge}>
                  <Text style={rr.langBadgeTxt}>{langShort(effectiveLanguage(row, hourAssignments))}</Text>
                </View>
              )
          }
        </View>
        {!!row.refText && !isHom && !isExp && (
          <Text style={rr.ref} numberOfLines={2}>{row.refText}</Text>
        )}
      </View>
      <View style={rr.assigneeCol}>
        {hasAssign ? (
          isPsalm ? (
            <View style={{ gap: 4, alignItems: "flex-end" }}>
              {psalmReaders.map((r, i) => (
                <View key={r.uid || r.name || i} style={[rr.chip, isCopticRow && rr.chipCoptic]}>
                  <Avatar uid={r.uid} size={18} />
                  <Text style={[rr.chipName, isCopticRow && rr.chipNameCoptic]} numberOfLines={1}>{r.name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={[rr.chip, isCopticRow && rr.chipCoptic]}>
              <Avatar uid={assignee.uid} size={18} />
              <Text style={[rr.chipName, isCopticRow && rr.chipNameCoptic]} numberOfLines={1}>{assignee.name}</Text>
            </View>
          )
        ) : (
          <Text style={rr.unassigned}>—</Text>
        )}
      </View>
    </View>
  );
};
const rr = StyleSheet.create({
  row:            { flexDirection: "row", alignItems: "flex-start", paddingVertical: 10, gap: 10 },
  border:         { borderBottomWidth: 1, borderBottomColor: SEP },
  iconBox:        { width: 24, height: 24, borderRadius: 7, justifyContent: "center", alignItems: "center", flexShrink: 0, marginTop: 1 },
  type:           { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  copticBadge:    { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, backgroundColor: COPTIC_BG, borderWidth: 1, borderColor: COPTIC_BORDER },
  copticBadgeTxt: { fontSize: 8, fontWeight: "800", color: COPTIC_COLOR, letterSpacing: 0.3 },
  langBadge:      { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, backgroundColor: CARD3 },
  langBadgeTxt:   { fontSize: 8, fontWeight: "700", color: T3, letterSpacing: 0.3 },
  ref:            { fontSize: 12, color: T2, marginTop: 2, lineHeight: 17 },
  assigneeCol:    { alignItems: "flex-end", flexShrink: 0, maxWidth: "45%" },
  chip:           { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(48,209,88,0.08)", borderWidth: 1, borderColor: "rgba(48,209,88,0.18)", borderRadius: 20, paddingVertical: 3, paddingHorizontal: 7 },
  chipCoptic:     { backgroundColor: COPTIC_BG, borderColor: COPTIC_BORDER },
  chipName:       { fontSize: 11, fontWeight: "600", color: GREEN, maxWidth: 90 },
  chipNameCoptic: { color: COPTIC_COLOR },
  unassigned:     { fontSize: 13, color: T3 },
});

// ── Hour card ─────────────────────────────────────────────────────────────────
const HourCard = ({ hour, hourAssignments }) => {
  const rows              = expandReadings(hour);
  const assignableRows    = rows.filter(r => isAssignableSlot(r.rKey) || isPsalmSlot(r.rKey));
  const { total, filled } = countSlots(hour, hourAssignments);
  const complete          = total > 0 && filled === total;
  const pct               = total > 0 ? Math.round(filled / total * 100) : 0;

  return (
    <View style={hc.card}>
      <View style={hc.cardTop}>
        <View style={[hc.accent, { backgroundColor: complete ? GREEN : pct > 0 ? BLUE : CARD3 }]} />
        <Text style={hc.label}>{hour.label}</Text>
        <View style={[hc.badge, complete && hc.badgeGreen]}>
          {complete
            ? <Icon name="check" size={10} color={GREEN} />
            : <Text style={hc.badgeTxt}>{pct}%</Text>
          }
        </View>
      </View>
      {assignableRows.length > 0 && (
        <View style={hc.body}>
          {assignableRows.map((row, i) => (
            <ReadingRow
              key={row.slotKey}
              row={row}
              hourAssignments={hourAssignments}
              isLast={i === assignableRows.length - 1}
            />
          ))}
        </View>
      )}
    </View>
  );
};
const hc = StyleSheet.create({
  card:      { backgroundColor: CARD2, borderRadius: 14, marginBottom: 10, overflow: "hidden" },
  cardTop:   { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  accent:    { width: 3, alignSelf: "stretch", borderRadius: 2, flexShrink: 0 },
  label:     { flex: 1, fontSize: 14, fontWeight: "700", color: T1 },
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: CARD3 },
  badgeGreen:{ backgroundColor: "rgba(48,209,88,0.1)", borderWidth: 1, borderColor: "rgba(48,209,88,0.25)" },
  badgeTxt:  { fontSize: 11, fontWeight: "700", color: T2 },
  body:      { borderTopWidth: 1, borderTopColor: SEP, paddingHorizontal: 14, paddingBottom: 8 },
});

// ── Day page ──────────────────────────────────────────────────────────────────
const PAGE_W = SCREEN_W - 32;

const DayPage = ({ day, daySchedule, easterDate }) => {
  const hours              = day.hours || [];
  const { total, filled }  = dayTotals(day, daySchedule);
  const pct                = total > 0 ? Math.round(filled / total * 100) : 0;
  const complete           = pct === 100;
  const dateStr            = easterDate ? calcDate(easterDate, day.easterOffset) : null;

  return (
    <View style={{ width: PAGE_W }}>
      <View style={dp.headerCard}>
        <View style={dp.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={dp.dayLabel}>{day.label}</Text>
            {dateStr && <Text style={dp.dayDate}>{dateStr}</Text>}
          </View>
          {complete
            ? <View style={dp.donePill}>
                <Icon name="check" size={11} color={GREEN} />
                <Text style={dp.doneTxt}>Complete</Text>
              </View>
            : <View style={dp.pctPill}><Text style={dp.pctTxt}>{pct}%</Text></View>
          }
        </View>
        <View style={dp.track}>
          <View style={[dp.trackFill, { width: `${pct}%` }, complete && { backgroundColor: GREEN }]} />
        </View>
        <Text style={dp.countTxt}>{filled} of {total} readings assigned</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }} nestedScrollEnabled>
        {hours.map(h => (
          <HourCard key={h.id} hour={h} hourAssignments={daySchedule[h.id] || {}} />
        ))}
      </ScrollView>
    </View>
  );
};
const dp = StyleSheet.create({
  headerCard:  { backgroundColor: CARD, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: SEP },
  headerTop:   { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  dayLabel:    { fontSize: 18, fontWeight: "800", color: T1, letterSpacing: -0.3 },
  dayDate:     { fontSize: 12, color: T2, marginTop: 3 },
  donePill:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(48,209,88,0.1)", borderWidth: 1, borderColor: "rgba(48,209,88,0.25)" },
  doneTxt:     { fontSize: 11, fontWeight: "700", color: GREEN },
  pctPill:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: CARD2 },
  pctTxt:      { fontSize: 12, fontWeight: "700", color: T2 },
  track:       { height: 3, backgroundColor: CARD2, borderRadius: 2, marginBottom: 10 },
  trackFill:   { height: 3, backgroundColor: BLUE, borderRadius: 2 },
  countTxt:    { fontSize: 12, color: T3 },
});

// ── Day tab strip ─────────────────────────────────────────────────────────────
const DayTabStrip = ({ days, selectedIndex, schedule, easterDate, onSelect }) => {
  const scrollRef = useRef(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ x: Math.max(0, selectedIndex * 70 - 100), animated: true });
  }, [selectedIndex]);

  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={ts.content} style={ts.bar}>
      {days.map((day, i) => {
        const { total, filled } = dayTotals(day, schedule?.[day.id] || {});
        const complete          = total > 0 && filled === total;
        const started           = filled > 0 && !complete;
        const active            = i === selectedIndex;
        return (
          <TouchableOpacity key={day.id} onPress={() => onSelect(i)}
            style={[ts.tab, active && ts.tabActive]} activeOpacity={0.75}>
            <View style={[ts.dot, complete ? ts.dotGreen : started ? ts.dotBlue : ts.dotGray]} />
            <Text style={[ts.label, active && ts.labelActive]} numberOfLines={1}>{day.shortLabel}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};
const ts = StyleSheet.create({
  bar:        { backgroundColor: BG, borderBottomWidth: 1, borderBottomColor: SEP },
  content:    { paddingHorizontal: 12, paddingVertical: 8, gap: 6, flexDirection: "row" },
  tab:        { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: CARD, alignItems: "center", justifyContent: "center", minWidth: 70 },
  tabActive:  { backgroundColor: BLUEDIM, borderWidth: 1, borderColor: "rgba(10,132,255,0.35)" },
  dot:        { width: 5, height: 5, borderRadius: 2.5, marginBottom: 5 },
  dotGray:    { backgroundColor: T3 },
  dotBlue:    { backgroundColor: BLUE },
  dotGreen:   { backgroundColor: GREEN },
  label:      { fontSize: 12, fontWeight: "600", color: T2, textAlign: "center" },
  labelActive:{ color: BLUE },
});

// ── Stats bar ─────────────────────────────────────────────────────────────────
const StatsBar = ({ allDays, schedule }) => {
  let total = 0, filled = 0, daysComplete = 0;
  allDays.forEach(day => {
    const { total: t, filled: f } = dayTotals(day, schedule?.[day.id] || {});
    total += t; filled += f;
    if (t > 0 && f === t) daysComplete++;
  });
  const pct = total > 0 ? Math.round(filled / total * 100) : 0;
  return (
    <View style={sb.wrap}>
      {[
        { val: `${pct}%`,         lbl: "Assigned",  color: T1    },
        { val: daysComplete,       lbl: "Days Done", color: GREEN },
        { val: `${filled}/${total}`, lbl: "Readings", color: T1  },
      ].map(({ val, lbl, color }, i, arr) => (
        <React.Fragment key={lbl}>
          <View style={sb.stat}>
            <Text style={[sb.val, { color }]}>{val}</Text>
            <Text style={sb.lbl}>{lbl}</Text>
          </View>
          {i < arr.length - 1 && <View style={sb.div} />}
        </React.Fragment>
      ))}
    </View>
  );
};
const sb = StyleSheet.create({
  wrap: { flexDirection: "row", backgroundColor: CARD, marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: SEP },
  stat: { flex: 1, alignItems: "center" },
  val:  { fontSize: 19, fontWeight: "800", letterSpacing: -0.5 },
  lbl:  { fontSize: 11, color: T2, marginTop: 3 },
  div:  { width: 1, backgroundColor: SEP, marginHorizontal: 4 },
});

// ── Year card ─────────────────────────────────────────────────────────────────
const YearCard = ({ arc, onPress }) => {
  const allDays           = useMemo(() => allDaysFromArchive(arc), [arc]);
  const { total, filled } = useMemo(() => {
    let t = 0, f = 0;
    allDays.forEach(day => {
      const s = dayTotals(day, arc.schedule?.[day.id] || {});
      t += s.total; f += s.filled;
    });
    return { total: t, filled: f };
  }, [allDays, arc]);
  const pct      = total > 0 ? Math.round(filled / total * 100) : 0;
  const complete = pct === 100;

  return (
    <TouchableOpacity style={yc.card} onPress={onPress} activeOpacity={0.75}>
      <View style={yc.top}>
        <View style={yc.iconBox}><Icon name="cross" size={20} color={ORANGE} /></View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={yc.year}>Pascha {arc.year}</Text>
          {arc.archivedAt && <Text style={yc.sub}>Archived {fmtDate(arc.archivedAt)}</Text>}
        </View>
        {complete
          ? <View style={yc.donePill}>
              <Icon name="check" size={10} color={GREEN} />
              <Text style={yc.doneTxt}>Complete</Text>
            </View>
          : <Text style={yc.pct}>{pct}%</Text>
        }
        <Icon name="chevron-right" size={16} color={T3} style={{ marginLeft: 10 }} />
      </View>
      <View style={yc.trackWrap}>
        <View style={[yc.trackFill, { width: `${pct}%` }, complete && { backgroundColor: GREEN }]} />
      </View>
      <View style={yc.dots}>
        {allDays.map(d => {
          const { total: t, filled: f } = dayTotals(d, arc.schedule?.[d.id] || {});
          const c = t > 0 && f === t, s = f > 0 && !c;
          return <View key={d.id} style={[yc.dot, c && yc.dotGreen, s && yc.dotBlue]} />;
        })}
      </View>
    </TouchableOpacity>
  );
};
const yc = StyleSheet.create({
  card:     { backgroundColor: CARD, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: SEP, marginBottom: 12 },
  top:      { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  iconBox:  { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,159,10,0.1)", justifyContent: "center", alignItems: "center", flexShrink: 0 },
  year:     { fontSize: 17, fontWeight: "800", color: T1, letterSpacing: -0.3 },
  sub:      { fontSize: 12, color: T3, marginTop: 2 },
  donePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: "rgba(48,209,88,0.1)", borderWidth: 1, borderColor: "rgba(48,209,88,0.25)" },
  doneTxt:  { fontSize: 10, fontWeight: "700", color: GREEN },
  pct:      { fontSize: 13, fontWeight: "700", color: T2 },
  trackWrap:{ height: 4, backgroundColor: CARD2, borderRadius: 2, marginBottom: 10 },
  trackFill:{ height: 4, backgroundColor: BLUE, borderRadius: 2 },
  dots:     { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  dot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: CARD3 },
  dotGreen: { backgroundColor: GREEN },
  dotBlue:  { backgroundColor: BLUE },
});

// ── Main ──────────────────────────────────────────────────────────────────────
const PaschaArchiveViewer = ({ visible, churchId, onClose }) => {
  const [archives, setArchives]         = useState([]);
  const [loading, setLoading]           = useState(false);
  const [selectedYear, setSelectedYear] = useState(null);
  const [pageIndex, setPageIndex]       = useState(0);
  const pagerRef                        = useRef(null);

  useEffect(() => {
    if (!visible || !churchId) return;
    setLoading(true); setSelectedYear(null); setPageIndex(0); setArchives([]);
    firestore().collection("churches").doc(churchId).collection("pascha").get()
      .then(snap => {
        const found = [];
        snap.forEach(doc => {
          if (!doc.id.startsWith("archive_")) return;
          found.push({ year: doc.id.replace("archive_", ""), ...doc.data() });
        });
        found.sort((a, b) => b.year - a.year);
        setArchives(found);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, churchId]);

  const selected = useMemo(
    () => archives.find(a => a.year === selectedYear) || null,
    [archives, selectedYear]
  );

  const selectedAllDays = useMemo(
    () => selected ? allDaysFromArchive(selected) : [],
    [selected]
  );

  const handleDaySelect = i => {
    setPageIndex(i);
    pagerRef.current?.scrollToIndex({ index: i, animated: true });
  };

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={av.overlay}>
        <View style={av.sheet}>
          <View style={av.handle} />
          <View style={av.hdr}>
            {selectedYear ? (
              <TouchableOpacity style={av.backBtn} onPress={() => setSelectedYear(null)} activeOpacity={0.7}>
                <Icon name="arrow-left" size={18} color={T1} />
              </TouchableOpacity>
            ) : (
              <View style={av.iconBox}><Icon name="archive-outline" size={19} color={ORANGE} /></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={av.title}>{selectedYear ? `Pascha ${selectedYear}` : "Archived Schedules"}</Text>
              {selected?.archivedAt && <Text style={av.sub}>Archived {fmtDate(selected.archivedAt)}</Text>}
            </View>
            <TouchableOpacity style={av.xBtn} onPress={onClose} activeOpacity={0.7}>
              <Icon name="close" size={17} color={T2} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={av.center}>
              <ActivityIndicator color={ORANGE} size="large" />
              <Text style={av.loadingTxt}>Loading archives…</Text>
            </View>
          ) : archives.length === 0 ? (
            <View style={av.center}>
              <View style={av.emptyIconWrap}><Icon name="archive-off-outline" size={34} color={T3} /></View>
              <Text style={av.emptyTitle}>No Archives Yet</Text>
              <Text style={av.emptySub}>Archive a schedule from Settings to see it here.</Text>
            </View>
          ) : !selectedYear ? (
            <ScrollView contentContainerStyle={av.list} showsVerticalScrollIndicator={false}>
              <Text style={av.sectionLabel}>
                {archives.length} archived year{archives.length > 1 ? "s" : ""}
              </Text>
              {archives.map(a => (
                <YearCard key={a.year} arc={a} onPress={() => { setSelectedYear(a.year); setPageIndex(0); }} />
              ))}
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>
              <StatsBar allDays={selectedAllDays} schedule={selected.schedule} />
              <DayTabStrip
                days={selectedAllDays}
                selectedIndex={pageIndex}
                schedule={selected.schedule}
                easterDate={selected.easterDate}
                onSelect={handleDaySelect}
              />
              <FlatList
                ref={pagerRef}
                data={selectedAllDays}
                keyExtractor={d => d.id}
                horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                snapToInterval={PAGE_W + 16}
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, gap: 16 }}
                onMomentumScrollEnd={e => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / (PAGE_W + 16));
                  setPageIndex(idx);
                }}
                getItemLayout={(_, index) => ({
                  length: PAGE_W + 16, offset: (PAGE_W + 16) * index, index,
                })}
                renderItem={({ item: day }) => {
                  if (!day.hours?.length) return <View style={{ width: PAGE_W }} />;
                  return (
                    <DayPage
                      day={day}
                      daySchedule={selected.schedule?.[day.id] || {}}
                      easterDate={selected.easterDate}
                    />
                  );
                }}
              />
              <View style={av.pageDots}>
                {selectedAllDays.map((_, i) => (
                  <TouchableOpacity key={i} onPress={() => handleDaySelect(i)} activeOpacity={0.7}>
                    <View style={[av.pageDot, i === pageIndex && av.pageDotActive]} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const av = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet:         { backgroundColor: BG, borderTopLeftRadius: 28, borderTopRightRadius: 28, height: "92%", paddingBottom: Platform.OS === "ios" ? 34 : 20 },
  handle:        { width: 38, height: 4, borderRadius: 2, backgroundColor: SEP, alignSelf: "center", marginTop: 12 },
  hdr:           { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: SEP },
  iconBox:       { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,159,10,0.12)", justifyContent: "center", alignItems: "center" },
  backBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: CARD2, justifyContent: "center", alignItems: "center" },
  title:         { fontSize: 20, fontWeight: "800", color: T1, letterSpacing: -0.3 },
  sub:           { fontSize: 12, color: T2, marginTop: 2 },
  xBtn:          { width: 32, height: 32, borderRadius: 16, backgroundColor: CARD2, justifyContent: "center", alignItems: "center" },
  center:        { flex: 1, justifyContent: "center", alignItems: "center", padding: 32, gap: 16 },
  loadingTxt:    { fontSize: 14, color: T2 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: CARD2, justifyContent: "center", alignItems: "center" },
  emptyTitle:    { fontSize: 19, fontWeight: "700", color: T1 },
  emptySub:      { fontSize: 14, color: T2, textAlign: "center", lineHeight: 21 },
  sectionLabel:  { fontSize: 12, fontWeight: "700", color: T3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 },
  list:          { padding: 16 },
  pageDots:      { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5, paddingVertical: 10 },
  pageDot:       { width: 5, height: 5, borderRadius: 2.5, backgroundColor: CARD3 },
  pageDotActive: { width: 16, borderRadius: 3, backgroundColor: BLUE },
});

export default PaschaArchiveViewer;