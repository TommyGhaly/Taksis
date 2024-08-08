import React, { useState } from 'react';
import {Image, StyleSheet, Text, View} from "react-native";
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
    		<View style={styles.editschedule}>
      			<View style={[styles.matinsGospelParent, styles.parentPosition]}>
        				<Text style={[styles.matinsGospel, styles.alterFlexBox]}>Matins Gospel</Text>
        				<View style={[styles.wrapper, styles.wrapperPosition1]} autoScroll="true" showTickIcon="false">
          					<DropDownPicker open={groupDropdownOpen} setOpen={setGroupDropdownOpen} value={groupDropdownValue} setValue={setGroupDropdownValue} placeholder="First Last" items={[]} labelStyle={styles.groupDropdownValue} />
        				</View>
      			</View>
      			<View style={[styles.rdHourGospelParent, styles.parentPosition]}>
        				<Text style={[styles.matinsGospel, styles.alterFlexBox]}>3rd Hour Gospel</Text>
        				<View style={[styles.wrapper, styles.wrapperPosition1]}>
          					<DropDownPicker open={groupDropdown1Open} setOpen={setGroupDropdown1Open} value={groupDropdown1Value} setValue={setGroupDropdown1Value} placeholder="First Last" items={[]} labelStyle={styles.groupDropdown1Value} />
        				</View>
      			</View>
      			<View style={[styles.thHourGospelParent, styles.parentPosition]}>
        				<Text style={[styles.matinsGospel, styles.alterFlexBox]}>6th Hour Gospel</Text>
        				<View style={[styles.wrapper, styles.wrapperPosition1]}>
          					<DropDownPicker open={groupDropdown2Open} setOpen={setGroupDropdown2Open} value={groupDropdown2Value} setValue={setGroupDropdown2Value} placeholder="First Last" items={[]} labelStyle={styles.groupDropdown2Value} />
        				</View>
      			</View>
      			<View style={[styles.paulineEpistleParent, styles.parentPosition]}>
        				<Text style={[styles.matinsGospel, styles.alterFlexBox]}>Pauline Epistle</Text>
        				<View style={[styles.wrapper, styles.wrapperPosition1]}>
          					<DropDownPicker open={groupDropdown3Open} setOpen={setGroupDropdown3Open} value={groupDropdown3Value} setValue={setGroupDropdown3Value} placeholder="First Last" items={[]} labelStyle={styles.groupDropdown3Value} />
        				</View>
      			</View>
      			<View style={[styles.catholicEpistleParent, styles.parentPosition]}>
        				<Text style={[styles.matinsGospel, styles.alterFlexBox]}>Catholic Epistle</Text>
        				<View style={[styles.wrapper, styles.wrapperPosition1]}>
          					<DropDownPicker open={groupDropdown4Open} setOpen={setGroupDropdown4Open} value={groupDropdown4Value} setValue={setGroupDropdown4Value} placeholder="First Last" items={[]} labelStyle={styles.groupDropdown4Value} />
        				</View>
      			</View>
      			<View style={[styles.praxisParent, styles.parentPosition]}>
        				<Text style={[styles.matinsGospel, styles.alterFlexBox]}>Praxis</Text>
        				<View style={[styles.wrapper, styles.wrapperPosition1]}>
          					<DropDownPicker open={groupDropdown5Open} setOpen={setGroupDropdown5Open} value={groupDropdown5Value} setValue={setGroupDropdown5Value} placeholder="First Last" items={[]} labelStyle={styles.groupDropdown5Value} />
        				</View>
      			</View>
      			<View style={[styles.waterHolderParent, styles.parentPosition]}>
        				<Text style={[styles.waterHolder, styles.alterFlexBox]}>Water Holder</Text>
        				<View style={[styles.wrapper3, styles.wrapperPosition1]}>
          					<DropDownPicker open={groupDropdown6Open} setOpen={setGroupDropdown6Open} value={groupDropdown6Value} setValue={setGroupDropdown6Value} placeholder="First Last" items={[]} labelStyle={styles.groupDropdown6Value} />
        				</View>
      			</View>
      			<View style={[styles.groupParent, styles.parentPosition]}>
        				<View style={[styles.wrapper, styles.wrapperPosition1]}>
          					<DropDownPicker open={groupDropdown7Open} setOpen={setGroupDropdown7Open} value={groupDropdown7Value} setValue={setGroupDropdown7Value} placeholder="First Last" items={[]} labelStyle={styles.groupDropdown7Value} />
        				</View>
        				<Text style={[styles.matinsGospel, styles.alterFlexBox]}>Wine Holder</Text>
      			</View>
      			<Text style={[styles.alterServers, styles.parentPosition]}>Alter Servers</Text>
      			<View style={[styles.wrapper5, styles.wrapperLayout]}>
        				<DropDownPicker open={groupDropdown8Open} setOpen={setGroupDropdown8Open} value={groupDropdown8Value} setValue={setGroupDropdown8Value} placeholder="First Last" items={[]} labelStyle={styles.groupDropdown8Value} />
      			</View>
      			<View style={[styles.wrapper6, styles.wrapperPosition]}>
        				<DropDownPicker open={groupDropdown9Open} setOpen={setGroupDropdown9Open} value={groupDropdown9Value} setValue={setGroupDropdown9Value} placeholder="First Last" items={[]} labelStyle={styles.groupDropdown9Value} />
      			</View>
      			<View style={[styles.wrapper7, styles.wrapperPosition]}>
        				<DropDownPicker open={groupDropdown10Open} setOpen={setGroupDropdown10Open} value={groupDropdown10Value} setValue={setGroupDropdown10Value} placeholder="First Last" items={[]} labelStyle={styles.groupDropdown10Value} />
      			</View>
      			<View style={[styles.wrapper8, styles.wrapperLayout]}>
        				<DropDownPicker open={groupDropdown11Open} setOpen={setGroupDropdown11Open} value={groupDropdown11Value} setValue={setGroupDropdown11Value} placeholder="First Last" items={[]} labelStyle={styles.groupDropdown11Value} />
      			</View>
      			<Text style={[styles.numberOfAlter, styles.alterFlexBox]}>Number of alter Servers:</Text>
      			<View style={[styles.rectangleView, styles.rectangleViewLayout]}>
        				<DropDownPicker style={styles.dropdownpicker} open={rectangleDropdownOpen} setOpen={setRectangleDropdownOpen} value={rectangleDropdownValue} setValue={setRectangleDropdownValue} items={[]} dropDownContainerStyle={styles.rectangleDropdowndropDownContainer} />
      			</View>
    		</View>);
};

