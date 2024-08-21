import React, { useState } from "react";
import { Text, StyleSheet, View } from "react-native";
import DropDownPicker from "react-native-dropdown-picker";

const Group = () => {
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
    <View style={styles.groupParent}>
      <View style={[styles.matinsGospelParent, styles.parentLayout]}>
        <Text style={[styles.matinsGospel, styles.alterFlexBox]}>
          Matins Gospel
        </Text>
        <View
          style={[styles.wrapper, styles.wrapperPosition1]}
          autoScroll="true"
          showTickIcon="false"
        >
          <DropDownPicker
            open={groupDropdownOpen}
            setOpen={setGroupDropdownOpen}
            value={groupDropdownValue}
            setValue={setGroupDropdownValue}
            placeholder="First Last"
            items={[]}
            labelStyle={styles.groupDropdownValue}
          />
        </View>
      </View>
      <View style={[styles.rdHourGospelParent, styles.parentLayout]}>
        <Text style={[styles.matinsGospel, styles.alterFlexBox]}>
          3rd Hour Gospel
        </Text>
        <View style={[styles.wrapper, styles.wrapperPosition1]}>
          <DropDownPicker
            open={groupDropdown1Open}
            setOpen={setGroupDropdown1Open}
            value={groupDropdown1Value}
            setValue={setGroupDropdown1Value}
            placeholder="First Last"
            items={[]}
            labelStyle={styles.groupDropdown1Value}
          />
        </View>
      </View>
      <View style={[styles.thHourGospelParent, styles.parentLayout]}>
        <Text style={[styles.matinsGospel, styles.alterFlexBox]}>
          6th Hour Gospel
        </Text>
        <View style={[styles.wrapper, styles.wrapperPosition1]}>
          <DropDownPicker
            open={groupDropdown2Open}
            setOpen={setGroupDropdown2Open}
            value={groupDropdown2Value}
            setValue={setGroupDropdown2Value}
            placeholder="First Last"
            items={[]}
            labelStyle={styles.groupDropdown2Value}
          />
        </View>
      </View>
      <View style={[styles.paulineEpistleParent, styles.parentLayout]}>
        <Text style={[styles.matinsGospel, styles.alterFlexBox]}>
          Pauline Epistle
        </Text>
        <View style={[styles.wrapper, styles.wrapperPosition1]}>
          <DropDownPicker
            open={groupDropdown3Open}
            setOpen={setGroupDropdown3Open}
            value={groupDropdown3Value}
            setValue={setGroupDropdown3Value}
            placeholder="First Last"
            items={[]}
            labelStyle={styles.groupDropdown3Value}
          />
        </View>
      </View>
      <View style={[styles.catholicEpistleParent, styles.parentLayout]}>
        <Text style={[styles.matinsGospel, styles.alterFlexBox]}>
          Catholic Epistle
        </Text>
        <View style={[styles.wrapper, styles.wrapperPosition1]}>
          <DropDownPicker
            open={groupDropdown4Open}
            setOpen={setGroupDropdown4Open}
            value={groupDropdown4Value}
            setValue={setGroupDropdown4Value}
            placeholder="First Last"
            items={[]}
            labelStyle={styles.groupDropdown4Value}
          />
        </View>
      </View>
      <View style={[styles.praxisParent, styles.parentLayout]}>
        <Text style={[styles.matinsGospel, styles.alterFlexBox]}>Praxis</Text>
        <View style={[styles.wrapper, styles.wrapperPosition1]}>
          <DropDownPicker
            open={groupDropdown5Open}
            setOpen={setGroupDropdown5Open}
            value={groupDropdown5Value}
            setValue={setGroupDropdown5Value}
            placeholder="First Last"
            items={[]}
            labelStyle={styles.groupDropdown5Value}
          />
        </View>
      </View>
      <View style={[styles.waterHolderParent, styles.parentLayout]}>
        <Text style={[styles.waterHolder, styles.alterFlexBox]}>
          Water Holder
        </Text>
        <View style={[styles.wrapper3, styles.wrapperPosition1]}>
          <DropDownPicker
            open={groupDropdown6Open}
            setOpen={setGroupDropdown6Open}
            value={groupDropdown6Value}
            setValue={setGroupDropdown6Value}
            placeholder="First Last"
            items={[]}
            labelStyle={styles.groupDropdown6Value}
          />
        </View>
      </View>
      <View style={[styles.groupContainer, styles.parentLayout]}>
        <View style={[styles.wrapper, styles.wrapperPosition1]}>
          <DropDownPicker
            open={groupDropdown7Open}
            setOpen={setGroupDropdown7Open}
            value={groupDropdown7Value}
            setValue={setGroupDropdown7Value}
            placeholder="First Last"
            items={[]}
            labelStyle={styles.groupDropdown7Value}
          />
        </View>
        <Text style={[styles.matinsGospel, styles.alterFlexBox]}>
          Wine Holder
        </Text>
      </View>
      <Text style={[styles.alterServers, styles.alterFlexBox]}>
        Alter Servers
      </Text>
      <View style={[styles.wrapper5, styles.wrapperLayout]}>
        <DropDownPicker
          open={groupDropdown8Open}
          setOpen={setGroupDropdown8Open}
          value={groupDropdown8Value}
          setValue={setGroupDropdown8Value}
          placeholder="First Last"
          items={[]}
          labelStyle={styles.groupDropdown8Value}
        />
      </View>
      <View style={[styles.wrapper6, styles.wrapperPosition]}>
        <DropDownPicker
          open={groupDropdown9Open}
          setOpen={setGroupDropdown9Open}
          value={groupDropdown9Value}
          setValue={setGroupDropdown9Value}
          placeholder="First Last"
          items={[]}
          labelStyle={styles.groupDropdown9Value}
        />
      </View>
      <View style={[styles.wrapper7, styles.wrapperPosition]}>
        <DropDownPicker
          open={groupDropdown10Open}
          setOpen={setGroupDropdown10Open}
          value={groupDropdown10Value}
          setValue={setGroupDropdown10Value}
          placeholder="First Last"
          items={[]}
          labelStyle={styles.groupDropdown10Value}
        />
      </View>
      <View style={[styles.wrapper8, styles.wrapperLayout]}>
        <DropDownPicker
          open={groupDropdown11Open}
          setOpen={setGroupDropdown11Open}
          value={groupDropdown11Value}
          setValue={setGroupDropdown11Value}
          placeholder="First Last"
          items={[]}
          labelStyle={styles.groupDropdown11Value}
        />
      </View>
      <Text style={[styles.numberOfAlter, styles.alterFlexBox]}>
        Number of alter Servers:
      </Text>
      <View style={styles.rectangleView}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  groupDropdownValue: {
    color: "#1e1e1e",
    fontSize: 24,
    fontFamily: "Roboto-Regular",
  },
  groupDropdown1Value: {
    color: "#1e1e1e",
    fontSize: 24,
    fontFamily: "Roboto-Regular",
  },
  groupDropdown2Value: {
    color: "#1e1e1e",
    fontSize: 24,
    fontFamily: "Roboto-Regular",
  },
  groupDropdown3Value: {
    color: "#1e1e1e",
    fontSize: 24,
    fontFamily: "Roboto-Regular",
  },
  groupDropdown4Value: {
    color: "#1e1e1e",
    fontSize: 24,
    fontFamily: "Roboto-Regular",
  },
  groupDropdown5Value: {
    color: "#1e1e1e",
    fontSize: 24,
    fontFamily: "Roboto-Regular",
  },
  groupDropdown6Value: {
    color: "#1e1e1e",
    fontSize: 24,
    fontFamily: "Roboto-Regular",
  },
  groupDropdown7Value: {
    color: "#1e1e1e",
    fontSize: 24,
    fontFamily: "Roboto-Regular",
  },
  groupDropdown8Value: {
    color: "#1e1e1e",
    fontSize: 16,
    fontFamily: "Roboto-Regular",
  },
  groupDropdown9Value: {
    color: "#1e1e1e",
    fontSize: 16,
    fontFamily: "Roboto-Regular",
  },
  groupDropdown10Value: {
    color: "#1e1e1e",
    fontSize: 16,
    fontFamily: "Roboto-Regular",
  },
  groupDropdown11Value: {
    color: "#1e1e1e",
    fontSize: 16,
    fontFamily: "Roboto-Regular",
  },
  rectangleDropdowndropDownContainer: {
    backgroundColor: "#8e8e93",
  },
  parentLayout: {
    width: "99.69%",
    left: "0.31%",
  },
  alterFlexBox: {
    justifyContent: "center",
    alignItems: "center",
    display: "flex",
    textAlign: "center",
    fontFamily: "Roboto-Regular",
    lineHeight: 22,
    position: "absolute",
  },
  wrapperPosition1: {
    left: "12.77%",
    bottom: "0%",
    right: "16.51%",
    width: "70.72%",
    position: "absolute",
  },
  wrapperLayout: {
    width: "45.65%",
    height: "2.99%",
    position: "absolute",
  },
  wrapperPosition: {
    top: "97.01%",
    width: "45.65%",
    height: "2.99%",
    bottom: "0%",
    position: "absolute",
  },
  matinsGospel: {
    height: "52.43%",
    color: "#8e8e93",
    fontSize: 24,
    alignItems: "center",
    display: "flex",
    textAlign: "center",
    fontFamily: "Roboto-Regular",
    lineHeight: 22,
    left: "0%",
    top: "0%",
    width: "100%",
  },
  wrapper: {
    height: "48.54%",
    top: "51.46%",
  },
  matinsGospelParent: {
    bottom: "90.93%",
    left: "0.31%",
    right: "0%",
    top: "0%",
    height: "9.07%",
    width: "99.69%",
    position: "absolute",
  },
  rdHourGospelParent: {
    top: "10.3%",
    bottom: "80.63%",
    left: "0.31%",
    right: "0%",
    height: "9.07%",
    width: "99.69%",
    position: "absolute",
  },
  thHourGospelParent: {
    top: "20.6%",
    bottom: "70.33%",
    left: "0.31%",
    right: "0%",
    height: "9.07%",
    width: "99.69%",
    position: "absolute",
  },
  paulineEpistleParent: {
    top: "30.9%",
    bottom: "60.04%",
    left: "0.31%",
    right: "0%",
    height: "9.07%",
    width: "99.69%",
    position: "absolute",
  },
  catholicEpistleParent: {
    top: "41.2%",
    bottom: "49.74%",
    left: "0.31%",
    right: "0%",
    height: "9.07%",
    width: "99.69%",
    position: "absolute",
  },
  praxisParent: {
    top: "51.5%",
    bottom: "39.44%",
    left: "0.31%",
    right: "0%",
    height: "9.07%",
    width: "99.69%",
    position: "absolute",
  },
  waterHolder: {
    height: "51.92%",
    color: "#8e8e93",
    fontSize: 24,
    alignItems: "center",
    display: "flex",
    textAlign: "center",
    fontFamily: "Roboto-Regular",
    lineHeight: 22,
    left: "0%",
    top: "0%",
    width: "100%",
  },
  wrapper3: {
    height: "48.08%",
    top: "51.92%",
  },
  waterHolderParent: {
    height: "9.15%",
    top: "61.8%",
    bottom: "29.05%",
    left: "0.31%",
    right: "0%",
    position: "absolute",
  },
  groupContainer: {
    top: "72.1%",
    bottom: "18.84%",
    left: "0.31%",
    right: "0%",
    height: "9.07%",
    width: "99.69%",
    position: "absolute",
  },
  alterServers: {
    height: "4.75%",
    top: "81.16%",
    color: "#8e8e93",
    fontSize: 24,
    alignItems: "center",
    display: "flex",
    textAlign: "center",
    fontFamily: "Roboto-Regular",
    lineHeight: 22,
    left: "0.31%",
    width: "99.69%",
  },
  wrapper5: {
    top: "91.99%",
    right: "54.04%",
    bottom: "5.02%",
    left: "0.31%",
  },
  wrapper6: {
    right: "0.31%",
    left: "54.04%",
  },
  wrapper7: {
    right: "54.35%",
    left: "0%",
  },
  wrapper8: {
    top: "92.08%",
    bottom: "4.93%",
    left: "54.35%",
    right: "0%",
  },
  numberOfAlter: {
    height: "3.7%",
    width: "58.07%",
    top: "86.88%",
    fontSize: 16,
    color: "#fff",
    alignItems: "center",
    display: "flex",
    textAlign: "center",
    fontFamily: "Roboto-Regular",
    lineHeight: 22,
    left: "0%",
  },
  dropdownpicker: {
    backgroundColor: "#8e8e93",
  },
  rectangleView: {
    height: "2.9%",
    width: "10.25%",
    top: "87.32%",
    right: "31.37%",
    bottom: "9.77%",
    left: "58.39%",
    borderRadius: 10,
    position: "absolute",
  },
  groupParent: {
    flex: 1,
    height: 1136,
    width: "100%",
  },
});

export default Group;
