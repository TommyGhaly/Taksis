import * as React from "react";
import { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  Platform,
  ScrollView,
  Animated,
  Alert,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import hymnsData from "./LiturgyFaithful.json";

const openUrl = async (url) => {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch (error) {
    Alert.alert("Error", "Failed to open the link. Please try again.");
  }
};

const LearnItLiturgyFaithful = ({ navigation }) => {
  const [expanded, setExpanded] = useState(null);
  const headerAnim = useRef(new Animated.Value(0)).current;
  const itemAnimValues = useRef(hymnsData.map(() => new Animated.Value(0))).current;
  const expandAnim = useRef({}).current;

  useEffect(() => {
    Animated.stagger(100, [
      Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
      ...itemAnimValues.map((anim) =>
        Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 })
      ),
    ]).start();
  }, []);

  const toggleExpand = (id) => {
    if (!expandAnim[id]) {
      expandAnim[id] = new Animated.Value(0);
    }

    if (expanded === id) {
      Animated.timing(expandAnim[id], {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(() => setExpanded(null));
    } else {
      if (expanded && expandAnim[expanded]) {
        expandAnim[expanded].setValue(0);
      }
      setExpanded(id);
      Animated.spring(expandAnim[id], {
        toValue: 1,
        tension: 100,
        friction: 10,
        useNativeDriver: false,
      }).start();
    }
  };

  const renderItem = ({ item, index }) => {
    const isExpanded = expanded === item.id;
    const hasSubOptions = item.subOptions && item.subOptions.length > 0;

    if (!expandAnim[item.id]) {
      expandAnim[item.id] = new Animated.Value(0);
    }

    const animValue = expandAnim[item.id];
    const subOptionCount = hasSubOptions ? item.subOptions.length : 0;
    const expandedHeight = Math.min(subOptionCount * 54 + 16, 250);

    return (
      <Animated.View
        style={[
          styles.animatedItem,
          {
            transform: [
              {
                translateY: itemAnimValues[index].interpolate({
                  inputRange: [0, 1],
                  outputRange: [30, 0],
                }),
              },
            ],
            opacity: itemAnimValues[index],
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.button,
            isExpanded && styles.buttonExpanded,
            { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
          onPress={() => toggleExpand(item.id)}
        >
          <View style={styles.buttonContent}>
            <Text style={styles.buttonText}>{item.title}</Text>
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: animValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "180deg"],
                    }),
                  },
                ],
              }}
            >
              <Ionicons name="chevron-down" size={20} color="rgba(255,255,255,0.4)" />
            </Animated.View>
          </View>
        </Pressable>

        {hasSubOptions && (
          <Animated.View
            style={[
              styles.expandedContainer,
              {
                maxHeight: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, expandedHeight],
                }),
                opacity: animValue,
                paddingVertical: animValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 8],
                }),
              },
            ]}
          >
            <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {item.subOptions.map((sub, idx) => (
                <Pressable
                  key={idx}
                  style={({ pressed }) => [
                    styles.subButton,
                    idx === item.subOptions.length - 1 && styles.subButtonLast,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => openUrl(sub.url)}
                >
                  <Text style={styles.subButtonText}>{sub.name}</Text>
                  <Ionicons name="open-outline" size={16} color="rgba(255,255,255,0.3)" />
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        )}
      </Animated.View>
    );
  };

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
          <Text style={styles.headerSubtext}>DIVINE LITURGY</Text>
          <Text style={styles.headerTitle}>Liturgy of the Faithful</Text>
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
    fontSize: 26,
    color: "#fff",
    fontWeight: "300",
    letterSpacing: 1,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
  },
  animatedItem: {
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  buttonExpanded: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
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
  expandedContainer: {
    backgroundColor: "#151515",
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  subButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e1e1e",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    marginTop: 2,
  },
  subButtonLast: {
    marginBottom: 2,
  },
  subButtonText: {
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "500",
    flex: 1,
  },
});

export default LearnItLiturgyFaithful;