import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, Pressable, Animated, Platform } from "react-native";

const LearnItMainMenu = ({ navigation }) => {
  const [showNotification, setShowNotification] = useState(false);
  const slideAnim = useRef(new Animated.Value(-100)).current; // Start off-screen

  useEffect(() => {
    // Show notification on component mount
    setShowNotification(true);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(() => {
      // Auto-dismiss after 4 seconds
      setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          setShowNotification(false);
        });
      }, 5000);
    });

    // Reset notification when screen is focused (simulating app refresh)
    const unsubscribe = navigation.addListener("focus", () => {
      setShowNotification(false); // Reset to allow showing again
    });

    return unsubscribe;
  }, [navigation, slideAnim]);

  return (
    <View style={styles.learnitmainmenu}>
      {showNotification && (
        <Animated.View style={[styles.notification, { transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.notificationText}>
            Some links may have audio recordings to help practice.
          </Text>
        </Animated.View>
      )}
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Learn It</Text>
      </View>
      <Pressable
        style={styles.option}
        onPress={() => navigation.navigate("LiturgyMenu")}
      >
        <Text style={styles.optionText}>Liturgy</Text>
      </Pressable>
      <Pressable
        style={styles.option}
        onPress={() => navigation.navigate("TasbehaMenu")}
      >
        <Text style={styles.optionText}>Midnight Praises (Tasbeha)</Text>
      </Pressable>
      <Pressable
        style={styles.option}
        onPress={() => navigation.navigate("VespersMenu")}
      >
        <Text style={styles.optionText}>Vespers (Ashaya)</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  learnitmainmenu: {
    backgroundColor: "#121212",
    flex: 1,
    alignItems: "center",
    padding: 20,
  },
  headerContainer: {
    marginBottom: 40,
    width: "100%",
    alignItems: "center",
    paddingTop: 50,
  },
  headerText: {
    fontSize: 36,
    color: "#ffffff",
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },
  option: {
    width: "100%",
    height: 80,
    backgroundColor: "#2c2c2c",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  optionText: {
    fontSize: 26,
    color: "#ffffff",
    textAlign: "center",
    fontWeight: "700",
    lineHeight: 32,
  },
  notification: {
    position: "absolute",
    top: Platform.OS === "ios" ? 40 : 20, // Adjust for iOS safe area
    left: 20,
    right: 20,
    backgroundColor: "#2c2c2c",
    padding: 15,
    borderRadius: 10,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  notificationText: {
    color: "#ffffff",
    fontSize: 16,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "System" : "Roboto",
  },
});

export default LearnItMainMenu;