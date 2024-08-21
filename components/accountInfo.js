import * as React from "react";
import { View, StyleSheet, Text } from "react-native";

const AccountInfo = (name, email, pass) => {
  return (
    <View style={styles.component6}>
      <View style={[styles.rectangleParent, styles.rectanglePosition]}>
        <View style={[styles.groupChild, styles.groupPosition]} />
        <Text style={styles.firstLast}>{name}</Text>
      </View>
      <View style={[styles.rectangleGroup, styles.rectanglePosition]}>
        <View style={[styles.groupChild, styles.groupPosition]} />
        <Text style={styles.firstLast}>{email}</Text>
      </View>
      <View style={[styles.rectangleContainer, styles.rectanglePosition]}>
        <View style={[styles.groupChild, styles.groupPosition]} />
        <Text style={styles.firstLast}>{phone}</Text>
      </View>
      <View style={[styles.groupView, styles.groupPosition]}>
        <View style={[styles.groupChild, styles.groupPosition]} />
        <Text style={styles.firstLast}>{pass}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  rectanglePosition: {
    left: "0%",
    right: "0%",
    height: "24.27%",
    position: "absolute",
    width: "100%",
  },
  groupPosition: {
    bottom: "0%",
    left: "0%",
    right: "0%",
    position: "absolute",
    width: "100%",
  },
  groupChild: {
    height: "100%",
    backgroundColor: "#1e1e1e",
    top: "0%",
  },
  firstLast: {
    height: "88%",
    width: "57.76%",
    top: "4%",
    left: "9.16%",
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Roboto-Regular",
    color: "#8e8e93",
    textAlign: "left",
    position: "absolute",
  },
  rectangleParent: {
    bottom: "75.73%",
    top: "0%",
  },
  rectangleGroup: {
    top: "25.24%",
    bottom: "50.49%",
  },
  rectangleContainer: {
    top: "50.49%",
    bottom: "25.24%",
  },
  groupView: {
    top: "75.73%",
    height: "24.27%",
    bottom: "0%",
  },
  component6: {
    flex: 1,
    height: 103,
    width: "100%",
  },
});

export default AccountInfo;
