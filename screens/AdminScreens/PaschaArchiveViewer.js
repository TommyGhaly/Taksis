import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  StyleSheet, ActivityIndicator, Image, Platform,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import PaschaSchedule from "../Pascha/PaschaSchedule.json";

const DEFAULT_AVATAR = require("../../assets/default_profile.png");

// ─── Tokens ───────────────────────────────────────────────────────────────────
const BG      = "#0f0f0f";
const CARD    = "#1c1c1e";
const CARD2   = "#2c2c2e";
const CARD3   = "#3a3a3c";
const SEP     = "rgba(255,255,255,0.08)";
const BLUE    = "#0a84ff";
const BLUEDIM = "rgba(10,132,255,0.15)";
const GREEN   = "#30d158";
const ORANGE  = "#ff9f0a";
const PURPLE  = "#bf5af2";
const T1      = "#ffffff";
const T2      = "rgba(255,255,255,0.65)";
const T3      = "rgba(255,255,255,0.28)";

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

function dayTotals(day, daySchedule) {
  let total = 0, filled = 0;
  (day.hours || []).forEach(h => {
    const s = countSlots(h, daySchedule[h.id] || {});
    total += s.total; filled += s.filled;
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

const Avatar = ({ uid, size = 28, style }) => {
  const uri = useProfilePic(uid);
  return (
    <View style={[{ width:size, height:size, borderRadius:size/2, overflow:"hidden", backgroundColor:CARD3 }, style]}>
      <Image source={uri ? { uri } : DEFAULT_AVATAR} style={{ width:size, height:size }} resizeMode="cover" />
    </View>
  );
};

// ─── Reading pill ─────────────────────────────────────────────────────────────
const ReadingPill = ({ row, hourAssignments, isLast }) => {
  const meta        = READING_META[row.rKey] || { label:row.rKey, icon:"book-outline", color:T2 };
  const isPsalm     = row.rKey === "psalm";
  const label       = row.index != null ? `${meta.label} ${row.index + 1}` : meta.label;
  const psalmReaders = isPsalm ? (hourAssignments.psalm_readers || []) : [];
  const assignee    = !isPsalm ? (hourAssignments[row.slotKey] || null) : null;
  const hasAssign   = isPsalm ? psalmReaders.length > 0 : !!assignee;

  return (
    <View style={[rp.row, !isLast && rp.border]}>
      <View style={rp.left}>
        <View style={[rp.iconBox, { backgroundColor: meta.color + "20" }]}>
          <Icon name={meta.icon} size={13} color={meta.color} />
        </View>
        <View style={{ flex:1 }}>
          <Text style={[rp.type, { color: meta.color }]}>{label}</Text>
          {!!row.refText && <Text style={rp.ref} numberOfLines={1}>{row.refText}</Text>}
        </View>
      </View>

      <View style={rp.right}>
        {hasAssign ? (
          isPsalm ? (
            <View style={rp.stack}>
              {psalmReaders.map((r, i) => (
                <View key={r.uid||r.name||i} style={rp.chip}>
                  <Avatar uid={r.uid} size={20} />
                  <Text style={rp.chipName} numberOfLines={1}>{r.name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={rp.chip}>
              <Avatar uid={assignee.uid} size={20} />
              <Text style={rp.chipName} numberOfLines={1}>{assignee.name}</Text>
            </View>
          )
        ) : (
          <View style={rp.unassignedPill}>
            <Text style={rp.unassignedTxt}>Unassigned</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const rp = StyleSheet.create({
  row:           { flexDirection:"row", alignItems:"flex-start", paddingVertical:11, gap:10 },
  border:        { borderBottomWidth:1, borderBottomColor:SEP },
  left:          { flexDirection:"row", alignItems:"flex-start", gap:10, flex:1 },
  iconBox:       { width:26, height:26, borderRadius:8, justifyContent:"center", alignItems:"center", flexShrink:0, marginTop:1 },
  type:          { fontSize:11, fontWeight:"800", letterSpacing:0.5, textTransform:"uppercase" },
  ref:           { fontSize:12, color:T2, marginTop:3, lineHeight:17 },
  right:         { alignItems:"flex-end", flexShrink:0, maxWidth:"48%" },
  stack:         { gap:5, alignItems:"flex-end" },
  chip:          { flexDirection:"row", alignItems:"center", gap:6,
                   backgroundColor:"rgba(48,209,88,0.08)", borderWidth:1,
                   borderColor:"rgba(48,209,88,0.18)", borderRadius:20,
                   paddingVertical:4, paddingHorizontal:8 },
  chipName:      { fontSize:12, fontWeight:"600", color:GREEN, maxWidth:100 },
  unassignedPill:{ paddingHorizontal:8, paddingVertical:3, borderRadius:10,
                   backgroundColor:"rgba(255,255,255,0.05)" },
  unassignedTxt: { fontSize:11, color:T3, fontStyle:"italic" },
});

// ─── Hour card ────────────────────────────────────────────────────────────────
const HourCard = ({ hour, hourAssignments }) => {
  const [open, setOpen] = useState(false);
  const rows = expandReadings(hour);
  const assignableRows = rows.filter(r => ASSIGNABLE.includes(r.rKey));
  const { total, filled } = countSlots(hour, hourAssignments);
  const complete = total > 0 && filled === total;
  const started  = filled > 0 && !complete;
  const pct      = total > 0 ? Math.round(filled / total * 100) : 0;
  const accentColor = complete ? GREEN : started ? BLUE : CARD3;

  return (
    <View style={hc.wrap}>
      <TouchableOpacity style={hc.header} onPress={() => setOpen(v => !v)} activeOpacity={0.7}>
        <View style={[hc.accent, { backgroundColor: accentColor }]} />
        <View style={hc.mid}>
          <Text style={hc.label}>{hour.label}</Text>
          <View style={hc.metaRow}>
            {complete
              ? <><Icon name="check-circle-outline" size={11} color={GREEN} />
                  <Text style={[hc.meta, { color:GREEN }]}>All assigned</Text></>
              : started
                ? <><Icon name="circle-slice-4" size={11} color={BLUE} />
                    <Text style={[hc.meta, { color:BLUE }]}>{filled} of {total}</Text></>
                : <Text style={hc.meta}>{total} readings</Text>
            }
          </View>
        </View>
        {/* mini progress arc */}
        <View style={hc.pctWrap}>
          <Text style={[hc.pctTxt, complete && { color:GREEN }]}>{pct}%</Text>
        </View>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={14} color={T3} />
      </TouchableOpacity>

      {open && (
        <View style={hc.body}>
          {assignableRows.map((row, i) => (
            <ReadingPill
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
  wrap:    { backgroundColor:CARD2, borderRadius:14, marginBottom:8, overflow:"hidden" },
  header:  { flexDirection:"row", alignItems:"center", padding:14, gap:10 },
  accent:  { width:3, alignSelf:"stretch", borderRadius:2, flexShrink:0 },
  mid:     { flex:1 },
  label:   { fontSize:14, fontWeight:"700", color:T1 },
  metaRow: { flexDirection:"row", alignItems:"center", gap:4, marginTop:3 },
  meta:    { fontSize:12, color:T2 },
  pctWrap: { paddingHorizontal:8, paddingVertical:3, borderRadius:8, backgroundColor:CARD3 },
  pctTxt:  { fontSize:11, fontWeight:"700", color:T2 },
  body:    { borderTopWidth:1, borderTopColor:SEP, paddingHorizontal:14, paddingBottom:6 },
});

// ─── Day section ──────────────────────────────────────────────────────────────
const DaySection = ({ day, daySchedule, easterDate }) => {
  const [open, setOpen] = useState(false);
  const hours  = day.hours || [];
  const { total, filled } = dayTotals(day, daySchedule);
  const pct      = total > 0 ? Math.round(filled / total * 100) : 0;
  const complete = pct === 100;
  const dateStr  = easterDate ? calcDate(easterDate, day.easterOffset) : null;

  return (
    <View style={ds.wrap}>
      <TouchableOpacity style={ds.header} onPress={() => setOpen(v => !v)} activeOpacity={0.72}>
        {/* colored left bar */}
        <View style={[ds.bar, { backgroundColor: complete ? GREEN : pct > 0 ? BLUE : CARD3 }]} />
        <View style={{ flex:1 }}>
          <Text style={ds.label}>{day.label}</Text>
          {dateStr && <Text style={ds.date}>{dateStr}</Text>}
        </View>
        <View style={ds.right}>
          {complete
            ? <View style={ds.donePill}>
                <Icon name="check" size={10} color={GREEN} />
                <Text style={ds.doneTxt}>Done</Text>
              </View>
            : <Text style={ds.pct}>{pct}%</Text>
          }
          <Icon name={open ? "chevron-up" : "chevron-down"} size={14} color={T3} style={{ marginLeft:8 }} />
        </View>
      </TouchableOpacity>

      <View style={ds.trackWrap}>
        <View style={[ds.trackFill, { width:`${pct}%` }, complete && { backgroundColor:GREEN }]} />
      </View>

      {open && (
        <View style={ds.body}>
          {hours.map(h => (
            <HourCard key={h.id} hour={h} hourAssignments={daySchedule[h.id] || {}} />
          ))}
        </View>
      )}
    </View>
  );
};

const ds = StyleSheet.create({
  wrap:     { backgroundColor:CARD, borderRadius:18, marginBottom:12,
              overflow:"hidden", borderWidth:1, borderColor:SEP },
  header:   { flexDirection:"row", alignItems:"center", padding:16, gap:12 },
  bar:      { width:4, alignSelf:"stretch", borderRadius:2, flexShrink:0 },
  label:    { fontSize:16, fontWeight:"700", color:T1 },
  date:     { fontSize:12, color:T2, marginTop:2 },
  right:    { flexDirection:"row", alignItems:"center" },
  pct:      { fontSize:13, fontWeight:"600", color:T2 },
  donePill: { flexDirection:"row", alignItems:"center", gap:4, paddingHorizontal:9, paddingVertical:3,
              borderRadius:20, backgroundColor:"rgba(48,209,88,0.1)",
              borderWidth:1, borderColor:"rgba(48,209,88,0.25)" },
  doneTxt:  { fontSize:11, fontWeight:"700", color:GREEN },
  trackWrap:{ height:2, backgroundColor:CARD2, marginHorizontal:16 },
  trackFill:{ height:2, backgroundColor:BLUE, borderRadius:2 },
  body:     { padding:12, paddingTop:10 },
});

// ─── Stats bar (shown in year detail header) ──────────────────────────────────
const StatsBar = ({ schedule }) => {
  let total = 0, filled = 0, daysComplete = 0;
  ALL_DAYS.forEach(d => {
    const dayDef = DAYS_BY_ID[d.id];
    const { total:t, filled:f } = dayTotals(dayDef, schedule?.[d.id] || {});
    total += t; filled += f;
    if (t > 0 && f === t) daysComplete++;
  });
  const pct = total > 0 ? Math.round(filled / total * 100) : 0;

  return (
    <View style={sb.wrap}>
      <View style={sb.stat}>
        <Text style={sb.val}>{pct}%</Text>
        <Text style={sb.lbl}>Assigned</Text>
      </View>
      <View style={sb.div} />
      <View style={sb.stat}>
        <Text style={[sb.val, { color:GREEN }]}>{daysComplete}</Text>
        <Text style={sb.lbl}>Days Done</Text>
      </View>
      <View style={sb.div} />
      <View style={sb.stat}>
        <Text style={sb.val}>{filled}</Text>
        <Text style={sb.lbl}>of {total}</Text>
      </View>
    </View>
  );
};

const sb = StyleSheet.create({
  wrap: { flexDirection:"row", backgroundColor:CARD2, marginHorizontal:16, marginBottom:12,
          borderRadius:14, padding:14 },
  stat: { flex:1, alignItems:"center" },
  val:  { fontSize:20, fontWeight:"800", color:T1, letterSpacing:-0.5 },
  lbl:  { fontSize:11, color:T2, marginTop:3 },
  div:  { width:1, backgroundColor:SEP, marginHorizontal:8 },
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
      {/* top row */}
      <View style={yc.top}>
        <View style={yc.iconBox}>
          <Icon name="cross" size={20} color={ORANGE} />
        </View>
        <View style={{ flex:1, marginLeft:14 }}>
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
        <Icon name="chevron-right" size={16} color={T3} style={{ marginLeft:10 }} />
      </View>

      {/* progress bar */}
      <View style={yc.trackWrap}>
        <View style={[yc.trackFill, { width:`${pct}%` }, complete && { backgroundColor:GREEN }]} />
      </View>

      {/* day dots */}
      <View style={yc.dots}>
        {ALL_DAYS.map(d => {
          const dayDef = DAYS_BY_ID[d.id];
          const { total:t, filled:f } = dayTotals(dayDef, arc.schedule?.[d.id] || {});
          const c = t > 0 && f === t;
          const s = f > 0 && !c;
          return (
            <View key={d.id}
              style={[yc.dot, c && yc.dotGreen, s && yc.dotBlue]} />
          );
        })}
      </View>
    </TouchableOpacity>
  );
};

const yc = StyleSheet.create({
  card:     { backgroundColor:CARD, borderRadius:18, padding:16,
              borderWidth:1, borderColor:SEP, marginBottom:12 },
  top:      { flexDirection:"row", alignItems:"center", marginBottom:12 },
  iconBox:  { width:42, height:42, borderRadius:12, backgroundColor:"rgba(255,159,10,0.1)",
              justifyContent:"center", alignItems:"center", flexShrink:0 },
  year:     { fontSize:17, fontWeight:"800", color:T1, letterSpacing:-0.3 },
  sub:      { fontSize:12, color:T3, marginTop:2 },
  donePill: { flexDirection:"row", alignItems:"center", gap:4, paddingHorizontal:8, paddingVertical:3,
              borderRadius:20, backgroundColor:"rgba(48,209,88,0.1)",
              borderWidth:1, borderColor:"rgba(48,209,88,0.25)" },
  doneTxt:  { fontSize:10, fontWeight:"700", color:GREEN },
  pct:      { fontSize:13, fontWeight:"700", color:T2 },
  trackWrap:{ height:4, backgroundColor:CARD2, borderRadius:2, marginBottom:10 },
  trackFill:{ height:4, backgroundColor:BLUE, borderRadius:2 },
  dots:     { flexDirection:"row", gap:4, flexWrap:"wrap" },
  dot:      { width:6, height:6, borderRadius:3, backgroundColor:CARD3 },
  dotGreen: { backgroundColor:GREEN },
  dotBlue:  { backgroundColor:BLUE },
});

// ─── Main ─────────────────────────────────────────────────────────────────────
const PaschaArchiveViewer = ({ visible, churchId, onClose }) => {
  const [archives, setArchives]         = useState([]);
  const [loading, setLoading]           = useState(false);
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
              <View style={av.loadingIconWrap}>
                <ActivityIndicator color={ORANGE} size="large" />
              </View>
              <Text style={av.loadingTxt}>Loading archives…</Text>
            </View>
          ) : archives.length === 0 ? (
            <View style={av.center}>
              <View style={av.emptyIconWrap}>
                <Icon name="archive-off-outline" size={34} color={T3} />
              </View>
              <Text style={av.emptyTitle}>No Archives Yet</Text>
              <Text style={av.emptySub}>
                Archive a schedule from Settings to see it here.
              </Text>
            </View>
          ) : !selectedYear ? (
            <ScrollView contentContainerStyle={av.list} showsVerticalScrollIndicator={false}>
              <Text style={av.sectionLabel}>{archives.length} archived year{archives.length > 1 ? "s" : ""}</Text>
              {archives.map(a => (
                <YearCard key={a.year} arc={a} onPress={() => setSelectedYear(a.year)} />
              ))}
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom:24 }} showsVerticalScrollIndicator={false}>
              <StatsBar schedule={selected.schedule} />
              <View style={av.list}>
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
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const av = StyleSheet.create({
  overlay:       { flex:1, backgroundColor:"rgba(0,0,0,0.75)", justifyContent:"flex-end" },
  sheet:         { backgroundColor:BG, borderTopLeftRadius:28, borderTopRightRadius:28,
                   height:"92%", paddingBottom:Platform.OS==="ios"?34:20 },
  handle:        { width:38, height:4, borderRadius:2, backgroundColor:SEP, alignSelf:"center", marginTop:12 },
  hdr:           { flexDirection:"row", alignItems:"center", gap:12,
                   paddingHorizontal:20, paddingTop:16, paddingBottom:14,
                   borderBottomWidth:1, borderBottomColor:SEP },
  iconBox:       { width:36, height:36, borderRadius:10, backgroundColor:"rgba(255,159,10,0.12)",
                   justifyContent:"center", alignItems:"center" },
  backBtn:       { width:36, height:36, borderRadius:18, backgroundColor:CARD2,
                   justifyContent:"center", alignItems:"center" },
  title:         { fontSize:20, fontWeight:"800", color:T1, letterSpacing:-0.3 },
  sub:           { fontSize:12, color:T2, marginTop:2 },
  xBtn:          { width:32, height:32, borderRadius:16, backgroundColor:CARD2,
                   justifyContent:"center", alignItems:"center" },
  center:        { flex:1, justifyContent:"center", alignItems:"center", padding:32 },
  loadingIconWrap:{ width:64, height:64, borderRadius:32, backgroundColor:CARD2,
                    justifyContent:"center", alignItems:"center", marginBottom:16 },
  loadingTxt:    { fontSize:14, color:T2 },
  emptyIconWrap: { width:72, height:72, borderRadius:36, backgroundColor:CARD2,
                   justifyContent:"center", alignItems:"center", marginBottom:18 },
  emptyTitle:    { fontSize:19, fontWeight:"700", color:T1, marginBottom:8 },
  emptySub:      { fontSize:14, color:T2, textAlign:"center", lineHeight:21 },
  sectionLabel:  { fontSize:12, fontWeight:"700", color:T3, letterSpacing:1,
                   textTransform:"uppercase", marginBottom:12 },
  list:          { padding:16 },
});

export default PaschaArchiveViewer;