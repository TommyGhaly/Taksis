import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { DrawerContentScrollView } from "@react-navigation/drawer";
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
    ],
  },
];

export default function CustomDrawerContent(props) {
  const { state, navigation, shouldShowInDrawer } = props;
  const insets = useSafeAreaInsets();
  const activeRoute = state.routeNames[state.index];

  const renderMenuItem = (item, isActive) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.menuItem, isActive && styles.menuItemActive]}
      onPress={() => navigation.navigate(item.id)}
      activeOpacity={0.7}
    >
      {isActive && <View style={styles.activeBar} />}
      <View style={[styles.iconWrap, isActive ? styles.iconWrapActive : styles.iconWrapInactive]}>
        <Icon name={item.icon} size={18} color={isActive ? ACCENT : "#6e6e73"} />
      </View>
      <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  const renderSection = (section, index) => {
    const visibleItems = section.items.filter(item => {
      if (item.id === "Home") return true;
      if (!item.role) return true;
      return shouldShowInDrawer(item.role);
    });
    if (visibleItems.length === 0) return null;
    return (
      <View key={index} style={styles.section}>
        {section.title && <Text style={styles.sectionTitle}>{section.title}</Text>}
        {visibleItems.map(item => renderMenuItem(item, activeRoute === item.id))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <Icon name="cross-outline" size={17} color={ACCENT} />
        </View>
        <View>
          <Text style={styles.appName}>Taksis</Text>
          <Text style={styles.appTagline}>Manage your service</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Menu — flex:1 so it fills remaining space without scrolling */}
      <View style={styles.menuArea}>
        {menuSections.map(renderSection)}
      </View>

      {/* Footer */}
      <View style={styles.divider} />
      <View style={styles.footerRow}>
        <Text style={styles.footerLabel}>Taksis</Text>
        <Text style={styles.footerSub}>By TG</Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#1a1a1a" },

  header:          { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 22 },
  logoWrap:        { width: 36, height: 36, borderRadius: 10, backgroundColor: `${ACCENT}18`, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: `${ACCENT}30` },
  appName:         { fontSize: 18, fontWeight: "700", color: "#fff" },
  appTagline:      { fontSize: 12, color: "#6e6e73", marginTop: 1 },

  divider:         { height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginHorizontal: 16 },

  // flex:1 fills all remaining space; justifyContent spreads sections evenly
  menuArea:        { flex: 1, paddingVertical: 10 },
  section:         { marginBottom: 4 },
  sectionTitle:    { fontSize: 10, fontWeight: "700", color: "#48484a", textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 },

  menuItem:        { flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingHorizontal: 14, marginHorizontal: 8, borderRadius: 11, position: "relative", gap: 10 },
  menuItemActive:  { backgroundColor: `${ACCENT}18` },
  activeBar:       { position: "absolute", left: 0, top: "50%", marginTop: -9, width: 3, height: 18, borderTopRightRadius: 3, borderBottomRightRadius: 3, backgroundColor: ACCENT },
  iconWrap:        { width: 32, height: 32, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  iconWrapActive:  { backgroundColor: `${ACCENT}28` },
  iconWrapInactive:{ backgroundColor: "rgba(255,255,255,0.05)" },
  menuLabel:       { flex: 1, fontSize: 14, fontWeight: "500", color: "#8e8e93" },
  menuLabelActive: { color: "#fff", fontWeight: "600" },

  footerRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 14 },
  footerLabel:     { fontSize: 12, fontWeight: "600", color: "#48484a" },
  footerSub:       { fontSize: 11, color: "#3a3a3c", fontStyle: "italic" },
});