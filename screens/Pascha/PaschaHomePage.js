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
import PaschaSchedule from "../Pascha/PaschaSchedule.json";
import {
  expandReadings, isAssignableSlot, isPsalmSlot,
  hasLanguagePicker, effectiveLanguage, langShort, psalmReadersKey,
  READING_META,
} from "../Pascha/PaschaReadingUtils";

const DEFAULT_AVATAR = require("../../assets/default_profile.png");

const BG = "#0f0f0f", GLASS = "rgba(255,255,255,0.055)", GLASS2 = "rgba(255,255,255,0.09)",
  GLASS_B = "rgba(255,255,255,0.1)", SEP = "rgba(255,255,255,0.07)", BLUE = "#3b82f6",
  BLUE2 = "#60a5fa", BLUE_D = "rgba(59,130,246,0.18)", T1 = "#f1f5f9",
  T2 = "rgba(241,245,249,0.58)", T3 = "rgba(241,245,249,0.24)";

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

function calcDate(easter, offset) {
  if (!easter) return null;
  const d = new Date(easter);
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });
}

function getMySlots(hour, ha, uid) {
  if (!uid) return new Set();
  const slots = new Set();
  expandReadings(hour).forEach(({ slotKey, rKey }) => {
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

function collectMyReadings(schedule, uid) {
  const result = [];
  ALL_DAYS.forEach(d => {
    const dayDef = DAYS_BY_ID[d.id], ds = schedule[d.id] || {}, hours = [];
    (dayDef?.hours || []).forEach(h => {
      const ha = ds[h.id] || {}, slotSet = getMySlots(h, ha, uid);
      if (slotSet.size === 0) return;
      const rows = expandReadings(h).filter(r =>
        (isAssignableSlot(r.rKey) || isPsalmSlot(r.rKey)) && slotSet.has(r.slotKey));
      if (rows.length > 0) hours.push({ hour: h, ha, rows });
    });
    if (hours.length > 0) result.push({ day: dayDef, hours });
  });
  return result;
}

function getVisibleHours(hours) {
  return hours.filter(h =>
    expandReadings(h).some(r => isAssignableSlot(r.rKey) || isPsalmSlot(r.rKey)));
}

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
    <View style={{ width:size, height:size, borderRadius:size/2, overflow:"hidden", backgroundColor:GLASS2 }}>
      <Image source={uri ? { uri } : DEFAULT_AVATAR} style={{ width:size, height:size }} resizeMode="cover" />
    </View>
  );
};

// ── Day Tab Bar ───────────────────────────────────────────────────────────────
const DayTabBar = ({ selectedId, easterDate, schedule, uid, onSelect }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={dt.content} style={dt.bar}>
    {ALL_DAYS.map(day => {
      const hasMe = dayHasMyReading(DAYS_BY_ID[day.id], schedule[day.id] || {}, uid);
      const active = day.id === selectedId;
      const dateStr = easterDate
        ? new Date(new Date(easterDate).setDate(new Date(easterDate).getDate() + day.easterOffset))
            .toLocaleDateString("en-US", { month:"short", day:"numeric" }) : null;
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
  bar:{backgroundColor:"transparent"},content:{paddingHorizontal:16,paddingVertical:10,gap:6,flexDirection:"row"},
  tab:{paddingHorizontal:11,paddingVertical:7,borderRadius:12,backgroundColor:GLASS,borderWidth:1,borderColor:SEP,alignItems:"center",minWidth:64,height:54},
  tabActive:{backgroundColor:BLUE_D,borderColor:"rgba(59,130,246,0.4)"},dot:{width:4,height:4,borderRadius:2,backgroundColor:BLUE2,marginBottom:3},
  label:{fontSize:11,fontWeight:"500",color:T2,textAlign:"center"},labelActive:{color:BLUE2,fontWeight:"600"},
  date:{fontSize:9,color:"rgba(241,245,249,0.5)",marginTop:2},dateActive:{color:"rgba(96,165,250,0.85)"},
});

// ── Reading Card ──────────────────────────────────────────────────────────────
const ReadingCard = ({ row, hourAssignments, uid, isFullSchedule, isMine, hideNames }) => {
  const meta = READING_META[row.rKey] || { label:row.rKey, icon:"book-outline", color:T2 };
  const isPsalm = isPsalmSlot(row.rKey), isHomily = row.rKey === "homily";
  let label;
  if (isHomily) label = `Homily — ${row.author || row.refText}`;
  else if (row.index != null) label = `${meta.label} ${row.index + 1}`;
  else label = meta.label;
  const readers = isPsalm ? (hourAssignments.psalm_readers || []) : [];
  const assignee = !isPsalm ? (hourAssignments[row.slotKey] || null) : null;
  const hasAssign = isPsalm ? readers.length > 0 : !!assignee;
  const showNames = !hideNames && (isFullSchedule || isMine);
  const showLang = isMine && hasLanguagePicker(row.rKey);
  return (
    <View style={[rdc.card, isMine && rdc.cardMine]}>
      <View style={rdc.header}>
        <View style={[rdc.iconWrap, { backgroundColor: meta.color + "1a" }]}>
          <Icon name={meta.icon} size={15} color={meta.color} />
        </View>
        <Text style={[rdc.typeLabel, { color: meta.color }]}>{label}</Text>
        {showLang && <View style={rdc.langBadge}><Text style={rdc.langBadgeTxt}>{langShort(effectiveLanguage(row, hourAssignments))}</Text></View>}
        {isMine && <View style={rdc.youPill}><Text style={rdc.youTxt}>You</Text></View>}
      </View>
      {!!row.refText && !isHomily && <Text style={rdc.ref}>{row.refText}</Text>}
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
  card:{backgroundColor:GLASS,borderWidth:1,borderColor:GLASS_B,borderRadius:14,padding:14,marginBottom:8},
  cardMine:{borderColor:"rgba(59,130,246,0.3)",backgroundColor:"rgba(59,130,246,0.07)"},
  header:{flexDirection:"row",alignItems:"center",gap:9,marginBottom:8},
  iconWrap:{width:30,height:30,borderRadius:9,justifyContent:"center",alignItems:"center"},
  typeLabel:{fontSize:11,fontWeight:"700",letterSpacing:0.8,textTransform:"uppercase",flex:1},
  langBadge:{paddingHorizontal:5,paddingVertical:2,borderRadius:5,backgroundColor:GLASS2},
  langBadgeTxt:{fontSize:9,fontWeight:"700",color:T3,letterSpacing:0.3},
  youPill:{paddingHorizontal:7,paddingVertical:2,borderRadius:8,backgroundColor:BLUE_D,borderWidth:1,borderColor:"rgba(59,130,246,0.3)"},
  youTxt:{fontSize:9,fontWeight:"700",color:BLUE2,letterSpacing:0.4},
  ref:{fontSize:14,color:T1,fontWeight:"300",lineHeight:21,marginBottom:3},
  loc:{fontSize:11,color:T2,fontWeight:"400"},
  assigneeRow:{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:10,paddingTop:10,borderTopWidth:1,borderTopColor:SEP},
  chip:{flexDirection:"row",alignItems:"center",gap:5,backgroundColor:GLASS2,borderWidth:1,borderColor:SEP,borderRadius:20,paddingVertical:3,paddingHorizontal:8},
  chipMe:{backgroundColor:BLUE_D,borderColor:"rgba(59,130,246,0.3)"},
  chipName:{fontSize:11,fontWeight:"500",color:T2,maxWidth:100},
  chipNameMe:{color:BLUE2,fontWeight:"600"},
});

// ── Single Hour Page ──────────────────────────────────────────────────────────
const HourPage = ({ hour, ha, uid, isFullSchedule, hideNames, pageWidth, pageLabel }) => {
  const mySlotSet = getMySlots(hour, ha, uid);
  const hasMe = mySlotSet.size > 0;
  const assignable = expandReadings(hour).filter(r => isAssignableSlot(r.rKey) || isPsalmSlot(r.rKey));
  return (
    <View style={{ width: pageWidth }}>
      <View style={pg.hourHeader}>
        <View style={[pg.hourAccent, { backgroundColor: hasMe ? BLUE : "rgba(255,255,255,0.15)" }]} />
        <View style={{ flex:1 }}>
          <Text style={pg.hourLabel}>{hour.label}</Text>
          {hasMe && <Text style={pg.hourSub}>{mySlotSet.size} reading{mySlotSet.size !== 1 ? "s" : ""} for you</Text>}
        </View>
        <Text style={pg.pageCount}>{pageLabel}</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={pg.cardsScroll}>
        {assignable.length === 0
          ? <View style={pg.emptyHour}><Text style={pg.emptyHourTxt}>No assigned readings</Text></View>
          : assignable.map(row => (
            <ReadingCard key={row.slotKey} row={row} hourAssignments={ha}
              uid={uid} isFullSchedule={isFullSchedule}
              isMine={mySlotSet.has(row.slotKey)} hideNames={hideNames} />
          ))}
      </ScrollView>
    </View>
  );
};

// ── Hour Pager ────────────────────────────────────────────────────────────────
const HourPagerController = ({ hours, daySchedule, uid, isFullSchedule, hideNames, targetHourId }) => {
  const { width } = useWindowDimensions();

  const visibleHours = useMemo(() => getVisibleHours(hours), [hours]);

  const targetIdx = useMemo(() => {
    if (!targetHourId) return 0;
    const idx = visibleHours.findIndex(h => h.id === targetHourId);
    return idx >= 0 ? idx : 0;
  }, [targetHourId, visibleHours]);

  const [page, setPage] = useState(targetIdx);
  const clamped = Math.min(page, Math.max(0, visibleHours.length - 1));

  // Use ref callback to scroll before first paint — fires once when ScrollView mounts
  const scrollRefCb = useCallback((node) => {
    if (node && targetIdx > 0) {
      node.scrollTo({ x: targetIdx * width, animated: false });
    }
  }, [targetIdx, width]);

  // Also keep a persistent ref for goTo
  const scrollRef = useRef(null);
  const setRefs = useCallback((node) => {
    scrollRef.current = node;
    scrollRefCb(node);
  }, [scrollRefCb]);

  const goTo = useCallback((idx) => {
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
    <View style={{ flex:1 }}>
      <View style={pg.nav}>
        <TouchableOpacity onPress={() => goTo(clamped - 1)} disabled={clamped === 0}
          style={[pg.navBtn, clamped === 0 && pg.navBtnDisabled]} activeOpacity={0.7}>
          <Icon name="chevron-left" size={18} color={clamped === 0 ? T3 : T1} />
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={pg.dotsContent}>
          {visibleHours.map((h, i) => {
            const hha = daySchedule[h.id] || {};
            const hasMe = getMySlots(h, hha, uid).size > 0;
            const active = i === clamped;
            return (
              <TouchableOpacity key={h.id} onPress={() => goTo(i)} style={pg.dotBtn} activeOpacity={0.7}>
                <View style={[pg.dotPill, active && pg.dotPillActive, hasMe && pg.dotPillMe, active && hasMe && pg.dotPillMeActive]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity onPress={() => goTo(clamped + 1)} disabled={clamped >= visibleHours.length - 1}
          style={[pg.navBtn, clamped >= visibleHours.length - 1 && pg.navBtnDisabled]} activeOpacity={0.7}>
          <Icon name="chevron-right" size={18} color={clamped >= visibleHours.length - 1 ? T3 : T1} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={setRefs}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          if (idx >= 0 && idx < visibleHours.length) setPage(idx);
        }}
        scrollEventThrottle={16}
      >
        {visibleHours.map((hour) => (
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
  nav:{flexDirection:"row",alignItems:"center",paddingHorizontal:12,paddingVertical:10,gap:4},
  navBtn:{width:36,height:36,borderRadius:18,backgroundColor:GLASS,borderWidth:1,borderColor:SEP,justifyContent:"center",alignItems:"center"},
  navBtnDisabled:{opacity:0.3},
  dotsContent:{flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:6},
  dotBtn:{padding:4},dotPill:{width:6,height:6,borderRadius:3,backgroundColor:T3},
  dotPillActive:{width:18,backgroundColor:T2},dotPillMe:{backgroundColor:"rgba(59,130,246,0.4)"},
  dotPillMeActive:{width:18,backgroundColor:BLUE2},
  hourHeader:{flexDirection:"row",alignItems:"center",gap:10,paddingHorizontal:16,paddingBottom:14},
  hourAccent:{width:3,height:20,borderRadius:2},
  hourLabel:{fontSize:17,fontWeight:"300",color:T1,letterSpacing:-0.3},
  hourSub:{fontSize:12,color:BLUE2,marginTop:2,fontWeight:"400"},
  pageCount:{fontSize:11,color:T3,fontWeight:"400"},
  cardsScroll:{paddingHorizontal:16,paddingBottom:32},
  empty:{flex:1,justifyContent:"center",alignItems:"center",gap:12,padding:48},
  emptyTxt:{fontSize:14,color:T2,fontWeight:"300"},
  emptyHour:{padding:24,alignItems:"center"},
  emptyHourTxt:{fontSize:13,color:T3,fontWeight:"400"},
});

// ── Timeline Day Card ─────────────────────────────────────────────────────────
const TimelineDayCard = ({ day, daySchedule, easterDate, uid, isLast, onHourPress }) => {
  const dateStr = easterDate ? calcDate(easterDate, day.easterOffset) : null;
  const myHours = [];
  (day.hours || []).forEach(h => {
    const ha = daySchedule[h.id] || {};
    const slotSet = getMySlots(h, ha, uid);
    if (slotSet.size === 0) return;
    const rows = expandReadings(h).filter(r =>
      (isAssignableSlot(r.rKey) || isPsalmSlot(r.rKey)) && slotSet.has(r.slotKey));
    if (rows.length > 0) myHours.push({ hour:h, rows });
  });
  const total = myHours.reduce((a, h) => a + h.rows.length, 0);
  const allTypes = [...new Set(myHours.flatMap(h => h.rows.map(r => {
    const base = r.rKey.replace(/_coptic$/, "").replace(/_vernacular$/, "");
    return READING_META[base] ? base : r.rKey;
  })))];

  const singleHourId = myHours.length === 1 ? myHours[0].hour.id : null;
  const handleCardPress = () => {
    if (singleHourId) onHourPress(day.id, singleHourId);
    else if (myHours.length > 0) onHourPress(day.id, myHours[0].hour.id);
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
            <View style={{ flex:1 }}>
              <Text style={tl.dayLabel}>{day.label}</Text>
              {dateStr && <Text style={tl.dateStr}>{dateStr}</Text>}
            </View>
            <View style={tl.badge}><Text style={tl.badgeNum}>{total}</Text></View>
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
        </TouchableOpacity>
        {myHours.length > 1 && myHours.map(({ hour, rows }, hi) => (
          <TouchableOpacity key={hour.id}
            style={[tl.hourRow, hi > 0 && { borderTopWidth:1, borderTopColor:SEP }]}
            onPress={() => onHourPress(day.id, hour.id)} activeOpacity={0.7}>
            <Text style={tl.hourLabel}>{hour.label}</Text>
            <View style={{ flexDirection:"row", alignItems:"center", gap:4 }}>
              <Text style={tl.hourCount}>{rows.length} {rows.length === 1 ? "reading" : "readings"}</Text>
              <Icon name="chevron-right" size={13} color={BLUE2} />
            </View>
          </TouchableOpacity>
        ))}
        {myHours.length === 1 && (
          <View style={tl.singleHourRow}>
            <Text style={tl.hourLabel}>{myHours[0].hour.label}</Text>
            <View style={{ flexDirection:"row", alignItems:"center", gap:4 }}>
              <Text style={tl.hourCount}>{myHours[0].rows.length} {myHours[0].rows.length === 1 ? "reading" : "readings"}</Text>
              <Icon name="chevron-right" size={13} color={BLUE2} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
};
const tl = StyleSheet.create({
  entry:{flexDirection:"row",paddingHorizontal:20,marginBottom:4},
  spineCol:{width:24,alignItems:"center",paddingTop:18},
  node:{width:10,height:10,borderRadius:5,backgroundColor:BLUE,borderWidth:2,borderColor:"rgba(59,130,246,0.35)",zIndex:1},
  line:{flex:1,width:1.5,backgroundColor:"rgba(59,130,246,0.2)",marginTop:4},
  card:{flex:1,marginLeft:12,marginBottom:14,borderRadius:20,backgroundColor:GLASS,borderWidth:1,borderColor:GLASS_B,overflow:"hidden"},
  cardHeader:{flexDirection:"row",alignItems:"flex-start",padding:16,paddingBottom:10,gap:10},
  dayLabel:{fontSize:16,fontWeight:"300",color:T1,letterSpacing:-0.2,marginBottom:3},
  dateStr:{fontSize:12,color:T2,fontWeight:"400"},
  badge:{minWidth:32,height:32,borderRadius:16,backgroundColor:BLUE_D,borderWidth:1,borderColor:"rgba(59,130,246,0.3)",justifyContent:"center",alignItems:"center",paddingHorizontal:8},
  badgeNum:{fontSize:15,fontWeight:"300",color:BLUE2},
  pillRow:{flexDirection:"row",flexWrap:"wrap",gap:6,paddingHorizontal:16,paddingBottom:12},
  pill:{flexDirection:"row",alignItems:"center",gap:4,paddingHorizontal:8,paddingVertical:3,borderRadius:20,borderWidth:1},
  pillTxt:{fontSize:10,fontWeight:"500",letterSpacing:0.3},
  hourRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16,paddingVertical:9},
  singleHourRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16,paddingVertical:9,borderTopWidth:1,borderTopColor:SEP},
  hourLabel:{fontSize:13,color:T2,fontWeight:"400"},
  hourCount:{fontSize:12,color:BLUE2,fontWeight:"400"},
});

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PaschaHomePage() {
  const isMounted = useRef(true);
  const [uid, setUid] = useState(null);
  const [churchId, setChurchId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [easterDate, setEasterDate] = useState(null);
  const [schedule, setSchedule] = useState({});
  const [fullScheduleOn, setFullScheduleOn] = useState(false);
  const [myReadingsOn, setMyReadingsOn] = useState(false);
  const [hideNames, setHideNames] = useState(false);
  const [nav, setNav] = useState(null); // null | { dayId, hourId }

  const isFullSchedule = fullScheduleOn;
  const isMyReadings = !fullScheduleOn && myReadingsOn;

  useEffect(() => {
    isMounted.current = true;
    const user = auth().currentUser;
    if (!user) return;
    setUid(user.uid);
    firestore().collection("users").doc(user.uid).onSnapshot(doc => {
      if (!isMounted.current || !doc.exists) return;
      setChurchId(doc.data().church || null);
      setHideNames(doc.data().paschaHideNames ?? false);
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

  const myReadingsData = useMemo(() => collectMyReadings(schedule, uid), [schedule, uid]);
  const totalMyReadings = myReadingsData.reduce((acc, d) =>
    acc + d.hours.reduce((a, h) => a + h.rows.length, 0), 0);

  const goToHour = useCallback((dayId, hourId) => setNav({ dayId, hourId }), []);
  const goToDay = useCallback((dayId) => setNav({ dayId, hourId: null }), []);
  const goBack = useCallback(() => setNav(null), []);

  if (loading) return <View style={mn.loadingWrap}><ActivityIndicator color={BLUE} size="large" /></View>;

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (nav) {
    const dayDef = DAYS_BY_ID[nav.dayId];
    if (!dayDef) { setNav(null); return null; }
    const daySchedule = schedule[nav.dayId] || {};
    const dateStr = easterDate ? calcDate(easterDate, dayDef.easterOffset) : null;

    return (
      <View style={mn.container}>
        <StatusBar barStyle="light-content" />
        <View style={mn.header}>
          <TouchableOpacity style={mn.backBtn} onPress={goBack} activeOpacity={0.7}>
            <Icon name="arrow-left" size={18} color={T1} />
          </TouchableOpacity>
          <View style={{ flex:1 }}>
            <Text style={mn.eyebrow}>{isFullSchedule ? "FULL SCHEDULE" : "MY READINGS"}</Text>
            <Text style={mn.title} numberOfLines={1}>{dayDef.label}</Text>
            {dateStr && <Text style={mn.subtitle}>{dateStr}</Text>}
          </View>
          <TouchableOpacity
            style={[mn.nameToggleBtn, hideNames && mn.nameToggleBtnActive]}
            onPress={async () => {
              const next = !hideNames; setHideNames(next);
              if (uid) await firestore().collection("users").doc(uid).update({ paschaHideNames: next }).catch(() => {});
            }} activeOpacity={0.75}>
            <Icon name={hideNames ? "account-off-outline" : "account-outline"} size={16} color={hideNames ? BLUE2 : T2} />
          </TouchableOpacity>
        </View>
        <View style={{ height:74 }}>
          <DayTabBar selectedId={nav.dayId} easterDate={easterDate}
            schedule={schedule} uid={uid} onSelect={goToDay} />
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
        <View style={{ flex:1 }}>
          <Text style={mn.eyebrow}>HOLY WEEK  ·  PASCHA</Text>
          <Text style={mn.title}>{isFullSchedule ? "Schedule" : "My Readings"}</Text>
        </View>
      </View>
      <View style={{ height:74 }}>
        <DayTabBar selectedId={null} easterDate={easterDate}
          schedule={schedule} uid={uid} onSelect={goToDay} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom:56, paddingTop:8 }}>
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
                  onHourPress={goToHour} />
              ))}
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

const ov = StyleSheet.create({
  summaryRow:{paddingHorizontal:20,marginBottom:6},
  summaryPill:{flexDirection:"row",alignItems:"center",gap:6,alignSelf:"flex-start",paddingHorizontal:12,paddingVertical:5,borderRadius:20,backgroundColor:BLUE_D,borderWidth:1,borderColor:"rgba(59,130,246,0.25)"},
  summaryTxt:{fontSize:12,color:BLUE2,fontWeight:"400"},
  empty:{alignItems:"center",padding:56,gap:12},
  emptyIconWrap:{width:72,height:72,borderRadius:36,backgroundColor:GLASS,justifyContent:"center",alignItems:"center",borderWidth:1,borderColor:SEP},
  emptyTitle:{fontSize:18,fontWeight:"300",color:T1,letterSpacing:-0.2},
  emptySub:{fontSize:14,color:T2,textAlign:"center",lineHeight:21,maxWidth:260,fontWeight:"400"},
});
const mn = StyleSheet.create({
  container:{flex:1,backgroundColor:BG},
  loadingWrap:{flex:1,backgroundColor:BG,justifyContent:"center",alignItems:"center"},
  header:{flexDirection:"row",alignItems:"center",paddingHorizontal:20,paddingTop:18,paddingBottom:8,gap:12},
  backBtn:{width:36,height:36,borderRadius:18,backgroundColor:GLASS,borderWidth:1,borderColor:SEP,justifyContent:"center",alignItems:"center"},
  eyebrow:{fontSize:11,fontWeight:"500",color:BLUE,letterSpacing:1.8,marginBottom:2},
  title:{fontSize:26,fontWeight:"200",color:T1,letterSpacing:-0.6},
  subtitle:{fontSize:13,color:"rgba(241,245,249,0.45)",fontWeight:"400",marginTop:2},
  nameToggleBtn:{width:36,height:36,borderRadius:18,backgroundColor:GLASS,borderWidth:1,borderColor:SEP,justifyContent:"center",alignItems:"center"},
  nameToggleBtnActive:{backgroundColor:BLUE_D,borderColor:"rgba(59,130,246,0.4)"},
});