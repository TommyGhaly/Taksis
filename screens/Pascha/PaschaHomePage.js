import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, FlatList,
  StyleSheet, Image, ActivityIndicator, Switch, StatusBar,
  Dimensions, useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons as Icon } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import PaschaSchedule from "../Pascha/PaschaSchedule.json";

const DEFAULT_AVATAR = require("../../assets/default_profile.png");

// ─── Tokens ───────────────────────────────────────────────────────────────────
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

const READING_META = {
  prophecies: { label:"Prophecy",  icon:"fire",                color:"#f59e0b" },
  psalm:      { label:"Psalm",     icon:"music-note",          color:"#34d399" },
  pauline:    { label:"Pauline",   icon:"feather",             color:"#a78bfa" },
  catholic:   { label:"Catholic",  icon:"bookshelf",           color:"#22d3ee" },
  praxis:     { label:"Praxis",    icon:"script-text-outline", color:"#fb923c" },
  gospel:     { label:"Gospel",    icon:"book-cross",          color:"#3b82f6" },
  gospels:    { label:"Gospel",    icon:"book-cross",          color:"#3b82f6" },
  homily:     { label:"Homily",    icon:"microphone-outline",  color:"#f87171" },
  litanies:   { label:"Litanies",  icon:"hands-pray",          color:T2        },
};
const ASSIGNABLE    = ["prophecies","psalm","pauline","catholic","praxis","gospel","gospels"];
const READING_ORDER = ["prophecies","psalm","pauline","catholic","praxis","gospel","gospels","homily","litanies"];

const ALL_DAYS = [
  { id:"last_friday_lent",    label:"Last Friday of Holy Lent", easterOffset:-9,  shortLabel:"Lent Fri" },
  { id:"palm_sunday",         label:"Palm Sunday",              easterOffset:-7,  shortLabel:"Palm Sun" },
  { id:"monday_eve",          label:"Monday Evening",           easterOffset:-6,  shortLabel:"Mon Eve"  },
  { id:"monday_morning",      label:"Monday Morning",           easterOffset:-6,  shortLabel:"Mon Morn" },
  { id:"tuesday_eve",         label:"Tuesday Evening",          easterOffset:-5,  shortLabel:"Tue Eve"  },
  { id:"tuesday_morning",     label:"Tuesday Morning",          easterOffset:-5,  shortLabel:"Tue Morn" },
  { id:"wednesday_eve",       label:"Wednesday Evening",        easterOffset:-4,  shortLabel:"Wed Eve"  },
  { id:"wednesday_morning",   label:"Wednesday Morning",        easterOffset:-4,  shortLabel:"Wed Morn" },
  { id:"thursday_eve",        label:"Thursday Evening",         easterOffset:-3,  shortLabel:"Thu Eve"  },
  { id:"covenant_thursday",   label:"Covenant Thursday",        easterOffset:-3,  shortLabel:"Cov Thu"  },
  { id:"good_friday_eve",     label:"Good Friday Evening",      easterOffset:-2,  shortLabel:"Fri Eve"  },
  { id:"good_friday_morning", label:"Good Friday Morning",      easterOffset:-2,  shortLabel:"Fri Morn" },
];

const DAYS_BY_ID = Object.fromEntries(
  ALL_DAYS.map(d => {
    const json = PaschaSchedule.days.find(j => j.id === d.id) || {};
    return [d.id, { ...json, ...d }];
  })
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcDate(easter, offset) {
  if (!easter) return null;
  const d = new Date(easter);
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });
}

function readingDisplay(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.map(v =>
      typeof v === "string" ? v
        : v.reference ? (v.location ? `${v.reference} — ${v.location}` : v.reference) : ""
    ).filter(Boolean).join("\n");
  return String(value);
}

