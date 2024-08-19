import React, { useState } from 'react';
import {Text, StyleSheet, View, Image} from "react-native";
import {Checkbox} from "react-native-paper";
//get the checkboxes working
const Group = () => {
  	const [rectangleCheckboxchecked, setRectangleCheckboxchecked] = useState(false);
  	const [rectangleCheckbox1checked, setRectangleCheckbox1checked] = useState(false);
  	const [rectangleCheckbox2checked, setRectangleCheckbox2checked] = useState(false);
  	const [rectangleCheckbox3checked, setRectangleCheckbox3checked] = useState(false);
  	const [rectangleCheckbox4checked, setRectangleCheckbox4checked] = useState(false);
  	
  	return (
    		<View style={styles.deaconParent}>
      			<Text style={[styles.deacon, styles.teacherTypo]}>Deacon</Text>
      			<Text style={[styles.alhanTeacher, styles.teacherTypo]}>Alhan teacher</Text>
      			<Text style={[styles.sundaySchoolTeacher, styles.teacherTypo]}>Sunday School Teacher</Text>
      			<Text style={[styles.servantsMeetingAttendance, styles.noneApplicableTypo]}>Servants Meeting Attendance Tracker</Text>
      			<Text style={[styles.noneApplicable, styles.noneApplicableTypo]}>None applicable</Text>
      			<View style={[styles.groupChild, styles.groupChildPosition]} />
      			<View style={[styles.groupItem, styles.groupChildPosition]} />
      			<View style={[styles.groupInner, styles.groupChildPosition]} />
      			<View style={[styles.lineView, styles.groupChildPosition]} />
      			<View style={[styles.groupChild1, styles.groupChildPosition]} />
      			<View style={[styles.wrapper, styles.wrapperPosition]}>
						<Image style={styles.boxes} resizeMode="cover" source={require("../assets/Rectangle 10.png")}/>
        				<Checkbox status={rectangleCheckboxchecked ? 'checked' : 'unchecked' } onPress={() => setRectangleCheckboxchecked(!rectangleCheckboxchecked)} color="#fff" />
      			</View>
      			<View style={[styles.container, styles.wrapperPosition]}>
        				<Checkbox status={rectangleCheckbox1checked ? 'checked' : 'unchecked' } onPress={() => setRectangleCheckbox1checked(!rectangleCheckbox1checked)} color="#fff">
								<Image style={styles.boxes} resizeMode="cover" source={require("../assets/Rectangle 10.png")}/>
						</Checkbox>
      			</View>
      			<View style={[styles.frame, styles.wrapperPosition]}>
        				<Checkbox status={rectangleCheckbox2checked ? 'checked' : 'unchecked' } onPress={() => setRectangleCheckbox2checked(!rectangleCheckbox2checked)} color="#fff" />
      			</View>
      			<View style={[styles.rectangleView, styles.wrapperPosition]}>
        				<Checkbox status={rectangleCheckbox3checked ? 'checked' : 'unchecked' } onPress={() => setRectangleCheckbox3checked(!rectangleCheckbox3checked)} color="#fff" />
      			</View>
      			<View style={[styles.wrapper1, styles.wrapperPosition]}>
        				<Checkbox status={rectangleCheckbox4checked ? 'checked' : 'unchecked' } onPress={() => setRectangleCheckbox4checked(!rectangleCheckbox4checked)} color="#fff" />
      			</View>
    		</View>);
};

const styles = StyleSheet.create({
  	teacherTypo: {
    		textAlign: "left",
    		color: "#8e8e93",
    		fontFamily: "Roboto-Regular",
    		letterSpacing: -0.2,
    		fontSize: 20,
    		left: "20%",
    		position: "absolute"
  	},
  	noneApplicableTypo: {
    		alignItems: "center",
    		display: "flex",
    		width: "80%",
    		textAlign: "left",
    		color: "#8e8e93",
    		fontFamily: "Roboto-Regular",
    		letterSpacing: -0.2,
    		fontSize: 20,
    		left: "20%",
    		position: "absolute"
  	},
  	groupChildPosition: {
    		borderTopWidth: 1,
    		borderColor: "#8e8e93",
    		borderStyle: "solid",
    		left: "15.61%",
    		right: "8.33%",
    		width: "76.06%",
    		height: "0.37%",
    		position: "absolute"
  	},
  	wrapperPosition: {
    		right: "92.12%",
    		left: "-0.3%",
    		position: "absolute"
  	},
  	deacon: {
    		top: "0%"
  	},
  	alhanTeacher: {
    		top: "21.27%"
  	},
  	sundaySchoolTeacher: {
    		top: "42.54%"
  	},
  	servantsMeetingAttendance: {
    		top: "63.81%"
  	},
  	noneApplicable: {
    		top: "89.55%"
  	},
  	groupChild: {
    		top: "11.38%",
    		bottom: "88.25%"
  	},
  	groupItem: {
    		top: "33.02%",
    		bottom: "66.6%"
  	},
  	groupInner: {
    		top: "55.04%",
    		bottom: "44.59%"
  	},
  	lineView: {
    		top: "84.14%",
    		bottom: "15.49%"
  	},
  	groupChild1: {
    		top: "99.81%",
    		bottom: "-0.19%"
  	},
  	wrapper: {
    		top: "3.73%",
    		bottom: "86.19%"
  	},
  	container: {
    		top: "46.27%",
    		bottom: "43.66%"
  	},
  	frame: {
    		top: "67.54%",
    		bottom: "22.39%"
  	},
  	rectangleView: {
    		top: "88.81%",
    		bottom: "1.12%"
  	},
  	wrapper1: {
    		top: "25%",
    		bottom: "64.93%"
  	},
  	deaconParent: {
    		width: 330,
    		height: 268
  	}
});

export default Group;
