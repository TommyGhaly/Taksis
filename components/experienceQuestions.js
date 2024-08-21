import React, { useState } from "react";
import { StyleSheet, View, Text } from "react-native";
import DropDownPicker from "react-native-dropdown-picker";

const ExperienceQuestions = () => {
  const [rectangleDropdownOpen, setRectangleDropdownOpen] = useState(false);
  const [rectangleDropdownValue, setRectangleDropdownValue] = useState();

  return (
    <View style={styles.experiencequestions}>
      <View style={styles.wrapper}>
        <DropDownPicker
          style={styles.dropdownpicker}
          open={rectangleDropdownOpen}
          setOpen={setRectangleDropdownOpen}
          value={rectangleDropdownValue}
          setValue={setRectangleDropdownValue}
          items={[]}
          dropDownContainerStyle={styles.rectangleDropdowndropDownContainer}
        />
      </View>
      <Text style={styles.yearsOld}>years old</Text>
      <Text style={[styles.notExperienced, styles.experiencedTypo]}>
        Not experienced
      </Text>
      <Text style={[styles.veryExperienced, styles.experiencedTypo]}>
        Very experienced
      </Text>
      <View style={[styles.unfilled, styles.knobLayout]} />
      <View style={[styles.filled, styles.knobLayout]} />
      <View style={[styles.knob, styles.knobLayout]} />
    </View>
  );
};

const styles = StyleSheet.create({
  rectangleDropdowndropDownContainer: {
    backgroundColor: "#000",
    borderStyle: "solid",
    borderColor: "#8e8e93",
    borderWidth: 1,
  },
  howLayout: {
    width: "94.46%",
    height: "12.15%",
    position: "absolute",
  },
  experiencedTypo: {
    fontSize: 12,
    top: "87.85%",
    textAlign: "left",
    color: "#8e8e93",
    fontFamily: "Roboto-Regular",
    letterSpacing: -0.1,
    position: "absolute",
  },
  knobLayout: {
    borderRadius: 100,
    position: "absolute",
  },
  dropdownpicker: {
    backgroundColor: "#000",
    borderColor: "#8e8e93",
    borderWidth: 1,
    borderStyle: "solid",
  },
  wrapper: {
    bottom: "75%",
    width: "8.3969%",
    left: "38.16%",
    borderRadius: 5,
    borderStyle: "solid",
    position: "absolute",
  },
  yearsOld: {
    height: "6.54%",
    width: "32.69%",
    top: "18.93%",
    left: "49.31%",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    textAlign: "left",
    color: "#8e8e93",
    fontFamily: "Roboto-Regular",
    letterSpacing: -0.1,
    position: "absolute",
  },
  notExperienced: {
    left: "0.83%",
  },
  veryExperienced: {
    left: "75.07%",
  },
  unfilled: {
    right: 0,
    left: 0,
    backgroundColor: "rgba(120, 120, 128, 0.32)",
    bottom: "2.8%",
    top: "96.26%",
    height: "0.93%",
    borderRadius: 100,
  },
  filled: {
    width: "50.83%",
    right: "49.17%",
    left: "0%",
    backgroundColor: "#147efb",
    bottom: "2.8%",
    top: "96.26%",
    height: "0.93%",
    borderRadius: 100,
  },
  knob: {
    marginTop: 186,
    top: "50%",
    right: 136,
    shadowColor: "rgba(0, 0, 0, 0.12)",
    shadowOffset: {
      width: 0,
      height: 0.5,
    },
    shadowRadius: 4,
    elevation: 4,
    shadowOpacity: 1,
    backgroundColor: "#fff",
    width: 28,
    height: 28,
    transform: [
      {
        rotate: "180deg",
      },
    ],
  },
  experiencequestions: {
    width: "100%",
    height: 428,
  },
});

export default ExperienceQuestions;