function expandReadings(hour) {
  const rows = [];
  READING_ORDER.forEach(k => {
    const val = hour.readings?.[k];
    if (val == null) return;
    if (Array.isArray(val) && ASSIGNABLE.includes(k) && k !== "psalm") {
      val.forEach((entry, i) => {
        let ref = "", loc = "";
        if (typeof entry === "string") ref = entry;
        else if (entry.reference) { ref = entry.reference; loc = entry.location || ""; }
        rows.push({ rKey:k, slotKey:`${k}_${i}`, index:i, refText:ref, location:loc });
      });
    } else {
      rows.push({ rKey:k, slotKey:k, index:null, refText:readingDisplay(val), location:"" });
    }
  });
  return rows;
}

function mySlots(hour, hourAssignments, uid) {
  if (!uid) return new Set();
  const slots = new Set();
  expandReadings(hour).forEach(({ slotKey, rKey }) => {
    if (!ASSIGNABLE.includes(rKey)) return;
    if (rKey === "psalm") {
      if ((hourAssignments.psalm_readers || []).some(r => r.uid === uid)) slots.add(slotKey);
    } else {
      if (hourAssignments[slotKey]?.uid === uid) slots.add(slotKey);
    }
  });
  return slots;
}

function dayHasMyReading(day, daySchedule, uid) {
  return (day.hours || []).some(h => mySlots(h, daySchedule[h.id] || {}, uid).size > 0);
}

function collectMyReadings(schedule, uid) {
  const result = [];
  ALL_DAYS.forEach(d => {
    const dayDef = DAYS_BY_ID[d.id];
    const daySchedule = schedule[d.id] || {};
    const hours = [];
    (dayDef?.hours || []).forEach(h => {
      const ha = daySchedule[h.id] || {};
      const slotSet = mySlots(h, ha, uid);
      if (slotSet.size === 0) return;
      const rows = expandReadings(h).filter(r => ASSIGNABLE.includes(r.rKey) && slotSet.has(r.slotKey));
      if (rows.length > 0) hours.push({ hour: h, ha, rows });
    });
    if (hours.length > 0) result.push({ day: dayDef, hours });
  });
  return result;
}

// ─── Profile pic ──────────────────────────────────────────────────────────────
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

const Avatar = ({ uid, size = 26 }) => {
  const uri = useProfilePic(uid);
  return (
    <View style={{ width:size, height:size, borderRadius:size/2, overflow:"hidden", backgroundColor:GLASS2 }}>
      <Image source={uri ? { uri } : DEFAULT_AVATAR} style={{ width:size, height:size }} resizeMode="cover" />
    </View>
  );
};

