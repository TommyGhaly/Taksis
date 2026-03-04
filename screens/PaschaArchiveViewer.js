import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  StyleSheet, ActivityIndicator, Image, Platform,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import PaschaSchedule from "./Pascha/PaschaSchedule.json";

const DEFAULT_AVATAR = require("../assets/default_profile.png");

// ─── Tokens ───────────────────────────────────────────────────────────────────
const BG      = "#0f0f0f";
const CARD    = "#1c1c1e";
const CARD2   = "#2c2c2e";
const CARD3   = "#3a3a3c";
const SEP     = "rgba(255,255,255,0.1)";
const BLUE    = "#0a84ff";
const BLUEDIM = "rgba(10,132,255,0.15)";
const GREEN   = "#30d158";
const ORANGE  = "#ff9f0a";
const T1      = "#ffffff";
const T2      = "rgba(255,255,255,0.65)";
const T3      = "rgba(255,255,255,0.30)";

const READING_META = {
  prophecies: { label:"Prophecy",  icon:"fire",                color:"#e5c46b" },
  psalm:      { label:"Psalm",     icon:"music-note",          color:"#7ec8a0" },
  pauline:    { label:"Pauline",   icon:"feather",             color:"#c084fc" },
  catholic:   { label:"Catholic",  icon:"bookshelf",           color:"#67d3cb" },
  praxis:     { label:"Praxis",    icon:"script-text-outline", color:"#fb923c" },
  gospel:     { label:"Gospel",    icon:"book-cross",          color:"#38bdf8" },
  gospels:    { label:"Gospel",    icon:"book-cross",          color:"#38bdf8" },
  homily:     { label:"Homily",    icon:"microphone-outline",  color:"#f87171" },
  litanies:   { label:"Litanies",  icon:"hands-pray",          color:T2        },
};
const ASSIGNABLE    = ["prophecies","psalm","pauline","catholic","praxis","gospel","gospels"];
const READING_ORDER = ["prophecies","psalm","pauline","catholic","praxis","gospel","gospels","homily","litanies"];

