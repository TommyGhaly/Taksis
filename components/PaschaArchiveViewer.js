import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View, Text, TouchableOpacity, Modal, ScrollView,
  StyleSheet, ActivityIndicator, Platform,
  Dimensions,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { collection, getDocs, getFirestore } from "@react-native-firebase/firestore";
import Avatar from "./Avatar";
import { SkeletonCardList } from "./Skeleton";
import {
  expandReadings, countSlots, dayProgress as dayTotals,
  isAssignableSlot, isPsalmSlot, hasLanguagePicker, effectiveLanguage, langShort,
  psalmReadersKey, READING_META,
} from "../screens/Pascha/PaschaReadingUtils";
import { DAY_SHORT_LABELS } from "../screens/Pascha/DayConstants";

var SCREEN_W = Dimensions.get("window").width;
var IS_TABLET = SCREEN_W >= 768;

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

// Background the old local Avatar painted behind the image. Module-level so the
// reference is stable and Avatar's React.memo still holds.
var AVATAR_BG = { backgroundColor: CARD3 };

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
        <Icon name={meta.icon} size={11} color={isCopticRow ? COPTIC_COLOR : meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
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
            <View style={{ gap: 3, alignItems: "flex-end" }}>
              {psalmReaders.map(function(r, i) {
                return (
                  <View key={r.uid || r.name || i} style={[rrS.chip, isCopticRow && rrS.chipCoptic]}>
                    <Avatar uid={r.uid} size={16} showBorder={false} style={AVATAR_BG} />
                    <Text style={[rrS.chipName, isCopticRow && rrS.chipNameCoptic]} numberOfLines={1}>{r.name}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={[rrS.chip, isCopticRow && rrS.chipCoptic]}>
              <Avatar uid={assignee.uid} size={16} showBorder={false} style={AVATAR_BG} />
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
row:            { flexDirection: "row", alignItems: "flex-start", paddingVertical: IS_TABLET ? 12 : 9, gap: 10 },
border:         { borderBottomWidth: 1, borderBottomColor: SEP },
iconBox:        { width: IS_TABLET ? 28 : 24, height: IS_TABLET ? 28 : 24, borderRadius: 7, justifyContent: "center", alignItems: "center", flexShrink: 0, marginTop: 1 },
type:           { fontSize: IS_TABLET ? 11 : 10, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
copticBadge:    { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: COPTIC_BG, borderWidth: 1, borderColor: COPTIC_BORDER },
copticBadgeTxt: { fontSize: 9, fontWeight: "800", color: COPTIC_COLOR, letterSpacing: 0.3 },
langBadge:      { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: CARD3 },
langBadgeTxt:   { fontSize: 9, fontWeight: "700", color: T3, letterSpacing: 0.3 },
ref:            { fontSize: IS_TABLET ? 13 : 12, color: T2, marginTop: 2, lineHeight: IS_TABLET ? 19 : 17 },
assigneeCol:    { alignItems: "flex-end", flexShrink: 0, maxWidth: "42%" },
chip:           { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(48,209,88,0.08)", borderWidth: 1, borderColor: "rgba(48,209,88,0.18)", borderRadius: 20, paddingVertical: IS_TABLET ? 4 : 3, paddingHorizontal: IS_TABLET ? 8 : 6 },
chipCoptic:     { backgroundColor: COPTIC_BG, borderColor: COPTIC_BORDER },
chipName:       { fontSize: IS_TABLET ? 12 : 11, fontWeight: "600", color: GREEN, maxWidth: 90 },
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
card:      { backgroundColor: CARD2, borderRadius: IS_TABLET ? 16 : 12, marginBottom: IS_TABLET ? 12 : 8, overflow: "hidden" },
cardTop:   { flexDirection: "row", alignItems: "center", padding: IS_TABLET ? 16 : 12, gap: 10 },
accent:    { width: 3, alignSelf: "stretch", borderRadius: 2, flexShrink: 0 },
label:     { flex: 1, fontSize: IS_TABLET ? 15 : 13, fontWeight: "700", color: T1 },
badge:     { paddingHorizontal: IS_TABLET ? 10 : 8, paddingVertical: IS_TABLET ? 4 : 3, borderRadius: 10, backgroundColor: CARD3 },
badgeGreen:{ backgroundColor: "rgba(48,209,88,0.1)", borderWidth: 1, borderColor: "rgba(48,209,88,0.25)" },
badgeTxt:  { fontSize: IS_TABLET ? 12 : 11, fontWeight: "700", color: T2 },
body:      { borderTopWidth: 1, borderTopColor: SEP, paddingHorizontal: IS_TABLET ? 16 : 12, paddingBottom: IS_TABLET ? 10 : 8 },
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
      scrollRef.current.scrollTo({ x: Math.max(0, selectedIndex * (IS_TABLET ? 78 : 68) - 80), animated: true });
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
content:     { paddingHorizontal: IS_TABLET ? 14 : 10, paddingVertical: IS_TABLET ? 12 : 8, gap: IS_TABLET ? 10 : 7, flexDirection: "row" },
tab:         { paddingHorizontal: IS_TABLET ? 14 : 10, paddingVertical: IS_TABLET ? 10 : 7, borderRadius: 12, backgroundColor: CARD, alignItems: "center", justifyContent: "center", minWidth: IS_TABLET ? 80 : 66, minHeight: IS_TABLET ? 70 : 56 },
tabActive:   { backgroundColor: BLUEDIM, borderWidth: 1, borderColor: "rgba(10,132,255,0.35)" },
dot:         { width: IS_TABLET ? 8 : 6, height: IS_TABLET ? 8 : 6, borderRadius: 4, marginBottom: IS_TABLET ? 6 : 4 },
dotGray:     { backgroundColor: T3 },
dotBlue:     { backgroundColor: BLUE },
dotGreen:    { backgroundColor: GREEN },
label:       { fontSize: IS_TABLET ? 13 : 11, fontWeight: "600", color: T2, textAlign: "center", lineHeight: IS_TABLET ? 17 : 14 },
labelActive: { color: BLUE, fontWeight: "700" },
date:        { fontSize: IS_TABLET ? 10 : 9, color: T3, marginTop: IS_TABLET ? 4 : 2 },
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
        <View style={ycS.iconBox}><Icon name="cross" size={IS_TABLET ? 20 : 17} color={ORANGE} /></View>
        <View style={{ flex: 1, marginLeft: IS_TABLET ? 14 : 12 }}>
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
card:     { backgroundColor: CARD, borderRadius: IS_TABLET ? 20 : 16, padding: IS_TABLET ? 18 : 14, borderWidth: 1, borderColor: SEP, marginBottom: IS_TABLET ? 14 : 10 },
top:      { flexDirection: "row", alignItems: "center", marginBottom: IS_TABLET ? 14 : 10 },
iconBox:  { width: IS_TABLET ? 46 : 38, height: IS_TABLET ? 46 : 38, borderRadius: IS_TABLET ? 14 : 11, backgroundColor: "rgba(255,159,10,0.1)", justifyContent: "center", alignItems: "center", flexShrink: 0 },
year:     { fontSize: IS_TABLET ? 19 : 16, fontWeight: "800", color: T1, letterSpacing: -0.3 },
sub:      { fontSize: IS_TABLET ? 13 : 11, color: T3, marginTop: 3 },
donePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, backgroundColor: "rgba(48,209,88,0.1)", borderWidth: 1, borderColor: "rgba(48,209,88,0.25)" },
doneTxt:  { fontSize: 11, fontWeight: "700", color: GREEN },
pct:      { fontSize: IS_TABLET ? 14 : 13, fontWeight: "700", color: T2 },
trackWrap:{ height: 4, backgroundColor: CARD2, borderRadius: 3, marginBottom: IS_TABLET ? 12 : 9 },
trackFill:{ height: 4, backgroundColor: BLUE, borderRadius: 3 },
dots:     { flexDirection: "row", gap: IS_TABLET ? 6 : 5, flexWrap: "wrap" },
dot:      { width: IS_TABLET ? 8 : 7, height: IS_TABLET ? 8 : 7, borderRadius: 4, backgroundColor: CARD3 },
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
    getDocs(collection(getFirestore(), "churches", churchId, "pascha"))
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

  var handleDaySelect = function(i) { setDayIndex(i); };

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={avS.overlay}>
        <View style={avS.sheet}>
          <View style={avS.handle} />
          <View style={avS.hdr}>
            {selectedYear ? (
              <TouchableOpacity style={avS.backBtn} onPress={function() { setSelectedYear(null); }} activeOpacity={0.7}>
                <Icon name="arrow-left" size={IS_TABLET ? 18 : 16} color={T1} />
              </TouchableOpacity>
            ) : (
              <View style={avS.iconBox}><Icon name="archive-outline" size={IS_TABLET ? 19 : 17} color={ORANGE} /></View>
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
            <SkeletonCardList count={5} height={64} />
          ) : archives.length === 0 ? (
            <View style={avS.center}>
              <View style={avS.emptyIconWrap}><Icon name="archive-off-outline" size={IS_TABLET ? 34 : 28} color={T3} /></View>
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
                  contentContainerStyle={avS.dayScroll}
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
sheet:         { backgroundColor: BG, borderTopLeftRadius: 30, borderTopRightRadius: 30, height: IS_TABLET ? "92%" : "96%", paddingBottom: Platform.OS === "ios" ? 36 : 24 },
handle:        { width: 42, height: 5, borderRadius: 3, backgroundColor: SEP, alignSelf: "center", marginTop: 12 },
hdr:           { flexDirection: "row", alignItems: "center", gap: IS_TABLET ? 14 : 12, paddingHorizontal: IS_TABLET ? 22 : 16, paddingTop: IS_TABLET ? 18 : 14, paddingBottom: IS_TABLET ? 16 : 12, borderBottomWidth: 1, borderBottomColor: SEP },
iconBox:       { width: IS_TABLET ? 40 : 34, height: IS_TABLET ? 40 : 34, borderRadius: IS_TABLET ? 12 : 10, backgroundColor: "rgba(255,159,10,0.12)", justifyContent: "center", alignItems: "center" },
backBtn:       { width: IS_TABLET ? 40 : 34, height: IS_TABLET ? 40 : 34, borderRadius: IS_TABLET ? 20 : 17, backgroundColor: CARD2, justifyContent: "center", alignItems: "center" },
title:         { fontSize: IS_TABLET ? 22 : 18, fontWeight: "800", color: T1, letterSpacing: -0.3 },
sub:           { fontSize: IS_TABLET ? 13 : 12, color: T2, marginTop: 2 },
xBtn:          { width: IS_TABLET ? 36 : 32, height: IS_TABLET ? 36 : 32, borderRadius: IS_TABLET ? 18 : 16, backgroundColor: CARD2, justifyContent: "center", alignItems: "center" },
center:        { flex: 1, justifyContent: "center", alignItems: "center", padding: IS_TABLET ? 36 : 24, gap: IS_TABLET ? 18 : 14 },
loadingTxt:    { fontSize: IS_TABLET ? 15 : 14, color: T2 },
emptyIconWrap: { width: IS_TABLET ? 80 : 64, height: IS_TABLET ? 80 : 64, borderRadius: IS_TABLET ? 40 : 32, backgroundColor: CARD2, justifyContent: "center", alignItems: "center" },
emptyTitle:    { fontSize: IS_TABLET ? 21 : 18, fontWeight: "700", color: T1 },
emptySub:      { fontSize: IS_TABLET ? 15 : 13, color: T2, textAlign: "center", lineHeight: IS_TABLET ? 23 : 20 },
sectionLabel:  { fontSize: IS_TABLET ? 13 : 11, fontWeight: "700", color: T3, letterSpacing: 1, textTransform: "uppercase", marginBottom: IS_TABLET ? 14 : 10 },
list:          { padding: IS_TABLET ? 18 : 14 },
dayScroll:     { padding: IS_TABLET ? 18 : 14, paddingTop: IS_TABLET ? 20 : 14, paddingBottom: 32 },
dayHeader:     { flexDirection: "row", alignItems: "flex-start", marginBottom: IS_TABLET ? 14 : 10 },
dayLabel:      { fontSize: IS_TABLET ? 22 : 18, fontWeight: "800", color: T1, letterSpacing: -0.3 },
dayDate:       { fontSize: IS_TABLET ? 13 : 12, color: T2, marginTop: 3 },
dayDonePill:   { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: "rgba(48,209,88,0.1)", borderWidth: 1, borderColor: "rgba(48,209,88,0.25)" },
dayDoneTxt:    { fontSize: 12, fontWeight: "700", color: GREEN },
dayPct:        { fontSize: IS_TABLET ? 16 : 14, fontWeight: "700", color: T2 },
dayTrackWrap:  { height: 4, backgroundColor: CARD2, borderRadius: 2, marginBottom: IS_TABLET ? 18 : 12 },
dayTrackFill:  { height: 4, backgroundColor: BLUE, borderRadius: 2 },
});

export default PaschaArchiveViewer;