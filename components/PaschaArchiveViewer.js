import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  StyleSheet, ActivityIndicator, Image, Platform,
  Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import firestore from "@react-native-firebase/firestore";
import storage from "@react-native-firebase/storage";
import {
  expandReadings, countSlots, dayProgress as dayTotals,
  isAssignableSlot, isPsalmSlot, hasLanguagePicker, effectiveLanguage, langShort,
  psalmReadersKey, READING_META,
} from "../screens/Pascha/PaschaReadingUtils";
import { DAY_SHORT_LABELS } from "../screens/Pascha/DayConstants";

var DEFAULT_AVATAR = require("../assets/default_profile.png");
var SCREEN_W = Dimensions.get("window").width;

// ── Tokens ────────────────────────────────────────────────────────────────────
var BG      = "#0f0f0f";
var CARD    = "#1c1c1e";
var CARD2   = "#2c2c2e";
var CARD3   = "#3a3a3c";
var SEP     = "rgba(255,255,255,0.08)";
var BLUE    = "#0a84ff";
var BLUEDIM = "rgba(10,132,255,0.15)";
var GREEN   = "#30d158";
var ORANGE  = "#ff9f0a";
var T1      = "#ffffff";
var T2      = "rgba(255,255,255,0.65)";
var T3      = "rgba(255,255,255,0.28)";
var COPTIC_COLOR  = "#f59e0b";
var COPTIC_BG     = "rgba(245,158,11,0.10)";
var COPTIC_BORDER = "rgba(245,158,11,0.28)";

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

function calcDate(easter, offset) {
  if (!easter) return null;
  var d = new Date(easter);
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function fmtDate(ts) {
  if (!ts) return "";
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function allDaysFromArchive(arc) {
  var shell = arc.scheduleShell || arc.shell || null;
  if (shell && shell.days) return buildAllDays(shell);
  var ids = Object.keys(arc.schedule || {});
  return ids.map(function(id) {
    var hourKeys = Object.keys((arc.schedule || {})[id] || {});
    return {
      id: id,
      label: id.replace(/_/g, " ").replace(/\b\w/g, function(c) { return c.toUpperCase(); }),
      easterOffset: 0,
      shortLabel: DAY_SHORT_LABELS[id] != null
        ? DAY_SHORT_LABELS[id]
        : id.split("_").slice(0, 2).join(" "),
      hours: hourKeys.map(function(hid) {
        return { id: hid, label: hid, readings: {} };
      }),
    };
  });
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function useProfilePic(uid) {
  var _a = useState(null), uri = _a[0], setUri = _a[1];
  useEffect(function() {
    if (!uid) return;
    var cancelled = false;
    storage().ref("profilePictures/" + uid + ".png").getDownloadURL()
      .then(function(url) { if (!cancelled) setUri(url); })
      .catch(function() {});
    return function() { cancelled = true; };
  }, [uid]);
  return uri;
}

var Avatar = function(props) {
  var uid = props.uid;
  var size = props.size != null ? props.size : 24;
  var style = props.style;
  var uri = useProfilePic(uid);
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: CARD3 }, style]}>
      <Image source={uri ? { uri: uri } : DEFAULT_AVATAR} style={{ width: size, height: size }} resizeMode="cover" />
    </View>
  );
};

