import React, { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from "react";
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, ScrollView, Modal, TextInput, Switch,
  FlatList, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator, StatusBar, Pressable,
  useWindowDimensions,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { LIST_PERF } from "../../utils/listConfig";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import PaschaArchiveViewer from "../../components/PaschaArchiveViewer";
import Avatar from "../../components/Avatar";
import * as avatarCache from "../../utils/avatarCache";
import SkeletonScreen from "../../components/Skeleton";
import useAfterInteractions from "../../hooks/useAfterInteractions";
import useResponsiveLayout from "../../hooks/useResponsiveLayout";
import {
  expandReadings, countSlots, dayProgress, isAssignableSlot, isPsalmSlot,
  hasLanguagePicker, languageOptionsFor, effectiveLanguage, langDisplay, langShort,
  langFirestoreKey, psalmReadersKey, prophecyCopticToggleKey,
  ASSIGNABLE, READING_META, MAX_PSALM_READERS, readingDisplay,
} from "../Pascha/PaschaReadingUtils";
import { DAY_SHORT_LABELS } from "../Pascha/DayConstants";

// ── Tokens ────────────────────────────────────────────────────────────────────
var BG      = "#0f0f0f";
var CARD    = "#1c1c1e";
var CARD2   = "#2c2c2e";
var CARD3   = "#3a3a3c";
var SEP     = "rgba(255,255,255,0.08)";
var BLUE    = "#0a84ff";
var BLUEDIM = "rgba(10,132,255,0.15)";
var GREEN   = "#30d158";
var RED     = "#ff453a";
var ORANGE  = "#ff9f0a";
var T1      = "#ffffff";
var T2      = "rgba(255,255,255,0.65)";
var T3      = "rgba(255,255,255,0.30)";
var COPTIC_COLOR  = "#f59e0b";
var COPTIC_BG     = "rgba(245,158,11,0.10)";
var COPTIC_BORDER = "rgba(245,158,11,0.28)";
var COPTIC_TRACK  = "rgba(245,158,11,0.45)";

// ── Font size multiplier ──────────────────────────────────────────────────────
var DEFAULT_FONT_MULTIPLIERS = { small: 0.85, medium: 1.0, large: 1.18 };

function resolvedFontScale(fontSizeScale, fontSizeMultipliers) {
  var map = fontSizeMultipliers != null ? fontSizeMultipliers : DEFAULT_FONT_MULTIPLIERS;
  var result = map[fontSizeScale];
  return result != null ? result : 1.0;
}

function sf(base, multiplier) {
  return Math.round(base * multiplier * 10) / 10;
}

// A scaled font size together with a line box that scales with it. Scaling the
// size alone left each style's fixed lineHeight behind, so on Large the text
// outgrew its line: descenders clipped and two-line labels overlapped.
function tx(base, multiplier) {
  var size = sf(base, multiplier);
  return { fontSize: size, lineHeight: Math.ceil(size * 1.3) };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildAllDays(shell) {
  if (!shell || !shell.days) return [];
  return shell.days.map(function(d) {
    return {
      id:           d.id,
      label:        d.label,
      easterOffset: d.easterOffset,
      shortLabel:   d.shortLabel != null
        ? d.shortLabel
        : (DAY_SHORT_LABELS[d.id] != null
          ? DAY_SHORT_LABELS[d.id]
          : d.label.split(" ").slice(0, 2).join(" ")),
      hours: d.hours != null ? d.hours : [],
    };
  });
}

var TILE_GAP = 12;

function chunk(list, size) {
  var out = [];
  for (var i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function calcDate(easter, offset) {
  if (!easter) return null;
  var d = new Date(easter);
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// Bottom sheet on phones. In a wide window (iPad, either orientation) a sheet
// stretched edge to edge put the close button a foot from the content and
// ran every row 1,000pt wide, so there it is a centered card instead.
var SHEET_CENTER = { justifyContent: "center", alignItems: "center" };
function useSheetPresentation(maxCardWidth) {
  var win = useWindowDimensions();
  var wide = win.width >= 700;
  return {
    wide:          wide,
    height:        win.height,
    animationType: wide ? "fade" : "slide",
    center:        wide ? SHEET_CENTER : null,
    card:          wide
      ? { width: Math.min(maxCardWidth, win.width - 48), borderRadius: 24, paddingBottom: 16 }
      : null,
  };
}

// Background the old local Avatar painted behind the image. Module-level so the
// reference is stable and Avatar's React.memo still holds.
var AVATAR_BG = { backgroundColor: CARD2 };

// ── Psalm reader row ──────────────────────────────────────────────────────────
var PsalmReadersRow = function(props) {
  var readers = props.readers != null ? props.readers : [];
  var onOpen = props.onOpen;
  var label = props.label;
  var fs = props.fontScale != null ? props.fontScale : 1;
  var has = readers.length > 0;
  return (
    <TouchableOpacity style={[hm.assignBtn, has && hm.assignBtnFilled]} onPress={onOpen} activeOpacity={0.7}>
      {has ? (
        <>
          <View style={{ flexDirection: "row" }}>
            {readers.slice(0, 4).map(function(r, i) {
              return (
                <Avatar key={r.uid || r.name || i} uid={r.uid} size={26}
                  style={{ marginLeft: i > 0 ? -8 : 0, borderWidth: 1.5, borderColor: CARD, backgroundColor: CARD2 }} />
              );
            })}
          </View>
          <Text style={[hm.assignedName, tx(14, fs)]} numberOfLines={1}>
            {readers.length === 1 ? readers[0].name : (readers.length + " readers assigned")}
          </Text>
          <Icon name="pencil-outline" size={14} color={T2} />
        </>
      ) : (
        <>
          <Icon name="account-multiple-plus-outline" size={16} color={T2} />
          <Text style={[hm.unassignedTxt, tx(14, fs)]}>{label || ("Assign readers (up to " + MAX_PSALM_READERS + ")")}</Text>
          <Icon name="chevron-right" size={14} color={T3} />
        </>
      )}
    </TouchableOpacity>
  );
};

// ── Language pill ─────────────────────────────────────────────────────────────
var LanguagePill = function(props) {
  var row = props.row;
  var hourAssignments = props.hourAssignments;
  var onSave = props.onSave;
  var _a = useState(false), open = _a[0], setOpen = _a[1];
  if (!hasLanguagePicker(row.rKey)) return null;
  var current = effectiveLanguage(row, hourAssignments);
  var options = languageOptionsFor(row.rKey);
  return (
    <View style={{ position: "relative" }}>
      <TouchableOpacity style={lp.pill} onPress={function() { setOpen(function(v) { return !v; }); }} activeOpacity={0.7}>
        <Text style={lp.pillTxt}>{langShort(current)}</Text>
        <Icon name="chevron-down" size={11} color={T2} />
      </TouchableOpacity>
      {open && (
        <View style={lp.dropdown}>
          {options.map(function(opt) {
            var active = opt.value === current;
            return (
              <TouchableOpacity key={opt.value}
                style={[lp.dropItem, active && lp.dropItemActive]}
                onPress={function() { onSave(row.slotKey, opt.value); setOpen(false); }}
                activeOpacity={0.7}>
                <Text style={[lp.dropTxt, active && lp.dropTxtActive]}>{opt.label}</Text>
                {active && <Icon name="check" size={13} color={BLUE} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};
var lp = StyleSheet.create({
  pill:           { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 8,
                    paddingVertical: 4, borderRadius: 8, backgroundColor: CARD2, borderWidth: 1, borderColor: SEP },
  pillTxt:        { fontSize: 10, fontWeight: "700", color: T2, letterSpacing: 0.5 },
  dropdown:       { position: "absolute", top: 30, right: 0, zIndex: 100, backgroundColor: CARD,
                    borderRadius: 12, borderWidth: 1, borderColor: SEP, paddingVertical: 4, minWidth: 120,
                    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.4, shadowRadius: 12 }, android: { elevation: 8 } }) },
  dropItem:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    paddingHorizontal: 14, paddingVertical: 10 },
  dropItemActive: { backgroundColor: BLUEDIM },
  dropTxt:        { fontSize: 14, color: T2, fontWeight: "500" },
  dropTxtActive:  { color: BLUE, fontWeight: "600" },
});

// ── Prophecy Coptic Toggle ────────────────────────────────────────────────────
var ProphecyCopticToggle = function(props) {
  var vernacularSlotKey = props.vernacularSlotKey;
  var hourAssignments = props.hourAssignments;
  var onSave = props.onSave;
  var fs = props.fontScale != null ? props.fontScale : 1;
  var toggleKey = prophecyCopticToggleKey(vernacularSlotKey);
  var enabled = hourAssignments[toggleKey] === true;
  var handleChange = function(val) {
    if (val) { onSave(toggleKey, true); return; }
    // Turning Coptic off also clears whoever reads it, so ask before
    // throwing away a real assignment.
    var copticReader = hourAssignments[vernacularSlotKey + "_coptic"];
    if (!copticReader) { onSave(toggleKey, deleteField()); return; }
    Alert.alert(
      "Remove Coptic reading?",
      copticReader.name + " will be unassigned from the Coptic reading.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: function() { onSave(toggleKey, deleteField()); } },
      ]
    );
  };
  return (
    <View style={pct.row}>
      <View style={pct.labelRow}>
        <View style={pct.alphaBox}>
          <Text style={[pct.alpha, { fontSize: sf(10, fs), lineHeight: sf(10, fs) }]}>{"ⲁ"}</Text>
        </View>
        <Text style={[pct.label, tx(11, fs)]}>Read in Coptic</Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={handleChange}
        trackColor={{ true: COPTIC_COLOR }}
        style={pct.toggle}
      />
    </View>
  );
};
var pct = StyleSheet.create({
  row:      { flexDirection: "row", justifyContent: "space-between", alignItems: "center",
              paddingVertical: 3, paddingHorizontal: 8, marginTop: 8, marginBottom: 6,
              borderRadius: 9, backgroundColor: "rgba(255,255,255,0.05)",
              borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.06)" },
  labelRow: { flexDirection: "row", alignItems: "center", flex: 1, marginRight: 8, gap: 6 },
  alphaBox: { width: 22, height: 22, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.03)",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
              justifyContent: "center", alignItems: "center", flexShrink: 0 },
  alpha:    { fontWeight: "600", color: T3, textAlign: "center", textAlignVertical: "center", includeFontPadding: false },
  label:    { color: T2, fontWeight: "400", flex: 1 },
  toggle:   { transform: [{ scaleX: 0.88 }, { scaleY: 0.88 }], marginRight: 8 },
});

// ── Gospel grid ───────────────────────────────────────────────────────────────
var GospelGrid = function(props) {
  var rows = props.rows;
  var hourAssignments = props.hourAssignments;
  var onOpenPicker = props.onOpenPicker;
  var fs = props.fontScale != null ? props.fontScale : 1;
  var meta = READING_META.gospels;
  return (
    <View style={gg.grid}>
      {rows.map(function(row) {
        var assignee = hourAssignments[row.slotKey];
        return (
          <TouchableOpacity key={row.slotKey} style={gg.cell}
            onPress={function() { onOpenPicker(row); }} activeOpacity={0.7}>
            <View style={gg.cellTop}>
              <View style={[gg.numBadge, { backgroundColor: meta.color + "22" }]}>
                <Text style={[gg.numTxt, { color: meta.color }]}>{row.index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[gg.ref, tx(12, fs)]} numberOfLines={1}>{row.refText}</Text>
                {!!row.location && <Text style={[gg.loc, tx(10, fs)]} numberOfLines={2}>{row.location}</Text>}
              </View>
            </View>
            {assignee ? (
              <View style={gg.assigneeRow}>
                <Avatar uid={assignee.uid} size={18} showBorder={false} style={AVATAR_BG} />
                <Text style={[gg.assigneeName, tx(11, fs)]} numberOfLines={1}>{assignee.name}</Text>
              </View>
            ) : (
              <View style={gg.unassignedRow}>
                <Icon name="account-plus-outline" size={12} color={T3} />
                <Text style={[gg.unassignedTxt, tx(11, fs)]}>Assign</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};
var gg = StyleSheet.create({
  grid:          { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  cell:          { width: "48%", backgroundColor: CARD2, borderRadius: 12, padding: 10, gap: 6 },
  cellTop:       { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  numBadge:      { width: 24, height: 24, borderRadius: 7, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  numTxt:        { fontSize: 11, fontWeight: "800" },
  ref:           { fontSize: 12, color: T1, fontWeight: "600", lineHeight: 16 },
  loc:           { fontSize: 10, color: T3, marginTop: 2, lineHeight: 14 },
  assigneeRow:   { flexDirection: "row", alignItems: "center", gap: 6 },
  assigneeName:  { fontSize: 11, fontWeight: "600", color: GREEN, flex: 1 },
  unassignedRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  unassignedTxt: { fontSize: 11, color: T3 },
});

// ── HourModal ─────────────────────────────────────────────────────────────────
var HourModal = function(props) {
  props = props || {};
  var visible = !!props.visible;
  var hour = props.hour;
  var hourAssignments = props.hourAssignments;
  var deacons = props.deacons;
  var congregation = props.congregation;
  var loadingUsers = props.loadingUsers;
  var onSaveReading = props.onSaveReading;
  var onSavePsalmReaders = props.onSavePsalmReaders;
  var onSaveLanguage = props.onSaveLanguage;
  var onSaveCopticToggle = props.onSaveCopticToggle;
  var onClose = props.onClose;
  var fs = props.fontScale != null ? props.fontScale : 1;
  // Set when a reading was tapped on an hour card: the sheet opens straight
  // into that reading's picker, and leaving the picker closes the sheet
  // instead of falling back to the hour's full list.
  var directRow = props.directRow || null;

  var sheet = useSheetPresentation(640);
  var screenH = sheet.height;

  // single-reader picker state
  var _pickerSlot = useState(null); var pickerSlot = _pickerSlot[0]; var setPickerSlot = _pickerSlot[1];
  var _pickerRow_ = useState(null); var pickerRow_ = _pickerRow_[0]; var setPickerRow_ = _pickerRow_[1];
  var _sel = useState(null); var sel = _sel[0]; var setSel = _sel[1];

  // multi-reader (psalm) picker state
  var _psalmRow = useState(null); var psalmRow = _psalmRow[0]; var setPsalmRow = _psalmRow[1];
  var _psalmSelected = useState(new Set()); var psalmSelected = _psalmSelected[0]; var setPsalmSelected = _psalmSelected[1];
  var _psalmSelectedMap = useState({}); var psalmSelectedMap = _psalmSelectedMap[0]; var setPsalmSelectedMap = _psalmSelectedMap[1];

  // shared picker state
  var _tab = useState("deacons"); var tab = _tab[0]; var setTab = _tab[1];
  var _q = useState(""); var q = _q[0]; var setQ = _q[1];
  var _manual = useState(""); var manual = _manual[0]; var setManual = _manual[1];
  var _manualOpen = useState(false); var manualOpen = _manualOpen[0]; var setManualOpen = _manualOpen[1];

  // See PickerAvatar. Rows below `photoBudget` show their photo. It grows by
  // one only after the last photo has been drawn, plus a short breather, so
  // at most one resize is ever queued on the main thread. A fixed timer used
  // to queue them faster than the simulator could draw them, and the close
  // button's tap waited behind the whole backlog.
  var _photosReady = useState(false); var photosReady = _photosReady[0]; var setPhotosReady = _photosReady[1];
  var _photoBudget = useState(0); var photoBudget = _photoBudget[0]; var setPhotoBudget = _photoBudget[1];
  var shownRef         = useRef(false);
  var photoTimerRef    = useRef(null);

  var bodyScrollRef    = useRef(null);
  var bodyScrollYRef   = useRef(0);
  var restoreScrollRef = useRef(false);

  var inPicker      = !!pickerSlot;
  var inPsalmPicker = !!psalmRow;
  var inAnyPicker   = inPicker || inPsalmPicker;

  var pickerSource = useMemo(function() {
    var list = tab === "deacons" ? deacons : congregation;
    if (!q) return list;
    // `q.toLowerCase()` was inside the predicate, so it ran once per candidate.
    var needle = q.toLowerCase();
    return list.filter(function(u) { return u.name.toLowerCase().includes(needle); });
  }, [tab, deacons, congregation, q]);


  useEffect(function() {
    if (!visible) {
      shownRef.current = false; setPhotosReady(false);
      setPickerSlot(null); setPickerRow_(null); setSel(null);
      setPsalmRow(null); setPsalmSelected(new Set()); setPsalmSelectedMap({});
      setTab("deacons"); setQ(""); setManual(""); setManualOpen(false);
    }
  }, [visible]);

  // Layout effect so the picker is in place before the sheet first paints;
  // a plain effect would flash the hour list for a frame.
  useLayoutEffect(function() {
    if (!visible || directRow == null) return;
    setTab("deacons"); setQ(""); setManual(""); setManualOpen(false);
    if (isPsalmSlot(directRow.rKey)) {
      var map = {};
      var keys = new Set();
      (hourAssignments[psalmReadersKey(directRow)] || []).forEach(function(r) {
        var k = r.uid || r.name;
        keys.add(k);
        map[k] = r;
      });
      setPsalmSelected(keys);
      setPsalmSelectedMap(map);
      setPsalmRow(directRow);
    } else {
      setSel(hourAssignments[directRow.slotKey] || null);
      setPickerSlot(directRow.slotKey); setPickerRow_(directRow);
    }
    // Only on open: re-running when assignments update would discard the
    // selection being edited.
  }, [visible, directRow]);

  // Opening a picker inside a sheet that is already up: draw the list with
  // stubs first, then load the photos once that frame is on screen.
  useEffect(function() {
    if (!inAnyPicker) return;
    setPhotosReady(false);
    if (!shownRef.current) return;   // first open: onShow lets them in
    var t = setTimeout(function() { setPhotosReady(true); }, 250);
    return function() { clearTimeout(t); };
  }, [pickerSlot, psalmRow]);

  // A new list (another reading, or the other tab) starts from stubs again.
  useEffect(function() {
    clearTimeout(photoTimerRef.current);
    setPhotoBudget(0);
  }, [pickerSlot, psalmRow, tab, visible]);

  useEffect(function() {
    if (photosReady) setPhotoBudget(function(b) { return Math.max(b, 1); });
  }, [photosReady]);

  var handlePhotoShown = useCallback(function(index) {
    clearTimeout(photoTimerRef.current);
    photoTimerRef.current = setTimeout(function() {
      setPhotoBudget(function(b) { return Math.max(b, index + 2); });
    }, 120);
  }, []);

  // Fallback for a row that never draws (scrolled out of the render window,
  // or a load that fails), so the rest of the list isn't stuck on stubs.
  useEffect(function() {
    if (!photosReady || !inAnyPicker || photoBudget < 1) return;
    if (photoBudget >= pickerSource.length) return;
    var at = photoBudget;
    var t = setTimeout(function() {
      setPhotoBudget(function(b) { return b === at ? b + 1 : b; });
    }, 800);
    return function() { clearTimeout(t); };
  }, [photosReady, inAnyPicker, photoBudget, pickerSource.length]);

  useEffect(function() {
    return function() { clearTimeout(photoTimerRef.current); };
  }, []);

  useEffect(function() {
    if (inAnyPicker) return;
    if (!restoreScrollRef.current) return;
    restoreScrollRef.current = false;
    requestAnimationFrame(function() {
      if (bodyScrollRef.current && bodyScrollYRef.current > 0) {
        bodyScrollRef.current.scrollTo({ y: bodyScrollYRef.current, animated: false });
      }
    });
  }, [inAnyPicker]);

  var togglePsalm = function(item) {
    var k = item.uid || item.name;
    setPsalmSelected(function(prev) {
      var next = new Set(prev);
      if (next.has(k)) {
        next.delete(k);
        setPsalmSelectedMap(function(m) { var n = Object.assign({}, m); delete n[k]; return n; });
      } else {
        if (next.size >= MAX_PSALM_READERS) return prev;
        next.add(k);
        setPsalmSelectedMap(function(m) { return Object.assign({}, m, { [k]: item }); });
      }
      return next;
    });
  };

  // These three must stay ABOVE the `!visible` guard below. They used to sit
  // further down, which meant this component rendered 17 hooks while closed and
  // 20 once an hour was opened - React throws "Rendered more hooks than during
  // the previous render." the moment that count changes, and <HourModal> is
  // mounted unconditionally with visible={!!hourOpen}, so opening any hour hit
  // it. togglePsalm only closes over stable setters, so it moves up with them.
  var handlePickerToggle = useCallback(function(item, on) {
    setSel(on ? null : item);
  }, []);

  var renderPickerRow = useCallback(function(ri) {
    var item = ri.item;
    var on = sel != null
      ? (sel.uid ? sel.uid === item.uid : sel.name === item.name)
      : false;
    return <PickerRow item={item} on={on} onToggle={handlePickerToggle} showPhoto={ri.index < photoBudget}
      index={ri.index} onPhotoShown={handlePhotoShown} />;
  }, [sel, handlePickerToggle, photoBudget, handlePhotoShown]);

  var renderPsalmRow = useCallback(function(ri) {
    var item = ri.item;
    var k = item.uid || item.name;
    var on = psalmSelected.has(k);
    return (
      <PsalmPickerRow
        item={item}
        on={on}
        atMax={psalmSelected.size >= MAX_PSALM_READERS && !on}
        onToggle={togglePsalm}
        showPhoto={ri.index < photoBudget}
        index={ri.index}
        onPhotoShown={handlePhotoShown}
      />
    );
  }, [psalmSelected, togglePsalm, photoBudget, handlePhotoShown]);

  if (!visible || !hour) return null;

  var rows              = expandReadings(hour, hourAssignments);
  if (!hour.readings) {
    console.warn("HourModal: hour.readings is not defined for hour", hour.id, "hour object keys:", Object.keys(hour));
  }
  var counts            = countSlots(hour, hourAssignments);
  var total             = counts.total;
  var filled            = counts.filled;
  var complete          = total > 0 && filled === total;
  var pctVal            = total > 0 ? Math.round(filled / total * 100) : 0;
  var sheetMax          = screenH * (sheet.wide ? 0.86 : 0.92);

  var gospelGridRows = rows
    .filter(function(r) {
      return (r.rKey === "gospel" || r.rKey === "gospels") && r.location;
    })
    .sort(function(a, b) {
      var ai = a.index != null && !isNaN(a.index) ? a.index : 9999;
      var bi = b.index != null && !isNaN(b.index) ? b.index : 9999;
      return ai - bi;
    });
  var hasGospelGrid = gospelGridRows.length > 0;
  var firstGospelGridSlotKey = hasGospelGrid ? gospelGridRows[0].slotKey : null;

  var rowLabel = function(row) {
    var meta = READING_META[row.rKey] || { label: row.rKey };
    if (row.rKey === "homily")     return "Homily \u2014 " + (row.author || row.refText);
    if (row.rKey === "exposition") return "Exposition";
    return row.index != null ? (meta.label + " " + (row.index + 1)) : meta.label;
  };

  // single-reader picker ───
  var openPicker = function(row) {
    setSel(hourAssignments[row.slotKey] || null);
    setTab("deacons"); setQ(""); setManual(""); setManualOpen(false);
    setPickerSlot(row.slotKey); setPickerRow_(row);
  };
  var closePicker  = function() {
    if (directRow != null) { onClose(); return; }
    restoreScrollRef.current = true; setPickerSlot(null); setPickerRow_(null);
  };
  var commitPicker = function() { onSaveReading(hour.id, pickerSlot, sel != null ? sel : null); closePicker(); };

  // psalm (multi) picker ───
  var openPsalmPicker = function(row) {
    var currentReaders = hourAssignments[psalmReadersKey(row)] || [];
    var map = {};
    var keys = new Set();
    currentReaders.forEach(function(r) {
      var k = r.uid || r.name;
      keys.add(k);
      map[k] = r;
    });
    setPsalmSelected(keys);
    setPsalmSelectedMap(map);
    setTab("deacons"); setQ(""); setManual(""); setManualOpen(false);
    setPsalmRow(row);
  };
  var closePsalmPicker = function() {
    if (directRow != null) { onClose(); return; }
    restoreScrollRef.current = true; setPsalmRow(null);
  };
  var addPsalmManual = function() {
    var name = manual.trim();
    if (!name || psalmSelected.size >= MAX_PSALM_READERS) return;
    var item = { uid: "m_" + Date.now(), name: name, isManual: true };
    var k = item.uid;
    setPsalmSelected(function(prev) { return new Set(Array.from(prev).concat([k])); });
    setPsalmSelectedMap(function(m) { return Object.assign({}, m, { [k]: item }); });
    setManual("");
    setManualOpen(false);
  };
  var commitPsalm = function() {
    var readers = Object.values(psalmSelectedMap).map(function(r) {
      return { uid: r.uid || null, name: r.name };
    });
    onSavePsalmReaders(hour.id, psalmReadersKey(psalmRow), readers);
    closePsalmPicker();
  };

  var pickerMeta  = pickerRow_ != null
    ? (READING_META[pickerRow_.rKey] || { label: pickerRow_.rKey, icon: "book-outline", color: T2 })
    : null;
  var pickerColor    = pickerMeta != null ? pickerMeta.color : T2;
  var isCopticPicker = pickerRow_ != null && pickerRow_.isCoptic === true;

  var pickerLabel = "";
  if (pickerRow_ != null) {
    if (pickerRow_.rKey === "homily") {
      pickerLabel = "Homily \u2014 " + (pickerRow_.author || pickerRow_.refText);
    } else if (pickerRow_.rKey === "exposition") {
      pickerLabel = "Exposition";
    } else if (pickerRow_.index != null) {
      pickerLabel = pickerMeta.label + " " + (pickerRow_.index + 1);
    } else {
      pickerLabel = pickerMeta != null ? pickerMeta.label : "";
    }
  }

  var psalmMeta  = psalmRow != null
    ? (READING_META[psalmRow.rKey] || { label: psalmRow.rKey, icon: "music-note", color: T2 })
    : null;
  var psalmLabel = "";
  if (psalmRow != null) {
    psalmLabel = psalmRow.index != null
      ? (psalmMeta.label + " " + (psalmRow.index + 1))
      : psalmMeta.label;
  }
  var psalmSelectedList = Object.values(psalmSelectedMap);

  // The Coptic switch takes a row above the list on prophecies that have one.
  var pickerHasCoptic      = pickerRow_ != null && pickerRow_.rKey === "prophecies" && pickerRow_.hasCopticOption;
  var pickerScrollMax      = sheetMax - (sel != null ? 330 : 270) - (pickerHasCoptic ? 56 : 0);
  var psalmPickerScrollMax = sheetMax - (psalmSelectedList.length > 0 ? 340 : 280);

  return (
    <Modal visible={visible} animationType={sheet.animationType} transparent onRequestClose={onClose} statusBarTranslucent
      onShow={function() { shownRef.current = true; setPhotosReady(true); }}>
      <View style={[hm.backdrop, sheet.center]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={inPicker ? closePicker : inPsalmPicker ? closePsalmPicker : onClose}
        />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[hm.kav, sheet.center]} pointerEvents="box-none">
          <View style={[hm.sheet, sheet.card, { maxHeight: sheetMax }]}>
            {!sheet.wide && <View style={hm.handle} />}

            {/* ── MAIN HOUR VIEW ─────────────────────────────────────────── */}
            {!inAnyPicker && directRow == null && (
              <>
                <View style={hm.hdr}>
                  <View style={{ flex: 1 }}>
                    <Text style={[hm.title, tx(20, fs)]}>{hour.label}</Text>
                    <Text style={[hm.sub, complete && { color: GREEN }, tx(13, fs)]}>
                      {complete ? "All readings assigned" : (filled + " of " + total + " assigned")}
                    </Text>
                  </View>
                  <TouchableOpacity style={hm.xBtn} onPress={onClose} activeOpacity={0.7}>
                    <Icon name="close" size={17} color={T2} />
                  </TouchableOpacity>
                </View>
                <View style={hm.trackWrap}>
                  <View style={[hm.trackFill, { width: pctVal + "%" }, complete && { backgroundColor: GREEN }]} />
                </View>
                <ScrollView
                  ref={bodyScrollRef}
                  style={{ maxHeight: Math.max(220, sheetMax - 165) }}
                  contentContainerStyle={hm.body}
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                  scrollEventThrottle={16}
                  onScroll={function(e) { bodyScrollYRef.current = e != null && e.nativeEvent ? e.nativeEvent.contentOffset.y : 0; }}
                  keyboardShouldPersistTaps="handled">
                  {rows.map(function(row, i) {
                    var meta        = READING_META[row.rKey] || { label: row.rKey, icon: "book-outline", color: T2 };
                    var assignable  = isAssignableSlot(row.rKey);
                    var isPsalm     = isPsalmSlot(row.rKey);
                    var isExp       = row.rKey === "exposition";
                    var isGospelLoc = (row.rKey === "gospel" || row.rKey === "gospels") && row.location;
                    var isFirstGospelGrid = firstGospelGridSlotKey != null && row.slotKey === firstGospelGridSlotKey;
                    var isCopticRow = row.isCoptic === true;
                    var assignee    = !isPsalm ? (hourAssignments[row.slotKey] || null) : null;
                    var label       = rowLabel(row);
                    var readers     = isPsalm ? (hourAssignments[psalmReadersKey(row)] || []) : [];

                    if (isGospelLoc && !isFirstGospelGrid) return null;

                    // The whole block opens its picker, not just the button. The
                    // Gospel grid has a picker per station, so it keeps its cells.
                    var openRow = isFirstGospelGrid ? null
                      : isPsalm ? function() { openPsalmPicker(row); }
                      : assignable ? function() { openPicker(row); }
                      : null;

                    return (
                      <Pressable key={row.slotKey} onPress={openRow} disabled={openRow == null}
                        style={function(state) {
                          return [hm.readingBlock, isCopticRow && hm.readingBlockCoptic,
                            i === rows.length - 1 && { borderBottomWidth: 0 },
                            state.pressed && hm.readingBlockPressed];
                        }}>
                        <View style={hm.readingTop}>
                          <View style={[hm.readingIcon, { backgroundColor: isCopticRow ? COPTIC_BG : meta.color + "22" }]}>
                            <Icon name={meta.icon} size={15} color={isCopticRow ? COPTIC_COLOR : meta.color} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text style={[hm.readingLabel, { color: isCopticRow ? COPTIC_COLOR : meta.color }, tx(10, fs)]}>
                                {isFirstGospelGrid ? "Gospels" : label}
                              </Text>
                              {isCopticRow && (
                                <View style={hm.copticBadge}>
                                  <Text style={hm.copticBadgeTxt}>COPTIC</Text>
                                </View>
                              )}
                            </View>
                            {isFirstGospelGrid
                              ? <Text style={[hm.readingRef, tx(14, fs)]}>12 stations</Text>
                              : (row.rKey === "homily" || isExp)
                                ? null
                                : !!row.refText && <Text style={[hm.readingRef, tx(14, fs)]}>{row.refText}</Text>
                            }
                          </View>
                          <LanguagePill row={row} hourAssignments={hourAssignments}
                            onSave={function(slotKey, lang) { onSaveLanguage(hour.id, slotKey, lang); }} />
                        </View>

                        {isFirstGospelGrid && (
                          <GospelGrid rows={gospelGridRows} hourAssignments={hourAssignments}
                            onOpenPicker={openPicker} fontScale={fs} />
                        )}
                        {!isFirstGospelGrid && isPsalm && (
                          <PsalmReadersRow readers={readers}
                            label={"Assign " + label.toLowerCase() + " readers"}
                            fontScale={fs}
                            onOpen={function() { openPsalmPicker(row); }} />
                        )}
                        {!isFirstGospelGrid && !isPsalm && assignable && (
                          <TouchableOpacity onPress={function() { openPicker(row); }} activeOpacity={0.7}
                            style={[hm.assignBtn, assignee && hm.assignBtnFilled]}>
                            {assignee ? (
                              <>
                                <Avatar uid={assignee.uid} size={28} showBorder={false} style={AVATAR_BG} />
                                <Text style={[hm.assignedName, tx(14, fs)]} numberOfLines={1}>{assignee.name}</Text>
                                <Icon name="pencil-outline" size={14} color={T2} />
                              </>
                            ) : (
                              <>
                                <Icon name="account-plus-outline" size={16} color={T2} />
                                <Text style={[hm.unassignedTxt, tx(14, fs)]}>Assign reader</Text>
                                <Icon name="chevron-right" size={14} color={T3} />
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                        {row.rKey === "prophecies" && row.hasCopticOption && (
                          <ProphecyCopticToggle
                            vernacularSlotKey={row.slotKey}
                            hourAssignments={hourAssignments}
                            fontScale={fs}
                            onSave={function(key, value) { onSaveCopticToggle(hour.id, key, value); }}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* ── SINGLE-READER PICKER VIEW ──────────────────────────────── */}
            {inPicker && pickerRow_ != null && (
              <>
                <View style={hm.pickerHdr}>
                  <TouchableOpacity style={hm.backBtn} onPress={closePicker} activeOpacity={0.7}>
                    <Icon name={directRow != null ? "close" : "arrow-left"} size={19} color={T1} />
                  </TouchableOpacity>
                  <View style={[hm.pickerIconBox, { backgroundColor: isCopticPicker ? COPTIC_BG : pickerColor + "22" }]}>
                    <Icon name={pickerMeta.icon} size={17} color={isCopticPicker ? COPTIC_COLOR : pickerColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[hm.pickerType, { color: isCopticPicker ? COPTIC_COLOR : pickerColor }]}>
                      {pickerLabel}{isCopticPicker ? "  \u2022  Coptic" : ""}
                    </Text>
                    {!!pickerRow_.refText && pickerRow_.rKey !== "homily" && pickerRow_.rKey !== "exposition" && (
                      <Text style={hm.pickerRef} numberOfLines={1}>{pickerRow_.refText}</Text>
                    )}
                    {!!pickerRow_.location && (
                      <Text style={hm.pickerRef} numberOfLines={1}>{pickerRow_.location}</Text>
                    )}
                  </View>
                </View>
                {pickerHasCoptic && (
                  <View style={hm.pickerCoptic}>
                    <ProphecyCopticToggle
                      vernacularSlotKey={pickerRow_.slotKey}
                      hourAssignments={hourAssignments}
                      fontScale={fs}
                      onSave={function(key, value) { onSaveCopticToggle(hour.id, key, value); }}
                    />
                  </View>
                )}
                {sel != null && (
                  <View style={hm.selBanner}>
                    <Avatar uid={sel.uid} user={sel} size={44} showBorder={false} style={AVATAR_BG} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={hm.selName}>{sel.name}</Text>
                      <Text style={hm.selSub}>
                        {sel.isDeacon ? "Deacon" : sel.isManual ? "Manual entry" : "Member"}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={function() { setSel(null); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon name="close-circle" size={20} color={RED} />
                    </TouchableOpacity>
                  </View>
                )}
                <View style={hm.seg}>
                  <View style={[hm.segSlider, tab === "all" && { left: "50%" }]} />
                  {[["deacons", "Deacons"], ["all", "All Members"]].map(function(pair) {
                    var k = pair[0]; var l = pair[1];
                    return (
                      <TouchableOpacity key={k} onPress={function() { setTab(k); setQ(""); }}
                        style={hm.segBtn} activeOpacity={0.8}>
                        <Text style={[hm.segTxt, tab === k && hm.segTxtOn]}>{l}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={hm.searchRow}>
                  <Icon name="magnify" size={16} color={T3} />
                  <TextInput style={hm.searchIn} placeholder="Search..." placeholderTextColor={T3}
                    value={q} onChangeText={setQ} returnKeyType="search" />
                  {q.length > 0 && (
                    <TouchableOpacity onPress={function() { setQ(""); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon name="close-circle" size={15} color={T3} />
                    </TouchableOpacity>
                  )}
                </View>
                {loadingUsers
                  ? <View style={hm.center}><ActivityIndicator color={BLUE} /></View>
                  : <FlatList
                      {...LIST_PERF}
                      data={pickerSource}
                      keyExtractor={pickerKeyExtractor}
                      style={[hm.pickerList, { maxHeight: pickerScrollMax }]}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator
                      ListEmptyComponent={PickerEmpty}
                      renderItem={renderPickerRow}
                    />
                }
                {manualOpen ? (
                  <View style={hm.manualBox}>
                    <TextInput style={hm.manualIn} placeholder="Full name..." placeholderTextColor={T3}
                      value={manual} onChangeText={setManual} autoFocus returnKeyType="done"
                      onSubmitEditing={function() {
                        var n = manual.trim();
                        if (n) {
                          setSel({ uid: "m_" + Date.now(), name: n, isManual: true });
                          setManual(""); setManualOpen(false);
                        }
                      }} />
                    <View style={hm.manualBtns}>
                      <TouchableOpacity style={hm.mCancel}
                        onPress={function() { setManualOpen(false); setManual(""); }}>
                        <Text style={hm.mCancelTxt}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={hm.mAdd} onPress={function() {
                        var n = manual.trim();
                        if (n) {
                          setSel({ uid: "m_" + Date.now(), name: n, isManual: true });
                          setManual(""); setManualOpen(false);
                        }
                      }}>
                        <Text style={hm.mAddTxt}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={hm.addManual}
                    onPress={function() { setManualOpen(true); }} activeOpacity={0.7}>
                    <Icon name="account-plus-outline" size={16} color={BLUE} />
                    <Text style={hm.addManualTxt}>Add name manually</Text>
                  </TouchableOpacity>
                )}
                <View style={hm.pickerFooter}>
                  <TouchableOpacity style={[hm.saveBtn, sel == null && hm.saveBtnClear]}
                    onPress={commitPicker} activeOpacity={0.8}>
                    <Text style={[hm.saveBtnTxt, sel == null && { color: RED }]}>
                      {sel != null ? ("Assign  " + sel.name) : "Clear Assignment"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ── PSALM (MULTI) PICKER VIEW ──────────────────────────────── */}
            {inPsalmPicker && psalmRow != null && (
              <>
                <View style={hm.pickerHdr}>
                  <TouchableOpacity style={hm.backBtn} onPress={closePsalmPicker} activeOpacity={0.7}>
                    <Icon name={directRow != null ? "close" : "arrow-left"} size={19} color={T1} />
                  </TouchableOpacity>
                  <View style={[hm.pickerIconBox, { backgroundColor: psalmMeta.color + "22" }]}>
                    <Icon name={psalmMeta.icon || "music-note"} size={17} color={psalmMeta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[hm.pickerType, { color: psalmMeta.color }]}>{psalmLabel}</Text>
                    {!!psalmRow.refText && (
                      <Text style={hm.pickerRef} numberOfLines={1}>{psalmRow.refText}</Text>
                    )}
                  </View>
                  <View style={pmS.counter}>
                    <Text style={pmS.counterTxt}>{psalmSelected.size + "/" + MAX_PSALM_READERS}</Text>
                  </View>
                </View>
                {psalmSelectedList.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    style={pmS.chipScroll} contentContainerStyle={pmS.chipRow}>
                    {psalmSelectedList.map(function(r) {
                      var k = r.uid || r.name;
                      return (
                        <TouchableOpacity key={k} style={pmS.chip}
                          onPress={function() { togglePsalm(r); }} activeOpacity={0.7}>
                          <Avatar uid={r.uid} user={r} size={20} showBorder={false} style={AVATAR_BG} />
                          <Text style={pmS.chipName} numberOfLines={1}>{r.name}</Text>
                          <Icon name="close-circle" size={14} color={T2} />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
                <View style={hm.seg}>
                  <View style={[hm.segSlider, tab === "all" && { left: "50%" }]} />
                  {[["deacons", "Deacons"], ["all", "All Members"]].map(function(pair) {
                    var k = pair[0]; var l = pair[1];
                    return (
                      <TouchableOpacity key={k} onPress={function() { setTab(k); setQ(""); }}
                        style={hm.segBtn} activeOpacity={0.8}>
                        <Text style={[hm.segTxt, tab === k && hm.segTxtOn]}>{l}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={hm.searchRow}>
                  <Icon name="magnify" size={16} color={T3} />
                  <TextInput style={hm.searchIn} placeholder="Search..." placeholderTextColor={T3}
                    value={q} onChangeText={setQ} returnKeyType="search" />
                  {q.length > 0 && (
                    <TouchableOpacity onPress={function() { setQ(""); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon name="close-circle" size={15} color={T3} />
                    </TouchableOpacity>
                  )}
                </View>
                {loadingUsers
                  ? <View style={hm.center}><ActivityIndicator color={BLUE} /></View>
                  : <FlatList
                      {...LIST_PERF}
                      data={pickerSource}
                      keyExtractor={pickerKeyExtractor}
                      style={[hm.pickerList, { maxHeight: psalmPickerScrollMax }]}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator
                      ListEmptyComponent={PickerEmpty}
                      renderItem={renderPsalmRow}
                    />
                }
                {manualOpen ? (
                  <View style={hm.manualBox}>
                    <TextInput style={hm.manualIn} placeholder="Full name..." placeholderTextColor={T3}
                      value={manual} onChangeText={setManual} autoFocus returnKeyType="done"
                      onSubmitEditing={addPsalmManual} />
                    <View style={hm.manualBtns}>
                      <TouchableOpacity style={hm.mCancel}
                        onPress={function() { setManualOpen(false); setManual(""); }}>
                        <Text style={hm.mCancelTxt}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={hm.mAdd} onPress={addPsalmManual}>
                        <Text style={hm.mAddTxt}>Add</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : psalmSelected.size < MAX_PSALM_READERS && (
                  <TouchableOpacity style={hm.addManual}
                    onPress={function() { setManualOpen(true); }} activeOpacity={0.7}>
                    <Icon name="account-plus-outline" size={16} color={BLUE} />
                    <Text style={hm.addManualTxt}>Add name manually</Text>
                  </TouchableOpacity>
                )}
                <View style={hm.pickerFooter}>
                  <TouchableOpacity
                    style={[hm.saveBtn, psalmSelected.size === 0 && hm.saveBtnClear]}
                    onPress={commitPsalm} activeOpacity={0.8}>
                    <Text style={[hm.saveBtnTxt, psalmSelected.size === 0 && { color: RED }]}>
                      {psalmSelected.size === 0
                        ? "Clear Readers"
                        : ("Confirm " + psalmSelected.size + " Reader" + (psalmSelected.size > 1 ? "s" : ""))}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

var hm = StyleSheet.create({
  backdrop:           { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  kav:                { flex: 1, width: "100%", justifyContent: "flex-end" },
  sheet:              { backgroundColor: CARD, borderTopLeftRadius: 26, borderTopRightRadius: 26,
                        paddingBottom: Platform.OS === "ios" ? 34 : 20, flexShrink: 1 },
  handle:             { width: 38, height: 4, borderRadius: 2, backgroundColor: SEP,
                        alignSelf: "center", marginTop: 12 },
  hdr:                { flexDirection: "row", alignItems: "flex-start", gap: 12,
                        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title:              { fontSize: 20, fontWeight: "800", color: T1, letterSpacing: -0.3 },
  sub:                { fontSize: 13, color: T2, marginTop: 2 },
  xBtn:               { width: 32, height: 32, borderRadius: 16, backgroundColor: CARD2,
                        justifyContent: "center", alignItems: "center" },
  trackWrap:          { height: 2, backgroundColor: SEP, marginHorizontal: 20, borderRadius: 2, marginBottom: 6 },
  trackFill:          { height: 2, backgroundColor: BLUE, borderRadius: 2 },
  body:               { paddingHorizontal: 20, paddingBottom: 16 },
  readingBlock:       { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: SEP },
  readingBlockCoptic: { backgroundColor: "rgba(245,158,11,0.03)" },
  // Bleeds past the body's 20pt inset so the highlight spans the sheet.
  readingBlockPressed: { backgroundColor: "rgba(255,255,255,0.05)", marginHorizontal: -20, paddingHorizontal: 20 },
  readingTop:         { flexDirection: "row", gap: 12, marginBottom: 10, alignItems: "flex-start" },
  readingIcon:        { width: 32, height: 32, borderRadius: 9, justifyContent: "center",
                        alignItems: "center", flexShrink: 0 },
  readingLabel:       { fontSize: 10, fontWeight: "800", letterSpacing: 0.8,
                        textTransform: "uppercase", marginBottom: 4 },
  readingRef:         { fontSize: 14, color: T1, lineHeight: 20 },
  copticBadge:        { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5,
                        backgroundColor: COPTIC_BG, borderWidth: 1, borderColor: COPTIC_BORDER },
  copticBadgeTxt:     { fontSize: 9, fontWeight: "800", color: COPTIC_COLOR, letterSpacing: 0.5 },
  assignBtn:          { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: CARD2,
                        borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  assignBtnFilled:    { backgroundColor: "rgba(48,209,88,0.08)", borderWidth: 1,
                        borderColor: "rgba(48,209,88,0.2)" },
  assignedName:       { flex: 1, fontSize: 14, color: GREEN, fontWeight: "600" },
  unassignedTxt:      { flex: 1, fontSize: 14, color: T2 },
  pickerHdr:          { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20,
                        paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: SEP },
  backBtn:            { width: 36, height: 36, borderRadius: 18, backgroundColor: CARD2,
                        justifyContent: "center", alignItems: "center" },
  pickerIconBox:      { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  pickerType:         { fontSize: 17, fontWeight: "700" },
  pickerRef:          { fontSize: 12, color: T2, marginTop: 2 },
  pickerCoptic:       { marginHorizontal: 20, marginTop: 6 },
  selBanner:          { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginTop: 14,
                        marginBottom: 2, borderRadius: 16, padding: 14, backgroundColor: BLUEDIM,
                        borderWidth: 1, borderColor: "rgba(10,132,255,0.25)" },
  selName:            { fontSize: 15, fontWeight: "700", color: T1 },
  selSub:             { fontSize: 12, color: T2, marginTop: 2 },
  seg:                { flexDirection: "row", marginHorizontal: 20, marginTop: 14, backgroundColor: CARD2,
                        borderRadius: 12, padding: 3, position: "relative" },
  segSlider:          { position: "absolute", top: 3, bottom: 3, left: 3, width: "50%",
                        backgroundColor: CARD3, borderRadius: 10 },
  segBtn:             { flex: 1, paddingVertical: 9, alignItems: "center", zIndex: 1 },
  segTxt:             { fontSize: 13, fontWeight: "600", color: T3 },
  segTxtOn:           { color: T1 },
  searchRow:          { flexDirection: "row", alignItems: "center", backgroundColor: CARD2,
                        borderRadius: 11, paddingHorizontal: 12, marginHorizontal: 20,
                        marginTop: 10, marginBottom: 6 },
  searchIn:           { flex: 1, color: T1, fontSize: 14, paddingVertical: 11, marginLeft: 8 },
  center:             { height: 100, justifyContent: "center", alignItems: "center" },
  empty:              { textAlign: "center", color: T3, fontSize: 14, paddingVertical: 24 },
  pRow:               { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 13,
                        marginBottom: 6, backgroundColor: CARD2 },
  pRowOn:             { backgroundColor: BLUEDIM, borderWidth: 1, borderColor: "rgba(10,132,255,0.25)" },
  pRowName:           { fontSize: 14, color: T1, fontWeight: "500" },
  // Hoisted out of the JSX, where they were fresh object literals every render.
  pRowBody:           { flex: 1, marginLeft: 12 },
  pAvatarStub:        { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },
  pRowAtMax:          { opacity: 0.4 },
  pickerList:         { paddingHorizontal: 20 },
  pRowTag:            { fontSize: 9, color: BLUE, fontWeight: "800", marginTop: 2, letterSpacing: 0.6 },
  radio:              { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: T3,
                        justifyContent: "center", alignItems: "center" },
  radioOn:            { borderColor: BLUE },
  radioDot:           { width: 10, height: 10, borderRadius: 5, backgroundColor: BLUE },
  addManual:          { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20,
                        marginTop: 4, marginBottom: 8, padding: 13, borderRadius: 12, backgroundColor: BLUEDIM },
  addManualTxt:       { fontSize: 14, fontWeight: "500", color: BLUE },
  manualBox:          { marginHorizontal: 20, marginTop: 6, marginBottom: 8 },
  manualIn:           { backgroundColor: CARD2, borderRadius: 11, paddingHorizontal: 14,
                        paddingVertical: 12, color: T1, fontSize: 14, marginBottom: 8 },
  manualBtns:         { flexDirection: "row", gap: 8 },
  mCancel:            { flex: 1, paddingVertical: 12, borderRadius: 11, backgroundColor: CARD2, alignItems: "center" },
  mCancelTxt:         { fontSize: 14, fontWeight: "600", color: T2 },
  mAdd:               { flex: 1, paddingVertical: 12, borderRadius: 11, backgroundColor: BLUE, alignItems: "center" },
  mAddTxt:            { fontSize: 14, fontWeight: "700", color: T1 },
  pickerFooter:       { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: SEP },
  saveBtn:            { backgroundColor: BLUE, paddingVertical: 15, borderRadius: 14, alignItems: "center" },
  saveBtnClear:       { backgroundColor: "rgba(255,69,58,0.1)", borderWidth: 1, borderColor: "rgba(255,69,58,0.2)" },
  saveBtnTxt:         { fontSize: 15, fontWeight: "700", color: T1 },
});

var pmS = StyleSheet.create({
  counter:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: CARD2 },
  counterTxt: { fontSize: 13, fontWeight: "700", color: T2 },
  chipScroll: { maxHeight: 48, marginHorizontal: 20, marginBottom: 4 },
  chipRow:    { flexDirection: "row", gap: 6, alignItems: "center" },
  chip:       { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(48,209,88,0.1)",
                borderWidth: 1, borderColor: "rgba(48,209,88,0.25)", borderRadius: 20,
                paddingVertical: 5, paddingHorizontal: 10 },
  chipName:   { fontSize: 13, fontWeight: "600", color: GREEN, maxWidth: 100 },
  checkbox:   { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: T3,
                justifyContent: "center", alignItems: "center" },
  checkboxOn: { backgroundColor: BLUE, borderColor: BLUE },
});

// ── Day tab bar ───────────────────────────────────────────────────────────────
var DayTabBar = function(props) {
  var allDays = props.allDays;
  var selectedId = props.selectedId;
  var easterDate = props.easterDate;
  var schedule = props.schedule;
  var onSelect = props.onSelect;
  var fs = props.fontScale != null ? props.fontScale : 1;
  var gutter = props.gutter != null ? props.gutter : 12;
  var scrollRef = useRef(null);
  var tabLayouts = useRef({});
  // The bar's own width, not the screen's: they differ on iPad, and the screen
  // width read at mount is wrong after a rotation.
  var _barW = useState(0); var barW = _barW[0]; var setBarW = _barW[1];

  useEffect(function() {
    if (!selectedId || !scrollRef.current || !barW) return;
    var layout = tabLayouts.current[selectedId];
    if (!layout) return;
    var centeredX = layout.x - (barW / 2) + (layout.width / 2);
    scrollRef.current.scrollTo({ x: Math.max(0, centeredX), animated: true });
  }, [selectedId, barW]);

  var labelType = tx(11, fs);
  var dateType  = tx(9, fs);

  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false}
      onLayout={function(e) { setBarW(e.nativeEvent.layout.width); }}
      contentContainerStyle={[dt.content, { paddingHorizontal: gutter }]} style={dt.bar}>
      {allDays.map(function(day) {
        var ds = schedule[day.id] || {};
        var prog = dayProgress(day, ds);
        var complete = prog.total > 0 && prog.filled === prog.total;
        var started  = prog.filled > 0 && !complete;
        var active   = day.id === selectedId;
        var dateStr  = easterDate
          ? new Date(new Date(easterDate).setDate(new Date(easterDate).getDate() + day.easterOffset))
              .toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : null;
        return (
          <TouchableOpacity key={day.id}
            onPress={function() { onSelect(day.id); }}
            onLayout={function(e) { tabLayouts.current[day.id] = e.nativeEvent.layout; }}
            style={[dt.tab, { minWidth: Math.round(66 * fs) }, active && dt.tabActive]} activeOpacity={0.75}>
            <View style={[dt.dot, complete ? dt.dotGreen : started ? dt.dotBlue : dt.dotGray]} />
            {/*
              One line, shrinking to fit: the tab used to be a fixed 58pt box
              around a two-line label, so on Large the date fell out the bottom.
              Now the tab sizes to its content and every tab is the same height.
            */}
            <Text style={[dt.label, active && dt.labelActive, labelType]}
              numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {day.shortLabel}
            </Text>
            {dateStr && <Text style={[dt.date, active && dt.dateActive, dateType]} numberOfLines={1}>{dateStr}</Text>}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};
var dt = StyleSheet.create({
  // A horizontal ScrollView flexes on the column axis by default: it would
  // either grow to share height with the hour list below or give height up to
  // it and squash the tabs. Neither — it is exactly as tall as its tabs.
  bar:        { backgroundColor: BG, flexGrow: 0, flexShrink: 0 },
  // flexGrow 1 on the content and the tabs lets the strip fill the width when
  // every day fits (iPad landscape); when it does not, it scrolls as before.
  content:     { paddingVertical: 8, gap: 6, flexDirection: "row", flexGrow: 1 },
  tab:         { flexGrow: 1, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10,
                 backgroundColor: CARD, alignItems: "center", justifyContent: "center",
                 borderWidth: 1, borderColor: "transparent" },
  tabActive:   { backgroundColor: BLUEDIM, borderColor: "rgba(10,132,255,0.35)" },
  dot:         { width: 5, height: 5, borderRadius: 2.5, marginBottom: 4 },
  dotGray:     { backgroundColor: T3 },
  dotBlue:     { backgroundColor: BLUE },
  dotGreen:    { backgroundColor: GREEN },
  label:       { fontWeight: "600", color: T2, textAlign: "center" },
  labelActive: { color: BLUE },
  date:        { color: T3, marginTop: 1 },
  dateActive:  { color: "rgba(10,132,255,0.7)" },
});

// ── Hour tile ─────────────────────────────────────────────────────────────────
/**
 * Picker rows, memoized.
 *
 * Both pickers used an inline `function(ri){...}` renderItem, so every keystroke in
 * the search field rebuilt every mounted row — and each row mounts an <Avatar>,
 * which carries a useSyncExternalStore subscription plus two effects.
 */
// Profile photos are stored at camera resolution, and expo-image shrinks each
// one on the main thread as it mounts. Ten of those used to hold the sheet
// back for seconds, so rows draw a plain circle first and the photos are let
// in one at a time once the sheet is on screen (see `photoBudget`). Each row
// reports when its photo is actually drawn so the next one can follow.
var PickerAvatar = function(props) {
  if (!props.showPhoto) {
    return (
      <View style={[hm.pAvatarStub, AVATAR_BG]}>
        <Icon name="account" size={20} color={T3} />
      </View>
    );
  }
  var onPhotoShown = props.onPhotoShown, index = props.index;
  return (
    <Avatar uid={props.item.uid} user={props.item} size={38} showBorder={false} style={AVATAR_BG}
      onDisplay={onPhotoShown ? function() { onPhotoShown(index); } : undefined} />
  );
};

var PickerRow = React.memo(function(props) {
  var item = props.item, on = props.on;
  return (
    <TouchableOpacity style={[hm.pRow, on && hm.pRowOn]}
      onPress={function() { props.onToggle(item, on); }} activeOpacity={0.65}>
      <PickerAvatar item={item} showPhoto={props.showPhoto} index={props.index} onPhotoShown={props.onPhotoShown} />
      <View style={hm.pRowBody}>
        <Text style={hm.pRowName}>{item.name}</Text>
        {item.isDeacon && <Text style={hm.pRowTag}>DEACON</Text>}
      </View>
      <View style={[hm.radio, on && hm.radioOn]}>
        {on && <View style={hm.radioDot} />}
      </View>
    </TouchableOpacity>
  );
});
PickerRow.displayName = "PickerRow";

var PsalmPickerRow = React.memo(function(props) {
  var item = props.item, on = props.on, atMax = props.atMax;
  return (
    <TouchableOpacity
      style={[hm.pRow, on && hm.pRowOn, atMax && hm.pRowAtMax]}
      onPress={function() { if (!atMax) props.onToggle(item); }}
      activeOpacity={0.65}>
      <PickerAvatar item={item} showPhoto={props.showPhoto} index={props.index} onPhotoShown={props.onPhotoShown} />
      <View style={hm.pRowBody}>
        <Text style={hm.pRowName}>{item.name}</Text>
        {item.isDeacon && <Text style={hm.pRowTag}>DEACON</Text>}
      </View>
      <View style={[pmS.checkbox, on && pmS.checkboxOn]}>
        {on && <Icon name="check" size={13} color={T1} />}
      </View>
    </TouchableOpacity>
  );
});
PsalmPickerRow.displayName = "PsalmPickerRow";

var pickerKeyExtractor = function(i) { return i.uid || i.name; };
var PickerEmpty = function() { return <Text style={hm.empty}>No results</Text>; };

var HourTile = React.memo(function(props) {
  var hour = props.hour;
  var hourAssignments = props.hourAssignments;
  var dayId = props.dayId;
  var deacons = props.deacons;
  var congregation = props.congregation;
  var loadingUsers = props.loadingUsers;
  var onSaveReading = props.onSaveReading;
  var onSavePsalmReaders = props.onSavePsalmReaders;
  var onSaveLanguage = props.onSaveLanguage;
  var onSaveCopticToggle = props.onSaveCopticToggle;
  var onOpenHour = props.onOpenHour;
  var onOpenReading = props.onOpenReading;
  var fs = props.fontScale != null ? props.fontScale : 1;

  var rows = expandReadings(hour, hourAssignments);
  if (hour) {
    var hasReadings = !!hour.readings;
    var readingKeys = hasReadings ? Object.keys(hour.readings).filter(k => hour.readings[k]) : [];
    if (rows.length === 0) {
      console.warn("HourTile [" + hour.id + "]: No rows from expandReadings. readings=" + hasReadings + 
        ", non-null reading keys=[" + readingKeys.join(", ") + "]" +
        ", hour keys=[" + Object.keys(hour).join(", ") + "]");
    }
  }
  var assignableRows = rows.filter(function(r) { return isAssignableSlot(r.rKey) || isPsalmSlot(r.rKey); });
  var counts         = countSlots(hour, hourAssignments);
  var total          = counts.total;
  var filled         = counts.filled;
  var complete       = total > 0 && filled === total;
  var started        = filled > 0 && !complete;
  var pctVal         = total > 0 ? filled / total : 0;
  var statusColor    = complete ? GREEN : started ? BLUE : "rgba(255,255,255,0.1)";

  var rowDisplayLabel = function(row) {
    var meta = READING_META[row.rKey] || { label: row.rKey };
    if (row.rKey === "homily")     return "Homily \u2014 " + (row.author || row.refText);
    if (row.rKey === "exposition") return "Exposition";
    return row.index != null ? (meta.label + " " + (row.index + 1)) : meta.label;
  };

  var nameType  = tx(16, fs);
  var smallType = tx(11, fs);
  var typeType  = tx(12, fs);
  var valueType = tx(13, fs);
  var badgeType = tx(9, fs);
  var iconSize  = Math.round(15 * fs);
  var avatarSize = Math.round(24 * fs);

  return (
    <TouchableOpacity onPress={function() { if (onOpenHour) onOpenHour(hour); }} activeOpacity={0.72}
      style={[ht.tile, props.style]}>
      {/* Status runs the full height of the card instead of a stub beside the title. */}
      <View style={[ht.accent, complete ? ht.accentDone : started ? ht.accentPartial : ht.accentEmpty]} />
      <View style={ht.titleRow}>
        <Text style={[ht.name, nameType]} numberOfLines={2}>{hour.label}</Text>
        {complete
          ? <View style={ht.pill}>
              <Icon name="check" size={Math.round(11 * fs)} color={GREEN} />
              <Text style={[ht.pillTxt, { color: GREEN }, smallType]}>Done</Text>
            </View>
          : started
            ? <View style={[ht.pill, ht.pillPartial]}>
                <Text style={[ht.pillTxt, { color: BLUE }, smallType]}>{filled + "/" + total}</Text>
              </View>
            : null
        }
      </View>
      <View style={ht.barRow}>
        <View style={ht.track}>
          <View style={[ht.trackFill, { flex: pctVal, backgroundColor: statusColor }]} />
          <View style={{ flex: 1 - pctVal }} />
        </View>
        <Text style={[ht.pct, smallType]}>{Math.round(pctVal * 100) + "%"}</Text>
      </View>
      <View style={ht.readingList}>
        {assignableRows.map(function(row, i) {
          var meta      = READING_META[row.rKey] || { label: row.rKey, icon: "book-outline", color: T2 };
          var isPsalm   = isPsalmSlot(row.rKey);
          var isCoptic  = row.isCoptic === true;
          var readers   = isPsalm ? (hourAssignments[psalmReadersKey(row)] || []) : [];
          var assignee  = !isPsalm ? (hourAssignments[row.slotKey] || null) : null;
          var typeLabel = rowDisplayLabel(row);
          var isLast    = i === assignableRows.length - 1;
          var lang      = (!isCoptic && !isPsalm && hasLanguagePicker(row.rKey))
            ? langShort(effectiveLanguage(row, hourAssignments))
            : null;
          var accent    = isCoptic ? COPTIC_COLOR : meta.color;
          return (
            <Pressable key={row.slotKey}
              onPress={function() { if (onOpenReading) onOpenReading(hour, row); }}
              style={function(state) {
                return [ht.rRow, !isLast && ht.rRowBorder, isCoptic && ht.rRowCoptic, state.pressed && ht.rRowPressed];
              }}>
              {/*
                Two lines on the left — what the reading is, then its reference —
                and who reads it on the right. The reference used to share one
                line with the reader and vanish once someone was assigned; this
                keeps both and needs far less width, which is what lets the
                cards sit two or three across on an iPad.
              */}
              <View style={ht.rLeft}>
                <Icon name={meta.icon} size={iconSize} color={accent} style={ht.rIcon} />
                <View style={ht.rLabelCol}>
                  <View style={ht.rTypeRow}>
                    <Text style={[ht.rType, { color: accent }, typeType]} numberOfLines={1}>{typeLabel}</Text>
                    {lang != null ? (
                      <View style={ht.langBadge}><Text style={[ht.langBadgeTxt, badgeType]}>{lang}</Text></View>
                    ) : isCoptic ? (
                      <View style={ht.copticBadge}><Text style={[ht.copticBadgeTxt, badgeType]}>COPTIC</Text></View>
                    ) : null}
                  </View>
                  {!!row.refText && row.rKey !== "homily" && row.rKey !== "exposition" && (
                    <Text style={[ht.rRef, valueType]} numberOfLines={1}>{row.refText}</Text>
                  )}
                </View>
              </View>
              {isPsalm && readers.length > 0 ? (
                <View style={ht.assigneeRow}>
                  <View style={ht.avatarStack}>
                    {readers.slice(0, 3).map(function(r, idx) {
                      return (
                        <Avatar key={r.uid || r.name || idx} uid={r.uid} size={avatarSize}
                          style={[ht.stackedAvatar, idx > 0 && { marginLeft: -Math.round(avatarSize * 0.35) }]} />
                      );
                    })}
                  </View>
                  <Text style={[ht.assigneeName, valueType]} numberOfLines={1}>
                    {readers.length === 1 ? readers[0].name : (readers.length + " readers")}
                  </Text>
                </View>
              ) : assignee != null ? (
                <View style={ht.assigneeRow}>
                  <Avatar uid={assignee.uid} size={avatarSize} style={ht.stackedAvatar} />
                  <Text style={[ht.assigneeName, isCoptic && { color: COPTIC_COLOR }, valueType]} numberOfLines={1}>
                    {assignee.name}
                  </Text>
                </View>
              ) : (
                <View style={ht.assignChip}>
                  <Icon name="account-plus-outline" size={Math.round(13 * fs)} color={BLUE} />
                  <Text style={[ht.assignChipTxt, smallType]} numberOfLines={1}>Assign</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </TouchableOpacity>
  );
});

var ht = StyleSheet.create({
  // One inset (PAD) for the title, the bar and the rows, so they share a left
  // edge. They used to be indented 0, 14 and 14 inside a 14pt-padded card.
  tile:           { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: SEP,
                    overflow: "hidden", paddingVertical: 14, paddingLeft: 18, paddingRight: 16 },
  accent:         { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  accentDone:     { backgroundColor: GREEN },
  accentPartial:  { backgroundColor: BLUE },
  accentEmpty:    { backgroundColor: "rgba(255,255,255,0.08)" },
  titleRow:       { flexDirection: "row", alignItems: "center", gap: 10 },
  name:           { fontWeight: "700", color: T1, flex: 1, letterSpacing: -0.2 },
  pill:           { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9,
                    paddingVertical: 2, borderRadius: 20, backgroundColor: "rgba(48,209,88,0.1)",
                    borderWidth: 1, borderColor: "rgba(48,209,88,0.28)" },
  pillPartial:    { backgroundColor: "rgba(10,132,255,0.12)", borderColor: "rgba(10,132,255,0.3)" },
  pillTxt:        { fontWeight: "700" },
  barRow:         { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, marginBottom: 6 },
  track:          { flex: 1, flexDirection: "row", height: 3, borderRadius: 2, backgroundColor: CARD2, overflow: "hidden" },
  trackFill:      { borderRadius: 2 },
  pct:            { fontWeight: "700", color: T3, minWidth: 34, textAlign: "right" },
  readingList:    { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  rRow:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    gap: 12, paddingVertical: 10 },
  rRowBorder:     { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.04)" },
  // Bleeds the tint to the card edges while the content keeps the shared inset.
  rRowCoptic:     { backgroundColor: "rgba(245,158,11,0.05)", marginLeft: -18, marginRight: -16,
                    paddingLeft: 18, paddingRight: 16 },
  rLeft:          { flexDirection: "row", alignItems: "flex-start", gap: 9, flex: 1 },
  rIcon:          { marginTop: 1 },
  rLabelCol:      { flex: 1, gap: 1 },
  rTypeRow:       { flexDirection: "row", alignItems: "center", gap: 6 },
  rType:          { fontWeight: "700", flexShrink: 1 },
  langBadge:      { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: CARD2 },
  langBadgeTxt:   { fontWeight: "700", color: T3, letterSpacing: 0.3 },
  copticBadge:    { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: COPTIC_BG,
                    borderWidth: 1, borderColor: COPTIC_BORDER },
  copticBadgeTxt: { fontWeight: "700", color: COPTIC_COLOR, letterSpacing: 0.3 },
  rRef:           { color: T3 },
  // Same bleed as the Coptic tint, so the press highlight spans the card.
  rRowPressed:    { backgroundColor: "rgba(255,255,255,0.06)", marginLeft: -18, marginRight: -16,
                    paddingLeft: 18, paddingRight: 16 },
  assignChip:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8,
                    paddingVertical: 3, borderRadius: 12, backgroundColor: "rgba(10,132,255,0.12)" },
  assignChipTxt:  { fontWeight: "700", color: BLUE },
  // The reader gets up to half the row; a long reading reference on the left
  // truncates before the name does.
  assigneeRow:    { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1, maxWidth: "50%",
                    justifyContent: "flex-end" },
  avatarStack:    { flexDirection: "row" },
  stackedAvatar:  { borderWidth: 1.5, borderColor: CARD, backgroundColor: CARD2 },
  assigneeName:   { fontWeight: "600", color: GREEN, flexShrink: 1 },
});

// ── Settings sheet ────────────────────────────────────────────────────────────
var SettingsSheet = function(props) {
  var visible = props.visible;
  var myReadingsVisible = props.myReadingsVisible;
  var fullScheduleVisible = props.fullScheduleVisible;
  var easterDate = props.easterDate;
  var year = props.year;
  var fontSizeScale = props.fontSizeScale;
  var onSetFontSize = props.onSetFontSize;
  var onToggleMyReadings = props.onToggleMyReadings;
  var onToggleFullSchedule = props.onToggleFullSchedule;
  var onDateSave = props.onDateSave;
  var onArchivePress = props.onArchivePress;
  var onViewArchives = props.onViewArchives;
  var onClose = props.onClose;

  var sheet = useSheetPresentation(560);
  var _pickerDate = useState(new Date()); var pickerDate = _pickerDate[0]; var setPickerDate = _pickerDate[1];
  var _pickerOpen = useState(false); var pickerOpen = _pickerOpen[0]; var setPickerOpen = _pickerOpen[1];

  useEffect(function() {
    if (visible) {
      setPickerOpen(false);
      setPickerDate(easterDate ? new Date(easterDate) : new Date());
    }
  }, [visible, easterDate]);

  var handleChange = function(event, selected) {
    if (Platform.OS === "android") {
      setPickerOpen(false);
      if (event.type !== "dismissed" && selected) onDateSave(selected);
    } else if (selected) {
      setPickerDate(selected);
    }
  };

  var keyDays = [
    { label: "Last Friday of Lent", offset: -9 },
    { label: "Palm Sunday",         offset: -7 },
    { label: "Holy Monday",         offset: -6 },
    { label: "Good Friday Eve",     offset: -2 },
    { label: "Easter Sunday",       offset:  0 },
  ];

  return (
    <Modal visible={visible} animationType={sheet.animationType} transparent onRequestClose={onClose}>
      <View style={[ss.backdrop, sheet.center]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[ss.sheet, sheet.card, sheet.wide && { maxHeight: sheet.height * 0.86 }]}>
          {!sheet.wide && <View style={ss.handle} />}
          <View style={ss.hdr}>
            <Text style={ss.hdrTitle}>Settings</Text>
            <TouchableOpacity style={ss.xBtn} onPress={onClose} activeOpacity={0.7}>
              <Icon name="close" size={17} color={T2} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 12 }}>

            <View style={ss.card}>
              <View style={ss.row}>
                <View style={[ss.iconBox, { backgroundColor: "rgba(48,209,88,0.12)" }]}>
                  <Icon name="account-outline" size={19} color={GREEN} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.label}>My Readings</Text>
                  <Text style={ss.desc}>{myReadingsVisible ? "Members can see their assignments" : "Hidden from members"}</Text>
                </View>
                <Switch
                  value={myReadingsVisible}
                  onValueChange={onToggleMyReadings}
                  trackColor={{ true: GREEN }}
                />
              </View>
            </View>

            <View style={ss.card}>
              <View style={ss.row}>
                <View style={[ss.iconBox, { backgroundColor: "rgba(10,132,255,0.12)" }]}>
                  <Icon name="calendar-text-outline" size={19} color={BLUE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.label}>Full Schedule</Text>
                  <Text style={ss.desc}>{fullScheduleVisible ? "Everyone can see all assignments" : "Hidden from members"}</Text>
                </View>
                <Switch
                  value={fullScheduleVisible}
                  onValueChange={onToggleFullSchedule}
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
                {["small", "medium", "large"].map(function(size) {
                  return (
                    <TouchableOpacity key={size} onPress={function() { onSetFontSize(size); }}
                      style={[ss.fontSizeBtn, fontSizeScale === size && ss.fontSizeBtnActive]}
                      activeOpacity={0.7}>
                      <Text style={[ss.fontSizeBtnTxt, fontSizeScale === size && ss.fontSizeBtnTxtActive,
                        { fontSize: size === "small" ? 12 : size === "large" ? 16 : 13 }]}>
                        {size.charAt(0).toUpperCase() + size.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={ss.card}>
              <View style={ss.row}>
                <View style={[ss.iconBox, { backgroundColor: BLUEDIM }]}>
                  <Icon name="calendar-star" size={19} color={BLUE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.label}>Easter Sunday</Text>
                  <Text style={ss.desc}>{easterDate ? calcDate(easterDate, 0) : "Not set \u2014 tap Edit"}</Text>
                </View>
                <Pressable style={ss.editBtn} onPress={function() {
                  if (pickerOpen && Platform.OS === "ios") { onDateSave(pickerDate); setPickerOpen(false); }
                  else setPickerOpen(function(v) { return !v; });
                }}>
                  <Text style={ss.editTxt}>{pickerOpen ? "Done" : "Edit"}</Text>
                </Pressable>
              </View>
              {pickerOpen && (
                <DateTimePicker value={pickerDate} mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleChange}
                  minimumDate={new Date(2020, 0, 1)} maximumDate={new Date(2050, 11, 31)}
                  style={{ width: "100%", height: Platform.OS === "ios" ? 150 : 180, marginTop: 8 }}
                  {...(Platform.OS === "ios" ? { textColor: "#E0E0E0", accentColor: BLUE } : {})} />
              )}
              {easterDate && !pickerOpen && (
                <>
                  <View style={ss.divider} />
                  {keyDays.map(function(kd) {
                    return (
                      <View key={kd.label} style={ss.dateRow}>
                        <Text style={ss.dateLabel}>{kd.label}</Text>
                        <Text style={[ss.dateVal, kd.offset === 0 && { color: BLUE, fontWeight: "700" }]}>
                          {calcDate(easterDate, kd.offset)}
                        </Text>
                      </View>
                    );
                  })}
                </>
              )}
            </View>

            <TouchableOpacity style={ss.archivesBtn} onPress={onViewArchives} activeOpacity={0.8}>
              <Icon name="archive-eye-outline" size={18} color={BLUE} />
              <Text style={ss.archivesBtnTxt}>View Archived Schedules</Text>
              <Icon name="chevron-right" size={15} color={T3} style={{ marginLeft: "auto" }} />
            </TouchableOpacity>
            <TouchableOpacity style={ss.archiveBtn} onPress={onArchivePress} activeOpacity={0.8}>
              <Icon name="archive-outline" size={18} color={RED} />
              <Text style={ss.archiveTxt}>{"Archive " + year + " Schedule"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
var ss = StyleSheet.create({
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
  editBtn:              { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9, backgroundColor: CARD },
  editTxt:              { fontSize: 13, fontWeight: "600", color: BLUE },
  divider:              { height: 1, backgroundColor: SEP, marginVertical: 12 },
  dateRow:              { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  dateLabel:            { fontSize: 13, color: T2 },
  dateVal:              { fontSize: 13, color: T1, fontWeight: "500" },
  archivesBtn:          { flexDirection: "row", alignItems: "center", gap: 10, padding: 15, borderRadius: 14,
                          borderWidth: 1, borderColor: "rgba(10,132,255,0.22)", backgroundColor: "rgba(10,132,255,0.07)" },
  archivesBtnTxt:       { fontSize: 15, fontWeight: "600", color: BLUE },
  archiveBtn:           { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
                          padding: 15, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,69,58,0.22)",
                          backgroundColor: "rgba(255,69,58,0.06)" },
  archiveTxt:           { fontSize: 15, fontWeight: "600", color: RED },
});

// ── Archive confirm ───────────────────────────────────────────────────────────
var ArchiveConfirm = function(props) {
  var visible = props.visible;
  var year = props.year;
  var onConfirm = props.onConfirm;
  var onClose = props.onClose;

  var sheet = useSheetPresentation(460);
  var _archiving = useState(false); var archiving = _archiving[0]; var setArchiving = _archiving[1];
  var _progress = useState(0); var progress = _progress[0]; var setProgress = _progress[1];
  var _done = useState(false); var done = _done[0]; var setDone = _done[1];

  useEffect(function() {
    if (!visible) { setArchiving(false); setProgress(0); setDone(false); }
  }, [visible]);

  var handleConfirm = function() {
    setArchiving(true); setProgress(0);
    var steps = [15, 35, 55, 72, 88];
    var idx = 0;
    var tick = setInterval(function() {
      if (idx < steps.length) { setProgress(steps[idx]); idx++; }
      else clearInterval(tick);
    }, 350);
    onConfirm().then(function() {
      clearInterval(tick);
      setProgress(100); setDone(true);
    }).catch(function(_err) {
      clearInterval(tick);
    });
  };

  return (
    <Modal visible={visible} animationType="fade" transparent
      onRequestClose={!archiving ? onClose : undefined} statusBarTranslucent>
      <View style={[arc.overlay, sheet.center]}>
        <View style={[arc.sheet, sheet.card, sheet.wide && arc.sheetCard]}>
          {!sheet.wide && <View style={arc.handle} />}
          <View style={arc.iconWrap}>
            <Icon name={done ? "check-circle-outline" : "archive-clock-outline"} size={32}
              color={done ? GREEN : ORANGE} />
          </View>
          <Text style={arc.title}>{done ? "Archived!" : ("Archive " + year + "?")}</Text>
          <Text style={arc.body}>
            {done
              ? ("The " + year + " schedule has been saved and assignees cleared.")
              : "Reader assignments will be saved to an archive. The schedule structure stays intact for next year."}
          </Text>
          <View style={arc.divider} />
          {archiving ? (
            <View style={arc.progressSection}>
              <View style={arc.progressHeader}>
                <Icon name="archive-arrow-down-outline" size={14} color={done ? GREEN : ORANGE} />
                <Text style={arc.progressLabel}>{done ? "Complete" : "Saving archive\u2026"}</Text>
                <Text style={[arc.progressPct, done && { color: GREEN }]}>{progress + "%"}</Text>
              </View>
              <View style={arc.progressTrack}>
                <View style={[arc.progressFill, { width: progress + "%", backgroundColor: done ? GREEN : ORANGE }]} />
              </View>
            </View>
          ) : (
            <View style={arc.actions}>
              <TouchableOpacity style={arc.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={arc.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={arc.confirmBtn} onPress={handleConfirm} activeOpacity={0.8}>
                <Icon name="archive-arrow-down-outline" size={16} color={T1} />
                <Text style={arc.confirmTxt}>Archive &amp; Clear</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};
var arc = StyleSheet.create({
  overlay:         { flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "flex-end" },
  sheet:           { backgroundColor: CARD, borderTopLeftRadius: 26, borderTopRightRadius: 26,
                     paddingHorizontal: 24, paddingBottom: Platform.OS === "ios" ? 44 : 28,
                     paddingTop: 12, alignItems: "center" },
  handle:          { width: 38, height: 4, borderRadius: 2, backgroundColor: SEP,
                     alignSelf: "center", marginBottom: 20 },
  sheetCard:       { paddingTop: 28, paddingBottom: 24 },
  iconWrap:        { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,159,10,0.1)",
                     justifyContent: "center", alignItems: "center", marginBottom: 14 },
  title:           { fontSize: 20, fontWeight: "800", color: T1, marginBottom: 8, letterSpacing: -0.3 },
  body:            { fontSize: 14, color: T2, textAlign: "center", lineHeight: 21, marginBottom: 20 },
  divider:         { width: "100%", height: 1, backgroundColor: SEP, marginBottom: 20 },
  actions:         { flexDirection: "row", gap: 10, width: "100%" },
  cancelBtn:       { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: CARD2, alignItems: "center" },
  cancelTxt:       { fontSize: 15, fontWeight: "600", color: T2 },
  confirmBtn:      { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center",
                     gap: 8, paddingVertical: 14, borderRadius: 14, backgroundColor: RED },
  confirmTxt:      { fontSize: 15, fontWeight: "700", color: T1 },
  progressSection: { width: "100%" },
  progressHeader:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  progressLabel:   { flex: 1, fontSize: 13, color: T2, fontWeight: "500" },
  progressPct:     { fontSize: 13, fontWeight: "700", color: T1 },
  progressTrack:   { height: 5, backgroundColor: CARD2, borderRadius: 3, overflow: "hidden" },
  progressFill:    { height: 5, borderRadius: 3 },
});

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PaschaManager() {
  var isMounted = useRef(true);

  // Hold the six Firestore listeners below until the drawer/stack transition
  // has finished animating — they otherwise stall it mid-slide.
  var ready = useAfterInteractions();

  var _uid = useState(null); var uid = _uid[0]; var setUid = _uid[1];
  var _churchId = useState(null); var churchId = _churchId[0]; var setChurchId = _churchId[1];
  var _scheduleShell = useState(null); var scheduleShell = _scheduleShell[0]; var setScheduleShell = _scheduleShell[1];
  var _assignees = useState({}); var assignees = _assignees[0]; var setAssignees = _assignees[1];
  var _myReadingsVisible = useState(false); var myReadingsVisible = _myReadingsVisible[0]; var setMyReadingsVisible = _myReadingsVisible[1];
  var _fullScheduleVisible = useState(false); var fullScheduleVisible = _fullScheduleVisible[0]; var setFullScheduleVisible = _fullScheduleVisible[1];
  var _easterDate = useState(null); var easterDate = _easterDate[0]; var setEasterDate = _easterDate[1];
  var _deacons = useState([]); var deacons = _deacons[0]; var setDeacons = _deacons[1];
  var _congregation = useState([]); var congregation = _congregation[0]; var setCongregation = _congregation[1];
  // Starts true so the people picker shows its spinner rather than "No results"
  // in the window before the congregation snapshot has delivered.
  var _loadingUsers = useState(true); var loadingUsers = _loadingUsers[0]; var setLoadingUsers = _loadingUsers[1];
  var _settingsOpen = useState(false); var settingsOpen = _settingsOpen[0]; var setSettingsOpen = _settingsOpen[1];
  var _archiveOpen = useState(false); var archiveOpen = _archiveOpen[0]; var setArchiveOpen = _archiveOpen[1];
  var _archiveViewOpen = useState(false); var archiveViewOpen = _archiveViewOpen[0]; var setArchiveViewOpen = _archiveViewOpen[1];
  var _selectedId = useState(null); var selectedId = _selectedId[0]; var setSelectedId = _selectedId[1];
  var _fontSizeScale = useState("medium"); var fontSizeScale = _fontSizeScale[0]; var setFontSizeScale = _fontSizeScale[1];
  var _fontSizeMultipliers = useState(DEFAULT_FONT_MULTIPLIERS);
  var fontSizeMultipliers = _fontSizeMultipliers[0]; var setFontSizeMultipliers = _fontSizeMultipliers[1];
  var _hourOpen = useState(null); var hourOpen = _hourOpen[0]; var setHourOpen = _hourOpen[1];
  var _hourOpenRow = useState(null); var hourOpenRow = _hourOpenRow[0]; var setHourOpenRow = _hourOpenRow[1];

  var allDays  = useMemo(function() { return buildAllDays(scheduleShell); }, [scheduleShell]);
  var daysById = useMemo(function() {
    var map = {};
    allDays.forEach(function(d) { map[d.id] = d; });
    return map;
  }, [allDays]);

  var schedule = useMemo(function() {
    var merged = {};
    allDays.forEach(function(day) {
      merged[day.id] = {};
      (day.hours || []).forEach(function(h) {
        var ha = assignees[day.id];
        merged[day.id][h.id] = Object.assign({}, ha != null && ha[h.id] != null ? ha[h.id] : {});
      });
    });
    return merged;
  }, [allDays, assignees]);

  var year        = easterDate ? new Date(easterDate).getFullYear() : new Date().getFullYear();
  var selectedDay = selectedId != null ? (daysById[selectedId] || null) : null;
  var activeFontMultiplier = resolvedFontScale(fontSizeScale, fontSizeMultipliers);

  // Live window metrics, so rotating the iPad (or resizing it in Split View)
  // re-lays out the grid instead of keeping the width it mounted with.
  var layout = useResponsiveLayout({ maxContentWidth: 1180 });
  var gutter = layout.isWide ? layout.gutter : 16;
  // How many hour cards fit side by side. A card wants ~290pt at 1x type and
  // grows with the font setting, so a bigger setting gives up a column before
  // its text truncates. With the multipliers in use today (1 / 1.15 / 1.3) an
  // 11" iPad shows 2 across in portrait at every size, and in landscape 3 at
  // Small and Medium, 2 at Large.
  var columns = layout.isWide
    ? Math.max(1, Math.min(3, Math.floor((layout.contentWidth + TILE_GAP) / (290 * activeFontMultiplier + TILE_GAP))))
    : 1;

  useEffect(function() {
    if (!ready) return;
    isMounted.current = true;
    var user = getAuth().currentUser;
    if (!user) return function() { isMounted.current = false; };
    setUid(user.uid);
    var unsub = onSnapshot(doc(getFirestore(), "users", user.uid), function(doc) {
      if (isMounted.current && doc.exists) {
        setChurchId(doc.data().church || null);
        setFontSizeScale(doc.data().paschaFontSize != null ? doc.data().paschaFontSize : "medium");
      }
    }, function(err) { console.warn("Pascha manager user listener failed:", err); });
    return function() { isMounted.current = false; unsub(); };
  }, [ready]);

  useEffect(function() {
    if (!ready) return;
    if (!churchId) return;
    isMounted.current = true;
    var unsubShell = onSnapshot(
      doc(getFirestore(), "churches", churchId, "pascha", "schedule_config"),
      function(doc) {
        if (!isMounted.current) return;
        if (doc.exists) {
          setScheduleShell(doc.data());
          setSelectedId(function(prev) {
            if (prev != null) return prev;
            var days = doc.data().days;
            return days != null && days[0] != null ? days[0].id : null;
          });
        }
      },
      function(err) { console.warn("Pascha schedule_config listener failed:", err); }
    );
    var unsubConfig = onSnapshot(
      doc(getFirestore(), "churches", churchId, "pascha", "config"),
      function(doc) {
        if (!isMounted.current || !doc.exists) return;
        var d = doc.data();
        setMyReadingsVisible(d.myReadingsVisible != null ? d.myReadingsVisible : false);
        setFullScheduleVisible(d.fullScheduleVisible != null ? d.fullScheduleVisible : false);
        setEasterDate(d.easterDate != null ? d.easterDate : null);
        if (d.fontSizeMultipliers) setFontSizeMultipliers(d.fontSizeMultipliers);
      },
      function(err) { console.warn("Pascha config listener failed:", err); }
    );
    var unsubSchedule = onSnapshot(
      doc(getFirestore(), "churches", churchId, "pascha", "schedule"),
      function(doc) {
        if (!isMounted.current) return;
        setAssignees(doc.exists ? doc.data() : {});
      },
      function(err) { console.warn("Pascha schedule listener failed:", err); }
    );
    return function() { unsubShell(); unsubConfig(); unsubSchedule(); };
  }, [churchId, ready]);

  useEffect(function() {
    if (!ready) return;
    if (!churchId) return;
    setLoadingUsers(true);
    var unsubC = onSnapshot(doc(getFirestore(), "churches", churchId), function(doc) {
      if (!isMounted.current || !doc.exists) return;
      setDeacons(
        (doc.data().deacons || [])
          .filter(function(d) { return d.name && d.uid; })
          .map(function(d) { return Object.assign({}, d, { isDeacon: true }); })
          .sort(function(a, b) { return a.name.localeCompare(b.name); })
      );
    }, function(err) { console.warn("Pascha manager church listener failed:", err); });
    var unsubU = onSnapshot(
      query(collection(getFirestore(), "users"), where("church", "==", churchId)),
      function(snap) {
        if (!isMounted.current) return;
        var users = snap.docs.map(function(d) { return Object.assign({ uid: d.id }, d.data()); })
          .filter(function(u) { return u.name; })
          .sort(function(a, b) { return a.name.localeCompare(b.name); });
        // Free: these docs are already loaded, so their photoURLs cost nothing.
        avatarCache.primeMany(users);
        setCongregation(users);
        setLoadingUsers(false);
      },
      function(err) {
        console.warn("Pascha manager users listener failed:", err);
        if (isMounted.current) setLoadingUsers(false);
      }
    );
    return function() { unsubC(); unsubU(); };
  }, [churchId, ready]);

  var writeConfig = useCallback(function(fields) {
    if (!churchId) return Promise.resolve();
    var ref = doc(getFirestore(), "churches", churchId, "pascha", "config");
    return updateDoc(ref, fields).catch(function(err) {
      if (err.code === "firestore/not-found") return setDoc(ref, fields);
      Alert.alert("Error", "Failed to save.");
      return Promise.resolve();
    });
  }, [churchId]);

  var writeSchedule = useCallback(function(fields) {
    if (!churchId) return Promise.resolve();
    var ref = doc(getFirestore(), "churches", churchId, "pascha", "schedule");
    return updateDoc(ref, fields).catch(function(err) {
      if (err.code === "firestore/not-found") return setDoc(ref, fields);
      Alert.alert("Error", "Failed to save.");
      return Promise.resolve();
    });
  }, [churchId]);

  var saveReading = useCallback(function(dayId, hourId, slotKey, person) {
    var value = person
      ? { uid: person.uid != null ? person.uid : null, name: person.name }
      : deleteField();
    return writeSchedule({ [dayId + "." + hourId + "." + slotKey]: value });
  }, [writeSchedule]);

  var savePsalmReaders = useCallback(function(dayId, hourId, readersKey, readers) {
    var value = readers.length > 0
      ? readers.map(function(r) { return { uid: r.uid != null ? r.uid : null, name: r.name }; })
      : deleteField();
    return writeSchedule({ [dayId + "." + hourId + "." + readersKey]: value });
  }, [writeSchedule]);

  var saveLanguage = useCallback(function(dayId, hourId, slotKey, lang) {
    return writeSchedule({ [dayId + "." + hourId + "." + langFirestoreKey(slotKey)]: lang });
  }, [writeSchedule]);

  var saveCopticToggle = useCallback(function(dayId, hourId, toggleKey, value) {
    var fields = {};
    fields[dayId + "." + hourId + "." + toggleKey] = value;
    if (value !== true) {
      var vernacularSlot = toggleKey.replace(/_coptic_enabled$/, "");
      fields[dayId + "." + hourId + "." + vernacularSlot + "_coptic"] = deleteField();
    }
    return writeSchedule(fields);
  }, [writeSchedule]);

  var doArchive = useCallback(function() {
    return getDoc(doc(getFirestore(), "churches", churchId, "pascha", "schedule_config"))
      .then(function(shellSnap) {
        var shellData = shellSnap.exists ? shellSnap.data() : null;
        return setDoc(
          doc(getFirestore(), "churches", churchId, "pascha", "archive_" + year),
          {
            schedule:      schedule,
            scheduleShell: shellData,
            easterDate:    easterDate,
            archivedAt:    serverTimestamp(),
          }
        );
      })
      .then(function() {
        return setDoc(doc(getFirestore(), "churches", churchId, "pascha", "schedule"), {});
      })
      .then(function() {
        return new Promise(function(resolve) { setTimeout(resolve, 600); });
      })
      .then(function() {
        setArchiveOpen(false);
        setSettingsOpen(false);
      })
      .catch(function(_err) {
        Alert.alert("Error", "Archive failed.");
      });
  }, [churchId, year, schedule, easterDate]);

  var ds = selectedId != null ? (schedule[selectedId] || {}) : {};

  return (
    <View style={mn.container}>
      <StatusBar barStyle="light-content" />

      {(!ready || !scheduleShell) ? (
        <SkeletonScreen
          variant="cards"
          count={6}
          showHeader={false}
          paddingTop={0}
          paddingHorizontal={0}
          bodyStyle={{ paddingHorizontal: gutter }}
          // The title is known before any read, so render the real header rather
          // than shimmering a placeholder that then shifts when data lands.
          header={
            <View style={[mn.header, { paddingHorizontal: gutter }]}>
              <View style={{ flex: 1 }}>
                <Text style={mn.eyebrow}>{"HOLY WEEK · PASCHA"}</Text>
                <Text style={[mn.title, tx(28, activeFontMultiplier)]}>Schedule</Text>
              </View>
            </View>
          }
        />
      ) : (
        <>
          <View style={[mn.header, { paddingHorizontal: gutter }]}>
            <View style={{ flex: 1 }}>
              <Text style={mn.eyebrow}>{"HOLY WEEK \u00B7 PASCHA"}</Text>
              <Text style={[mn.title, tx(28, activeFontMultiplier)]}>Schedule</Text>
            </View>
            <TouchableOpacity style={mn.cogBtn} onPress={function() { setSettingsOpen(true); }} activeOpacity={0.7}>
              <Icon name="cog-outline" size={20} color={T2} />
            </TouchableOpacity>
          </View>

          {!easterDate && (
            <TouchableOpacity style={[mn.nudge, { marginHorizontal: gutter }]} onPress={function() { setSettingsOpen(true); }} activeOpacity={0.8}>
              <Icon name="alert-circle-outline" size={14} color={ORANGE} />
              <Text style={mn.nudgeTxt}>Set Easter date in Settings</Text>
              <Icon name="chevron-right" size={13} color={ORANGE} />
            </TouchableOpacity>
          )}

          <DayTabBar
            allDays={allDays}
            selectedId={selectedId}
            easterDate={easterDate}
            schedule={schedule}
            onSelect={setSelectedId}
            fontScale={activeFontMultiplier}
            gutter={gutter}
          />

          {selectedDay != null && (
            <View style={[mn.dayHdr, { paddingHorizontal: gutter }]}>
              <View style={mn.dayHdrTop}>
                <View>
                  <Text style={[mn.dayTitle, tx(20, activeFontMultiplier)]}>{selectedDay.label}</Text>
                  {easterDate && (
                    <Text style={[mn.dayDate, tx(12, activeFontMultiplier)]}>{calcDate(easterDate, selectedDay.easterOffset)}</Text>
                  )}
                </View>
              </View>
              <View style={mn.progRow}>
                <View style={mn.progTrack}>
                  {(function() {
                    var dp = dayProgress(selectedDay, ds);
                    var pctVal = dp.total > 0 ? Math.round(dp.filled / dp.total * 100) : 0;
                    var allDone = dp.filled === dp.total && dp.total > 0;
                    return (
                      <View style={[mn.progFill, { width: pctVal + "%" }, allDone && { backgroundColor: GREEN }]} />
                    );
                  })()}
                </View>
                <Text style={[mn.progPct, tx(12, activeFontMultiplier)]}>
                  {(function() {
                    var dp = dayProgress(selectedDay, ds);
                    return dp.total > 0 ? (Math.round(dp.filled / dp.total * 100) + "%") : "0%";
                  })()}
                </Text>
              </View>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false}
            contentContainerStyle={[mn.scroll, { paddingHorizontal: gutter }]}>
            {chunk(selectedDay != null ? (selectedDay.hours || []) : [], columns).map(function(rowHours) {
              return (
                <View key={rowHours[0].id} style={mn.tileRow}>
                  {rowHours.map(function(hour) {
                    return (
                      <HourTile
                        key={hour.id}
                        style={mn.tileCell}
                        hour={hour}
                        hourAssignments={ds[hour.id] || {}}
                        dayId={selectedId}
                        deacons={deacons}
                        congregation={congregation}
                        loadingUsers={loadingUsers}
                        fontScale={activeFontMultiplier}
                        onSaveReading={function(hourId, slotKey, person) { return saveReading(selectedId, hourId, slotKey, person); }}
                        onSavePsalmReaders={function(hourId, readersKey, readers) { return savePsalmReaders(selectedId, hourId, readersKey, readers); }}
                        onSaveLanguage={function(hourId, slotKey, lang) { return saveLanguage(selectedId, hourId, slotKey, lang); }}
                        onSaveCopticToggle={function(hourId, toggleKey, value) { return saveCopticToggle(selectedId, hourId, toggleKey, value); }}
                        onOpenHour={function(hour) { setHourOpenRow(null); setHourOpen(hour); }}
                        onOpenReading={function(hour, row) { setHourOpenRow(row); setHourOpen(hour); }}
                      />
                    );
                  })}
                  {/* Keeps a short last row's cards the same width as the rows above. */}
                  {Array.from({ length: columns - rowHours.length }, function(_, k) {
                    return <View key={"pad" + k} style={mn.tileCell} />;
                  })}
                </View>
              );
            })}
          </ScrollView>
        </>
      )}

      <HourModal
        visible={!!hourOpen}
        hour={hourOpen}
        directRow={hourOpenRow}
        hourAssignments={hourOpen ? (ds[hourOpen.id] || {}) : {}}
        dayId={selectedId}
        deacons={deacons}
        congregation={congregation}
        loadingUsers={loadingUsers}
        fontScale={activeFontMultiplier}
        onSaveReading={function(hourId, slotKey, person) { return saveReading(selectedId, hourId, slotKey, person); }}
        onSavePsalmReaders={function(hourId, readersKey, readers) { return savePsalmReaders(selectedId, hourId, readersKey, readers); }}
        onSaveLanguage={function(hourId, slotKey, lang) { return saveLanguage(selectedId, hourId, slotKey, lang); }}
        onSaveCopticToggle={function(hourId, toggleKey, value) { return saveCopticToggle(selectedId, hourId, toggleKey, value); }}
        onClose={function() { setHourOpen(null); setHourOpenRow(null); }}
      />

      <SettingsSheet
        visible={settingsOpen}
        myReadingsVisible={myReadingsVisible}
        fullScheduleVisible={fullScheduleVisible}
        easterDate={easterDate}
        year={year}
        fontSizeScale={fontSizeScale}
        onSetFontSize={function(size) {
          setFontSizeScale(size);
          if (uid) {
            updateDoc(doc(getFirestore(), "users", uid), { paschaFontSize: size }).catch(function(_err) {});
          }
        }}
        onToggleMyReadings={function(v) { setMyReadingsVisible(v); writeConfig({ myReadingsVisible: v }); }}
        onToggleFullSchedule={function(v) { setFullScheduleVisible(v); writeConfig({ fullScheduleVisible: v }); }}
        onDateSave={function(date) {
          var iso = date.toISOString();
          setEasterDate(iso);
          writeConfig({ easterDate: iso });
        }}
        onViewArchives={function() { setSettingsOpen(false); setArchiveViewOpen(true); }}
        onArchivePress={function() { setSettingsOpen(false); setArchiveOpen(true); }}
        onClose={function() { setSettingsOpen(false); }}
      />

      <ArchiveConfirm
        visible={archiveOpen}
        year={year}
        onConfirm={doArchive}
        onClose={function() { setArchiveOpen(false); }}
      />

      <PaschaArchiveViewer
        visible={archiveViewOpen}
        churchId={churchId}
        onClose={function() { setArchiveViewOpen(false); }}
      />
    </View>
  );
}

var mn = StyleSheet.create({
  container:   { flex: 1, backgroundColor: BG },
  loadingWrap: { flex: 1, backgroundColor: BG, justifyContent: "center", alignItems: "center" },
  header:      { flexDirection: "row", alignItems: "center", paddingTop: 18, paddingBottom: 6 },
  eyebrow:     { fontSize: 11, fontWeight: "700", color: BLUE, letterSpacing: 1.5, marginBottom: 4 },
  title:       { fontSize: 28, fontWeight: "800", color: T1, letterSpacing: -0.5 },
  cogBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD,
                 justifyContent: "center", alignItems: "center" },
  nudge:       { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6, padding: 12, borderRadius: 12,
                 backgroundColor: "rgba(255,159,10,0.08)", borderWidth: 1,
                 borderColor: "rgba(255,159,10,0.18)" },
  nudgeTxt:    { flex: 1, fontSize: 13, color: ORANGE, fontWeight: "500" },
  dayHdr:      { paddingTop: 6, paddingBottom: 12 },
  dayHdrTop:   { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
                 marginBottom: 10 },
  dayTitle:    { fontSize: 20, fontWeight: "800", color: T1, letterSpacing: -0.3 },
  dayDate:     { fontSize: 12, color: T2, marginTop: 2 },
  progRow:     { flexDirection: "row", alignItems: "center", gap: 10 },
  progTrack:   { flex: 1, height: 3, backgroundColor: CARD2, borderRadius: 2, overflow: "hidden" },
  progFill:    { height: 3, backgroundColor: BLUE, borderRadius: 2 },
  progPct:     { fontSize: 12, fontWeight: "700", color: T3, minWidth: 36, textAlign: "right" },
  scroll:      { paddingBottom: 48, paddingTop: 4 },
  tileRow:     { flexDirection: "row", gap: TILE_GAP, marginBottom: TILE_GAP },
  // flexBasis 0 so every card in a row is the same width whatever its content;
  // the row's default stretch makes them the same height too.
  tileCell:    { flex: 1, flexBasis: 0 },
});