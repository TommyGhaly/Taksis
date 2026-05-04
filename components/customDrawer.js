import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ACCENT = "#147efb";

const menuSections = [
  {
    title: null,
    items: [
      { id: "Home", icon: "home-outline", label: "Home" },
    ],
  },
  {
    title: "Schedules & Attendance",
    items: [
      { id: "Deacon Service Schedule",      icon: "calendar-month-outline", label: "Deacon Schedule",   role: "schedule"               },
      { id: "Sunday School Attendance",     icon: "school-outline",         label: "Sunday School",     role: "sundaySchoolAttendance" },
      { id: "Hymns Class Attendance",       icon: "music-note-outline",     label: "Hymns Class",       role: "hymnsClassAttendance"   },
      { id: "Servants Meeting Attendance",  icon: "account-group-outline",  label: "Servants Meeting",  role: "servantsMeetingTracker" },
    ],
  },
  {
    title: "Administration",
    items: [
      { id: "Edit Deacons",        icon: "account-edit-outline",   label: "Edit Deacons",     role: "editDeacons"     },
      { id: "Traffic Manager",     icon: "car-outline",            label: "Traffic Manager",  role: "trafficManager"  },
      { id: "Pascha Manager",      icon: "cross-outline",          label: "Pascha Manager",   role: "paschaManager"   },
      { id: "Servants Management", icon: "account-plus-outline",   label: "Servants Manager", role: "servantsManager" },
      { id: "Alhan Management",    icon: "microphone-outline",     label: "Alhan Manager",    role: "alhanManager"    },
      { id: "Admin Manager",       icon: "shield-account-outline", label: "Admin Manager",    role: "adminManager"    },
      { id: "Database Manager",    icon: "database-outline",       label: "Database Manager", role: "databaseManager" },
    ],
  },
];

// Reference sizes — what the drawer looks like at full (1.0) density.
const REF = {
  itemHeight: 53,
  sectionTitleHeight: 34,
  sectionMarginBottom: 4,
  iconWrap: 32,
  iconSize: 18,
  labelFont: 14,
  sectionTitleFont: 10,
  itemPaddingV: 11,
  itemPaddingH: 14,
  menuPaddingV: 10,
  headerHeight: 80,
  footerHeight: 46,
  dividerSpace: 2,
};

// Compute scale so total content fits in availableHeight without scrolling.
// Returns 1.0 when there's room, down to ~0.65 minimum so it stays usable.
function computeScale(availableHeight, sections) {
  let needed = REF.headerHeight + REF.footerHeight + REF.dividerSpace * 2 + REF.menuPaddingV * 2;
  for (const sec of sections) {
    if (sec.items.length === 0) continue;
    if (sec.title) needed += REF.sectionTitleHeight;
    needed += sec.items.length * REF.itemHeight;
    needed += REF.sectionMarginBottom;
  }
  if (needed <= availableHeight) return 1;
  const raw = availableHeight / needed;
  return Math.max(0.65, raw);
}

