import * as React from "react";
import { useRef, useEffect } from "react";
import {
  Pressable,
  View,
  Text,
  Animated,
  Platform,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme, useTabBarInset } from "../../../theme";

const menuItems = [
  { screen: "Matins", label: "Matins" },
  { screen: "OfferingLamb", label: "Offering of the Lamb" },
  { screen: "LiturgyWord", label: "Liturgy of the Word" },
  { screen: "LiturgyFaithful", label: "Liturgy of the Faithful" },
  { screen: "Distribution", label: "Distribution" },
];

const LearnItLiturgyMenu = ({ navigation }) => {
  const styles = useStyles();
  const t = useTheme();
  const tabBarInset = useTabBarInset();
  const headerAnim = useRef(new Animated.Value(0)).current;
  const itemAnimValues = useRef(menuItems.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
      ...itemAnimValues.map((anim) =>
        Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 })
      ),
    ]).start();
  }, []);

  const renderItem = ({ item, index }) => (
    <Animated.View
      style={{
        transform: [
          {
            translateY: itemAnimValues[index].interpolate({
              inputRange: [0, 1],
              outputRange: [30, 0],
            }),
          },
        ],
        opacity: itemAnimValues[index],
        marginBottom: 12,
      }}
    >
      <Pressable
        style={({ pressed }) => [
          styles.button,
          { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        ]}
        onPress={() => navigation.navigate(item.screen)}
      >
        <View style={styles.buttonContent}>
          <Text style={styles.buttonText}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={20} color={t.textTertiary} />
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.headerContainer,
          {
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
            opacity: headerAnim,
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.6 : 1 }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={t.text} />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerSubtext}>DIVINE LITURGY</Text>
          <Text style={styles.headerTitle}>Liturgy</Text>
        </View>
      </Animated.View>

      <FlatList
        data={menuItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.screen}
        contentContainerStyle={[styles.listContainer, { paddingBottom: 40 + tabBarInset }]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const useStyles = makeStyles((t) => ({
  container: {
    flex: 1,
    backgroundColor: t.background,
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 55 : 35,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.fill,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    marginRight: 36,
  },
  headerSubtext: {
    fontSize: 11,
    color: t.isDark ? "#555" : t.textMuted,
    letterSpacing: 3,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 32,
    color: t.text,
    fontWeight: "300",
    letterSpacing: 1,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  button: {
    backgroundColor: t.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: t.border,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  buttonText: {
    fontSize: 17,
    color: t.text,
    fontWeight: "600",
    flex: 1,
  },
}));

export default LearnItLiturgyMenu;