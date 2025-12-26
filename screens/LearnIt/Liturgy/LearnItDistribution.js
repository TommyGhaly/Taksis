import * as React from "react";
import { useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  Platform,
  Animated,
  Alert,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import hymnsData from "./Distribution.json";

const openUrl = async (url) => {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch (error) {
    Alert.alert("Error", "Failed to open the link. Please try again.");
  }
};

const LearnItDistribution = ({ navigation }) => {
  const headerAnim = useRef(new Animated.Value(0)).current;
  const itemAnimValues = useRef(hymnsData.map(() => new Animated.Value(0))).current;

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
        onPress={() => openUrl(item.url)}
      >
        <View style={styles.buttonContent}>
          <Text style={styles.buttonText}>{item.title}</Text>
          <Ionicons name="open-outline" size={18} color="rgba(255,255,255,0.3)" />
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
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </Pressable>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerSubtext}>DISTRIBUTION</Text>
          <Text style={styles.headerTitle}>Communion</Text>
        </View>
      </Animated.View>

      <FlatList
        data={hymnsData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
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
    backgroundColor: "rgba(255,255,255,0.08)",
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
    color: "#555",
    letterSpacing: 3,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 32,
    color: "#fff",
    fontWeight: "300",
    letterSpacing: 1,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  button: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
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
    color: "#fff",
    fontWeight: "600",
    flex: 1,
  },
});

export default LearnItDistribution;