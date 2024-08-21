import React, { useState } from "react";
import { Image, StyleSheet, Text, View, ScrollView } from "react-native";
import DropDownPicker from "react-native-dropdown-picker";

const EditSchedule = () => {
  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);
  const [groupDropdownValue, setGroupDropdownValue] = useState();
  const [groupDropdown1Open, setGroupDropdown1Open] = useState(false);
  const [groupDropdown1Value, setGroupDropdown1Value] = useState();
  const [groupDropdown2Open, setGroupDropdown2Open] = useState(false);
  const [groupDropdown2Value, setGroupDropdown2Value] = useState();
  const [groupDropdown3Open, setGroupDropdown3Open] = useState(false);
  const [groupDropdown3Value, setGroupDropdown3Value] = useState();
  const [groupDropdown4Open, setGroupDropdown4Open] = useState(false);
  const [groupDropdown4Value, setGroupDropdown4Value] = useState();
  const [groupDropdown5Open, setGroupDropdown5Open] = useState(false);
  const [groupDropdown5Value, setGroupDropdown5Value] = useState();
  const [groupDropdown6Open, setGroupDropdown6Open] = useState(false);
  const [groupDropdown6Value, setGroupDropdown6Value] = useState();
  const [groupDropdown7Open, setGroupDropdown7Open] = useState(false);
  const [groupDropdown7Value, setGroupDropdown7Value] = useState();
  const [groupDropdown8Open, setGroupDropdown8Open] = useState(false);
  const [groupDropdown8Value, setGroupDropdown8Value] = useState();
  const [groupDropdown9Open, setGroupDropdown9Open] = useState(false);
  const [groupDropdown9Value, setGroupDropdown9Value] = useState();
  const [groupDropdown10Open, setGroupDropdown10Open] = useState(false);
  const [groupDropdown10Value, setGroupDropdown10Value] = useState();
  const [groupDropdown11Open, setGroupDropdown11Open] = useState(false);
  const [groupDropdown11Value, setGroupDropdown11Value] = useState();
  const [rectangleDropdownOpen, setRectangleDropdownOpen] = useState(false);
  const [rectangleDropdownValue, setRectangleDropdownValue] = useState();

  return (
    <ScrollView style={styles.editschedule}>
      <View style={styles.attendencetitleWrapper}>
        <Image
          resizeMode="cover"
          source={require("../assets/Rectangle 17.png")}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  attendencetitleWrapper: {
    top: 52,
    left: 34,
    width: 280,
    height: 71,
  },
  editschedule: {
    backgroundColor: "#000",
    flex: 1,
    height: 852,
    width: "100%",
    marginTop: 60,
    marginBottom: 90,
  },
});

export default EditSchedule;
