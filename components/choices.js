import React, { useState } from "react";
import { Text, StyleSheet, View } from "react-native";
import { CheckBox } from "@rneui/themed";

const Choices = ( { onDeaconChange, onAlhanChange, onSSTeachChange, onServantChange } ) => {
  const [deacon, setDeacon] =
    useState(false);
  const [alhan, setAlhan] =
    useState(false);
  const [ssTeach, setSSTeach] =
    useState(false);
  const [servant, setServant] =
    useState(false);
  const [none, setNone] =
    useState(false);

  const handleDeacon = (checked) => {
    setDeacon(checked)
    onDeaconChange(checked); // Pass the checkbox state up to the parent component
  };
  const handleAlhan = (checked) => {
    setAlhan(checked);
    onAlhanChange(checked); // Pass the checkbox state up to the parent component
  };
  const handleSSTeach = (checked) => {
    setSSTeach(checked);
    onSSTeachChange(checked); // Pass the checkbox state up to the parent component
  };
  const handleServant = (checked) => {
    setServant(checked);
    onServantChange(checked); // Pass the checkbox state up to the parent component
  };
  return (
    <View style={styles.deaconParent}>
      <Text style={[styles.deacon, styles.teacherTypo]}>Deacon</Text>
      <Text style={[styles.alhanTeacher, styles.teacherTypo]}>
        Alhan teacher
      </Text>
      <Text style={[styles.sundaySchoolTeacher, styles.teacherTypo]}>
        Sunday School Teacher
      </Text>
      <Text
        style={[styles.servantsMeetingAttendance, styles.noneApplicableTypo]}
      >
        Servants Meeting Attendance Tracker
      </Text>
      <Text style={[styles.noneApplicable, styles.noneApplicableTypo]}>
        None applicable
      </Text>
      <View style={[styles.groupChild, styles.groupChildLayout]} />
      <View style={[styles.groupItem, styles.groupChildLayout]} />
      <View style={[styles.groupInner, styles.groupChildLayout]} />
      <View style={[styles.lineView, styles.groupChildLayout]} />
      <View style={[styles.groupChild1, styles.groupChildLayout]} />
      <CheckBox
        style={styles.rectangleCheckbox}
        checked={deacon}
        onPress={() => {
          handleDeacon(!deacon);
          none ? setNone(!none) : none;
        }}
        containerStyle={styles.rectangleCheckboxLayout}
        iconType="material-community"
        checkedIcon="checkbox-outline"
        uncheckedIcon={"checkbox-blank-outline"}
        size={40}
      />
      <CheckBox
        style={styles.rectangleCheckbox}
        checked={ssTeach}
        onPress={() => {
          handleSSTeach(!ssTeach);
          none? setNone(!none) : none;
        }}
        containerStyle={styles.rectangleCheckbox1Layout}
        iconType="material-community"
        checkedIcon="checkbox-outline"
        uncheckedIcon={"checkbox-blank-outline"}
        size={40}
      />
      <CheckBox
        style={styles.rectangleCheckbox}
        checked={servant}
        onPress={() => {
          handleServant(!servant);
          none ? setNone(!none) : none;
        }}
        containerStyle={styles.rectangleCheckbox2Layout}
        iconType="material-community"
        checkedIcon="checkbox-outline"
        uncheckedIcon={"checkbox-blank-outline"}
        size={40}
      />
      <CheckBox
        style={styles.rectangleCheckbox}
        checked={none}
        onPress={() => {
          setNone(!none);
          deacon ? handleDeacon(!deacon) : deacon;
          alhan ? handleAlhan(!alhan) : alhan
          ssTeach ? handleSSTeach(!ssTeach) : ssTeach
          servant ? handleServant(!servant) : servant 
        }}
        containerStyle={styles.rectangleCheckbox3Layout}
        iconType="material-community"
        checkedIcon="checkbox-outline"
        uncheckedIcon={"checkbox-blank-outline"}
        size={40}
      />
      <CheckBox
        style={styles.rectangleCheckbox}
        checked={alhan}
        onPress={() => {
          handleAlhan(!alhan);
          none ? setNone(!none) : none;
        }}
        containerStyle={styles.rectangleCheckbox4Layout}
        iconType="material-community"
        checkedIcon="checkbox-outline"
        uncheckedIcon={"checkbox-blank-outline"}
        size={40}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  rectangleCheckboxLayout: {
    backgroundColor: "transparent",
    padding: 0,
    left: -10,
    top: -10,
    position: "absolute",
  },
  rectangleCheckbox1Layout: {
    backgroundColor: "transparent",
    padding: 0,
    left: -10,
    top: 104,
    position: "absolute",
  },
  rectangleCheckbox2Layout: {
    backgroundColor: "transparent",
    padding: 0,
    left: -10,
    top: 161,
    position: "absolute",
  },
  rectangleCheckbox3Layout: {
    backgroundColor: "transparent",
    padding: 0,
    left: -10,
    top: 218,
    position: "absolute",
  },
  rectangleCheckbox4Layout: {
    backgroundColor: "transparent",
    padding: 0,
    left: -10,
    top: 47,
    position: "absolute",
  },
  teacherTypo: {
    textAlign: "left",
    color: "#8e8e93",
    fontFamily: "Roboto-Regular",
    letterSpacing: -0.2,
    fontSize: 20,
    left: 66,
    position: "absolute",
  },
  noneApplicableTypo: {
    width: 264,
    alignItems: "center",
    display: "flex",
    textAlign: "left",
    color: "#8e8e93",
    fontFamily: "Roboto-Regular",
    letterSpacing: -0.2,
    fontSize: 20,
    left: 66,
    position: "absolute",
  },
  groupChildLayout: {
    height: 1,
    width: 251,
    borderTopWidth: 1,
    left: 52,
    borderColor: "#8e8e93",
    borderStyle: "solid",
    position: "absolute",
  },
  deacon: {
    top: 0,
  },
  alhanTeacher: {
    top: 57,
  },
  sundaySchoolTeacher: {
    top: 114,
  },
  servantsMeetingAttendance: {
    top: 171,
  },
  noneApplicable: {
    top: 240,
  },
  groupChild: {
    top: 31,
  },
  groupItem: {
    top: 89,
  },
  groupInner: {
    top: 148,
  },
  lineView: {
    top: 226,
  },
  groupChild1: {
    top: 268,
  },
  rectangleCheckbox: {
    borderRadius: 10,
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "#8e8e93",
    borderStyle: "solid",
  },
  deaconParent: {
    flex: 1,
    width: "100%",
    height: 268,
  },
});

export default Choices;