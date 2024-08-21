import * as React from "react";
import { Pressable, StyleSheet, View, Text } from "react-native";
import BackArrow from "../../../components/backArrow";

const LearnItLiturgyMenu = ({ navigation }) => {
  return (
    <View style={styles.learnitliturgymenu}>
      <Pressable
        style={[styles.rectangleParent, styles.rectangleParentPosition]}
        onPress={() => {
          navigation.navigate("Matins");
        }}
      >
        <View style={[styles.frameChild, styles.childPosition]} />
        <Text style={[styles.matins, styles.liturgyTypo]}>Matins</Text>
      </Pressable>
      <Pressable
        style={[styles.rectangleGroup, styles.rectangleParentPosition]}
        onPress={() => {
          navigation.navigate("OfferingLamb");
        }}
      >
        <View style={[styles.frameChild, styles.childPosition]} />
        <Text style={[styles.offeringOfThe, styles.liturgyTypo]}>
          Offering of the lamb
        </Text>
      </Pressable>
      <Pressable
        style={[styles.rectangleContainer, styles.rectangleParentPosition]}
        onPress={() => {
          navigation.navigate("LiturgyWord");
        }}
      >
        <View style={[styles.frameChild, styles.childPosition]} />
        <Text style={[styles.liturgyOfThe, styles.liturgyTypo]}>
          Liturgy of the Word
        </Text>
      </Pressable>
      <Pressable
        style={[styles.framePressable, styles.rectangleParentPosition]}
        onPress={() => {
          navigation.navigate("LiturgyFaithful");
        }}
      >
        <View style={[styles.frameChild, styles.childPosition]} />
        <Text style={[styles.liturgyOfThe1, styles.liturgyTypo]}>
          Liturgy of the Faithful
        </Text>
      </Pressable>
      <Pressable
        style={[styles.rectangleParent1, styles.rectangleParentPosition]}
        onPress={() => {
          navigation.navigate("Distribution");
        }}
      >
        <View style={[styles.frameChild, styles.childPosition]} />
        <Text style={[styles.distribution, styles.liturgyTypo]}>
          Distribution
        </Text>
      </Pressable>
      <View style={styles.backbutton}>
        <BackArrow />
      </View>
      <View style={styles.liturgy}>
        <View style={[styles.liturgyChild, styles.childPosition]} />
        <Text style={[styles.liturgy1, styles.liturgyTypo]}>Liturgy</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backbutton: {
    top: 74,
    left: 16,
  },
  rectangleParentPosition: {
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
  liturgyTypo: {
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
  matins: {
    width: "31.24%",
    left: "34.17%",
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
    top: "32.86%",
    bottom: "62.68%",
  },
  offeringOfThe: {
    width: "90.4%",
    left: "4.58%",
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
    top: "42.61%",
    bottom: "52.93%",
  },
  liturgyOfThe: {
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
    top: "52.35%",
    bottom: "43.19%",
  },
  liturgyOfThe1: {
    width: "96.68%",
    left: "1.67%",
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
  framePressable: {
    top: "62.09%",
    bottom: "33.45%",
  },
  distribution: {
    width: "52.52%",
    left: "23.75%",
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
  rectangleParent1: {
    top: "71.83%",
    bottom: "23.71%",
  },
  backarrow: {
    top: "8.69%",
    right: "89.82%",
    bottom: "88.5%",
    left: "4.07%",
    position: "absolute",
    overflow: "hidden",
  },
  liturgyChild: {
    backgroundColor: "#555",
  },
  liturgy1: {
    width: "90.55%",
    top: "41.11%",
    left: "4.44%",
  },
  liturgy: {
    height: "10.56%",
    width: "82.7%",
    top: "14.32%",
    right: "8.65%",
    bottom: "75.12%",
    left: "8.65%",
    position: "absolute",
  },
  learnitliturgymenu: {
    backgroundColor: "#000",
    flex: 1,
    height: 852,
    overflow: "hidden",
    width: "100%",
  },
});

export default LearnItLiturgyMenu;
