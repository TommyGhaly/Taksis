import * as React from "react";
import { StyleSheet, View, Text } from "react-native";

const AttendenceHistory = () => {
  return (
    <View style={styles.rectangleParent}>
      <View style={[styles.componentChild, styles.mmddyyyyPosition]} />
      <Text style={[styles.firstLastHas, styles.mmddyyyyFlexBox]}>
        First Last has been present x times in the last month
      </Text>
      <View style={[styles.mmddyyyyParent, styles.groupParentPosition]}>
        <Text style={[styles.mmddyyyy, styles.mmddyyyyFlexBox]}>
          MM/DD/YYYY
        </Text>
        <View style={[styles.groupChild, styles.childPosition]} />
      </View>
      <View style={[styles.mmddyyyyGroup, styles.groupParentPosition]}>
        <Text style={[styles.mmddyyyy, styles.mmddyyyyFlexBox]}>
          MM/DD/YYYY
        </Text>
        <View style={[styles.groupChild, styles.childPosition]} />
      </View>
      <View style={[styles.mmddyyyyContainer, styles.groupParentPosition]}>
        <Text style={[styles.mmddyyyy, styles.mmddyyyyFlexBox]}>
          MM/DD/YYYY
        </Text>
        <View style={[styles.groupChild, styles.childPosition]} />
      </View>
      <View style={[styles.groupView, styles.groupParentPosition]}>
        <Text style={[styles.mmddyyyy, styles.mmddyyyyFlexBox]}>
          MM/DD/YYYY
        </Text>
        <View style={[styles.groupChild, styles.childPosition]} />
      </View>
      <View style={[styles.mmddyyyyParent1, styles.groupParentPosition]}>
        <Text style={[styles.mmddyyyy, styles.mmddyyyyFlexBox]}>
          MM/DD/YYYY
        </Text>
        <View style={[styles.groupChild, styles.childPosition]} />
      </View>
      <View style={[styles.mmddyyyyParent2, styles.groupParentPosition]}>
        <Text style={[styles.mmddyyyy, styles.mmddyyyyFlexBox]}>
          MM/DD/YYYY
        </Text>
        <View style={[styles.groupChild, styles.childPosition]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mmddyyyyPosition: {
    left: "0%",
    top: "0%",
    height: "100%",
    width: "100%",
  },
  mmddyyyyFlexBox: {
    alignItems: "center",
    display: "flex",
    textAlign: "left",
    fontFamily: "Roboto-Regular",
    lineHeight: 22,
    position: "absolute",
  },
  groupParentPosition: {
    left: "36.9%",
    right: "2.54%",
    width: "60.56%",
    height: "13.04%",
    position: "absolute",
  },
  childPosition: {
    bottom: "0%",
    position: "absolute",
  },
  componentChild: {
    right: "0%",
    borderRadius: 10,
    backgroundColor: "#1e1e1e",
    bottom: "0%",
    position: "absolute",
  },
  firstLastHas: {
    height: "10.56%",
    width: "84.22%",
    top: "7.04%",
    left: "5.09%",
    fontSize: 24,
    color: "#fff",
  },
  mmddyyyy: {
    fontSize: 16,
    color: "#8e8e93",
    left: "0%",
    top: "0%",
    height: "100%",
    width: "100%",
  },
  groupChild: {
    height: "23.81%",
    width: "6.3%",
    top: "76.19%",
    right: "80.67%",
    left: "13.03%",
    borderRadius: 5,
    backgroundColor: "rgba(0, 0, 0, 0)",
    borderStyle: "solid",
    borderColor: "#8e8e93",
    borderWidth: 1,
  },
  mmddyyyyParent: {
    top: "17.6%",
    bottom: "69.36%",
  },
  mmddyyyyGroup: {
    top: "82.82%",
    bottom: "4.14%",
  },
  mmddyyyyContainer: {
    top: "69.77%",
    bottom: "17.18%",
  },
  groupView: {
    top: "56.73%",
    bottom: "30.23%",
  },
  mmddyyyyParent1: {
    top: "43.69%",
    bottom: "43.27%",
  },
  mmddyyyyParent2: {
    top: "30.64%",
    bottom: "56.31%",
  },
  rectangleParent: {
    flex: 1,
    height: 483,
    width: "100%",
  },
});

export default AttnedenceHistory;
