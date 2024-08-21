import React, { useState } from "react";
import { Pressable, Text, StyleSheet, View } from "react-native";
import { Button as RNPButton, Checkbox } from "react-native-paper";
import { Button } from "@rneui/themed";

const ChangeRoles = () => {
  const [rectangleCheckboxchecked, setRectangleCheckboxchecked] =
    useState(false);
  const [rectangleCheckbox1checked, setRectangleCheckbox1checked] =
    useState(false);
  const [rectangleCheckbox2checked, setRectangleCheckbox2checked] =
    useState(false);
  const [rectangleCheckbox3checked, setRectangleCheckbox3checked] =
    useState(false);
  const [rectangleCheckbox4checked, setRectangleCheckbox4checked] =
    useState(false);

  return (
    <View style={styles.changeroles}>
      <Pressable
        style={[styles.continuebutton, styles.selectAllThatFlexBox]}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.continue}>Confirm</Text>
      </Pressable>
      <Text style={[styles.selectAllThat, styles.deaconTypo]}>
        Select all that apply to you
      </Text>
      <RNPButton
        style={styles.backarrow}
        mode="outlined"
        onPress={() => navigation.goBack()}
        contentStyle={styles.backArrowIconBtn}
      />
      <View style={styles.deaconParent}>
        <Text style={[styles.deacon, styles.deaconTypo]}>Deacon</Text>
        <Button
          title="Alhan teacher"
          radius="5"
          iconPosition="left"
          type="clear"
          color="#8e8e93"
          titleStyle={styles.alhanTeacherBtn}
          containerStyle={styles.alhanTeacherBtn1}
          buttonStyle={styles.alhanTeacherBtn2}
        />
        <Button
          title="Sunday School Teacher"
          radius="5"
          iconPosition="left"
          type="clear"
          color="#8e8e93"
          titleStyle={styles.sundaySchoolTeacherBtn}
          containerStyle={styles.sundaySchoolTeacherBtn1}
          buttonStyle={styles.sundaySchoolTeacherBtn2}
        />
        <Button
          title="Servants Meeting Attendance Tracker"
          radius="5"
          iconPosition="left"
          type="clear"
          color="#8e8e93"
          titleStyle={styles.servantsMeetingAttendanceBtn}
          containerStyle={styles.servantsMeetingAttendanceBtn1}
          buttonStyle={styles.servantsMeetingAttendanceBtn2}
        />
        <Button
          title="None applicable"
          radius="5"
          iconPosition="left"
          type="clear"
          color="#8e8e93"
          titleStyle={styles.noneApplicableBtn}
          containerStyle={styles.noneApplicableBtn1}
          buttonStyle={styles.noneApplicableBtn2}
        />
        <View style={[styles.instanceChild, styles.instanceChildPosition]} />
        <View style={[styles.instanceItem, styles.instanceChildPosition]} />
        <View style={[styles.instanceInner, styles.instanceChildPosition]} />
        <View style={[styles.lineView, styles.instanceChildPosition]} />
        <View style={[styles.instanceChild1, styles.instanceChildPosition]} />
        <View style={styles.vectorParent}>
          <View style={[styles.wrapper, styles.wrapperPosition]}>
            <Checkbox
              status={rectangleCheckboxchecked ? "checked" : "unchecked"}
              onPress={() =>
                setRectangleCheckboxchecked(!rectangleCheckboxchecked)
              }
              color="#000"
            />
          </View>
          <View style={[styles.container, styles.wrapperPosition]}>
            <Checkbox
              status={rectangleCheckbox1checked ? "checked" : "unchecked"}
              onPress={() =>
                setRectangleCheckbox1checked(!rectangleCheckbox1checked)
              }
              color="#000"
            />
          </View>
          <View style={[styles.frame, styles.wrapperPosition]}>
            <Checkbox
              status={rectangleCheckbox2checked ? "checked" : "unchecked"}
              onPress={() =>
                setRectangleCheckbox2checked(!rectangleCheckbox2checked)
              }
              color="#000"
            />
          </View>
          <View style={[styles.rectangleView, styles.wrapperPosition]}>
            <Checkbox
              status={rectangleCheckbox3checked ? "checked" : "unchecked"}
              onPress={() =>
                setRectangleCheckbox3checked(!rectangleCheckbox3checked)
              }
              color="#000"
            />
          </View>
          <View style={[styles.wrapper1, styles.wrapperPosition]}>
            <Checkbox
              status={rectangleCheckbox4checked ? "checked" : "unchecked"}
              onPress={() =>
                setRectangleCheckbox4checked(!rectangleCheckbox4checked)
              }
              color="#000"
            />
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backArrowIconBtn: {
    height: "2.82%",
    width: "6.11%",
  },
  alhanTeacherBtn: {
    color: "#8e8e93",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  alhanTeacherBtn1: {
    left: "49.62%",
    top: "21.59%",
    position: "absolute",
  },
  alhanTeacherBtn2: {},
  sundaySchoolTeacherBtn: {
    color: "#8e8e93",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  sundaySchoolTeacherBtn1: {
    left: "49.62%",
    top: "43.18%",
    position: "absolute",
  },
  sundaySchoolTeacherBtn2: {},
  servantsMeetingAttendanceBtn: {
    color: "#8e8e93",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  servantsMeetingAttendanceBtn1: {
    left: "49.62%",
    top: "64.77%",
    position: "absolute",
  },
  servantsMeetingAttendanceBtn2: {
    width: "198.5%",
  },
  noneApplicableBtn: {
    color: "#8e8e93",
    fontSize: 20,
    fontFamily: "Roboto-Regular",
  },
  noneApplicableBtn1: {
    left: "49.62%",
    top: "90.91%",
    position: "absolute",
  },
  noneApplicableBtn2: {
    width: "198.5%",
  },
  selectAllThatFlexBox: {
    alignItems: "center",
    left: "4.07%",
  },
  deaconTypo: {
    textAlign: "left",
    color: "#8e8e93",
    fontFamily: "Roboto-Regular",
    position: "absolute",
  },
  instanceChildPosition: {
    borderTopWidth: 1,
    borderColor: "#8e8e93",
    left: "38.72%",
    right: "-127.44%",
    width: "188.72%",
    height: "0.38%",
    borderStyle: "solid",
    position: "absolute",
  },
  wrapperPosition: {
    right: "-4%",
    left: "-4%",
    position: "absolute",
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
    borderRadius: 10,
    backgroundColor: "#333",
    borderColor: "rgba(0, 0, 0, 0.15)",
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderStyle: "solid",
    alignItems: "center",
    position: "absolute",
  },
  selectAllThat: {
    height: "6.1%",
    width: "83.46%",
    top: "16.78%",
    fontSize: 34,
    letterSpacing: -0.3,
    display: "flex",
    alignItems: "center",
    left: "4.07%",
  },
  backarrow: {
    top: "8.69%",
    right: "89.82%",
    bottom: "88.5%",
    left: "4.07%",
    position: "absolute",
    overflow: "hidden",
  },
  deacon: {
    top: "0%",
    left: "49.62%",
    fontSize: 20,
    letterSpacing: -0.2,
  },
  instanceChild: {
    top: "11.55%",
    bottom: "88.07%",
  },
  instanceItem: {
    top: "33.52%",
    bottom: "66.1%",
  },
  instanceInner: {
    top: "55.87%",
    bottom: "43.75%",
  },
  lineView: {
    top: "85.42%",
    bottom: "14.2%",
  },
  instanceChild1: {
    top: "101.33%",
    bottom: "-1.7%",
  },
  wrapper: {
    top: "-0.4%",
    bottom: "89.72%",
  },
  container: {
    top: "44.66%",
    bottom: "44.66%",
  },
  frame: {
    top: "67.19%",
    bottom: "22.13%",
  },
  rectangleView: {
    top: "89.72%",
    bottom: "-0.4%",
  },
  wrapper1: {
    top: "22.13%",
    bottom: "67.19%",
  },
  vectorParent: {
    height: "95.83%",
    width: "18.8%",
    top: "4.17%",
    right: "81.2%",
    bottom: "0%",
    left: "0%",
    position: "absolute",
  },
  deaconParent: {
    height: "30.99%",
    width: "33.84%",
    top: "27.93%",
    right: "54.2%",
    bottom: "41.08%",
    left: "11.96%",
    position: "absolute",
  },
  changeroles: {
    backgroundColor: "#000",
    flex: 1,
    width: "100%",
    height: 852,
    overflow: "hidden",
  },
});

export default ChangeRoles;