export default function CustomDrawerContent(props) {
  const { state, navigation, shouldShowInDrawer } = props;
  const insets = useSafeAreaInsets();
  const activeRoute = state.routeNames[state.index];

  const [drawerHeight, setDrawerHeight] = useState(0);

  // Compute visible sections once so scaling is based on what actually renders.
  const visibleSections = useMemo(() => {
    return menuSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (item.id === "Home") return true;
          if (!item.role) return true;
          return shouldShowInDrawer(item.role);
        }),
      }))
      .filter((s) => s.items.length > 0);
  }, [shouldShowInDrawer]);

  const usable = drawerHeight - insets.top - insets.bottom - 12;
  const scale = drawerHeight > 0 ? computeScale(usable, visibleSections) : 1;
  const styles = useMemo(() => makeStyles(scale), [scale]);

  const renderMenuItem = (item, isActive) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.menuItem, isActive && styles.menuItemActive]}
      onPress={() => navigation.navigate(item.id)}
      activeOpacity={0.7}
    >
      {isActive && <View style={styles.activeBar} />}
      <View style={[styles.iconWrap, isActive ? styles.iconWrapActive : styles.iconWrapInactive]}>
        <Icon name={item.icon} size={Math.round(REF.iconSize * scale)} color={isActive ? ACCENT : "#6e6e73"} />
      </View>
      <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  const renderSection = (section, index) => (
    <View key={index} style={styles.section}>
      {section.title && <Text style={styles.sectionTitle}>{section.title}</Text>}
      {section.items.map((item) => renderMenuItem(item, activeRoute === item.id))}
    </View>
  );

  return (
    <View
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}
      onLayout={(e) => setDrawerHeight(e.nativeEvent.layout.height)}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <Icon name="cross-outline" size={Math.round(17 * scale)} color={ACCENT} />
        </View>
        <View>
          <Text style={styles.appName}>Ⲧⲁⲝⲓⲥ</Text>
          <Text style={styles.appTagline}>Manage your service</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Menu */}
      <View style={styles.menuArea}>
        {visibleSections.map(renderSection)}
      </View>

      {/* Footer */}
      <View style={styles.divider} />
      <View style={styles.footerRow}>
        <Text style={styles.footerLabel}>Ⲧⲁⲝⲓⲥ</Text>
        <Text style={styles.footerSub}>By TG</Text>
      </View>
    </View>
  );
}

// Styles produced from the scale factor so every density-sensitive dimension
// shrinks together when there are too many items to fit.
const makeStyles = (scale) => {
  const s = (n) => Math.round(n * scale);
  const iconWrap = s(REF.iconWrap);

  return StyleSheet.create({
    container:       { flex: 1, backgroundColor: "#1a1a1a" },

    header:          { flexDirection: "row", alignItems: "center", gap: s(12), paddingHorizontal: 18, paddingVertical: s(22) },
    logoWrap:        { width: s(36), height: s(36), borderRadius: 10, backgroundColor: `${ACCENT}18`, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: `${ACCENT}30` },
    appName:         { fontSize: s(18), fontWeight: "700", color: "#fff" },
    appTagline:      { fontSize: s(12), color: "#6e6e73", marginTop: 1 },

    divider:         { height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginHorizontal: 16 },

    menuArea:        { flex: 1, paddingVertical: s(REF.menuPaddingV) },
    section:         { marginBottom: s(REF.sectionMarginBottom) },
    sectionTitle:    {
      fontSize: Math.max(9, s(REF.sectionTitleFont)),
      fontWeight: "700", color: "#48484a", textTransform: "uppercase", letterSpacing: 0.8,
      paddingHorizontal: 20, paddingTop: s(18), paddingBottom: s(6),
    },

    menuItem:        {
      flexDirection: "row", alignItems: "center",
      paddingVertical: s(REF.itemPaddingV), paddingHorizontal: s(REF.itemPaddingH),
      marginHorizontal: 8, borderRadius: 11, position: "relative", gap: s(10),
    },
    menuItemActive:  { backgroundColor: `${ACCENT}18` },
    activeBar:       {
      position: "absolute", left: 0, top: "50%", marginTop: -s(9),
      width: 3, height: s(18),
      borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: ACCENT,
    },
    iconWrap:        { width: iconWrap, height: iconWrap, borderRadius: 9, justifyContent: "center", alignItems: "center" },
    iconWrapActive:  { backgroundColor: `${ACCENT}28` },
    iconWrapInactive:{ backgroundColor: "rgba(255,255,255,0.05)" },
    menuLabel:       { flex: 1, fontSize: Math.max(12, s(REF.labelFont)), fontWeight: "500", color: "#8e8e93" },
    menuLabelActive: { color: "#fff", fontWeight: "600" },

    footerRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: s(14) },
    footerLabel:     { fontSize: s(12), fontWeight: "600", color: "#48484a" },
    footerSub:       { fontSize: s(11), color: "#3a3a3c", fontStyle: "italic" },
  });
};