// ─── Day tab bar ──────────────────────────────────────────────────────────────
const DayTabBar = ({ selectedId, easterDate, schedule, uid, onSelect }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false}
    contentContainerStyle={dt.content} style={dt.bar}>
    {ALL_DAYS.map(day => {
      const hasMe = dayHasMyReading(DAYS_BY_ID[day.id], schedule[day.id] || {}, uid);
      const active = day.id === selectedId;
      const dateStr = easterDate
        ? new Date(new Date(easterDate).setDate(new Date(easterDate).getDate() + day.easterOffset))
            .toLocaleDateString("en-US", { month:"short", day:"numeric" })
        : null;
      return (
        <TouchableOpacity key={day.id} onPress={() => onSelect(day.id)}
          style={[dt.tab, active && dt.tabActive]} activeOpacity={0.75}>
          {hasMe && <View style={dt.dot} />}
          <Text style={[dt.label, active && dt.labelActive]} numberOfLines={1}>{day.shortLabel}</Text>
          {dateStr && <Text style={[dt.date, active && dt.dateActive]}>{dateStr}</Text>}
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

const dt = StyleSheet.create({
  bar:         { backgroundColor:"transparent" },
  content:     { paddingHorizontal:16, paddingVertical:10, gap:6, flexDirection:"row" },
  tab:         { paddingHorizontal:11, paddingVertical:7, borderRadius:12, backgroundColor:GLASS,
                 borderWidth:1, borderColor:SEP, alignItems:"center", minWidth:64, height:54 },
  tabActive:   { backgroundColor:BLUE_D, borderColor:"rgba(59,130,246,0.4)" },
  dot:         { width:4, height:4, borderRadius:2, backgroundColor:BLUE2, marginBottom:3 },
  label:       { fontSize:11, fontWeight:"500", color:T2, textAlign:"center" },
  labelActive: { color:BLUE2, fontWeight:"600" },
  date:        { fontSize:9, color:T3, marginTop:2 },
  dateActive:  { color:"rgba(96,165,250,0.6)" },
});

// ─── Reading Card ─────────────────────────────────────────────────────────────
const ReadingCard = ({ row, hourAssignments, uid, isFullSchedule, isMine, hideNames }) => {
  const meta     = READING_META[row.rKey] || { label:row.rKey, icon:"book-outline", color:T2 };
  const isPsalm  = row.rKey === "psalm";
  const label    = row.index != null ? `${meta.label} ${row.index + 1}` : meta.label;
  const readers  = isPsalm ? (hourAssignments.psalm_readers || []) : [];
  const assignee = !isPsalm ? (hourAssignments[row.slotKey] || null) : null;
  const hasAssign = isPsalm ? readers.length > 0 : !!assignee;
  // show names if: names not hidden AND (full schedule OR it's mine)
  const showNames = !hideNames && (isFullSchedule || isMine);

  return (
    <View style={[rdc.card, isMine && rdc.cardMine]}>
      <View style={rdc.header}>
        <View style={[rdc.iconWrap, { backgroundColor: meta.color + "1a" }]}>
          <Icon name={meta.icon} size={15} color={meta.color} />
        </View>
        <Text style={[rdc.typeLabel, { color: meta.color }]}>{label}</Text>
        {isMine && (
          <View style={rdc.youPill}>
            <Text style={rdc.youTxt}>You</Text>
          </View>
        )}
      </View>

      {!!row.refText && (
        <Text style={rdc.ref}>{row.refText}</Text>
      )}
      {!!row.location && <Text style={rdc.loc}>{row.location}</Text>}

      {hasAssign && showNames && (
        <View style={rdc.assigneeRow}>
          {isPsalm ? readers.map((r, i) => (
            <View key={r.uid||i} style={[rdc.chip, r.uid === uid && rdc.chipMe]}>
              <Avatar uid={r.uid} size={16} />
              <Text style={[rdc.chipName, r.uid === uid && rdc.chipNameMe]} numberOfLines={1}>{r.name}</Text>
            </View>
          )) : (
            <View style={[rdc.chip, isMine && rdc.chipMe]}>
              <Avatar uid={assignee.uid} size={16} />
              <Text style={[rdc.chipName, isMine && rdc.chipNameMe]} numberOfLines={1}>{assignee.name}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const rdc = StyleSheet.create({
  card:        { backgroundColor:GLASS, borderWidth:1, borderColor:GLASS_B,
                 borderRadius:14, padding:14, marginBottom:8 },
  cardMine:    { borderColor:"rgba(59,130,246,0.3)", backgroundColor:"rgba(59,130,246,0.07)" },
  header:      { flexDirection:"row", alignItems:"center", gap:9, marginBottom:8 },
  iconWrap:    { width:30, height:30, borderRadius:9, justifyContent:"center", alignItems:"center" },
  typeLabel:   { fontSize:11, fontWeight:"700", letterSpacing:0.8, textTransform:"uppercase", flex:1 },
  youPill:     { paddingHorizontal:7, paddingVertical:2, borderRadius:8,
                 backgroundColor:BLUE_D, borderWidth:1, borderColor:"rgba(59,130,246,0.3)" },
  youTxt:      { fontSize:9, fontWeight:"700", color:BLUE2, letterSpacing:0.4 },
  ref:         { fontSize:14, color:T1, fontWeight:"300", lineHeight:21, marginBottom:3 },
  loc:         { fontSize:11, color:T2, fontWeight:"400" },
  assigneeRow: { flexDirection:"row", flexWrap:"wrap", gap:6, marginTop:10,
                 paddingTop:10, borderTopWidth:1, borderTopColor:SEP },
  chip:        { flexDirection:"row", alignItems:"center", gap:5, backgroundColor:GLASS2,
                 borderWidth:1, borderColor:SEP, borderRadius:20, paddingVertical:3, paddingHorizontal:8 },
  chipMe:      { backgroundColor:BLUE_D, borderColor:"rgba(59,130,246,0.3)" },
  chipName:    { fontSize:11, fontWeight:"500", color:T2, maxWidth:100 },
  chipNameMe:  { color:BLUE2, fontWeight:"600" },
});

// ─── Paginated Hour Viewer ────────────────────────────────────────────────────
const HourPager = ({ hours, daySchedule, uid, isFullSchedule, hideNames }) => {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const flatRef = useRef(null);

  // Build visible hours list (skip empty if not full schedule)
  // Always show all hours — personal mode just hides other people's names, not the readings
  const visibleHours = hours.filter(h => expandReadings(h).some(r => ASSIGNABLE.includes(r.rKey)));

  const goTo = (idx) => {
    if (idx < 0 || idx >= visibleHours.length) return;
    flatRef.current?.scrollToIndex({ index: idx, animated: true });
    setPage(idx);
  };

  const onViewable = useRef(({ viewableItems }) => {
    if (viewableItems[0] != null) setPage(viewableItems[0].index);
  }).current;

  if (visibleHours.length === 0) {
    return (
      <View style={pg.empty}>
        <Icon name="cross" size={28} color={T3} />
        <Text style={pg.emptyTxt}>No readings assigned for this day</Text>
      </View>
    );
  }

  return (
    <View style={{ flex:1 }}>
      {/* Page indicator + nav */}
      <View style={pg.nav}>
        <TouchableOpacity onPress={() => goTo(page - 1)} disabled={page === 0}
          style={[pg.navBtn, page === 0 && pg.navBtnDisabled]} activeOpacity={0.7}>
          <Icon name="chevron-left" size={18} color={page === 0 ? T3 : T1} />
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={pg.dotsContent}>
          {visibleHours.map((h, i) => {
            const ha = daySchedule[h.id] || {};
            const hasMe = mySlots(h, ha, uid).size > 0;
            const active = i === page;
            return (
              <TouchableOpacity key={h.id} onPress={() => goTo(i)} style={pg.dotBtn} activeOpacity={0.7}>
                <View style={[pg.dotPill, active && pg.dotPillActive, hasMe && pg.dotPillMe,
                  active && hasMe && pg.dotPillMeActive]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity onPress={() => goTo(page + 1)}
          disabled={page === visibleHours.length - 1}
          style={[pg.navBtn, page === visibleHours.length - 1 && pg.navBtnDisabled]} activeOpacity={0.7}>
          <Icon name="chevron-right" size={18}
            color={page === visibleHours.length - 1 ? T3 : T1} />
        </TouchableOpacity>
      </View>

      {/* Paged FlatList */}
      <FlatList
        ref={flatRef}
        data={visibleHours}
        keyExtractor={h => h.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item: hour }) => {
          const ha = daySchedule[hour.id] || {};
          const mySlotSet = mySlots(hour, ha, uid);
          const hasMe = mySlotSet.size > 0;
          const assignable = expandReadings(hour).filter(r => ASSIGNABLE.includes(r.rKey));

          return (
            <View style={[pg.page, { width }]}>
              {/* Hour name header */}
              <View style={pg.hourHeader}>
                <View style={[pg.hourAccent, { backgroundColor: hasMe ? BLUE : "rgba(255,255,255,0.15)" }]} />
                <View style={{ flex:1 }}>
                  <Text style={pg.hourLabel}>{hour.label}</Text>
                  {hasMe && (
                    <Text style={pg.hourSub}>{mySlotSet.size} reading{mySlotSet.size !== 1 ? "s" : ""} for you</Text>
                  )}
                </View>
                <Text style={pg.pageCount}>{page + 1} / {visibleHours.length}</Text>
              </View>

              {/* Reading cards */}
              <ScrollView showsVerticalScrollIndicator={false}
                contentContainerStyle={pg.cardsScroll}>
                {assignable.length === 0 ? (
                  <View style={pg.emptyHour}>
                    <Text style={pg.emptyHourTxt}>No assigned readings</Text>
                  </View>
                ) : assignable.map(row => (
                  <ReadingCard
                    key={row.slotKey} row={row} hourAssignments={ha}
                    uid={uid} isFullSchedule={isFullSchedule}
                    isMine={mySlotSet.has(row.slotKey)}
                    hideNames={hideNames}
                  />
                ))}
              </ScrollView>
            </View>
          );
        }}
      />
    </View>
  );
};

const pg = StyleSheet.create({
  nav:             { flexDirection:"row", alignItems:"center", paddingHorizontal:12,
                     paddingVertical:10, gap:4 },
  navBtn:          { width:36, height:36, borderRadius:18, backgroundColor:GLASS,
                     borderWidth:1, borderColor:SEP, justifyContent:"center", alignItems:"center" },
  navBtnDisabled:  { opacity:0.3 },
  dotsContent:     { flexDirection:"row", alignItems:"center", gap:5, paddingHorizontal:6 },
  dotBtn:          { padding:4 },
  dotPill:         { width:6, height:6, borderRadius:3, backgroundColor:T3 },
  dotPillActive:   { width:18, backgroundColor:T2 },
  dotPillMe:       { backgroundColor:"rgba(59,130,246,0.4)" },
  dotPillMeActive: { width:18, backgroundColor:BLUE2 },
  page:            { flex:1 },
  hourHeader:      { flexDirection:"row", alignItems:"center", gap:10,
                     paddingHorizontal:16, paddingBottom:14 },
  hourAccent:      { width:3, height:20, borderRadius:2 },
  hourLabel:       { fontSize:17, fontWeight:"300", color:T1, letterSpacing:-0.3 },
  hourSub:         { fontSize:12, color:BLUE2, marginTop:2, fontWeight:"400" },
  pageCount:       { fontSize:11, color:T3, fontWeight:"400" },
  cardsScroll:     { paddingHorizontal:16, paddingBottom:32 },
  empty:           { flex:1, justifyContent:"center", alignItems:"center", gap:12, padding:48 },
  emptyTxt:        { fontSize:14, color:T2, fontWeight:"300" },
  emptyHour:       { padding:24, alignItems:"center" },
  emptyHourTxt:    { fontSize:13, color:T3, fontWeight:"400" },
});

// ─── Timeline Day Card (home) ─────────────────────────────────────────────────
const TimelineDayCard = ({ day, daySchedule, easterDate, uid, isLast, onPress }) => {
  const dateStr = easterDate ? calcDate(easterDate, day.easterOffset) : null;
  const myHours = [];
  (day.hours || []).forEach(h => {
    const ha = daySchedule[h.id] || {};
    const slotSet = mySlots(h, ha, uid);
    if (slotSet.size === 0) return;
    const rows = expandReadings(h).filter(r => ASSIGNABLE.includes(r.rKey) && slotSet.has(r.slotKey));
    if (rows.length > 0) myHours.push({ hour:h, rows });
  });
  const total = myHours.reduce((a, h) => a + h.rows.length, 0);
  const allTypes = [...new Set(myHours.flatMap(h => h.rows.map(r => r.rKey)))];

  return (
    <View style={tl.entry}>
      <View style={tl.spineCol}>
        <View style={tl.node} />
        {!isLast && <View style={tl.line} />}
      </View>
      <TouchableOpacity style={tl.card} onPress={onPress} activeOpacity={0.78}>
        <View style={tl.cardHeader}>
          <View style={{ flex:1 }}>
            <Text style={tl.dayLabel}>{day.label}</Text>
            {dateStr && <Text style={tl.dateStr}>{dateStr}</Text>}
          </View>
          <View style={tl.badge}>
            <Text style={tl.badgeNum}>{total}</Text>
          </View>
        </View>
        <View style={tl.pillRow}>
          {allTypes.map(rKey => {
            const m = READING_META[rKey] || { icon:"book-outline", color:T3, label:rKey };
            return (
              <View key={rKey} style={[tl.pill, { backgroundColor:m.color+"14", borderColor:m.color+"40" }]}>
                <Icon name={m.icon} size={10} color={m.color} />
                <Text style={[tl.pillTxt, { color:m.color }]}>{m.label}</Text>
              </View>
            );
          })}
        </View>
        {myHours.map(({ hour, rows }, hi) => (
          <View key={hour.id} style={[tl.hourRow, hi > 0 && { borderTopWidth:1, borderTopColor:SEP }]}>
            <Text style={tl.hourLabel}>{hour.label}</Text>
            <Text style={tl.hourCount}>{rows.length} {rows.length === 1 ? "reading" : "readings"}</Text>
          </View>
        ))}
      </TouchableOpacity>
    </View>
  );
};

const tl = StyleSheet.create({
  entry:      { flexDirection:"row", paddingHorizontal:20, marginBottom:4 },
  spineCol:   { width:24, alignItems:"center", paddingTop:18 },
  node:       { width:10, height:10, borderRadius:5, backgroundColor:BLUE,
                borderWidth:2, borderColor:"rgba(59,130,246,0.35)", zIndex:1 },
  line:       { flex:1, width:1.5, backgroundColor:"rgba(59,130,246,0.2)", marginTop:4 },
  card:       { flex:1, marginLeft:12, marginBottom:14, borderRadius:20,
                backgroundColor:GLASS, borderWidth:1, borderColor:GLASS_B, overflow:"hidden" },
  cardHeader: { flexDirection:"row", alignItems:"flex-start", padding:16, paddingBottom:10, gap:10 },
  dayLabel:   { fontSize:16, fontWeight:"300", color:T1, letterSpacing:-0.2, marginBottom:3 },
  dateStr:    { fontSize:12, color:T2, fontWeight:"400" },
  badge:      { minWidth:32, height:32, borderRadius:16, backgroundColor:BLUE_D,
                borderWidth:1, borderColor:"rgba(59,130,246,0.3)",
                justifyContent:"center", alignItems:"center", paddingHorizontal:8 },
  badgeNum:   { fontSize:15, fontWeight:"300", color:BLUE2 },
  pillRow:    { flexDirection:"row", flexWrap:"wrap", gap:6, paddingHorizontal:16, paddingBottom:12 },
  pill:       { flexDirection:"row", alignItems:"center", gap:4, paddingHorizontal:8,
                paddingVertical:3, borderRadius:20, borderWidth:1 },
  pillTxt:    { fontSize:10, fontWeight:"500", letterSpacing:0.3 },
  hourRow:    { flexDirection:"row", alignItems:"center", justifyContent:"space-between",
                paddingHorizontal:16, paddingVertical:9 },
  hourLabel:  { fontSize:13, color:T2, fontWeight:"400" },
  hourCount:  { fontSize:12, color:BLUE2, fontWeight:"400" },
});

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PaschaHomePage() {
  const isMounted = useRef(true);
  const [uid, setUid]                       = useState(null);
  const [churchId, setChurchId]             = useState(null);
  const [loading, setLoading]               = useState(true);
  const [easterDate, setEasterDate]         = useState(null);
  const [schedule, setSchedule]             = useState({});
  const [fullScheduleOn, setFullScheduleOn] = useState(false);
  const [myReadingsOn, setMyReadingsOn]     = useState(false);
  const [hideNames, setHideNames]           = useState(false);
  const [selectedId, setSelectedId]         = useState(null);

  const isFullSchedule = fullScheduleOn;
  const isMyReadings   = !fullScheduleOn && myReadingsOn;

  useEffect(() => {
    isMounted.current = true;
    const user = auth().currentUser;
    if (!user) return;
    setUid(user.uid);
    firestore().collection("users").doc(user.uid).onSnapshot(doc => {
      if (!isMounted.current || !doc.exists) return;
      const data = doc.data();
      setChurchId(data.church || null);
      setHideNames(data.paschaHideNames ?? false);
    });
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!churchId) return;
    const unsub = firestore().collection("churches").doc(churchId)
      .collection("pascha").doc("config").onSnapshot(doc => {
        if (!isMounted.current) return;
        setLoading(false);
        if (!doc.exists) return;
        const d = doc.data();
        setFullScheduleOn(d.fullScheduleVisible ?? false);
        setMyReadingsOn(d.myReadingsVisible ?? false);
        setEasterDate(d.easterDate ?? null);
        setSchedule(d.schedule ?? {});
      });
    return () => unsub();
  }, [churchId]);

  const myReadingsData  = collectMyReadings(schedule, uid);
  const totalMyReadings = myReadingsData.reduce((acc, d) =>
    acc + d.hours.reduce((a, h) => a + h.rows.length, 0), 0);

  const selectedDayDef      = selectedId ? DAYS_BY_ID[selectedId] : null;
  const selectedDaySchedule = selectedId ? (schedule[selectedId] || {}) : {};

  if (loading) return (
    <View style={mn.loadingWrap}><ActivityIndicator color={BLUE} size="large" /></View>
  );

  // ── Day detail — paginated ────────────────────────────────────────────────
  if (selectedId && selectedDayDef) {
    const dateStr = easterDate ? calcDate(easterDate, selectedDayDef.easterOffset) : null;
    return (
      <View style={mn.container}>
        <StatusBar barStyle="light-content" />

        <View style={mn.header}>
          <TouchableOpacity style={mn.backBtn} onPress={() => setSelectedId(null)} activeOpacity={0.7}>
            <Icon name="arrow-left" size={18} color={T1} />
          </TouchableOpacity>
          <View style={{ flex:1 }}>
            <Text style={mn.eyebrow}>{isFullSchedule ? "FULL SCHEDULE" : "MY READINGS"}</Text>
            <Text style={mn.title} numberOfLines={1}>{selectedDayDef.label}</Text>
            {dateStr && <Text style={mn.subtitle}>{dateStr}</Text>}
          </View>
          <TouchableOpacity
            style={[mn.nameToggleBtn, hideNames && mn.nameToggleBtnActive]}
            onPress={async () => {
              const next = !hideNames;
              setHideNames(next);
              if (uid) await firestore().collection("users").doc(uid)
                .update({ paschaHideNames: next }).catch(() => {});
            }}
            activeOpacity={0.75}
          >
            <Icon name={hideNames ? "account-off-outline" : "account-outline"} size={16}
              color={hideNames ? BLUE2 : T2} />
          </TouchableOpacity>
        </View>

        <View style={{ height:74 }}>
          <DayTabBar selectedId={selectedId} easterDate={easterDate}
            schedule={schedule} uid={uid} onSelect={id => { setSelectedId(id); }} />
        </View>

        {/* Paginated hours — fills remaining space */}
        <HourPager
          hours={selectedDayDef.hours || []}
          daySchedule={selectedDaySchedule}
          uid={uid}
          isFullSchedule={isFullSchedule}
          hideNames={hideNames}
        />
      </View>
    );
  }

  // ── Home overview ─────────────────────────────────────────────────────────
  return (
    <View style={mn.container}>
      <StatusBar barStyle="light-content" />
      <View style={mn.header}>
        <View style={{ flex:1 }}>
          <Text style={mn.eyebrow}>HOLY WEEK  ·  PASCHA</Text>
          <Text style={mn.title}>{isFullSchedule ? "Schedule" : "My Readings"}</Text>
        </View>
      </View>

      <View style={{ height:74 }}>
        <DayTabBar selectedId={null} easterDate={easterDate}
          schedule={schedule} uid={uid} onSelect={setSelectedId} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom:56, paddingTop:8 }}>
        {totalMyReadings > 0 && (
          <View style={ov.summaryRow}>
            <View style={ov.summaryPill}>
              <Icon name="cross" size={12} color={BLUE2} />
              <Text style={ov.summaryTxt}>
                {totalMyReadings} reading{totalMyReadings !== 1 ? "s" : ""} · {myReadingsData.length} day{myReadingsData.length !== 1 ? "s" : ""}
              </Text>
            </View>
          </View>
        )}

        {(isMyReadings || isFullSchedule) && (
          totalMyReadings === 0 ? (
            <View style={ov.empty}>
              <View style={ov.emptyIconWrap}><Icon name="cross" size={28} color={T3} /></View>
              <Text style={ov.emptyTitle}>Not yet scheduled</Text>
              <Text style={ov.emptySub}>Your assigned readings will appear here once the schedule is set.</Text>
            </View>
          ) : (
            <View style={{ paddingTop:8 }}>
              {myReadingsData.map(({ day }, i) => (
                <TimelineDayCard key={day.id} day={day}
                  daySchedule={schedule[day.id] || {}}
                  easterDate={easterDate} uid={uid}
                  isLast={i === myReadingsData.length - 1}
                  onPress={() => setSelectedId(day.id)} />
              ))}
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

const ov = StyleSheet.create({
  summaryRow:    { paddingHorizontal:20, marginBottom:6 },
  summaryPill:   { flexDirection:"row", alignItems:"center", gap:6, alignSelf:"flex-start",
                   paddingHorizontal:12, paddingVertical:5, borderRadius:20,
                   backgroundColor:BLUE_D, borderWidth:1, borderColor:"rgba(59,130,246,0.25)" },
  summaryTxt:    { fontSize:12, color:BLUE2, fontWeight:"400" },
  empty:         { alignItems:"center", padding:56, gap:12 },
  emptyIconWrap: { width:72, height:72, borderRadius:36, backgroundColor:GLASS,
                   justifyContent:"center", alignItems:"center", borderWidth:1, borderColor:SEP },
  emptyTitle:    { fontSize:18, fontWeight:"300", color:T1, letterSpacing:-0.2 },
  emptySub:      { fontSize:14, color:T2, textAlign:"center", lineHeight:21, maxWidth:260, fontWeight:"400" },
});

const mn = StyleSheet.create({
  container:   { flex:1, backgroundColor:BG },
  loadingWrap: { flex:1, backgroundColor:BG, justifyContent:"center", alignItems:"center" },
  header:      { flexDirection:"row", alignItems:"center", paddingHorizontal:20,
                 paddingTop:18, paddingBottom:8, gap:12 },
  backBtn:     { width:36, height:36, borderRadius:18, backgroundColor:GLASS,
                 borderWidth:1, borderColor:SEP, justifyContent:"center", alignItems:"center" },
  eyebrow:     { fontSize:11, fontWeight:"500", color:BLUE, letterSpacing:1.8, marginBottom:2 },
  title:       { fontSize:26, fontWeight:"200", color:T1, letterSpacing:-0.6 },
  nameToggleBtn:       { width:36, height:36, borderRadius:18, backgroundColor:GLASS,
                         borderWidth:1, borderColor:SEP, justifyContent:"center", alignItems:"center" },
  nameToggleBtnActive: { backgroundColor:BLUE_D, borderColor:"rgba(59,130,246,0.4)" },
});