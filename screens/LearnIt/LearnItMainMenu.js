import * as React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { SharedElement } from "react-navigation-shared-element";

const LearnItMainMenu = ({ navigation }) => {
  return (
    <View style={styles.learnitmainmenu}>
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
        onPress={() => navigation.navigate("TesbehaMenu")}
      >
        <Text style={styles.optionText}>Midnight Praises (Tesbeha)</Text>
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

LearnItMainMenu.sharedElements = () => ["liturgyBox"];

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
});

export default LearnItMainMenu;
