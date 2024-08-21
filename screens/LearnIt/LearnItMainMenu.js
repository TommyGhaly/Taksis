import * as React from "react";
import { Image, StyleSheet, Text, View, Pressable } from "react-native";

const LearnItMainMenu = ({ navigation }) => {
  return (
    <View style={styles.learnitmainmenu}>
      <View style={styles.attendancetitleWrapper}>
        <View style={styles.attendancetitle}>
          <Image
            style={[styles.attendancetitleChild, styles.childPosition]}
            resizeMode="cover"
            source={require("../../assets/Rectangle 17.png")}
          />
          <Text style={styles.learnToServe}>Learn to Serve</Text>
        </View>
      </View>
      <Pressable
        style={[styles.tesbeha, styles.tesbehaPosition]}
        onPress={() => {
          navigation.navigate("TesbehaMenu");
        }}
      >
        <View style={[styles.tesbehaChild, styles.childPosition]} />
        <Text style={[styles.midnightPraisesTesbeha, styles.liturgy1Typo]}>
          Midnight Praises (Tesbeha)
        </Text>
      </Pressable>
      <Pressable
        style={[styles.liturgy, styles.tesbehaPosition]}
        onPress={() => {
          navigation.navigate("LiturgyMenu");
        }}
      >
        <View style={[styles.tesbehaChild, styles.childPosition]} />
        <Text style={[styles.liturgy1, styles.liturgy1Typo]}>Liturgy</Text>
      </Pressable>
      <Pressable
        style={[styles.vespers, styles.tesbehaPosition]}
        onPress={() => {
          navigation.navigate("VespersMenu");
        }}
      >
        <View style={[styles.tesbehaChild, styles.childPosition]} />
        <Text style={[styles.vespersAshaya, styles.liturgy1Typo]}>
          Vespers (Ashaya)
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
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
  tesbehaPosition: {
    left: "18.32%",
    right: "18.07%",
    width: "63.61%",
    height: "18.78%",
    position: "absolute",
  },
  liturgy1Typo: {
    color: "#000",
    fontFamily: "Roboto-Bold",
    fontWeight: "700",
    justifyContent: "center",
    alignItems: "center",
    display: "flex",
    textAlign: "center",
    lineHeight: 22,
    fontSize: 24,
    position: "absolute",
  },
  attendancetitleChild: {
    maxWidth: "100%",
    overflow: "hidden",
    maxHeight: "100%",
  },
  learnToServe: {
    height: "60.56%",
    width: "91.43%",
    top: "30.72%",
    left: "4.29%",
    fontFamily: "Roboto-Regular",
    color: "#8e8e93",
    justifyContent: "center",
    alignItems: "center",
    display: "flex",
    textAlign: "center",
    lineHeight: 24,
    fontSize: 24,
    position: "absolute",
  },
  attendancetitle: {
    left: "0%",
    bottom: "0%",
    right: "0%",
    top: "0%",
    height: "100%",
    position: "absolute",
    width: "100%",
  },
  attendancetitleWrapper: {
    height: 71,
    width: 280,
    top: 80,
    left: 24,
    position: "absolute",
  },
  tesbehaChild: {
    backgroundColor: "#555",
  },
  midnightPraisesTesbeha: {
    height: "73.31%",
    top: 50,
    left: "4.44%",
    width: "90.56%",
    fontFamily: "Roboto-Bold",
    fontWeight: "700",
  },
  tesbeha: {
    top: "50.23%",
    bottom: "30.99%",
  },
  liturgy1: {
    height: "24.44%",
    top: "41.11%",
    left: "4.44%",
    width: "90.56%",
    fontFamily: "Roboto-Bold",
    fontWeight: "700",
  },
  liturgy: {
    top: "27.58%",
    bottom: "53.64%",
  },
  vespersAshaya: {
    height: "48.88%",
    width: "82.76%",
    top: 60,
    left: "8.33%",
  },
  vespers: {
    top: "72.89%",
    bottom: "8.33%",
  },
  learnitmainmenu: {
    backgroundColor: "#000",
    flex: 1,
    height: 852,
    width: "100%",
  },
});

export default LearnItMainMenu;
