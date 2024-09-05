import * as React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";

const LearnItMainMenu = ({ navigation }) => {
  return (
    <View style={styles.learnitmainmenu}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>LearnIt</Text>
      </View>
      <Pressable
        style={styles.option}
        onPress={() => {
          navigation.navigate("TesbehaMenu");
        }}
      >
        <Text style={styles.optionText}>Midnight Praises (Tesbeha)</Text>
      </Pressable>
      <Pressable
        style={styles.option}
        onPress={() => {
          navigation.navigate("LiturgyMenu");
        }}
      >
        <Text style={styles.optionText}>Liturgy</Text>
      </Pressable>
      <Pressable
        style={styles.option}
        onPress={() => {
          navigation.navigate("VespersMenu");
        }}
      >
        <Text style={styles.optionText}>Vespers (Ashaya)</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  learnitmainmenu: {
    backgroundColor: "#121212",  // Very dark grey background
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,  // Add some padding around
  },
  headerContainer: {
    marginBottom: 40,  // Space between header and options
    width: "100%",
    alignItems: "center",
  },
  headerText: {
    fontSize: 36,  // Large font size for the title
    color: "#ffffff",
    fontFamily: "Roboto-Bold",
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },
  option: {
    width: "100%",
    height: 80,
    backgroundColor: "#2c2c2c",  // Slightly lighter card background
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,  // Space between options
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  optionText: {
    fontSize: 26,  // Larger font size
    color: "#ffffff",  // White text color for better contrast
    fontFamily: "Roboto-Bold",
    textAlign: "center",
    lineHeight: 32,
    textShadowColor: "#000000",  // Text shadow for better visibility
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
});

export default LearnItMainMenu;