// ── Reading row ───────────────────────────────────────────────────────────────
var ReadingRow = function(props) {
  var row = props.row;
  var hourAssignments = props.hourAssignments;
  var isLast = props.isLast;
  var meta         = READING_META[row.rKey] || { label: row.rKey, icon: "book-outline", color: T2 };
  var isPsalm      = isPsalmSlot(row.rKey);
  var isHom        = row.rKey === "homily";
  var isExp        = row.rKey === "exposition";
  var isCopticRow  = row.isCoptic === true;

  var label;
  if (isHom)                  label = "Homily — " + (row.author || row.refText);
  else if (isExp)             label = "Exposition";
  else if (row.index != null) label = meta.label + " " + (row.index + 1);
  else                        label = meta.label;

  var psalmReaders = isPsalm ? (hourAssignments[psalmReadersKey(row)] || []) : [];
  var assignee     = !isPsalm ? (hourAssignments[row.slotKey] || null) : null;
  var hasAssign    = isPsalm ? psalmReaders.length > 0 : !!assignee;

  return (
    <View style={[rrS.row, !isLast && rrS.border]}>
      <View style={[rrS.iconBox, { backgroundColor: isCopticRow ? COPTIC_BG : meta.color + "20" }]}>
        <Icon name={meta.icon} size={12} color={isCopticRow ? COPTIC_COLOR : meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[rrS.type, { color: isCopticRow ? COPTIC_COLOR : meta.color }]}>{label}</Text>
          {isCopticRow
            ? <View style={rrS.copticBadge}><Text style={rrS.copticBadgeTxt}>COPTIC</Text></View>
            : hasLanguagePicker(row.rKey) && (
                <View style={rrS.langBadge}>
                  <Text style={rrS.langBadgeTxt}>{langShort(effectiveLanguage(row, hourAssignments))}</Text>
                </View>
              )
          }
        </View>
        {!!row.refText && !isHom && !isExp && (
          <Text style={rrS.ref} numberOfLines={2}>{row.refText}</Text>
        )}
      </View>
      <View style={rrS.assigneeCol}>
        {hasAssign ? (
          isPsalm ? (
            <View style={{ gap: 4, alignItems: "flex-end" }}>
              {psalmReaders.map(function(r, i) {
                return (
                  <View key={r.uid || r.name || i} style={[rrS.chip, isCopticRow && rrS.chipCoptic]}>
                    <Avatar uid={r.uid} size={18} />
                    <Text style={[rrS.chipName, isCopticRow && rrS.chipNameCoptic]} numberOfLines={1}>{r.name}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={[rrS.chip, isCopticRow && rrS.chipCoptic]}>
              <Avatar uid={assignee.uid} size={18} />
              <Text style={[rrS.chipName, isCopticRow && rrS.chipNameCoptic]} numberOfLines={1}>{assignee.name}</Text>
            </View>
          )
        ) : (
          <Text style={rrS.unassigned}>{"—"}</Text>
        )}
      </View>
    </View>
  );
};
const rrS = StyleSheet.create({
row:            { flexDirection: "row", alignItems: "flex-start", paddingVertical: 12, gap: 12 },
border:         { borderBottomWidth: 1, borderBottomColor: SEP },
iconBox:        { width: 28, height: 28, borderRadius: 8, justifyContent: "center", alignItems: "center", flexShrink: 0, marginTop: 1 },
type:           { fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
copticBadge:    { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: COPTIC_BG, borderWidth: 1, borderColor: COPTIC_BORDER },
copticBadgeTxt: { fontSize: 9, fontWeight: "800", color: COPTIC_COLOR, letterSpacing: 0.3 },
langBadge:      { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: CARD3 },
langBadgeTxt:   { fontSize: 9, fontWeight: "700", color: T3, letterSpacing: 0.3 },
ref:            { fontSize: 13, color: T2, marginTop: 3, lineHeight: 19 },
assigneeCol:    { alignItems: "flex-end", flexShrink: 0, maxWidth: "45%" },
chip:           { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(48,209,88,0.08)", borderWidth: 1, borderColor: "rgba(48,209,88,0.18)", borderRadius: 20, paddingVertical: 4, paddingHorizontal: 8 },
chipCoptic:     { backgroundColor: COPTIC_BG, borderColor: COPTIC_BORDER },
chipName:       { fontSize: 12, fontWeight: "600", color: GREEN, maxWidth: 100 },
chipNameCoptic: { color: COPTIC_COLOR },
unassigned:     { fontSize: 14, color: T3 },
});

// ── Hour card ─────────────────────────────────────────────────────────────────
var HourCard = function(props) {
  var hour = props.hour;
  var hourAssignments = props.hourAssignments;
  var rows              = expandReadings(hour, hourAssignments);
  var assignableRows    = rows.filter(function(r) { return isAssignableSlot(r.rKey) || isPsalmSlot(r.rKey); });
  var counts            = countSlots(hour, hourAssignments);
  var total             = counts.total;
  var filled            = counts.filled;
  var complete          = total > 0 && filled === total;
  var pct               = total > 0 ? Math.round(filled / total * 100) : 0;

  return (
    <View style={hcS.card}>
      <View style={hcS.cardTop}>
        <View style={[hcS.accent, { backgroundColor: complete ? GREEN : pct > 0 ? BLUE : CARD3 }]} />
        <Text style={hcS.label}>{hour.label}</Text>
        <View style={[hcS.badge, complete && hcS.badgeGreen]}>
          {complete
            ? <Icon name="check" size={10} color={GREEN} />
            : <Text style={hcS.badgeTxt}>{pct + "%"}</Text>
          }
        </View>
      </View>
      {assignableRows.length > 0 && (
        <View style={hcS.body}>
          {assignableRows.map(function(row, i) {
            return (
              <ReadingRow
                key={row.slotKey}
                row={row}
                hourAssignments={hourAssignments}
                isLast={i === assignableRows.length - 1}
              />
            );
          })}
        </View>
      )}
    </View>
  );
};
const hcS = StyleSheet.create({
card:      { backgroundColor: CARD2, borderRadius: 16, marginBottom: 12, overflow: "hidden" },
cardTop:   { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
accent:    { width: 4, alignSelf: "stretch", borderRadius: 2, flexShrink: 0 },
label:     { flex: 1, fontSize: 15, fontWeight: "700", color: T1 },
badge:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: CARD3 },
badgeGreen:{ backgroundColor: "rgba(48,209,88,0.1)", borderWidth: 1, borderColor: "rgba(48,209,88,0.25)" },
badgeTxt:  { fontSize: 12, fontWeight: "700", color: T2 },
body:      { borderTopWidth: 1, borderTopColor: SEP, paddingHorizontal: 16, paddingBottom: 10 },
});

// ── Day tab strip ─────────────────────────────────────────────────────────────
var DayTabStrip = function(props) {
  var days = props.days;
  var selectedIndex = props.selectedIndex;
  var schedule = props.schedule;
  var easterDate = props.easterDate;
  var onSelect = props.onSelect;
  var scrollRef = useRef(null);

  useEffect(function() {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ x: Math.max(0, selectedIndex * 78 - 80), animated: true });
    }
  }, [selectedIndex]);

  return (
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={tsS.content} style={tsS.bar}>
      {days.map(function(day, i) {
        var dt = dayTotals(day, schedule != null && schedule[day.id] != null ? schedule[day.id] : {});
        var complete = dt.total > 0 && dt.filled === dt.total;
        var started  = dt.filled > 0 && !complete;
        var active   = i === selectedIndex;
        var dateStr  = easterDate ? calcDate(easterDate, day.easterOffset) : null;
        return (
          <TouchableOpacity key={day.id} onPress={function() { onSelect(i); }}
            style={[tsS.tab, active && tsS.tabActive]} activeOpacity={0.75}>
            <View style={[tsS.dot, complete ? tsS.dotGreen : started ? tsS.dotBlue : tsS.dotGray]} />
            <Text style={[tsS.label, active && tsS.labelActive]} numberOfLines={2}
              adjustsFontSizeToFit minimumFontScale={0.65}>
              {day.shortLabel}
            </Text>
            {dateStr != null && <Text style={[tsS.date, active && tsS.dateActive]}>{dateStr}</Text>}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};
const tsS = StyleSheet.create({
bar:         { backgroundColor: BG, borderBottomWidth: 1, borderBottomColor: SEP },
content:     { paddingHorizontal: 14, paddingVertical: 12, gap: 10, flexDirection: "row" },
tab:         { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: CARD, alignItems: "center", justifyContent: "center", minWidth: 80, minHeight: 70 },
tabActive:   { backgroundColor: BLUEDIM, borderWidth: 1, borderColor: "rgba(10,132,255,0.35)" },
dot:         { width: 8, height: 8, borderRadius: 4, marginBottom: 6 },
dotGray:     { backgroundColor: T3 },
dotBlue:     { backgroundColor: BLUE },
dotGreen:    { backgroundColor: GREEN },
label:       { fontSize: 13, fontWeight: "600", color: T2, textAlign: "center", lineHeight: 17 },
labelActive: { color: BLUE, fontWeight: "700" },
date:        { fontSize: 10, color: T3, marginTop: 4 },
dateActive:  { color: "rgba(10,132,255,0.7)" },
});

// ── Year card ─────────────────────────────────────────────────────────────────
var YearCard = function(props) {
  var arc = props.arc;
  var onPress = props.onPress;
  var allDays = useMemo(function() { return allDaysFromArchive(arc); }, [arc]);
  var totals = useMemo(function() {
    var t = 0, f = 0;
    allDays.forEach(function(day) {
      var s = dayTotals(day, arc.schedule != null && arc.schedule[day.id] != null ? arc.schedule[day.id] : {});
      t += s.total; f += s.filled;
    });
    return { total: t, filled: f };
  }, [allDays, arc]);
  var pct      = totals.total > 0 ? Math.round(totals.filled / totals.total * 100) : 0;
  var complete = pct === 100;

  return (
    <TouchableOpacity style={ycS.card} onPress={onPress} activeOpacity={0.75}>
      <View style={ycS.top}>
        <View style={ycS.iconBox}><Icon name="cross" size={20} color={ORANGE} /></View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={ycS.year}>{"Pascha " + arc.year}</Text>
          {arc.archivedAt && <Text style={ycS.sub}>{"Archived " + fmtDate(arc.archivedAt)}</Text>}
        </View>
        {complete
          ? <View style={ycS.donePill}>
              <Icon name="check" size={10} color={GREEN} />
              <Text style={ycS.doneTxt}>Complete</Text>
            </View>
          : <Text style={ycS.pct}>{pct + "%"}</Text>
        }
        <Icon name="chevron-right" size={16} color={T3} style={{ marginLeft: 10 }} />
      </View>
      <View style={ycS.trackWrap}>
        <View style={[ycS.trackFill, { width: pct + "%" }, complete && { backgroundColor: GREEN }]} />
      </View>
      <View style={ycS.dots}>
        {allDays.map(function(d) {
          var s = dayTotals(d, arc.schedule != null && arc.schedule[d.id] != null ? arc.schedule[d.id] : {});
          var c = s.total > 0 && s.filled === s.total;
          var st = s.filled > 0 && !c;
          return <View key={d.id} style={[ycS.dot, c && ycS.dotGreen, st && ycS.dotBlue]} />;
        })}
      </View>
    </TouchableOpacity>
  );
};
const ycS = StyleSheet.create({
card:     { backgroundColor: CARD, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: SEP, marginBottom: 14 },
top:      { flexDirection: "row", alignItems: "center", marginBottom: 14 },
iconBox:  { width: 46, height: 46, borderRadius: 14, backgroundColor: "rgba(255,159,10,0.1)", justifyContent: "center", alignItems: "center", flexShrink: 0 },
year:     { fontSize: 19, fontWeight: "800", color: T1, letterSpacing: -0.3 },
sub:      { fontSize: 13, color: T3, marginTop: 3 },
donePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(48,209,88,0.1)", borderWidth: 1, borderColor: "rgba(48,209,88,0.25)" },
doneTxt:  { fontSize: 11, fontWeight: "700", color: GREEN },
pct:      { fontSize: 14, fontWeight: "700", color: T2 },
trackWrap:{ height: 5, backgroundColor: CARD2, borderRadius: 3, marginBottom: 12 },
trackFill:{ height: 5, backgroundColor: BLUE, borderRadius: 3 },
dots:     { flexDirection: "row", gap: 6, flexWrap: "wrap" },
dot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: CARD3 },
dotGreen: { backgroundColor: GREEN },
dotBlue:  { backgroundColor: BLUE },
});

// ── Main ──────────────────────────────────────────────────────────────────────
var PaschaArchiveViewer = function(props) {
  var visible = props.visible;
  var churchId = props.churchId;
  var onClose = props.onClose;

  var _archives = useState([]);
  var archives = _archives[0]; var setArchives = _archives[1];
  var _loading = useState(false);
  var loading = _loading[0]; var setLoading = _loading[1];
  var _selectedYear = useState(null);
  var selectedYear = _selectedYear[0]; var setSelectedYear = _selectedYear[1];
  var _dayIndex = useState(0);
  var dayIndex = _dayIndex[0]; var setDayIndex = _dayIndex[1];

  useEffect(function() {
    if (!visible || !churchId) return;
    setLoading(true); setSelectedYear(null); setDayIndex(0); setArchives([]);
    firestore().collection("churches").doc(churchId).collection("pascha").get()
      .then(function(snap) {
        var found = [];
        snap.forEach(function(doc) {
          if (!doc.id.startsWith("archive_")) return;
          var data = doc.data();
          found.push(Object.assign({ year: doc.id.replace("archive_", "") }, data));
        });
        found.sort(function(a, b) { return b.year - a.year; });
        setArchives(found);
      })
      .catch(function() {})
      .finally(function() { setLoading(false); });
  }, [visible, churchId]);

  var selected = useMemo(function() {
    return archives.find(function(a) { return a.year === selectedYear; }) || null;
  }, [archives, selectedYear]);

  var selectedAllDays = useMemo(function() {
    return selected ? allDaysFromArchive(selected) : [];
  }, [selected]);

  var currentDay = selectedAllDays[dayIndex] || null;
  var currentDaySchedule = selected && currentDay
    ? (selected.schedule != null && selected.schedule[currentDay.id] != null ? selected.schedule[currentDay.id] : {})
    : {};

  var handleDaySelect = function(i) {
    setDayIndex(i);
  };

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={avS.overlay}>
        <View style={avS.sheet}>
          <View style={avS.handle} />
          <View style={avS.hdr}>
            {selectedYear ? (
              <TouchableOpacity style={avS.backBtn} onPress={function() { setSelectedYear(null); }} activeOpacity={0.7}>
                <Icon name="arrow-left" size={18} color={T1} />
              </TouchableOpacity>
            ) : (
              <View style={avS.iconBox}><Icon name="archive-outline" size={19} color={ORANGE} /></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={avS.title}>{selectedYear ? ("Pascha " + selectedYear) : "Archived Schedules"}</Text>
              {selected && selected.archivedAt && <Text style={avS.sub}>{"Archived " + fmtDate(selected.archivedAt)}</Text>}
            </View>
            <TouchableOpacity style={avS.xBtn} onPress={onClose} activeOpacity={0.7}>
              <Icon name="close" size={17} color={T2} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={avS.center}>
              <ActivityIndicator color={ORANGE} size="large" />
              <Text style={avS.loadingTxt}>{"Loading archives…"}</Text>
            </View>
          ) : archives.length === 0 ? (
            <View style={avS.center}>
              <View style={avS.emptyIconWrap}><Icon name="archive-off-outline" size={34} color={T3} /></View>
              <Text style={avS.emptyTitle}>No Archives Yet</Text>
              <Text style={avS.emptySub}>Archive a schedule from Settings to see it here.</Text>
            </View>
          ) : !selectedYear ? (
            <ScrollView contentContainerStyle={avS.list} showsVerticalScrollIndicator={false}>
              <Text style={avS.sectionLabel}>
                {archives.length + " archived year" + (archives.length > 1 ? "s" : "")}
              </Text>
              {archives.map(function(a) {
                return (
                  <YearCard key={a.year} arc={a} onPress={function() { setSelectedYear(a.year); setDayIndex(0); }} />
                );
              })}
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>
              <DayTabStrip
                days={selectedAllDays}
                selectedIndex={dayIndex}
                schedule={selected.schedule}
                easterDate={selected.easterDate}
                onSelect={handleDaySelect}
              />
              {currentDay != null ? (
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ padding: 18, paddingTop: 20, paddingBottom: 32 }}
                  key={currentDay.id}
                >
                  <View style={avS.dayHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={avS.dayLabel}>{currentDay.label}</Text>
                      {selected.easterDate && (
                        <Text style={avS.dayDate}>{calcDate(selected.easterDate, currentDay.easterOffset)}</Text>
                      )}
                    </View>
                    {(function() {
                      var dt = dayTotals(currentDay, currentDaySchedule);
                      var p = dt.total > 0 ? Math.round(dt.filled / dt.total * 100) : 0;
                      var done = dt.total > 0 && dt.filled === dt.total;
                      return done
                        ? <View style={avS.dayDonePill}>
                            <Icon name="check" size={11} color={GREEN} />
                            <Text style={avS.dayDoneTxt}>Complete</Text>
                          </View>
                        : <Text style={avS.dayPct}>{p + "%"}</Text>;
                    })()}
                  </View>
                  <View style={avS.dayTrackWrap}>
                    {(function() {
                      var dt = dayTotals(currentDay, currentDaySchedule);
                      var p = dt.total > 0 ? Math.round(dt.filled / dt.total * 100) : 0;
                      var done = dt.total > 0 && dt.filled === dt.total;
                      return <View style={[avS.dayTrackFill, { width: p + "%" }, done && { backgroundColor: GREEN }]} />;
                    })()}
                  </View>
                  {(currentDay.hours || []).map(function(h) {
                    return (
                      <HourCard
                        key={h.id}
                        hour={h}
                        hourAssignments={currentDaySchedule[h.id] || {}}
                      />
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={avS.center}>
                  <Text style={avS.loadingTxt}>No data for this day</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const avS = StyleSheet.create({
overlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
sheet:         { backgroundColor: BG, borderTopLeftRadius: 30, borderTopRightRadius: 30, height: "92%", paddingBottom: Platform.OS === "ios" ? 36 : 24 },
handle:        { width: 42, height: 5, borderRadius: 3, backgroundColor: SEP, alignSelf: "center", marginTop: 14 },
hdr:           { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: SEP },
iconBox:       { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,159,10,0.12)", justifyContent: "center", alignItems: "center" },
backBtn:       { width: 40, height: 40, borderRadius: 20, backgroundColor: CARD2, justifyContent: "center", alignItems: "center" },
title:         { fontSize: 22, fontWeight: "800", color: T1, letterSpacing: -0.3 },
sub:           { fontSize: 13, color: T2, marginTop: 3 },
xBtn:          { width: 36, height: 36, borderRadius: 18, backgroundColor: CARD2, justifyContent: "center", alignItems: "center" },
center:        { flex: 1, justifyContent: "center", alignItems: "center", padding: 36, gap: 18 },
loadingTxt:    { fontSize: 15, color: T2 },
emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: CARD2, justifyContent: "center", alignItems: "center" },
emptyTitle:    { fontSize: 21, fontWeight: "700", color: T1 },
emptySub:      { fontSize: 15, color: T2, textAlign: "center", lineHeight: 23 },
sectionLabel:  { fontSize: 13, fontWeight: "700", color: T3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 },
list:          { padding: 18 },
dayHeader:     { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
dayLabel:      { fontSize: 22, fontWeight: "800", color: T1, letterSpacing: -0.3 },
dayDate:       { fontSize: 13, color: T2, marginTop: 4 },
dayDonePill:   { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: "rgba(48,209,88,0.1)", borderWidth: 1, borderColor: "rgba(48,209,88,0.25)" },
dayDoneTxt:    { fontSize: 12, fontWeight: "700", color: GREEN },
dayPct:        { fontSize: 16, fontWeight: "700", color: T2 },
dayTrackWrap:  { height: 4, backgroundColor: CARD2, borderRadius: 2, marginBottom: 18 },
dayTrackFill:  { height: 4, backgroundColor: BLUE, borderRadius: 2 },
});

export default PaschaArchiveViewer;