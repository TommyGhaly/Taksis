import * as React from "react";
import { StyleSheet, View, Text, Pressable, ScrollView } from "react-native";
import BackArrow from "../../../components/backArrow";

const LearnItTesbehaMenu = ({ navigation }) => {
  return (
    <View style={styles.learnittesbehamenu}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.backbutton}>
          <BackArrow />
        </View>
        <View style={styles.headerContainer}>
          <Text style={styles.headerText}>Tesbeha</Text>
        </View>
        <Pressable
          style={styles.option}
          onPress={() => {
            navigation.navigate("Introduction");
          }}
        >
          <Text style={styles.optionText}>Introduction</Text>
        </Pressable>
        <Pressable
          style={styles.option}
          onPress={() => {
            navigation.navigate("FirstCanticle");
          }}
        >
          <Text style={styles.optionText}>First Canticle</Text>
        </Pressable>
        <Pressable
          style={styles.option}
          onPress={() => {
            navigation.navigate("SecondCanticle");
          }}
        >
          <Text style={styles.optionText}>Second Canticle</Text>
        </Pressable>
        <Pressable
          style={styles.option}
          onPress={() => {
            navigation.navigate("ThirdCanticle");
          }}
        >
          <Text style={styles.optionText}>Third Canticle</Text>
        </Pressable>
        <Pressable
          style={styles.option}
          onPress={() => {
            navigation.navigate("Commemoration");
          }}
        >
          <Text style={styles.optionText}>The Commemoration</Text>
        </Pressable>
        <Pressable
          style={styles.option}
          onPress={() => {
            navigation.navigate("FourthCanticle");
          }}
        >
          <Text style={styles.optionText}>Fourth Canticle</Text>
        </Pressable>
        <Pressable
          style={styles.option}
          onPress={() => {
            navigation.navigate("AdamPsali");
          }}
        >
          <Text style={styles.optionText}>Adam Psali</Text>
        </Pressable>
        <Pressable
          style={styles.option}
          onPress={() => {
            navigation.navigate("SundayTheotokia");
          }}
        >
          <Text style={styles.optionText}>Sunday Theotokia</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  learnittesbehamenu: {
    backgroundColor: "#121212",  // Very dark grey background
    flex: 1,
  },
  scrollViewContent: {
    padding: 20,
    alignItems: "center",
  },
  backbutton: {
    position: "absolute",
    top: 20,
    left: 20,
  },
  headerContainer: {
    marginBottom: 40,
    width: "100%",
    alignItems: "center",
  },
  headerText: {
    fontSize: 40,
    color: "#ffffff",
    fontFamily: "Roboto-Bold",
    fontWeight: "700",
    textAlign: "center",
    marginBottom: -10,
  },
  subHeaderText: {
    fontSize: 24,
    color: "#ffffff",
    fontFamily: "Roboto-Bold",
    textAlign: "center",
  },
  option: {
    width: "100%",
    height: 70,
    backgroundColor: "#1a1a1a",  // Slightly lighter card background
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,  // Space between options
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
});

export default LearnItTesbehaMenu;
