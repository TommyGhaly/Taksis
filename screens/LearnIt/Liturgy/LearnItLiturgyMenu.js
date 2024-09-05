import * as React from "react";
import { Pressable, StyleSheet, View, Text } from "react-native";
import BackArrow from "../../../components/backArrow";

const LearnItLiturgyMenu = ({ navigation }) => {
  return (
    <View style={styles.learnitliturgymenu}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>Liturgy</Text>
      </View>
      <Pressable
        style={styles.option}
        onPress={() => {
          navigation.navigate("Matins");
        }}
      >
        <Text style={styles.optionText}>Matins</Text>
      </Pressable>
      <Pressable
        style={styles.option}
        onPress={() => {
          navigation.navigate("OfferingLamb");
        }}
      >
        <Text style={styles.optionText}>Offering of the Lamb</Text>
      </Pressable>
      <Pressable
        style={styles.option}
        onPress={() => {
          navigation.navigate("LiturgyWord");
        }}
      >
        <Text style={styles.optionText}>Liturgy of the Word</Text>
      </Pressable>
      <Pressable
        style={styles.option}
        onPress={() => {
          navigation.navigate("LiturgyFaithful");
        }}
      >
        <Text style={styles.optionText}>Liturgy of the Faithful</Text>
      </Pressable>
      <Pressable
        style={styles.option}
        onPress={() => {
          navigation.navigate("Distribution");
        }}
      >
        <Text style={styles.optionText}>Distribution</Text>
      </Pressable>
      <View style={styles.backbutton}>
        <BackArrow />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  learnitliturgymenu: {
    backgroundColor: "#121212",  // Very dark grey background
    flex: 1,
    padding: 20,  // Add padding for better spacing
    justifyContent: "center",
    alignItems: "center",
  },
  headerContainer: {
    marginBottom: 40,  // Space between header and options
  },
  headerText: {
    fontSize: 32,
    color: "#ffffff",
    fontFamily: "Roboto-Bold",
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },
  option: {
    width: "100%",
    height: 70,
    backgroundColor: "#1a1a1a",  // Slightly lighter card background
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,  // Space between options
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  optionText: {
    fontSize: 24,
    color: "#ffffff",  // White text color for better contrast
    fontFamily: "Roboto-Bold",
    textAlign: "center",
    lineHeight: 30,
    textShadowColor: "#000000",  // Text shadow for better visibility
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  backbutton: {
    position: "absolute",
    top: 20,
    left: 20,
  },
});

export default LearnItLiturgyMenu;