const ALL_DAYS = [
  { id:"last_friday_lent",    label:"Last Friday of Holy Lent", easterOffset:-9  },
  { id:"palm_sunday",         label:"Palm Sunday",              easterOffset:-7  },
  { id:"monday_eve",          label:"Monday Evening",           easterOffset:-6  },
  { id:"monday_morning",      label:"Monday Morning",           easterOffset:-6  },
  { id:"tuesday_eve",         label:"Tuesday Evening",          easterOffset:-5  },
  { id:"tuesday_morning",     label:"Tuesday Morning",          easterOffset:-5  },
  { id:"wednesday_eve",       label:"Wednesday Evening",        easterOffset:-4  },
  { id:"wednesday_morning",   label:"Wednesday Morning",        easterOffset:-4  },
  { id:"thursday_eve",        label:"Thursday Evening",         easterOffset:-3  },
  { id:"covenant_thursday",   label:"Covenant Thursday",        easterOffset:-3  },
  { id:"good_friday_eve",     label:"Good Friday Evening",      easterOffset:-2  },
  { id:"good_friday_morning", label:"Good Friday Morning",      easterOffset:-2  },
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

function expandReadings(hour) {
  const rows = [];
  READING_ORDER.forEach(k => {
    const val = hour.readings?.[k];
    if (val == null) return;
    if (Array.isArray(val) && ASSIGNABLE.includes(k) && k !== "psalm") {
      val.forEach((entry, i) => {
        let ref = "";
        if (typeof entry === "string") ref = entry;
        else if (entry.reference) ref = entry.location ? `${entry.reference} — ${entry.location}` : entry.reference;
        rows.push({ rKey:k, slotKey:`${k}_${i}`, index:i, refText:ref });
      });
    } else {
      const ref = Array.isArray(val)
        ? val.map(v => typeof v === "string" ? v : v.reference || "").filter(Boolean).join(", ")
        : (typeof val === "string" ? val : "");
      rows.push({ rKey:k, slotKey:k, index:null, refText:ref });
    }
  });
  return rows;
}

// Count slots correctly — psalm uses psalm_readers array
function countSlots(hour, ha) {
  let total = 0, filled = 0;
  expandReadings(hour).forEach(({ slotKey, rKey }) => {
    if (!ASSIGNABLE.includes(rKey)) return;
    total++;
    if (rKey === "psalm") {
      if ((ha.psalm_readers || []).length > 0) filled++;
    } else {
      if (ha[slotKey]) filled++;
    }
  });
  return { total, filled };
}

// ─── Profile pic hook ─────────────────────────────────────────────────────────
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

// ─── Avatar ───────────────────────────────────────────────────────────────────
const Avatar = ({ uid, size = 28, style }) => {
  const uri = useProfilePic(uid);
  return (
    <View style={[{ width:size, height:size, borderRadius:size/2, overflow:"hidden", backgroundColor:CARD3 }, style]}>
      <Image source={uri ? { uri } : DEFAULT_AVATAR} style={{ width:size, height:size }} resizeMode="cover" />
    </View>
  );
};

// ─── Assignee chip (single) ───────────────────────────────────────────────────
const AssigneeChip = ({ person }) => (
  <View style={ch.chip}>
    <Avatar uid={person.uid} size={22} />
    <Text style={ch.name} numberOfLines={1}>{person.name}</Text>
  </View>
);

// ─── Reading row ──────────────────────────────────────────────────────────────
const ReadingRow = ({ row, hourAssignments, isLast }) => {
  const meta     = READING_META[row.rKey] || { label:row.rKey, icon:"book-outline", color:T2 };
  const isPsalm  = row.rKey === "psalm";
  const label    = row.index != null ? `${meta.label} ${row.index + 1}` : meta.label;

  // Psalm: array of readers
  const psalmReaders = isPsalm ? (hourAssignments.psalm_readers || []) : [];
  // Others: single assignee object
  const assignee = !isPsalm ? (hourAssignments[row.slotKey] || null) : null;

  const hasAssignment = isPsalm ? psalmReaders.length > 0 : !!assignee;

  return (
    <View style={[rr.row, !isLast && rr.border]}>
      {/* Left: type + ref */}
      <View style={rr.left}>
        <View style={[rr.iconBox, { backgroundColor: meta.color + "18" }]}>
          <Icon name={meta.icon} size={12} color={meta.color} />
        </View>
        <View style={{ flex:1 }}>
          <Text style={[rr.type, { color:meta.color }]}>{label}</Text>
          {!!row.refText && <Text style={rr.ref} numberOfLines={1}>{row.refText}</Text>}
        </View>
      </View>

      {/* Right: assignee(s) */}
      <View style={rr.right}>
        {hasAssignment ? (
          isPsalm ? (
            // Multiple psalm readers — show stacked chips
            <View style={rr.psalmReaders}>
              {psalmReaders.map((r, i) => (
                <AssigneeChip key={r.uid || r.name || i} person={r} />
              ))}
            </View>
          ) : (
            <AssigneeChip person={assignee} />
          )
        ) : (
          <Text style={rr.unassigned}>Unassigned</Text>
        )}
      </View>
    </View>
  );
};

const rr = StyleSheet.create({
  row:          { flexDirection:"row", alignItems:"flex-start", paddingVertical:10, gap:10 },
  border:       { borderBottomWidth:1, borderBottomColor:SEP },
  left:         { flexDirection:"row", alignItems:"flex-start", gap:8, flex:1 },
  iconBox:      { width:24, height:24, borderRadius:7, justifyContent:"center", alignItems:"center", flexShrink:0, marginTop:1 },
  type:         { fontSize:11, fontWeight:"800", letterSpacing:0.4, textTransform:"uppercase" },
  ref:          { fontSize:12, color:T2, marginTop:2, lineHeight:17 },
  right:        { alignItems:"flex-end", flexShrink:0, maxWidth:"45%" },
  psalmReaders: { gap:5, alignItems:"flex-end" },
  unassigned:   { fontSize:12, color:T3, fontStyle:"italic" },
});

const ch = StyleSheet.create({
  chip: { flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"rgba(48,209,88,0.08)",
          borderWidth:1, borderColor:"rgba(48,209,88,0.2)", borderRadius:20,
          paddingVertical:4, paddingHorizontal:8 },
  name: { fontSize:12, fontWeight:"600", color:GREEN, maxWidth:110 },
});

// ─── Hour accordion ───────────────────────────────────────────────────────────
const HourCard = ({ hour, hourAssignments }) => {
  const [open, setOpen] = useState(false);
  const rows = expandReadings(hour);
  const assignableRows = rows.filter(r => ASSIGNABLE.includes(r.rKey));
  const { total, filled } = countSlots(hour, hourAssignments);
  const complete = total > 0 && filled === total;
  const started  = filled > 0 && !complete;

  return (
    <View style={hc.wrap}>
      <TouchableOpacity style={hc.header} onPress={() => setOpen(v => !v)} activeOpacity={0.7}>
        <View style={[hc.bar, { backgroundColor: complete ? GREEN : started ? BLUE : CARD3 }]} />
        <View style={hc.middle}>
          <Text style={hc.label}>{hour.label}</Text>
          <Text style={[hc.count, complete && { color:GREEN }]}>
            {complete ? "All assigned" : started ? `${filled} / ${total}` : `${total} readings`}
          </Text>
        </View>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={14} color={T3} />
      </TouchableOpacity>

      {open && (
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
  wrap:   { backgroundColor:CARD2, borderRadius:13, marginBottom:8, overflow:"hidden" },
  header: { flexDirection:"row", alignItems:"center", padding:14, gap:12 },
  bar:    { width:3, alignSelf:"stretch", borderRadius:2, flexShrink:0 },
  middle: { flex:1 },
  label:  { fontSize:14, fontWeight:"700", color:T1 },
  count:  { fontSize:12, color:T2, marginTop:2 },
  body:   { borderTopWidth:1, borderTopColor:SEP, paddingHorizontal:14, paddingBottom:4 },
});

// ─── Day section ──────────────────────────────────────────────────────────────
const DaySection = ({ day, daySchedule, easterDate }) => {
  const [open, setOpen] = useState(false);
  const hours = day.hours || [];

  let total = 0, filled = 0;
  hours.forEach(h => {
    const s = countSlots(h, daySchedule[h.id] || {});
    total += s.total; filled += s.filled;
  });
  const pct      = total > 0 ? Math.round(filled / total * 100) : 0;
  const complete = pct === 100;
  const dateStr  = easterDate ? calcDate(easterDate, day.easterOffset) : null;

  return (
    <View style={dss.wrap}>
      <TouchableOpacity style={dss.header} onPress={() => setOpen(v => !v)} activeOpacity={0.72}>
        <View style={{ flex:1 }}>
          <Text style={dss.label}>{day.label}</Text>
          {dateStr && <Text style={dss.date}>{dateStr}</Text>}
        </View>
        <View style={dss.right}>
          {complete
            ? <View style={dss.donePill}>
                <Icon name="check" size={10} color={GREEN} />
                <Text style={dss.doneTxt}>Done</Text>
              </View>
            : <Text style={dss.pct}>{pct}%</Text>
          }
          <Icon name={open ? "chevron-up" : "chevron-down"} size={14} color={T3} style={{ marginLeft:8 }} />
        </View>
      </TouchableOpacity>

      <View style={dss.trackWrap}>
        <View style={[dss.trackFill, { width:`${pct}%` }, complete && { backgroundColor:GREEN }]} />
      </View>

      {open && (
        <View style={dss.body}>
          {hours.map(h => (
            <HourCard key={h.id} hour={h} hourAssignments={daySchedule[h.id] || {}} />
          ))}
        </View>
      )}
    </View>
  );
};

const dss = StyleSheet.create({
  wrap:     { backgroundColor:CARD, borderRadius:16, marginBottom:10, overflow:"hidden", borderWidth:1, borderColor:SEP },
  header:   { flexDirection:"row", alignItems:"center", padding:16 },
  label:    { fontSize:16, fontWeight:"700", color:T1 },
  date:     { fontSize:12, color:T2, marginTop:2 },
  right:    { flexDirection:"row", alignItems:"center" },
  pct:      { fontSize:13, fontWeight:"600", color:T2 },
  donePill: { flexDirection:"row", alignItems:"center", gap:4, paddingHorizontal:8, paddingVertical:3,
              borderRadius:20, backgroundColor:"rgba(48,209,88,0.1)", borderWidth:1, borderColor:"rgba(48,209,88,0.28)" },
  doneTxt:  { fontSize:11, fontWeight:"700", color:GREEN },
  trackWrap:{ height:2, backgroundColor:CARD2, marginHorizontal:16 },
  trackFill:{ height:2, backgroundColor:BLUE, borderRadius:2 },
  body:     { padding:12, paddingTop:10 },
});

// ─── Year card ────────────────────────────────────────────────────────────────
const YearCard = ({ arc, onPress }) => {
  let total = 0, filled = 0;
  ALL_DAYS.forEach(d => {
    const dayDef = DAYS_BY_ID[d.id];
    (dayDef?.hours || []).forEach(h => {
      const s = countSlots(h, (arc.schedule?.[d.id]?.[h.id]) || {});
      total += s.total; filled += s.filled;
    });
  });
  const pct      = total > 0 ? Math.round(filled / total * 100) : 0;
  const complete = pct === 100;

  const fmtDate = ts => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
  };

  return (
    <TouchableOpacity style={yc.card} onPress={onPress} activeOpacity={0.75}>
      <View style={yc.iconBox}>
        <Icon name="calendar-check-outline" size={22} color={BLUE} />
      </View>
      <View style={{ flex:1, marginLeft:14 }}>
        <View style={yc.topRow}>
          <Text style={yc.year}>Pascha {arc.year}</Text>
          {complete
            ? <View style={yc.donePill}>
                <Icon name="check" size={10} color={GREEN} />
                <Text style={yc.doneTxt}>Complete</Text>
              </View>
            : <Text style={yc.pct}>{pct}%</Text>
          }
        </View>
        {arc.archivedAt && <Text style={yc.sub}>Archived {fmtDate(arc.archivedAt)}</Text>}
        <View style={yc.trackWrap}>
          <View style={[yc.trackFill, { width:`${pct}%` }, complete && { backgroundColor:GREEN }]} />
        </View>
      </View>
      <Icon name="chevron-right" size={16} color={T3} style={{ marginLeft:8 }} />
    </TouchableOpacity>
  );
};

const yc = StyleSheet.create({
  card:     { flexDirection:"row", alignItems:"center", backgroundColor:CARD,
              borderRadius:16, padding:16, borderWidth:1, borderColor:SEP, marginBottom:10 },
  iconBox:  { width:44, height:44, borderRadius:12, backgroundColor:BLUEDIM,
              justifyContent:"center", alignItems:"center", flexShrink:0 },
  topRow:   { flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:4 },
  year:     { fontSize:16, fontWeight:"700", color:T1 },
  pct:      { fontSize:12, fontWeight:"600", color:T2 },
  sub:      { fontSize:12, color:T3, marginBottom:6 },
  donePill: { flexDirection:"row", alignItems:"center", gap:4, paddingHorizontal:8, paddingVertical:2,
              borderRadius:20, backgroundColor:"rgba(48,209,88,0.1)", borderWidth:1, borderColor:"rgba(48,209,88,0.28)" },
  doneTxt:  { fontSize:10, fontWeight:"700", color:GREEN },
  trackWrap:{ height:3, backgroundColor:CARD2, borderRadius:2 },
  trackFill:{ height:3, backgroundColor:BLUE, borderRadius:2 },
});

// ─── Main ─────────────────────────────────────────────────────────────────────
const PaschaArchiveViewer = ({ visible, churchId, onClose }) => {
  const [archives, setArchives]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [selectedYear, setSelectedYear] = useState(null);

  useEffect(() => {
    if (!visible || !churchId) return;
    setLoading(true);
    setSelectedYear(null);
    setArchives([]);
    firestore()
      .collection("churches").doc(churchId)
      .collection("pascha").get()
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

  const fmtDate = ts => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
  };

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={av.overlay}>
        <View style={av.sheet}>
          <View style={av.handle} />

          {/* Header */}
          <View style={av.hdr}>
            {selectedYear ? (
              <TouchableOpacity style={av.backBtn} onPress={() => setSelectedYear(null)} activeOpacity={0.7}>
                <Icon name="arrow-left" size={18} color={T1} />
              </TouchableOpacity>
            ) : (
              <View style={av.iconBox}>
                <Icon name="archive-outline" size={19} color={ORANGE} />
              </View>
            )}
            <View style={{ flex:1 }}>
              <Text style={av.title}>
                {selectedYear ? `Pascha ${selectedYear}` : "Archived Schedules"}
              </Text>
              {selected?.archivedAt && (
                <Text style={av.sub}>Archived {fmtDate(selected.archivedAt)}</Text>
              )}
            </View>
            <TouchableOpacity style={av.xBtn} onPress={onClose} activeOpacity={0.7}>
              <Icon name="close" size={17} color={T2} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          {loading ? (
            <View style={av.center}>
              <ActivityIndicator color={BLUE} size="large" />
              <Text style={av.loadingTxt}>Loading archives…</Text>
            </View>
          ) : archives.length === 0 ? (
            <View style={av.center}>
              <View style={av.emptyIconWrap}>
                <Icon name="archive-off-outline" size={32} color={T3} />
              </View>
              <Text style={av.emptyTitle}>No Archives Yet</Text>
              <Text style={av.emptySub}>Archived schedules will appear here.</Text>
            </View>
          ) : !selectedYear ? (
            <ScrollView contentContainerStyle={av.list} showsVerticalScrollIndicator={false}>
              {archives.map(a => (
                <YearCard key={a.year} arc={a} onPress={() => setSelectedYear(a.year)} />
              ))}
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={av.list} showsVerticalScrollIndicator={false}>
              {ALL_DAYS.map(d => {
                const dayDef = DAYS_BY_ID[d.id];
                if (!dayDef?.hours?.length) return null;
                return (
                  <DaySection
                    key={d.id}
                    day={dayDef}
                    daySchedule={selected.schedule?.[d.id] || {}}
                    easterDate={selected.easterDate}
                  />
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const av = StyleSheet.create({
  overlay:      { flex:1, backgroundColor:"rgba(0,0,0,0.72)", justifyContent:"flex-end" },
  sheet:        { backgroundColor:BG, borderTopLeftRadius:26, borderTopRightRadius:26,
                  height:"92%", paddingBottom:Platform.OS==="ios"?34:20 },
  handle:       { width:38, height:4, borderRadius:2, backgroundColor:SEP, alignSelf:"center", marginTop:12 },
  hdr:          { flexDirection:"row", alignItems:"center", gap:12,
                  paddingHorizontal:20, paddingTop:16, paddingBottom:14,
                  borderBottomWidth:1, borderBottomColor:SEP },
  iconBox:      { width:36, height:36, borderRadius:10, backgroundColor:"rgba(255,159,10,0.12)",
                  justifyContent:"center", alignItems:"center" },
  backBtn:      { width:36, height:36, borderRadius:18, backgroundColor:CARD2,
                  justifyContent:"center", alignItems:"center" },
  title:        { fontSize:20, fontWeight:"800", color:T1, letterSpacing:-0.3 },
  sub:          { fontSize:12, color:T2, marginTop:2 },
  xBtn:         { width:32, height:32, borderRadius:16, backgroundColor:CARD2,
                  justifyContent:"center", alignItems:"center" },
  center:       { flex:1, justifyContent:"center", alignItems:"center", padding:32 },
  loadingTxt:   { fontSize:14, color:T2, marginTop:12 },
  emptyIconWrap:{ width:64, height:64, borderRadius:32, backgroundColor:CARD2,
                  justifyContent:"center", alignItems:"center", marginBottom:16 },
  emptyTitle:   { fontSize:18, fontWeight:"700", color:T1, marginBottom:8 },
  emptySub:     { fontSize:14, color:T2, textAlign:"center" },
  list:         { padding:16 },
});

export default PaschaArchiveViewer;