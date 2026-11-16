import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Text, View, Pressable, Animated, Platform } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { makeStyles, useTheme, GlassSurface, useTabBarInset } from "../../theme";

const LearnItMainMenu = ({ navigation }) => {
  const styles = useStyles();
  const tabBarInset = useTabBarInset();
  const t = useTheme();
  const [showNotification, setShowNotification] = useState(false);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const hasShownNotification = useRef(false);

  const menuItems = [
    { title: "Liturgy", subtitle: "Divine Liturgy", screen: "LiturgyMenu", icon: "cross", library: "material" },
    { title: "Midnight Praises", subtitle: "Tasbeha", screen: "TasbehaMenu", icon: "moon-outline", library: "ionicons" },
    { title: "Vespers", subtitle: "Ashaya", screen: "VespersMenu", icon: "candle", library: "material" },
  ];

  useEffect(() => {
    // Only show notification once per mount
    if (hasShownNotification.current) return;
    hasShownNotification.current = true;

    setShowNotification(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 500,
          useNativeDriver: true,
        }).start(() => setShowNotification(false));
      }, 4000);
    });
  }, [slideAnim]);

  return (
    <View style={styles.container}>
      {showNotification && (
        <Animated.View style={[styles.notification, { transform: [{ translateY: slideAnim }] }]}>
          <Ionicons name="volume-high-outline" size={18} color={t.isDark ? "#888" : t.textMuted} style={{ marginRight: 8 }} />
          <Text style={styles.notificationText}>
            Some sections include audio recordings for practice
          </Text>
        </Animated.View>
      )}

      <View style={[styles.content, tabBarInset > 0 && { paddingBottom: 20 + tabBarInset }]}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerSubtext}>Ⲧⲁⲝⲓⲥ</Text>
          <Text style={styles.headerText}>Learn It</Text>
          <View style={styles.headerDivider} />
        </View>

        <View style={styles.menuContainer}>
          {menuItems.map((item) => (
            <Pressable
              key={item.screen}
              onPress={() => navigation.navigate(item.screen)}
              style={({ pressed }) => [
                { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <GlassSurface style={styles.option} interactive>
              <View style={styles.iconContainer}>
                {item.library === "material" ? (
                  <MaterialCommunityIcons name={item.icon} size={26} color={t.isDark ? "rgba(255,255,255,0.7)" : t.textSecondary} />
                ) : (
                  <Ionicons name={item.icon} size={26} color={t.isDark ? "rgba(255,255,255,0.7)" : t.textSecondary} />
                )}
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.optionText}>{item.title}</Text>
                {item.subtitle && <Text style={styles.optionSubtext}>{item.subtitle}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={20} color={t.isDark ? "rgba(255,255,255,0.3)" : t.textTertiary} />
              </GlassSurface>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
};

const useStyles = makeStyles((t) => ({
  container: {
    backgroundColor: t.background,
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  headerContainer: {
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    marginBottom: 50,
  },
  headerSubtext: {
    fontSize: 12,
    color: t.isDark ? "#666" : t.textMuted,
    letterSpacing: 4,
    marginBottom: 8,
  },
  headerText: {
    fontSize: 42,
    color: t.text,
    fontWeight: "300",
    letterSpacing: 1,
  },
  headerDivider: {
    width: 60,
    height: 2,
    backgroundColor: t.surfaceHighest,
    marginTop: 20,
    borderRadius: 1,
  },
  menuContainer: {
    gap: 12,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: t.surface,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.border,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: t.fill,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
  },
  optionText: {
    fontSize: 18,
    color: t.text,
    fontWeight: "600",
  },
  optionSubtext: {
    fontSize: 14,
    color: t.textSecondary,
    marginTop: 2,
  },
  notification: {
    position: "absolute",
    top: 10,
    left: 16,
    right: 16,
    backgroundColor: t.isDark ? "rgba(40, 40, 40, 0.95)" : "rgba(255, 255, 255, 0.95)",
    padding: 14,
    borderRadius: 12,
    zIndex: 1000,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: t.border,
  },
  notificationText: {
    color: t.isDark ? "#E0E0E0" : t.text,
    fontSize: 14,
  },
}));

export default LearnItMainMenu;