const styles = StyleSheet.create({
  	groupDropdownValue: {
    		color: "#1e1e1e",
    		fontSize: 24,
    		fontFamily: "Roboto-Regular"
  	},
  	groupDropdown1Value: {
    		color: "#1e1e1e",
    		fontSize: 24,
    		fontFamily: "Roboto-Regular"
  	},
  	groupDropdown2Value: {
    		color: "#1e1e1e",
    		fontSize: 24,
    		fontFamily: "Roboto-Regular"
  	},
  	groupDropdown3Value: {
    		color: "#1e1e1e",
    		fontSize: 24,
    		fontFamily: "Roboto-Regular"
  	},
  	groupDropdown4Value: {
    		color: "#1e1e1e",
    		fontSize: 24,
    		fontFamily: "Roboto-Regular"
  	},
  	groupDropdown5Value: {
    		color: "#1e1e1e",
    		fontSize: 24,
    		fontFamily: "Roboto-Regular"
  	},
  	groupDropdown6Value: {
    		color: "#1e1e1e",
    		fontSize: 24,
    		fontFamily: "Roboto-Regular"
  	},
  	groupDropdown7Value: {
    		color: "#1e1e1e",
    		fontSize: 24,
    		fontFamily: "Roboto-Regular"
  	},
  	groupDropdown8Value: {
    		color: "#1e1e1e",
    		fontSize: 16,
    		fontFamily: "Roboto-Regular"
  	},
  	groupDropdown9Value: {
    		color: "#1e1e1e",
    		fontSize: 16,
    		fontFamily: "Roboto-Regular"
  	},
  	groupDropdown10Value: {
    		color: "#1e1e1e",
    		fontSize: 16,
    		fontFamily: "Roboto-Regular"
  	},
  	groupDropdown11Value: {
    		color: "#1e1e1e",
    		fontSize: 16,
    		fontFamily: "Roboto-Regular"
  	},
  	rectangleDropdowndropDownContainer: {
    		backgroundColor: "#8e8e93"
  	},
  	attendancetitlePosition: {
    		left: "0%",
    		top: "0%",
    		width: "100%"
  	},
  	rectangleViewLayout: {
    		borderRadius: 10,
    		position: "absolute"
  	},
  	alterFlexBox: {
    		justifyContent: "center",
    		alignItems: "center",
    		display: "flex",
    		textAlign: "center",
    		fontFamily: "Roboto-Regular",
    		lineHeight: 22
  	},
  	parentPosition: {
    		width: "81.68%",
    		left: "9.16%",
    		position: "absolute"
  	},
  	wrapperPosition1: {
    		left: "12.77%",
    		right: "16.51%",
    		width: "70.72%",
    		bottom: "0%",
    		position: "absolute"
  	},
  	wrapperLayout: {
    		width: "37.4%",
    		height: "3.99%",
    		position: "absolute"
  	},
  	wrapperPosition: {
    		bottom: "-54.81%",
    		top: "150.82%",
    		width: "37.4%",
    		height: "3.99%",
    		position: "absolute"
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
    		position: "absolute"
  	},
  	wrapper: {
    		height: "48.54%",
    		top: "51.46%"
  	},
  	matinsGospelParent: {
    		top: "21.48%",
    		bottom: "66.43%",
    		left: "9.16%",
    		right: "9.16%",
    		height: "12.09%",
    		width: "81.68%"
  	},
  	rdHourGospelParent: {
    		top: "35.21%",
    		bottom: "52.7%",
    		left: "9.16%",
    		right: "9.16%",
    		height: "12.09%",
    		width: "81.68%"
  	},
  	thHourGospelParent: {
    		top: "48.94%",
    		bottom: "38.97%",
    		left: "9.16%",
    		right: "9.16%",
    		height: "12.09%",
    		width: "81.68%"
  	},
  	paulineEpistleParent: {
    		top: "62.68%",
    		bottom: "25.23%",
    		left: "9.16%",
    		right: "9.16%",
    		height: "12.09%",
    		width: "81.68%"
  	},
  	catholicEpistleParent: {
    		top: "76.41%",
    		bottom: "11.5%",
    		left: "9.16%",
    		right: "9.16%",
    		height: "12.09%",
    		width: "81.68%"
  	},
  	praxisParent: {
    		top: "90.14%",
    		bottom: "-2.23%",
    		left: "9.16%",
    		right: "9.16%",
    		height: "12.09%",
    		width: "81.68%"
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
    		position: "absolute"
  	},
  	wrapper3: {
    		height: "48.08%",
    		top: "51.92%"
  	},
  	waterHolderParent: {
    		height: "12.21%",
    		top: "103.87%",
    		bottom: "-16.08%",
    		left: "9.16%",
    		right: "9.16%"
  	},
  	groupParent: {
    		top: "117.61%",
    		bottom: "-29.69%",
    		left: "9.16%",
    		right: "9.16%",
    		height: "12.09%",
    		width: "81.68%"
  	},
  	alterServers: {
    		height: "6.34%",
    		top: "129.69%",
    		left: "9.16%",
    		justifyContent: "center",
    		alignItems: "center",
    		display: "flex",
    		textAlign: "center",
    		fontFamily: "Roboto-Regular",
    		lineHeight: 22,
    		color: "#8e8e93",
    		fontSize: 24
  	},
  	wrapper5: {
    		top: "144.13%",
    		right: "53.44%",
    		bottom: "-48.12%",
    		left: "9.16%"
  	},
  	wrapper6: {
    		right: "9.41%",
    		left: "53.18%"
  	},
  	wrapper7: {
    		right: "53.69%",
    		left: "8.91%"
  	},
  	wrapper8: {
    		top: "144.25%",
    		bottom: "-48.24%",
    		left: "53.44%",
    		right: "9.16%"
  	},
  	numberOfAlter: {
    		height: "4.93%",
    		width: "73.54%",
    		top: "137.32%",
    		left: "-5.34%",
    		fontSize: 16,
    		color: "#fff",
    		alignItems: "center",
    		display: "flex",
    		textAlign: "center",
    		fontFamily: "Roboto-Regular",
    		lineHeight: 22,
    		position: "absolute"
  	},
  	dropdownpicker: {
    		backgroundColor: "#8e8e93"
  	},
  	rectangleView: {
    		height: "3.87%",
    		width: "8.4%",
    		top: "137.91%",
    		right: "34.86%",
    		bottom: "-41.78%",
    		left: "56.74%"
  	},
  	editschedule: {
    		backgroundColor: "#000",
    		flex: 1,
    		height: 852,
    		width: "100%"
  	}
});

export default EditSchedule;
