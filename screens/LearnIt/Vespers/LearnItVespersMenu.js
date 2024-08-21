import * as React from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import BackArrow from "../../../components/backArrow";

const LearnItVespersMenu = ({ navigation }) => {
  return (
    <View style={styles.learnitvespersmenu}>
      <Pressable
        style={[styles.rectangleParent, styles.rectanglePosition]}
        onPress={() => {
          navigation.navigate("VersesCymbals");
        }}
      >
        <View style={[styles.frameChild, styles.childPosition]} />
        <Text style={[styles.versesOfThe, styles.responsesTypo]}>
          Verses of the Cymbals
        </Text>
      </Pressable>
      <Pressable
        style={[styles.rectangleGroup, styles.rectanglePosition]}
        onPress={() => {
          navigation.navigate("Doxology");
        }}
      >
        <View style={[styles.frameChild, styles.childPosition]} />
        <Text style={[styles.doxologies, styles.responsesTypo]}>
          Doxologies
        </Text>
      </Pressable>
      <View style={styles.backbutton}>
        <BackArrow />
      </View>
      <View style={styles.vespers}>
        <View style={[styles.vespersChild, styles.childPosition]} />
        <Text style={[styles.vespersAshaya, styles.responsesTypo]}>
          Vespers (Ashaya)
        </Text>
      </View>
      <Pressable
        style={[styles.rectangleContainer, styles.rectanglePosition]}
        onPress={() => {
          navigation.navigate("Responses");
        }}
      >
        <View style={[styles.frameChild, styles.childPosition]} />
        <Text style={[styles.responses, styles.responsesTypo]}>Responses</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  backbutton: {
    top: 74,
    left: 16,
  },
  rectanglePosition: {
    left: "18.32%",
    right: "18.07%",
    width: "63.61%",
    height: "4.46%",
    position: "absolute",
  },
  childPosition: {
    borderRadius: 10,
    left: "0%",
    bottom: "0%",
    right: "0%",
    top: "0%",
    height: "100%",
    position: "absolute",
    width: "100%",
  },
  responsesTypo: {
    justifyContent: "center",
    alignItems: "center",
    display: "flex",
    textAlign: "center",
    color: "#000",
    fontFamily: "Roboto-Bold",
    fontWeight: "700",
    lineHeight: 24,
    fontSize: 24,
    position: "absolute",
  },
  frameChild: {
    backgroundColor: "#8e8e93",
  },
  versesOfThe: {
    width: "101.24%",
    left: "-0.83%",
    top: "21.05%",
    alignItems: "center",
    display: "flex",
    textAlign: "center",
    color: "#000",
    fontFamily: "Roboto-Bold",
    fontWeight: "700",
    lineHeight: 24,
    fontSize: 24,
  },
  rectangleParent: {
    top: "42.61%",
    bottom: "52.93%",
  },
  doxologies: {
    width: "50%",
    left: "25%",
    top: "21.05%",
    alignItems: "center",
    display: "flex",
    textAlign: "center",
    color: "#000",
    fontFamily: "Roboto-Bold",
    fontWeight: "700",
    lineHeight: 24,
    fontSize: 24,
  },
  rectangleGroup: {
    top: "52.35%",
    bottom: "43.19%",
  },
  backarrow: {
    top: "8.69%",
    right: "89.82%",
    bottom: "88.5%",
    left: "4.07%",
    position: "absolute",
    overflow: "hidden",
  },
  vespersChild: {
    backgroundColor: "#555",
  },
  vespersAshaya: {
    width: "82.77%",
    top: "37.78%",
    left: "8.62%",
  },
  vespers: {
    height: "10.56%",
    width: "82.7%",
    top: "14.32%",
    right: "8.65%",
    bottom: "75.12%",
    left: "8.65%",
    position: "absolute",
  },
  responses: {
    height: "57.89%",
    width: "86.24%",
    left: "6.67%",
    top: "21.05%",
    alignItems: "center",
    display: "flex",
    textAlign: "center",
    color: "#000",
    fontFamily: "Roboto-Bold",
    fontWeight: "700",
    lineHeight: 24,
    fontSize: 24,
  },
  rectangleContainer: {
    top: "32.86%",
    bottom: "62.68%",
  },
  learnitvespersmenu: {
    backgroundColor: "#000",
    flex: 1,
    height: 852,
    overflow: "hidden",
    width: "100%",
  },
});

export default LearnItVespersMenu;
