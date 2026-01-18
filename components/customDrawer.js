import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import Icon from "react-native-vector-icons/FontAwesome";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const menuSections = [
  {
    title: null, // No header for main section
    items: [
      { id: "Home", icon: "home", label: "Home" },
    ],
  },
  {
    title: "Schedules & Attendance",
    items: [
      { id: "Deacon Service Schedule", icon: "calendar", label: "Deacon Schedule", role: "schedule" },
      { id: "Sunday School Attendance", icon: "graduation-cap", label: "Sunday School", role: "sundaySchoolAttendance" },
      { id: "Hymns Class Attendance", icon: "music", label: "Hymns Class", role: "hymnsClassAttendance" },
      { id: "Servants Meeting Attendance", icon: "users", label: "Servants Meeting", role: "servantsMeetingTracker" },
    ],
  },
  {
    title: "Administration",
    items: [
      { id: "Edit Deacons", icon: "pencil-square-o", label: "Edit Deacons", role: "editDeacons" },
      { id: "Traffic Manager", icon: "car", label: "Traffic Manager", role: "trafficManager" },
      { id: "Servants Management", icon: "user-plus", label: "Servants Manager", role: "servantsManager" },
      { id: "Alhan Management", icon: "microphone", label: "Alhan Manager", role: "alhanManager" },
      { id: "Admin Manager", icon: "shield", label: "Admin Manager", role: "adminManager" },
    ],
  },
];

export default function CustomDrawerContent(props) {
  const { state, navigation, userRoles, shouldShowInDrawer } = props;
  const insets = useSafeAreaInsets();
  const activeRoute = state.routeNames[state.index];

  const renderMenuItem = (item, isActive) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.menuItem, isActive && styles.menuItemActive]}
      onPress={() => navigation.navigate(item.id)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, isActive && styles.iconContainerActive]}>
        <Icon name={item.icon} size={18} color={isActive ? "#147efb" : "#8e8e93"} />
      </View>
      <Text style={[styles.menuLabel, isActive && styles.menuLabelActive]}>
        {item.label}
      </Text>
      {isActive && <View style={styles.activeIndicator} />}
    </TouchableOpacity>
  );

  const renderSection = (section, index) => {
    const visibleItems = section.items.filter((item) => {
      if (item.id === "Home") return true;
      if (!item.role) return true;
      return shouldShowInDrawer(item.role);
    });

    if (visibleItems.length === 0) return null;

    return (
      <View key={index} style={styles.section}>
        {section.title && (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        {visibleItems.map((item) => renderMenuItem(item, activeRoute === item.id))}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome</Text>
        <Text style={styles.appTagline}>Manage your service</Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Menu sections */}
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {menuSections.map(renderSection)}
      </DrawerContentScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.divider} />
        <View style={styles.appInfo}>
          <Text style={styles.appName}>Taksis</Text>
          <Text style={styles.appVersion}>By TG</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  appTagline: {
    fontSize: 14,
    color: "#8e8e93",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginHorizontal: 16,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6e6e73",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    borderRadius: 12,
    position: "relative",
  },
  menuItemActive: {
    backgroundColor: "rgba(20, 126, 251, 0.12)",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  iconContainerActive: {
    backgroundColor: "rgba(20, 126, 251, 0.2)",
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
    color: "#c7c7cc",
  },
  menuLabelActive: {
    color: "#fff",
    fontWeight: "600",
  },
  activeIndicator: {
    position: "absolute",
    left: 0,
    top: "50%",
    marginTop: -10,
    width: 3,
    height: 20,
    backgroundColor: "#147efb",
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  footer: {
    paddingBottom: 20,
  },
  appInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  appName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6e6e73",
  },
  appVersion: {
    fontSize: 12,
    color: "#48484a",
    fontStyle: "italic",
  },
});