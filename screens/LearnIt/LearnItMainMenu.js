import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, Animated, Platform } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const LearnItMainMenu = ({ navigation }) => {
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
          <Ionicons name="volume-high-outline" size={18} color="#888" style={{ marginRight: 8 }} />
          <Text style={styles.notificationText}>
            Some sections include audio recordings for practice
          </Text>
        </Animated.View>
      )}

      <View style={styles.content}>
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
                styles.option,
                { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
              ]}
            >
              <View style={styles.iconContainer}>
                {item.library === "material" ? (
                  <MaterialCommunityIcons name={item.icon} size={26} color="rgba(255,255,255,0.7)" />
                ) : (
                  <Ionicons name={item.icon} size={26} color="rgba(255,255,255,0.7)" />
                )}
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.optionText}>{item.title}</Text>
                {item.subtitle && <Text style={styles.optionSubtext}>{item.subtitle}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#121212",
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
    color: "#666",
    letterSpacing: 4,
    marginBottom: 8,
  },
  headerText: {
    fontSize: 42,
    color: "#fff",
    fontWeight: "300",
    letterSpacing: 1,
  },
  headerDivider: {
    width: 60,
    height: 2,
    backgroundColor: "#333",
    marginTop: 20,
    borderRadius: 1,
  },
  menuContainer: {
    gap: 12,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
  },
  optionText: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "600",
  },
  optionSubtext: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  notification: {
    position: "absolute",
    top: 10,
    left: 16,
    right: 16,
    backgroundColor: "rgba(40, 40, 40, 0.95)",
    padding: 14,
    borderRadius: 12,
    zIndex: 1000,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  notificationText: {
    color: "#E0E0E0",
    fontSize: 14,
  },
});

export default LearnItMainMenu;