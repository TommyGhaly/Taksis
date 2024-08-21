import * as React from "react";
import { Text, StyleSheet, Pressable, View } from "react-native";
import { Button as RNEButton } from "@rneui/themed";
import { Button } from "react-native-paper";

const ChangeChildren = () => {
  return (
    <View style={styles.changechildren}>
      <Text style={[styles.child1, styles.childTypo]}>Child 1</Text>
      <Text style={[styles.child2, styles.childTypo]}>Child 2</Text>
      <Text style={[styles.child3, styles.childTypo]}>Child 3</Text>
      <Pressable style={styles.rectangleParent}>
        <View style={[styles.frameChild, styles.frameBg]} />
        <Text style={[styles.remove, styles.removeTypo]}>Remove</Text>
      </Pressable>
      <Pressable style={[styles.rectangleGroup, styles.rectangleLayout]}>
        <View style={[styles.frameItem, styles.removePosition]} />
        <RNEButton
          title="Remove"
          type="clear"
          color="#8e8e93"
          titleStyle={styles.removeBtn}
          containerStyle={styles.removeBtn1}
          buttonStyle={styles.removeBtn2}
        />
      </Pressable>
      <Pressable style={[styles.rectangleContainer, styles.rectangleLayout]}>
        <View style={[styles.frameItem, styles.removePosition]} />
        <Text style={[styles.remove1, styles.removeTypo]}>Remove</Text>
      </Pressable>
      <Button
        style={[styles.backarrow, styles.backarrowPosition]}
        mode="outlined"
        onPress={() => navigation.goBack()}
        contentStyle={styles.backArrowIconBtn}
      />
      <Pressable
        style={[styles.continuebutton, styles.backarrowPosition]}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.continue}>Confirm</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  removeBtn: {
    color: "#8e8e93",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  removeBtn1: {
    left: "21.97%",
    top: "24.49%",
    position: "absolute",
  },
  removeBtn2: {
    height: "53.06%",
    width: "55.3%",
  },
  backArrowIconBtn: {
    height: "2.82%",
    width: "6.11%",
  },
  childTypo: {
    alignItems: "center",
    display: "flex",
    textAlign: "left",
    color: "#8e8e93",
    fontFamily: "Roboto-Regular",
    letterSpacing: -0.3,
    fontSize: 34,
    left: "6.62%",
    width: "33.08%",
    height: "6.1%",
    position: "absolute",
  },
  frameBg: {
    backgroundColor: "#1e1e1e",
    borderRadius: 10,
    position: "absolute",
  },
  removeTypo: {
    fontSize: 20,
    letterSpacing: -0.2,
    alignItems: "center",
    display: "flex",
    textAlign: "left",
    color: "#8e8e93",
    fontFamily: "Roboto-Regular",
    position: "absolute",
  },
  rectangleLayout: {
    height: 49,
    width: 132,
    left: 226,
    position: "absolute",
  },
  removePosition: {
    left: "0%",
    top: "0%",
    height: "100%",
    width: "100%",
  },
  backarrowPosition: {
    left: "4.07%",
    position: "absolute",
  },
  child1: {
    top: "18.66%",
  },
  child2: {
    top: "28.17%",
  },
  child3: {
    top: "37.68%",
  },
  frameChild: {
    height: "188.46%",
    width: "180.82%",
    top: "-46.15%",
    right: "-41.1%",
    bottom: "-42.31%",
    left: "-39.73%",
  },
  remove: {
    letterSpacing: -0.2,
    left: "0%",
    top: "0%",
    height: "100%",
    width: "100%",
  },
  rectangleParent: {
    top: 172,
    left: 255,
    width: 73,
    height: 26,
    position: "absolute",
  },
  frameItem: {
    right: "0%",
    bottom: "0%",
    backgroundColor: "#1e1e1e",
    borderRadius: 10,
    position: "absolute",
  },
  rectangleGroup: {
    top: 241,
  },
  remove1: {
    height: "53.06%",
    width: "55.3%",
    top: "24.49%",
    left: "21.97%",
    letterSpacing: -0.2,
  },
  rectangleContainer: {
    top: 322,
  },
  backarrow: {
    top: "8.69%",
    right: "89.82%",
    bottom: "88.5%",
    overflow: "hidden",
  },
  continue: {
    fontSize: 17,
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
    color: "#fff",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  continuebutton: {
    height: "5.87%",
    width: "91.09%",
    top: "83.57%",
    right: "4.83%",
    bottom: "10.56%",
    backgroundColor: "#333",
    borderStyle: "solid",
    borderColor: "rgba(0, 0, 0, 0.15)",
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
    left: "4.07%",
    alignItems: "center",
  },
  changechildren: {
    backgroundColor: "#000",
    flex: 1,
    height: 852,
    overflow: "hidden",
    width: "100%",
  },
});

export default ChangeChildren;
