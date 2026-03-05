import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, ScrollView, Modal, TextInput, Switch,
  FlatList, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator, StatusBar, Pressable, Image,
  useWindowDimensions, Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import DateTimePicker from "@react-native-community/datetimepicker";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import auth from "@react-native-firebase/auth";
import PaschaSchedule from "./Pascha/PaschaSchedule.json";
import PaschaArchiveViewer from "./PaschaArchiveViewer";

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
const RED     = "#ff453a";
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
const ASSIGNABLE        = ["prophecies","psalm","pauline","catholic","praxis","gospel","gospels"];
const MAX_PSALM_READERS = 4;
const READING_ORDER     = ["prophecies","psalm","pauline","catholic","praxis","gospel","gospels","homily","litanies"];

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
        if (typeof entry === "string") { ref = entry; }
        else if (entry.reference) { ref = entry.reference; loc = entry.location || ""; }
        rows.push({ rKey:k, slotKey:`${k}_${i}`, index:i, refText:ref, location:loc });
      });
    } else {
      rows.push({ rKey:k, slotKey:k, index:null, refText:readingDisplay(val), location:"" });
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

function dayProgress(day, ds) {
  let total = 0, filled = 0;
  (day.hours || []).forEach(h => {
    const s = countSlots(h, ds[h.id] || {});
    total += s.total; filled += s.filled;
  });
  return { total, filled };
}

// ─── Profile picture hook ─────────────────────────────────────────────────────
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

const Avatar = ({ uid, size = 40, style }) => {
  const uri = useProfilePic(uid);
  return (
    <View style={[{ width:size, height:size, borderRadius:size/2, overflow:"hidden", backgroundColor:CARD2 }, style]}>
      <Image source={uri ? { uri } : DEFAULT_AVATAR} style={{ width:size, height:size }} resizeMode="cover" />
    </View>
  );
};

// ─── Psalm reader row button ──────────────────────────────────────────────────
const PsalmReadersRow = ({ readers = [], onOpen }) => {
  const has = readers.length > 0;
  return (
    <TouchableOpacity style={[hm.assignBtn, has && hm.assignBtnFilled]} onPress={onOpen} activeOpacity={0.7}>
      {has ? (
        <>
          <View style={{ flexDirection:"row" }}>
            {readers.slice(0,3).map((r, i) => (
              <Avatar key={r.uid||r.name||i} uid={r.uid} size={26}
                style={{ marginLeft:i>0?-8:0, borderWidth:1.5, borderColor:CARD }} />
            ))}
          </View>
          <Text style={hm.assignedName} numberOfLines={1}>
            {readers.length === 1 ? readers[0].name : `${readers.length} readers assigned`}
          </Text>
          <Icon name="pencil-outline" size={14} color={T2} />
        </>
      ) : (
        <>
          <Icon name="account-multiple-plus-outline" size={16} color={T2} />
          <Text style={hm.unassignedTxt}>Assign readers (up to {MAX_PSALM_READERS})</Text>
          <Icon name="chevron-right" size={14} color={T3} />
        </>
      )}
    </TouchableOpacity>
  );
};

// ─── Gospel grid ─────────────────────────────────────────────────────────────
const GospelGrid = ({ rows, hourAssignments, onOpenPicker }) => {
  const meta = READING_META.gospels;
  return (
    <View style={gg.grid}>
      {rows.map(row => {
        const assignee = hourAssignments[row.slotKey];
        return (
          <TouchableOpacity key={row.slotKey} style={gg.cell} onPress={() => onOpenPicker(row)} activeOpacity={0.7}>
            <View style={gg.cellTop}>
              <View style={[gg.numBadge, { backgroundColor:meta.color+"22" }]}>
                <Text style={[gg.numTxt, { color:meta.color }]}>{row.index + 1}</Text>
              </View>
              <View style={{ flex:1 }}>
                <Text style={gg.ref} numberOfLines={1}>{row.refText}</Text>
                {!!row.location && <Text style={gg.loc} numberOfLines={2}>{row.location}</Text>}
              </View>
            </View>
            {assignee ? (
              <View style={gg.assigneeRow}>
                <Avatar uid={assignee.uid} size={18} />
                <Text style={gg.assigneeName} numberOfLines={1}>{assignee.name}</Text>
              </View>
            ) : (
              <View style={gg.unassignedRow}>
                <Icon name="account-plus-outline" size={12} color={T3} />
                <Text style={gg.unassignedTxt}>Assign</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const gg = StyleSheet.create({
  grid:         { flexDirection:"row", flexWrap:"wrap", gap:8, marginTop:4 },
  cell:         { width:"48%", backgroundColor:CARD2, borderRadius:12, padding:10, gap:6 },
  cellTop:      { flexDirection:"row", alignItems:"flex-start", gap:8 },
  numBadge:     { width:24, height:24, borderRadius:7, justifyContent:"center", alignItems:"center", flexShrink:0 },
  numTxt:       { fontSize:11, fontWeight:"800" },
  ref:          { fontSize:12, color:T1, fontWeight:"600", lineHeight:16 },
  loc:          { fontSize:10, color:T3, marginTop:2, lineHeight:14 },
  assigneeRow:  { flexDirection:"row", alignItems:"center", gap:6 },
  assigneeName: { fontSize:11, fontWeight:"600", color:GREEN, flex:1 },
  unassignedRow:{ flexDirection:"row", alignItems:"center", gap:4 },
  unassignedTxt:{ fontSize:11, color:T3 },
});

// ─── Psalm multi-select picker ────────────────────────────────────────────────
const PsalmPickerModal = ({ visible, refText, currentReaders, deacons, congregation, loadingUsers, onSave, onClose }) => {
  const { height: screenH } = useWindowDimensions();
  const [tab, setTab]           = useState("deacons");
  const [q, setQ]               = useState("");
  const [selected, setSelected] = useState(new Set());
  const [selectedMap, setSelectedMap] = useState({});
  const [manual, setManual]     = useState("");
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const map = {};
    const keys = new Set();
    (currentReaders || []).forEach(r => {
      const k = r.uid || r.name;
      keys.add(k); map[k] = r;
    });
    setSelected(keys); setSelectedMap(map);
    setTab("deacons"); setQ(""); setManual(""); setManualOpen(false);
  }, [visible]);

  const sheetMax = screenH * 0.92;
  const listMax  = sheetMax - 280;

  const source = useMemo(() => {
    const list = tab === "deacons" ? deacons : congregation;
    return q ? list.filter(u => u.name.toLowerCase().includes(q.toLowerCase())) : list;
  }, [tab, deacons, congregation, q]);

  const toggle = item => {
    const k = item.uid || item.name;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(k)) {
        next.delete(k);
        setSelectedMap(m => { const n = { ...m }; delete n[k]; return n; });
      } else {
        if (next.size >= MAX_PSALM_READERS) return prev;
        next.add(k);
        setSelectedMap(m => ({ ...m, [k]: item }));
      }
      return next;
    });
  };

  const addManual = () => {
    const name = manual.trim();
    if (!name || selected.size >= MAX_PSALM_READERS) return;
    const item = { uid:`m_${Date.now()}`, name, isManual:true };
    setSelected(prev => new Set([...prev, item.uid]));
    setSelectedMap(m => ({ ...m, [item.uid]: item }));
    setManual(""); setManualOpen(false);
  };

  const commit = () => {
    onSave(Object.values(selectedMap).map(r => ({ uid:r.uid||null, name:r.name })));
    onClose();
  };

  const selectedList = Object.values(selectedMap);

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={hm.backdrop}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":"height"} style={{ width:"100%" }}>
              <View style={[hm.sheet, { maxHeight:sheetMax }]}>
                <View style={hm.handle} />
                <View style={hm.pickerHdr}>
                  <TouchableOpacity style={hm.backBtn} onPress={onClose} activeOpacity={0.7}>
                    <Icon name="close" size={19} color={T1} />
                  </TouchableOpacity>
                  <View style={[hm.pickerIconBox, { backgroundColor:READING_META.psalm.color+"22" }]}>
                    <Icon name="music-note" size={17} color={READING_META.psalm.color} />
                  </View>
                  <View style={{ flex:1 }}>
                    <Text style={[hm.pickerType, { color:READING_META.psalm.color }]}>Psalm Readers</Text>
                    {!!refText && <Text style={hm.pickerRef} numberOfLines={1}>{refText}</Text>}
                  </View>
                  <View style={pm.counter}>
                    <Text style={pm.counterTxt}>{selected.size}/{MAX_PSALM_READERS}</Text>
                  </View>
                </View>
                {selectedList.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    style={pm.chipScroll} contentContainerStyle={pm.chipRow}>
                    {selectedList.map(r => {
                      const k = r.uid || r.name;
                      return (
                        <TouchableOpacity key={k} style={pm.chip} onPress={() => toggle(r)} activeOpacity={0.7}>
                          <Avatar uid={r.uid} size={20} />
                          <Text style={pm.chipName} numberOfLines={1}>{r.name}</Text>
                          <Icon name="close-circle" size={14} color={T2} />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
                <View style={hm.seg}>
                  <View style={[hm.segSlider, tab==="all" && { left:"50%" }]} />
                  {[["deacons","Deacons"],["all","All Members"]].map(([k,l]) => (
                    <TouchableOpacity key={k} onPress={() => { setTab(k); setQ(""); }}
                      style={hm.segBtn} activeOpacity={0.8}>
                      <Text style={[hm.segTxt, tab===k && hm.segTxtOn]}>{l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={hm.searchRow}>
                  <Icon name="magnify" size={16} color={T3} />
                  <TextInput style={hm.searchIn} placeholder="Search..." placeholderTextColor={T3}
                    value={q} onChangeText={setQ} returnKeyType="search" />
                  {q.length > 0 && (
                    <TouchableOpacity onPress={() => setQ("")} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                      <Icon name="close-circle" size={15} color={T3} />
                    </TouchableOpacity>
                  )}
                </View>
                {loadingUsers
                  ? <View style={hm.center}><ActivityIndicator color={BLUE} /></View>
                  : <FlatList
                      data={source}
                      keyExtractor={i => i.uid||i.name}
                      style={{ maxHeight:listMax, paddingHorizontal:20 }}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator
                      ListEmptyComponent={<Text style={hm.empty}>No results</Text>}
                      renderItem={({ item }) => {
                        const k = item.uid || item.name;
                        const on = selected.has(k);
                        const atMax = selected.size >= MAX_PSALM_READERS && !on;
                        return (
                          <TouchableOpacity
                            style={[hm.pRow, on && hm.pRowOn, atMax && { opacity:0.4 }]}
                            onPress={() => { if (!atMax) toggle(item); }}
                            activeOpacity={0.65}
                          >
                            <Avatar uid={item.uid} size={38} />
                            <View style={{ flex:1, marginLeft:12 }}>
                              <Text style={hm.pRowName}>{item.name}</Text>
                              {item.isDeacon && <Text style={hm.pRowTag}>DEACON</Text>}
                            </View>
                            <View style={[pm.checkbox, on && pm.checkboxOn]}>
                              {on && <Icon name="check" size={13} color={T1} />}
                            </View>
                          </TouchableOpacity>
                        );
                      }}
                    />
                }
                {manualOpen ? (
                  <View style={hm.manualBox}>
                    <TextInput style={hm.manualIn} placeholder="Full name..." placeholderTextColor={T3}
                      value={manual} onChangeText={setManual} autoFocus returnKeyType="done"
                      onSubmitEditing={addManual} />
                    <View style={hm.manualBtns}>
                      <TouchableOpacity style={hm.mCancel} onPress={() => { setManualOpen(false); setManual(""); }}>
                        <Text style={hm.mCancelTxt}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={hm.mAdd} onPress={addManual}>
                        <Text style={hm.mAddTxt}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : selected.size < MAX_PSALM_READERS && (
                  <TouchableOpacity style={hm.addManual} onPress={() => setManualOpen(true)} activeOpacity={0.7}>
                    <Icon name="account-plus-outline" size={16} color={BLUE} />
                    <Text style={hm.addManualTxt}>Add name manually</Text>
                  </TouchableOpacity>
                )}
                <View style={hm.pickerFooter}>
                  <TouchableOpacity
                    style={[hm.saveBtn, selected.size===0 && hm.saveBtnClear]}
                    onPress={commit} activeOpacity={0.8}
                  >
                    <Text style={[hm.saveBtnTxt, selected.size===0 && { color:RED }]}>
                      {selected.size===0 ? "Clear Psalm Readers" : `Confirm ${selected.size} Reader${selected.size>1?"s":""}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const pm = StyleSheet.create({
  counter:    { paddingHorizontal:10, paddingVertical:4, borderRadius:10, backgroundColor:CARD2 },
  counterTxt: { fontSize:13, fontWeight:"700", color:T2 },
  chipScroll: { maxHeight:48, marginHorizontal:20, marginBottom:4 },
  chipRow:    { flexDirection:"row", gap:6, alignItems:"center" },
  chip:       { flexDirection:"row", alignItems:"center", gap:6, backgroundColor:"rgba(48,209,88,0.1)", borderWidth:1, borderColor:"rgba(48,209,88,0.25)", borderRadius:20, paddingVertical:5, paddingHorizontal:10 },
  chipName:   { fontSize:13, fontWeight:"600", color:GREEN, maxWidth:100 },
  checkbox:   { width:22, height:22, borderRadius:6, borderWidth:2, borderColor:T3, justifyContent:"center", alignItems:"center" },
  checkboxOn: { backgroundColor:BLUE, borderColor:BLUE },
});

// ─── HourModal ────────────────────────────────────────────────────────────────
const HourModal = ({ visible, hour, hourAssignments, deacons, congregation, loadingUsers, onSaveReading, onOpenPsalmPicker, onClose }) => {
  const { height: screenH } = useWindowDimensions();
  const [pickerSlot, setPickerSlot] = useState(null);
  const [pickerRow_, setPickerRow_] = useState(null);
  const [sel, setSel]               = useState(null);
  const [tab, setTab]               = useState("deacons");
  const [q, setQ]                   = useState("");
  const [manual, setManual]         = useState("");
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    if (!visible) { setPickerSlot(null); setPickerRow_(null); setSel(null); }
  }, [visible]);

  if (!hour) return null;

  const rows          = expandReadings(hour);
  const { total, filled } = countSlots(hour, hourAssignments);
  const complete      = total > 0 && filled === total;
  const pct           = total > 0 ? Math.round(filled / total * 100) : 0;
  const sheetMax      = screenH * 0.92;
  const psalmReaders  = hourAssignments.psalm_readers || [];
  const gospelRows    = rows.filter(r => (r.rKey==="gospel"||r.rKey==="gospels") && r.location);
  const hasGospelGrid = gospelRows.length > 0;

  const openPicker = row => {
    setSel(hourAssignments[row.slotKey] || null);
    setTab("deacons"); setQ(""); setManual(""); setManualOpen(false);
    setPickerSlot(row.slotKey); setPickerRow_(row);
  };
  const closePicker  = () => { setPickerSlot(null); setPickerRow_(null); };
  const commitPicker = () => { onSaveReading(hour.id, pickerSlot, sel ?? null); closePicker(); };

  const pickerMeta      = pickerRow_ ? (READING_META[pickerRow_.rKey] || { label:pickerRow_.rKey, icon:"book-outline", color:T2 }) : null;
  const pickerColor     = pickerMeta?.color || T2;
  const pickerLabel     = pickerRow_ ? (pickerRow_.index!=null ? `${pickerMeta?.label} ${pickerRow_.index+1}` : pickerMeta?.label) : "";
  const pickerScrollMax = sheetMax - (sel ? 330 : 270);

  const pickerSource = useMemo(() => {
    const list = tab==="deacons" ? deacons : congregation;
    return q ? list.filter(u => u.name.toLowerCase().includes(q.toLowerCase())) : list;
  }, [tab, deacons, congregation, q]);

  return (
    <Modal visible={visible} animationType="none" transparent
      onRequestClose={pickerSlot ? closePicker : onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={pickerSlot ? closePicker : onClose}>
        <View style={hm.backdrop}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":"height"} style={{ width:"100%" }}>
              <View style={[hm.sheet, { maxHeight:sheetMax }]}>
                <View style={hm.handle} />

                {!pickerSlot && (
                  <>
                    <View style={hm.hdr}>
                      <View style={{ flex:1 }}>
                        <Text style={hm.title}>{hour.label}</Text>
                        <Text style={[hm.sub, complete && { color:GREEN }]}>
                          {complete ? "All readings assigned" : `${filled} of ${total} assigned`}
                        </Text>
                      </View>
                      <TouchableOpacity style={hm.xBtn} onPress={onClose} activeOpacity={0.7}>
                        <Icon name="close" size={17} color={T2} />
                      </TouchableOpacity>
                    </View>
                    <View style={hm.trackWrap}>
                      <View style={[hm.trackFill, { width:`${pct}%` }, complete && { backgroundColor:GREEN }]} />
                    </View>
                    <ScrollView
                      style={{ flexGrow:1, maxHeight:sheetMax - 100 }}
                      contentContainerStyle={hm.body}
                      showsVerticalScrollIndicator
                      alwaysBounceVertical={false}
                      nestedScrollEnabled
                    >
                      {rows.map((row, i) => {
                        const meta        = READING_META[row.rKey] || { label:row.rKey, icon:"book-outline", color:T2 };
                        const assignable  = ASSIGNABLE.includes(row.rKey);
                        const isPsalm     = row.rKey === "psalm";
                        const isGospelLoc = (row.rKey==="gospel"||row.rKey==="gospels") && row.location;
                        const isFirstGospel = hasGospelGrid && row.rKey==="gospels" && row.index===0;
                        const assignee    = !isPsalm ? (hourAssignments[row.slotKey]||null) : null;
                        const label       = row.index!=null ? `${meta.label} ${row.index+1}` : meta.label;
                        if (isGospelLoc && !isFirstGospel) return null;
                        return (
                          <View key={row.slotKey}
                            style={[hm.readingBlock, i===rows.length-1 && { borderBottomWidth:0 }]}>
                            <View style={hm.readingTop}>
                              <View style={[hm.readingIcon, { backgroundColor:meta.color+"22" }]}>
                                <Icon name={meta.icon} size={15} color={meta.color} />
                              </View>
                              <View style={{ flex:1 }}>
                                <Text style={[hm.readingLabel, { color:meta.color }]}>
                                  {isFirstGospel ? "Gospels" : label}
                                </Text>
                                {isFirstGospel
                                  ? <Text style={hm.readingRef}>12 stations</Text>
                                  : !!row.refText && <Text style={hm.readingRef}>{row.refText}</Text>
                                }
                              </View>
                            </View>
                            {isFirstGospel && (
                              <GospelGrid rows={gospelRows} hourAssignments={hourAssignments} onOpenPicker={openPicker} />
                            )}
                            {!isFirstGospel && isPsalm && assignable && (
                              <PsalmReadersRow readers={psalmReaders} onOpen={onOpenPsalmPicker} />
                            )}
                            {!isFirstGospel && !isPsalm && assignable && (
                              <TouchableOpacity onPress={() => openPicker(row)} activeOpacity={0.7}
                                style={[hm.assignBtn, assignee && hm.assignBtnFilled]}>
                                {assignee ? (
                                  <>
                                    <Avatar uid={assignee.uid} size={28} />
                                    <Text style={hm.assignedName} numberOfLines={1}>{assignee.name}</Text>
                                    <Icon name="pencil-outline" size={14} color={T2} />
                                  </>
                                ) : (
                                  <>
                                    <Icon name="account-plus-outline" size={16} color={T2} />
                                    <Text style={hm.unassignedTxt}>Assign reader</Text>
                                    <Icon name="chevron-right" size={14} color={T3} />
                                  </>
                                )}
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })}
                    </ScrollView>
                  </>
                )}

                {!!pickerSlot && pickerRow_ && (
                  <>
                    <View style={hm.pickerHdr}>
                      <TouchableOpacity style={hm.backBtn} onPress={closePicker} activeOpacity={0.7}>
                        <Icon name="arrow-left" size={19} color={T1} />
                      </TouchableOpacity>
                      <View style={[hm.pickerIconBox, { backgroundColor:pickerColor+"22" }]}>
                        <Icon name={pickerMeta.icon} size={17} color={pickerColor} />
                      </View>
                      <View style={{ flex:1 }}>
                        <Text style={[hm.pickerType, { color:pickerColor }]}>{pickerLabel}</Text>
                        {!!pickerRow_.refText && <Text style={hm.pickerRef} numberOfLines={1}>{pickerRow_.refText}</Text>}
                        {!!pickerRow_.location && <Text style={hm.pickerRef} numberOfLines={1}>{pickerRow_.location}</Text>}
                      </View>
                    </View>
                    {sel && (
                      <View style={hm.selBanner}>
                        <Avatar uid={sel.uid} size={44} />
                        <View style={{ flex:1, marginLeft:12 }}>
                          <Text style={hm.selName}>{sel.name}</Text>
                          <Text style={hm.selSub}>{sel.isDeacon ? "Deacon" : sel.isManual ? "Manual entry" : "Member"}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setSel(null)} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                          <Icon name="close-circle" size={20} color={RED} />
                        </TouchableOpacity>
                      </View>
                    )}
                    <View style={hm.seg}>
                      <View style={[hm.segSlider, tab==="all" && { left:"50%" }]} />
                      {[["deacons","Deacons"],["all","All Members"]].map(([k,l]) => (
                        <TouchableOpacity key={k} onPress={() => { setTab(k); setQ(""); }}
                          style={hm.segBtn} activeOpacity={0.8}>
                          <Text style={[hm.segTxt, tab===k && hm.segTxtOn]}>{l}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={hm.searchRow}>
                      <Icon name="magnify" size={16} color={T3} />
                      <TextInput style={hm.searchIn} placeholder="Search..." placeholderTextColor={T3}
                        value={q} onChangeText={setQ} returnKeyType="search" />
                      {q.length > 0 && (
                        <TouchableOpacity onPress={() => setQ("")} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                          <Icon name="close-circle" size={15} color={T3} />
                        </TouchableOpacity>
                      )}
                    </View>
                    {loadingUsers
                      ? <View style={hm.center}><ActivityIndicator color={BLUE} /></View>
                      : <FlatList
                          data={pickerSource}
                          keyExtractor={i => i.uid||i.name}
                          style={{ maxHeight:pickerScrollMax, paddingHorizontal:20 }}
                          keyboardShouldPersistTaps="handled"
                          showsVerticalScrollIndicator
                          ListEmptyComponent={<Text style={hm.empty}>No results</Text>}
                          renderItem={({ item }) => {
                            const on = sel?.uid ? sel.uid===item.uid : sel?.name===item.name;
                            return (
                              <TouchableOpacity style={[hm.pRow, on && hm.pRowOn]}
                                onPress={() => setSel(on ? null : item)} activeOpacity={0.65}>
                                <Avatar uid={item.uid} size={38} />
                                <View style={{ flex:1, marginLeft:12 }}>
                                  <Text style={hm.pRowName}>{item.name}</Text>
                                  {item.isDeacon && <Text style={hm.pRowTag}>DEACON</Text>}
                                </View>
                                <View style={[hm.radio, on && hm.radioOn]}>
                                  {on && <View style={hm.radioDot} />}
                                </View>
                              </TouchableOpacity>
                            );
                          }}
                        />
                    }
                    {manualOpen ? (
                      <View style={hm.manualBox}>
                        <TextInput style={hm.manualIn} placeholder="Full name..." placeholderTextColor={T3}
                          value={manual} onChangeText={setManual} autoFocus returnKeyType="done"
                          onSubmitEditing={() => {
                            const n = manual.trim();
                            if (n) { setSel({ uid:`m_${Date.now()}`, name:n, isManual:true }); setManual(""); setManualOpen(false); }
                          }} />
                        <View style={hm.manualBtns}>
                          <TouchableOpacity style={hm.mCancel} onPress={() => { setManualOpen(false); setManual(""); }}>
                            <Text style={hm.mCancelTxt}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={hm.mAdd} onPress={() => {
                            const n = manual.trim();
                            if (n) { setSel({ uid:`m_${Date.now()}`, name:n, isManual:true }); setManual(""); setManualOpen(false); }
                          }}>
                            <Text style={hm.mAddTxt}>Add</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity style={hm.addManual} onPress={() => setManualOpen(true)} activeOpacity={0.7}>
                        <Icon name="account-plus-outline" size={16} color={BLUE} />
                        <Text style={hm.addManualTxt}>Add name manually</Text>
                      </TouchableOpacity>
                    )}
                    <View style={hm.pickerFooter}>
                      <TouchableOpacity style={[hm.saveBtn, !sel && hm.saveBtnClear]}
                        onPress={commitPicker} activeOpacity={0.8}>
                        <Text style={[hm.saveBtnTxt, !sel && { color:RED }]}>
                          {sel ? `Assign  ${sel.name}` : "Clear Assignment"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const hm = StyleSheet.create({
  backdrop:       { flex:1, backgroundColor:"rgba(0,0,0,0.65)", justifyContent:"flex-end" },
  sheet:          { backgroundColor:CARD, borderTopLeftRadius:26, borderTopRightRadius:26, paddingBottom:Platform.OS==="ios"?34:20, flexShrink:1 },
  handle:         { width:38, height:4, borderRadius:2, backgroundColor:SEP, alignSelf:"center", marginTop:12 },
  hdr:            { flexDirection:"row", alignItems:"flex-start", gap:12, paddingHorizontal:20, paddingTop:16, paddingBottom:12 },
  title:          { fontSize:20, fontWeight:"800", color:T1, letterSpacing:-0.3 },
  sub:            { fontSize:13, color:T2, marginTop:2 },
  xBtn:           { width:32, height:32, borderRadius:16, backgroundColor:CARD2, justifyContent:"center", alignItems:"center" },
  trackWrap:      { height:2, backgroundColor:SEP, marginHorizontal:20, borderRadius:2, marginBottom:6 },
  trackFill:      { height:2, backgroundColor:BLUE, borderRadius:2 },
  body:           { paddingHorizontal:20, paddingBottom:12 },
  readingBlock:   { paddingVertical:14, borderBottomWidth:1, borderBottomColor:SEP },
  readingTop:     { flexDirection:"row", gap:12, marginBottom:10, alignItems:"flex-start" },
  readingIcon:    { width:32, height:32, borderRadius:9, justifyContent:"center", alignItems:"center", flexShrink:0 },
  readingLabel:   { fontSize:10, fontWeight:"800", letterSpacing:0.8, textTransform:"uppercase", marginBottom:4 },
  readingRef:     { fontSize:14, color:T1, lineHeight:20 },
  assignBtn:      { flexDirection:"row", alignItems:"center", gap:10, backgroundColor:CARD2, borderRadius:12, paddingHorizontal:12, paddingVertical:10 },
  assignBtnFilled:{ backgroundColor:"rgba(48,209,88,0.08)", borderWidth:1, borderColor:"rgba(48,209,88,0.2)" },
  assignedName:   { flex:1, fontSize:14, color:GREEN, fontWeight:"600" },
  unassignedTxt:  { flex:1, fontSize:14, color:T2 },
  pickerHdr:      { flexDirection:"row", alignItems:"center", gap:12, paddingHorizontal:20, paddingTop:16, paddingBottom:14, borderBottomWidth:1, borderBottomColor:SEP },
  backBtn:        { width:36, height:36, borderRadius:18, backgroundColor:CARD2, justifyContent:"center", alignItems:"center" },
  pickerIconBox:  { width:36, height:36, borderRadius:10, justifyContent:"center", alignItems:"center" },
  pickerType:     { fontSize:17, fontWeight:"700" },
  pickerRef:      { fontSize:12, color:T2, marginTop:2 },
  selBanner:      { flexDirection:"row", alignItems:"center", marginHorizontal:20, marginTop:14, marginBottom:2, borderRadius:16, padding:14, backgroundColor:BLUEDIM, borderWidth:1, borderColor:"rgba(10,132,255,0.25)" },
  selName:        { fontSize:15, fontWeight:"700", color:T1 },
  selSub:         { fontSize:12, color:T2, marginTop:2 },
  seg:            { flexDirection:"row", marginHorizontal:20, marginTop:14, backgroundColor:CARD2, borderRadius:12, padding:3, position:"relative" },
  segSlider:      { position:"absolute", top:3, bottom:3, left:3, width:"50%", backgroundColor:CARD3, borderRadius:10 },
  segBtn:         { flex:1, paddingVertical:9, alignItems:"center", zIndex:1 },
  segTxt:         { fontSize:13, fontWeight:"600", color:T3 },
  segTxtOn:       { color:T1 },
  searchRow:      { flexDirection:"row", alignItems:"center", backgroundColor:CARD2, borderRadius:11, paddingHorizontal:12, marginHorizontal:20, marginTop:10, marginBottom:6 },
  searchIn:       { flex:1, color:T1, fontSize:14, paddingVertical:11, marginLeft:8 },
  center:         { height:100, justifyContent:"center", alignItems:"center" },
  empty:          { textAlign:"center", color:T3, fontSize:14, paddingVertical:24 },
  pRow:           { flexDirection:"row", alignItems:"center", padding:10, borderRadius:13, marginBottom:6, backgroundColor:CARD2 },
  pRowOn:         { backgroundColor:BLUEDIM, borderWidth:1, borderColor:"rgba(10,132,255,0.25)" },
  pRowName:       { fontSize:14, color:T1, fontWeight:"500" },
  pRowTag:        { fontSize:9, color:BLUE, fontWeight:"800", marginTop:2, letterSpacing:0.6 },
  radio:          { width:22, height:22, borderRadius:11, borderWidth:2, borderColor:T3, justifyContent:"center", alignItems:"center" },
  radioOn:        { borderColor:BLUE },
  radioDot:       { width:10, height:10, borderRadius:5, backgroundColor:BLUE },
  addManual:      { flexDirection:"row", alignItems:"center", gap:8, marginHorizontal:20, marginTop:4, marginBottom:8, padding:13, borderRadius:12, backgroundColor:BLUEDIM },
  addManualTxt:   { fontSize:14, fontWeight:"500", color:BLUE },
  manualBox:      { marginHorizontal:20, marginTop:6, marginBottom:8 },
  manualIn:       { backgroundColor:CARD2, borderRadius:11, paddingHorizontal:14, paddingVertical:12, color:T1, fontSize:14, marginBottom:8 },
  manualBtns:     { flexDirection:"row", gap:8 },
  mCancel:        { flex:1, paddingVertical:12, borderRadius:11, backgroundColor:CARD2, alignItems:"center" },
  mCancelTxt:     { fontSize:14, fontWeight:"600", color:T2 },
  mAdd:           { flex:1, paddingVertical:12, borderRadius:11, backgroundColor:BLUE, alignItems:"center" },
  mAddTxt:        { fontSize:14, fontWeight:"700", color:T1 },
  pickerFooter:   { paddingHorizontal:20, paddingTop:10, borderTopWidth:1, borderTopColor:SEP },
  saveBtn:        { backgroundColor:BLUE, paddingVertical:15, borderRadius:14, alignItems:"center" },
  saveBtnClear:   { backgroundColor:"rgba(255,69,58,0.1)", borderWidth:1, borderColor:"rgba(255,69,58,0.2)" },
  saveBtnTxt:     { fontSize:15, fontWeight:"700", color:T1 },
});

// ─── Day tab bar ──────────────────────────────────────────────────────────────
const DayTabBar = ({ days, selectedId, easterDate, schedule, onSelect }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false}
    contentContainerStyle={dt.content} style={dt.bar}>
    {days.map(day => {
      const ds = schedule[day.id] || {};
      const { total, filled } = dayProgress(day, ds);
      const complete = total > 0 && filled === total;
      const started  = filled > 0 && !complete;
      const active   = day.id === selectedId;
      const dateStr  = easterDate
        ? new Date(new Date(easterDate).setDate(new Date(easterDate).getDate()+day.easterOffset))
            .toLocaleDateString("en-US",{ month:"short", day:"numeric" })
        : null;
      return (
        <TouchableOpacity key={day.id} onPress={() => onSelect(day.id)}
          style={[dt.tab, active && dt.tabActive]} activeOpacity={0.75}>
          <View style={[dt.dot, complete ? dt.dotGreen : started ? dt.dotBlue : dt.dotGray]} />
          <Text style={[dt.label, active && dt.labelActive]} numberOfLines={1}>{day.shortLabel}</Text>
          {dateStr && <Text style={[dt.date, active && dt.dateActive]}>{dateStr}</Text>}
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

const dt = StyleSheet.create({
  bar:        { backgroundColor:BG },
  content:    { paddingHorizontal:12, paddingVertical:8, gap:5, flexDirection:"row" },
  tab:        { paddingHorizontal:9, paddingVertical:6, borderRadius:9, backgroundColor:CARD, alignItems:"center", minWidth:62, height:52 },
  tabActive:  { backgroundColor:BLUEDIM, borderWidth:1, borderColor:"rgba(10,132,255,0.35)" },
  dot:        { width:5, height:5, borderRadius:2.5, marginBottom:3 },
  dotGray:    { backgroundColor:T3 },
  dotBlue:    { backgroundColor:BLUE },
  dotGreen:   { backgroundColor:GREEN },
  label:      { fontSize:11, fontWeight:"600", color:T2, textAlign:"center" },
  labelActive:{ color:BLUE },
  date:       { fontSize:9, color:T3, marginTop:2 },
  dateActive: { color:"rgba(10,132,255,0.7)" },
});

// ─── Hour tile ────────────────────────────────────────────────────────────────
const HourTile = React.memo(({ hour, hourAssignments, dayId, deacons, congregation, loadingUsers, onSaveReading, onSavePsalmReaders }) => {
  const [hourOpen, setHourOpen]               = useState(false);
  const [psalmPickerOpen, setPsalmPickerOpen] = useState(false);

  const rows           = expandReadings(hour);
  const assignableRows = rows.filter(r => ASSIGNABLE.includes(r.rKey));
  const { total, filled } = countSlots(hour, hourAssignments);
  const complete     = total > 0 && filled === total;
  const started      = filled > 0 && !complete;
  const pct          = total > 0 ? filled / total : 0;
  const statusColor  = complete ? GREEN : started ? BLUE : T3;
  const psalmReaders = hourAssignments.psalm_readers || [];
  const psalmRefText = rows.find(r => r.rKey === "psalm")?.refText || "";

  return (
    <>
      <TouchableOpacity onPress={() => setHourOpen(true)} activeOpacity={0.72} style={ht.tile}>
        <View style={ht.titleRow}>
          <Text style={ht.name}>{hour.label}</Text>
          {complete
            ? <View style={ht.pill}>
                <Icon name="check" size={11} color={GREEN} />
                <Text style={[ht.pillTxt, { color:GREEN }]}>Done</Text>
              </View>
            : started
              ? <View style={[ht.pill, { backgroundColor:"rgba(10,132,255,0.12)", borderColor:"rgba(10,132,255,0.3)" }]}>
                  <Text style={[ht.pillTxt, { color:BLUE }]}>In progress</Text>
                </View>
              : null
          }
        </View>
        <View style={ht.track}>
          <View style={[ht.trackFill, { flex:pct, backgroundColor:statusColor }]} />
          <View style={{ flex:1-pct }} />
        </View>
        <View style={ht.readingList}>
          {assignableRows.map((row, i) => {
            const meta      = READING_META[row.rKey] || { label:row.rKey, icon:"book-outline", color:T2 };
            const isPsalm   = row.rKey === "psalm";
            const assignee  = !isPsalm ? hourAssignments[row.slotKey] : null;
            const typeLabel = row.index!=null ? `${meta.label} ${row.index+1}` : meta.label;
            const isLast    = i === assignableRows.length - 1;
            return (
              <View key={row.slotKey} style={[ht.rRow, !isLast && ht.rRowBorder]}>
                <View style={ht.rLeft}>
                  <Icon name={meta.icon} size={13} color={meta.color} />
                  <Text style={[ht.rType, { color:meta.color }]}>{typeLabel}</Text>
                </View>
                {isPsalm ? (
                  psalmReaders.length > 0
                    ? <View style={ht.assigneeRow}>
                        {psalmReaders.slice(0,3).map((r,idx) => (
                          <Avatar key={r.uid||r.name||idx} uid={r.uid} size={20}
                            style={{ marginLeft:idx>0?-6:0, borderWidth:1.5, borderColor:CARD }} />
                        ))}
                        <Text style={ht.assigneeName} numberOfLines={1}>
                          {psalmReaders.length===1 ? psalmReaders[0].name : `${psalmReaders.length} readers`}
                        </Text>
                      </View>
                    : <Text style={ht.rRef} numberOfLines={1}>{row.refText||"—"}</Text>
                ) : assignee ? (
                  <View style={ht.assigneeRow}>
                    <Avatar uid={assignee.uid} size={20} />
                    <Text style={ht.assigneeName} numberOfLines={1}>{assignee.name}</Text>
                  </View>
                ) : (
                  <Text style={ht.rRef} numberOfLines={1}>{row.refText||"—"}</Text>
                )}
              </View>
            );
          })}
        </View>
      </TouchableOpacity>

      <HourModal
        visible={hourOpen}
        hour={hour}
        hourAssignments={hourAssignments}
        dayId={dayId}
        deacons={deacons}
        congregation={congregation}
        loadingUsers={loadingUsers}
        onSaveReading={onSaveReading}
        onOpenPsalmPicker={() => { setHourOpen(false); setPsalmPickerOpen(true); }}
        onClose={() => setHourOpen(false)}
      />
      <PsalmPickerModal
        visible={psalmPickerOpen}
        refText={psalmRefText}
        currentReaders={psalmReaders}
        deacons={deacons}
        congregation={congregation}
        loadingUsers={loadingUsers}
        onSave={readers => onSavePsalmReaders(hour.id, readers)}
        onClose={() => { setPsalmPickerOpen(false); setHourOpen(true); }}
      />
    </>
  );
});

const ht = StyleSheet.create({
  tile:        { backgroundColor:CARD, borderRadius:16, marginBottom:10, padding:16, borderWidth:1, borderColor:SEP },
  titleRow:    { flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:10 },
  name:        { fontSize:16, fontWeight:"700", color:T1, flex:1, marginRight:8 },
  pill:        { flexDirection:"row", alignItems:"center", gap:4, paddingHorizontal:9, paddingVertical:3, borderRadius:20, backgroundColor:"rgba(48,209,88,0.1)", borderWidth:1, borderColor:"rgba(48,209,88,0.28)" },
  pillTxt:     { fontSize:11, fontWeight:"700" },
  track:       { flexDirection:"row", height:2, borderRadius:2, backgroundColor:CARD2, marginBottom:12, overflow:"hidden" },
  trackFill:   { borderRadius:2 },
  readingList: {},
  rRow:        { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingVertical:7 },
  rRowBorder:  { borderBottomWidth:1, borderBottomColor:SEP },
  rLeft:       { flexDirection:"row", alignItems:"center", gap:6, flex:1, marginRight:8 },
  rType:       { fontSize:12, fontWeight:"700" },
  rRef:        { fontSize:12, color:T3, flex:1, textAlign:"right" },
  assigneeRow: { flexDirection:"row", alignItems:"center", gap:4 },
  assigneeName:{ fontSize:12, fontWeight:"600", color:GREEN, maxWidth:130 },
});

// ─── Settings sheet ───────────────────────────────────────────────────────────
const SettingsSheet = ({ visible, paschaVisible, easterDate, year, onToggle, onDateSave, onArchivePress, onViewArchives, onClose }) => {
  const [pickerDate, setPickerDate] = useState(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (visible) { setPickerOpen(false); setPickerDate(easterDate ? new Date(easterDate) : new Date()); }
  }, [visible, easterDate]);

  const handleChange = (event, selected) => {
    if (Platform.OS === "android") {
      setPickerOpen(false);
      if (event.type !== "dismissed" && selected) onDateSave(selected);
    } else if (selected) setPickerDate(selected);
  };

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={ss.backdrop}>
        <View style={ss.sheet}>
          <View style={ss.handle} />
          <View style={ss.hdr}>
            <Text style={ss.hdrTitle}>Settings</Text>
            <TouchableOpacity style={ss.xBtn} onPress={onClose} activeOpacity={0.7}>
              <Icon name="close" size={17} color={T2} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:20, gap:12 }}>
            <View style={ss.card}>
              <View style={ss.row}>
                <View style={[ss.iconBox, { backgroundColor:"rgba(48,209,88,0.12)" }]}>
                  <Icon name={paschaVisible ? "eye" : "eye-off-outline"} size={19} color={GREEN} />
                </View>
                <View style={{ flex:1 }}>
                  <Text style={ss.label}>Congregation Visibility</Text>
                  <Text style={ss.desc}>{paschaVisible ? "Visible to all members" : "Hidden (draft)"}</Text>
                </View>
                <Switch value={paschaVisible} onValueChange={onToggle}
                  trackColor={{ false:T3, true:GREEN }} thumbColor={T1} />
              </View>
            </View>
            <View style={ss.card}>
              <View style={ss.row}>
                <View style={[ss.iconBox, { backgroundColor:BLUEDIM }]}>
                  <Icon name="calendar-star" size={19} color={BLUE} />
                </View>
                <View style={{ flex:1 }}>
                  <Text style={ss.label}>Easter Sunday</Text>
                  <Text style={ss.desc}>{easterDate ? calcDate(easterDate, 0) : "Not set — tap Edit"}</Text>
                </View>
                <Pressable style={ss.editBtn} onPress={() => {
                  if (pickerOpen && Platform.OS==="ios") { onDateSave(pickerDate); setPickerOpen(false); }
                  else setPickerOpen(v => !v);
                }}>
                  <Text style={ss.editTxt}>{pickerOpen ? "Done" : "Edit"}</Text>
                </Pressable>
              </View>
              {pickerOpen && (
                <DateTimePicker value={pickerDate} mode="date"
                  display={Platform.OS==="ios" ? "spinner" : "default"}
                  onChange={handleChange}
                  minimumDate={new Date(2020,0,1)} maximumDate={new Date(2050,11,31)}
                  style={{ width:"100%", height:Platform.OS==="ios"?150:180, marginTop:8 }}
                  {...(Platform.OS==="ios" ? { textColor:"#E0E0E0", accentColor:BLUE } : {})}
                />
              )}
              {easterDate && !pickerOpen && (
                <>
                  <View style={ss.divider} />
                  {[["Last Friday of Lent",-9],["Palm Sunday",-7],["Holy Monday",-6],["Good Friday",-2],["Easter Sunday",0]].map(([l,o]) => (
                    <View key={l} style={ss.dateRow}>
                      <Text style={ss.dateLabel}>{l}</Text>
                      <Text style={[ss.dateVal, o===0 && { color:BLUE, fontWeight:"700" }]}>{calcDate(easterDate, o)}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
            <TouchableOpacity style={ss.archivesBtn} onPress={onViewArchives} activeOpacity={0.8}>
              <Icon name="archive-eye-outline" size={18} color={BLUE} />
              <Text style={ss.archivesBtnTxt}>View Archived Schedules</Text>
              <Icon name="chevron-right" size={15} color={T3} style={{ marginLeft:"auto" }} />
            </TouchableOpacity>
            <TouchableOpacity style={ss.archiveBtn} onPress={onArchivePress} activeOpacity={0.8}>
              <Icon name="archive-outline" size={18} color={RED} />
              <Text style={ss.archiveTxt}>Archive {year} Schedule</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const ss = StyleSheet.create({
  backdrop:      { flex:1, backgroundColor:"rgba(0,0,0,0.72)", justifyContent:"flex-end" },
  sheet:         { backgroundColor:CARD, borderTopLeftRadius:26, borderTopRightRadius:26, maxHeight:"90%", paddingBottom:Platform.OS==="ios"?34:20 },
  handle:        { width:38, height:4, borderRadius:2, backgroundColor:SEP, alignSelf:"center", marginTop:12 },
  hdr:           { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:20, paddingVertical:16, borderBottomWidth:1, borderBottomColor:SEP },
  hdrTitle:      { fontSize:20, fontWeight:"700", color:T1 },
  xBtn:          { width:32, height:32, borderRadius:16, backgroundColor:CARD2, justifyContent:"center", alignItems:"center" },
  card:          { backgroundColor:CARD2, borderRadius:14, padding:16 },
  row:           { flexDirection:"row", alignItems:"center", gap:12 },
  iconBox:       { width:40, height:40, borderRadius:11, justifyContent:"center", alignItems:"center" },
  label:         { fontSize:15, fontWeight:"600", color:T1 },
  desc:          { fontSize:13, color:T2, marginTop:2 },
  editBtn:       { paddingHorizontal:14, paddingVertical:7, borderRadius:9, backgroundColor:CARD },
  editTxt:       { fontSize:13, fontWeight:"600", color:BLUE },
  divider:       { height:1, backgroundColor:SEP, marginVertical:12 },
  dateRow:       { flexDirection:"row", justifyContent:"space-between", marginBottom:8 },
  dateLabel:     { fontSize:13, color:T2 },
  dateVal:       { fontSize:13, color:T1, fontWeight:"500" },
  archivesBtn:   { flexDirection:"row", alignItems:"center", gap:10, padding:15, borderRadius:14, borderWidth:1, borderColor:"rgba(10,132,255,0.22)", backgroundColor:"rgba(10,132,255,0.07)" },
  archivesBtnTxt:{ fontSize:15, fontWeight:"600", color:BLUE },
  archiveBtn:    { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:8, padding:15, borderRadius:14, borderWidth:1, borderColor:"rgba(255,69,58,0.22)", backgroundColor:"rgba(255,69,58,0.06)" },
  archiveTxt:    { fontSize:15, fontWeight:"600", color:RED },
});

// ─── Archive confirm ──────────────────────────────────────────────────────────
const ArchiveConfirm = ({ visible, year, onConfirm, onClose }) => {
  const [archiving, setArchiving] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [done, setDone]           = useState(false);

  useEffect(() => {
    if (!visible) { setArchiving(false); setProgress(0); setDone(false); }
  }, [visible]);

  const handleConfirm = async () => {
    setArchiving(true);
    setProgress(0);
    const steps = [15, 35, 55, 72, 88];
    let i = 0;
    const tick = setInterval(() => {
      if (i < steps.length) { setProgress(steps[i]); i++; }
      else clearInterval(tick);
    }, 350);
    await onConfirm();
    clearInterval(tick);
    setProgress(100);
    setDone(true);
  };

  return (
    <Modal visible={visible} animationType="none" transparent
      onRequestClose={!archiving ? onClose : undefined} statusBarTranslucent>
      <View style={arc.overlay}>
        <View style={arc.sheet}>
          <View style={arc.handle} />
          <View style={arc.iconWrap}>
            <Icon name={done ? "check-circle-outline" : "archive-clock-outline"} size={32}
              color={done ? GREEN : ORANGE} />
          </View>
          <Text style={arc.title}>{done ? "Archived!" : `Archive ${year}?`}</Text>
          <Text style={arc.body}>
            {done
              ? `The ${year} schedule has been saved and cleared.`
              : "Reader assignments will be saved and this year's schedule cleared for next year."}
          </Text>
          <View style={arc.divider} />
          {archiving ? (
            <View style={arc.progressSection}>
              <View style={arc.progressHeader}>
                <Icon name="archive-arrow-down-outline" size={14} color={done ? GREEN : ORANGE} />
                <Text style={arc.progressLabel}>{done ? "Complete" : "Saving archive…"}</Text>
                <Text style={[arc.progressPct, done && { color:GREEN }]}>{progress}%</Text>
              </View>
              <View style={arc.progressTrack}>
                <View style={[arc.progressFill, { width:`${progress}%`, backgroundColor:done ? GREEN : ORANGE }]} />
              </View>
            </View>
          ) : (
            <View style={arc.actions}>
              <TouchableOpacity style={arc.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={arc.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={arc.confirmBtn} onPress={handleConfirm} activeOpacity={0.8}>
                <Icon name="archive-arrow-down-outline" size={16} color={T1} />
                <Text style={arc.confirmTxt}>Archive & Clear</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const arc = StyleSheet.create({
  overlay:         { flex:1, backgroundColor:"rgba(0,0,0,0.82)", justifyContent:"flex-end" },
  sheet:           { backgroundColor:CARD, borderTopLeftRadius:26, borderTopRightRadius:26, paddingHorizontal:24, paddingBottom:Platform.OS==="ios"?44:28, paddingTop:12, alignItems:"center" },
  handle:          { width:38, height:4, borderRadius:2, backgroundColor:SEP, alignSelf:"center", marginBottom:20 },
  iconWrap:        { width:60, height:60, borderRadius:30, backgroundColor:"rgba(255,159,10,0.1)", justifyContent:"center", alignItems:"center", marginBottom:14 },
  title:           { fontSize:20, fontWeight:"800", color:T1, marginBottom:8, letterSpacing:-0.3 },
  body:            { fontSize:14, color:T2, textAlign:"center", lineHeight:21, marginBottom:20 },
  divider:         { width:"100%", height:1, backgroundColor:SEP, marginBottom:20 },
  actions:         { flexDirection:"row", gap:10, width:"100%" },
  cancelBtn:       { flex:1, paddingVertical:14, borderRadius:14, backgroundColor:CARD2, alignItems:"center" },
  cancelTxt:       { fontSize:15, fontWeight:"600", color:T2 },
  confirmBtn:      { flex:2, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:8, paddingVertical:14, borderRadius:14, backgroundColor:RED },
  confirmTxt:      { fontSize:15, fontWeight:"700", color:T1 },
  progressSection: { width:"100%" },
  progressHeader:  { flexDirection:"row", alignItems:"center", gap:6, marginBottom:10 },
  progressLabel:   { flex:1, fontSize:13, color:T2, fontWeight:"500" },
  progressPct:     { fontSize:13, fontWeight:"700", color:T1 },
  progressTrack:   { height:5, backgroundColor:CARD2, borderRadius:3, overflow:"hidden" },
  progressFill:    { height:5, borderRadius:3 },
});

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PaschaManager() {
  const isMounted = useRef(true);
  const [churchId, setChurchId]               = useState(null);
  const [myReadingsVisible, setMyReadingsVisible]   = useState(false);
  const [fullScheduleVisible, setFullScheduleVisible] = useState(false);
  const [easterDate, setEasterDate]           = useState(null);
  const [schedule, setSchedule]               = useState({});
  const [deacons, setDeacons]                 = useState([]);
  const [congregation, setCongregation]       = useState([]);
  const [loadingUsers, setLoadingUsers]       = useState(false);
  const [settingsOpen, setSettingsOpen]       = useState(false);
  const [archiveOpen, setArchiveOpen]         = useState(false);
  const [archiveViewOpen, setArchiveViewOpen] = useState(false);
  const [selectedId, setSelectedId]           = useState(ALL_DAYS[0].id);

  const year        = easterDate ? new Date(easterDate).getFullYear() : new Date().getFullYear();
  const selectedDay = DAYS_BY_ID[selectedId];

  useEffect(() => {
    isMounted.current = true;
    const user = auth().currentUser;
    if (!user) return;
    const unsub = firestore().collection("users").doc(user.uid).onSnapshot(doc => {
      if (isMounted.current && doc.exists) setChurchId(doc.data().church || null);
    });
    return () => { isMounted.current = false; unsub(); };
  }, []);

  useEffect(() => {
    if (!churchId) return;
    const unsub = firestore().collection("churches").doc(churchId)
      .collection("pascha").doc("config").onSnapshot(doc => {
        if (!isMounted.current || !doc.exists) return;
        const d = doc.data();
        setPaschaVisible(d.paschaVisible ?? false);
        setMyReadingsVisible(d.myReadingsVisible ?? false);
        setFullScheduleVisible(d.fullScheduleVisible ?? false);
        setEasterDate(d.easterDate ?? null);
        setSchedule(d.schedule ?? {});
      });
    return () => unsub();
  }, [churchId]);

  useEffect(() => {
    if (!churchId) return;
    setLoadingUsers(true);
    const unsubC = firestore().collection("churches").doc(churchId).onSnapshot(doc => {
      if (!isMounted.current || !doc.exists) return;
      setDeacons((doc.data().deacons||[]).filter(d => d.name && d.uid)
        .map(d => ({ ...d, isDeacon:true })).sort((a,b) => a.name.localeCompare(b.name)));
    });
    const unsubU = firestore().collection("users").where("church","==",churchId).onSnapshot(snap => {
      if (!isMounted.current) return;
      setCongregation(snap.docs.map(d => ({ uid:d.id, ...d.data() }))
        .filter(u => u.name).sort((a,b) => a.name.localeCompare(b.name)));
      setLoadingUsers(false);
    });
    return () => { unsubC(); unsubU(); };
  }, [churchId]);

  const writeConfig = useCallback(async fields => {
    if (!churchId) return;
    await firestore().collection("churches").doc(churchId)
      .collection("pascha").doc("config")
      .update(fields)
      .catch(async err => {
        if (err.code === "firestore/not-found") {
          await firestore().collection("churches").doc(churchId)
            .collection("pascha").doc("config").set(fields);
        } else Alert.alert("Error", "Failed to save.");
      });
  }, [churchId]);

  const saveReading = useCallback(async (dayId, hourId, slotKey, person) => {
    const path  = `schedule.${dayId}.${hourId}.${slotKey}`;
    const value = person
      ? { uid:person.uid||null, name:person.name }
      : firestore.FieldValue.delete();
    await writeConfig({ [path]: value });
  }, [writeConfig]);

  const savePsalmReaders = useCallback(async (dayId, hourId, readers) => {
    const path  = `schedule.${dayId}.${hourId}.psalm_readers`;
    const value = readers.length > 0
      ? readers.map(r => ({ uid:r.uid||null, name:r.name }))
      : firestore.FieldValue.delete();
    await writeConfig({ [path]: value });
  }, [writeConfig]);

  const doArchive = useCallback(async () => {
    try {
      await firestore().collection("churches").doc(churchId)
        .collection("pascha").doc(`archive_${year}`)
        .set({ schedule, archivedAt:firestore.FieldValue.serverTimestamp() });
      await writeConfig({ schedule:{} });
      await new Promise(r => setTimeout(r, 600));
      setArchiveOpen(false);
      setSettingsOpen(false);
    } catch {
      Alert.alert("Error", "Archive failed.");
    }
  }, [churchId, year, schedule, writeConfig]);

  const { total:dayTotal, filled:dayFilled } = selectedDay
    ? dayProgress(selectedDay, schedule[selectedId]||{})
    : { total:0, filled:0 };
  const dayPct = dayTotal > 0 ? Math.round(dayFilled/dayTotal*100) : 0;
  const ds = schedule[selectedId] || {};

  return (
    <View style={mn.container}>
      <StatusBar barStyle="light-content" />
      <View style={mn.header}>
        <View style={{ flex:1 }}>
          <Text style={mn.eyebrow}>HOLY WEEK  ·  PASCHA</Text>
          <Text style={mn.title}>Schedule</Text>
        </View>
        <TouchableOpacity style={mn.cogBtn} onPress={() => setSettingsOpen(true)} activeOpacity={0.7}>
          <Icon name="cog-outline" size={20} color={T2} />
        </TouchableOpacity>
      </View>

      {!easterDate && (
        <TouchableOpacity style={mn.nudge} onPress={() => setSettingsOpen(true)} activeOpacity={0.8}>
          <Icon name="alert-circle-outline" size={14} color={ORANGE} />
          <Text style={mn.nudgeTxt}>Set Easter date in Settings</Text>
          <Icon name="chevron-right" size={13} color={ORANGE} />
        </TouchableOpacity>
      )}

      <View style={{ height:68 }}>
        <DayTabBar days={ALL_DAYS} selectedId={selectedId} easterDate={easterDate}
          schedule={schedule} onSelect={setSelectedId} />
      </View>

      {selectedDay && (
        <View style={mn.dayHdr}>
          <Text style={mn.dayTitle}>{selectedDay.label}</Text>
          {easterDate && <Text style={mn.dayDate}>{calcDate(easterDate, selectedDay.easterOffset)}</Text>}
          {dayTotal > 0 && (
            <View style={[mn.dayTrack, { marginTop:10 }]}>
              <View style={[mn.dayTrackFill, { width:`${dayPct}%` }, dayPct===100 && { backgroundColor:GREEN }]} />
            </View>
          )}
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={mn.scroll}>
        {(selectedDay?.hours||[]).map(hour => (
          <HourTile
            key={hour.id}
            hour={hour}
            hourAssignments={ds[hour.id]||{}}
            dayId={selectedId}
            deacons={deacons}
            congregation={congregation}
            loadingUsers={loadingUsers}
            onSaveReading={(hourId, slotKey, person) => saveReading(selectedId, hourId, slotKey, person)}
            onSavePsalmReaders={(hourId, readers) => savePsalmReaders(selectedId, hourId, readers)}
          />
        ))}
      </ScrollView>

      <SettingsSheet visible={settingsOpen} paschaVisible={paschaVisible} easterDate={easterDate}
        year={year}
        onToggle={v => { setPaschaVisible(v); writeConfig({ paschaVisible:v }); }}
        onDateSave={date => { const iso=date.toISOString(); setEasterDate(iso); writeConfig({ easterDate:iso }); }}
        onViewArchives={() => { setSettingsOpen(false); setArchiveViewOpen(true); }}
        onArchivePress={() => { setSettingsOpen(false); setArchiveOpen(true); }}
        onClose={() => setSettingsOpen(false)} />

      <ArchiveConfirm visible={archiveOpen} year={year} onConfirm={doArchive}
        onClose={() => setArchiveOpen(false)} />

      <PaschaArchiveViewer visible={archiveViewOpen} churchId={churchId}
        onClose={() => setArchiveViewOpen(false)} />
    </View>
  );
}

const mn = StyleSheet.create({
  container:   { flex:1, backgroundColor:"#121212" },
  header:      { flexDirection:"row", alignItems:"center", paddingHorizontal:20, paddingTop:18, paddingBottom:10 },
  eyebrow:     { fontSize:11, fontWeight:"700", color:BLUE, letterSpacing:1.5, marginBottom:4 },
  title:       { fontSize:28, fontWeight:"800", color:T1, letterSpacing:-0.5 },
  cogBtn:      { width:40, height:40, borderRadius:20, backgroundColor:CARD, justifyContent:"center", alignItems:"center" },
  nudge:       { flexDirection:"row", alignItems:"center", gap:8, marginHorizontal:16, marginBottom:6, padding:12, borderRadius:12, backgroundColor:"rgba(255,159,10,0.08)", borderWidth:1, borderColor:"rgba(255,159,10,0.18)" },
  nudgeTxt:    { flex:1, fontSize:13, color:ORANGE, fontWeight:"500" },
  dayHdr:      { paddingHorizontal:20, paddingTop:14, paddingBottom:10 },
  dayTitle:    { fontSize:22, fontWeight:"800", color:T1, letterSpacing:-0.3 },
  dayDate:     { fontSize:13, color:T2, marginTop:3 },
  dayTrack:    { height:2, backgroundColor:CARD2, borderRadius:2 },
  dayTrackFill:{ height:2, backgroundColor:BLUE, borderRadius:2 },
  scroll:      { paddingHorizontal:16, paddingBottom:48, paddingTop:4 },
});