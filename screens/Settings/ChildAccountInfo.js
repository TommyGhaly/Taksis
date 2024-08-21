import * as React from "react";
import { Text, StyleSheet, View } from "react-native";
import { Button } from "react-native-paper";


const ChildAccountInfo = () => {
  return (
    <View style={styles.childaccountinfo}>
      <Text style={[styles.accountInfo, styles.rankTypo]}>Account info</Text>
      <View style={[styles.rectangleParent, styles.groupParentPosition]}>
        <View style={[styles.groupChild, styles.groupParentPosition]} />
        <Text style={[styles.rank, styles.rankTypo]}>Rank</Text>
      </View>
      <View style={[styles.rectangleGroup, styles.groupParentPosition]}>
        <View style={[styles.groupChild, styles.groupParentPosition]} />
        <Text style={[styles.rank, styles.rankTypo]}>Church 1</Text>
      </View>
      <Button
        style={styles.backarrow}
        mode="outlined"
        onPress={() => navigation.goBack()}
        contentStyle={styles.backArrowIconBtn}
      />
      <View style={[styles.component6, styles.groupParentPosition]}>
        <View
          style={[styles.rectangleContainer, styles.rectangleParentPosition]}
        >
          <View style={[styles.groupChild, styles.groupParentPosition]} />
          <Text style={[styles.rank, styles.rankTypo]}>First Last</Text>
        </View>
        <View style={[styles.groupView, styles.rectangleParentPosition]}>
          <View style={[styles.groupChild, styles.groupParentPosition]} />
          <Text style={[styles.rank, styles.rankTypo]}>example@gmail.com</Text>
        </View>
        <View style={[styles.rectangleParent1, styles.rectangleParentPosition]}>
          <View style={[styles.groupChild, styles.groupParentPosition]} />
          <Text style={[styles.rank, styles.rankTypo]}>555-555-5555</Text>
        </View>
        <View style={[styles.rectangleParent2, styles.rectangleParentPosition]}>
          <View style={[styles.groupChild, styles.groupParentPosition]} />
          <Text style={[styles.rank, styles.rankTypo]}>password923</Text>
        </View>
      </View>
      <View style={[styles.rectangleParent3, styles.groupParentPosition]}>
        <View style={[styles.groupChild, styles.groupParentPosition]} />
        <Text style={[styles.rank, styles.rankTypo]}>Age</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backArrowIconBtn: {
    height: "2.82%",
    width: "6.11%",
  },
  rankTypo: {
    textAlign: "left",
    color: "#8e8e93",
    fontFamily: "Roboto-Regular",
    lineHeight: 22,
    width: "57.76%",
    position: "absolute",
  },
  groupParentPosition: {
    left: "0%",
    right: "0%",
    position: "absolute",
    width: "100%",
  },
  rectangleParentPosition: {
    height: "24.27%",
    left: "0%",
    right: "0%",
    position: "absolute",
    width: "100%",
  },
  accountInfo: {
    height: "2.58%",
    top: "13.97%",
    left: "4.33%",
    fontSize: 24,
  },
  groupChild: {
    height: "100%",
    backgroundColor: "#1e1e1e",
    bottom: "0%",
    top: "0%",
  },
  rank: {
    height: "88%",
    top: "4%",
    left: "9.16%",
    fontSize: 16,
  },
  rectangleParent: {
    top: "38.5%",
    bottom: "58.57%",
    height: "2.93%",
    right: "0%",
  },
  rectangleGroup: {
    top: "41.55%",
    bottom: "55.52%",
    height: "2.93%",
    right: "0%",
  },
  backarrow: {
    top: "8.69%",
    right: "89.82%",
    bottom: "88.5%",
    left: "4.07%",
    position: "absolute",
    overflow: "hidden",
  },
  rectangleContainer: {
    bottom: "75.73%",
    top: "0%",
  },
  groupView: {
    top: "25.24%",
    bottom: "50.49%",
  },
  rectangleParent1: {
    top: "50.49%",
    bottom: "25.24%",
  },
  rectangleParent2: {
    top: "75.73%",
    bottom: "0%",
  },
  component6: {
    height: "12.09%",
    top: "20.19%",
    bottom: "67.72%",
  },
  rectangleParent3: {
    top: "44.6%",
    bottom: "52.46%",
    height: "2.93%",
    right: "0%",
  },
  childaccountinfo: {
    backgroundColor: "#000",
    flex: 1,
    height: 852,
    overflow: "hidden",
    width: "100%",
  },
});

export default ChildAccountInfo;
