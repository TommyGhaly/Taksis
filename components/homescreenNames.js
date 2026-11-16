import React, { useState, useEffect, useRef } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Avatar from "./Avatar";
import { makeStyles, useTheme, GlassSurface } from "../theme";

// memo'd because HomeScreen rebuilds its readings/offerings arrays each render;
// without this every one of these rows remounts on any state change.
const HomeScreenNames = React.memo(({ role, user }) => {
  const styles = useStyles();
  const t = useTheme();
  const [expand, setExpand] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: expand ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: expand ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  }, [expand]);

  const getIconName = () => {
    if (role === "Water") {
      return "water";
    } else if (role === "Wine") {
      return "wine";
    } else if (role === "Altar") {
      return "people";
    } else {
      return "book";
    }
  };

  const expandedHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 150],
  });

  return (
    <Pressable onPress={() => setExpand(!expand)}>
     <GlassSurface style={styles.card} interactive>
      <View style={styles.contentContainer}>
        <Animated.View style={[styles.expandedContent, { height: expandedHeight, opacity: opacityAnim }]}>
          <Avatar
            uid={user?.uid}
            user={user}
            size={130}
            style={styles.profileImage}
            showBorder={false}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.row,
            {
              transform: [{ translateY: translateYAnim }],
            },
          ]}
        >
          <Ionicons name={getIconName()} size={24} color={t.isDark ? "rgba(255,255,255,0.7)" : t.textSecondary} style={styles.icon} />
          <Text style={styles.name}>
            {role}: {user?.name || "N/A"}
          </Text>
        </Animated.View>
      </View>
     </GlassSurface>
    </Pressable>
  );
});

HomeScreenNames.displayName = "HomeScreenNames";

// A glass card when Liquid Glass is on. There are 12–25 per schedule, which
// UIGlassEffect handles fine; the much longer attendance and roster lists stay
// solid.
const useStyles = makeStyles((t) => ({
  card: {
    backgroundColor: t.surface,
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: t.border,
  },
  contentContainer: {
    flexDirection: "column",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    marginRight: 10,
  },
  name: {
    fontSize: 18,
    color: t.text,
    fontWeight: "600",
  },
  expandedContent: {
    alignItems: "center",
    overflow: "hidden",
  },
  profileImage: {
    width: 130,
    height: 130,
    borderRadius: 65,
    marginTop: 0,
    borderWidth: 2,
    borderColor: t.borderStrong,
  },
  imagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginTop: 0,
    backgroundColor: t.isDark ? "#3c3c3c" : t.surfaceHighest,
    justifyContent: "center",
    alignItems: "center",
  },
  noImageText: {
    color: t.isDark ? "#e0e0e0" : t.textSecondary,
    fontSize: 14,
    textAlign: "center",
  },
}));

export default HomeScreenNames;