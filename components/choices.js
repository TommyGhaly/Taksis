import React, { useState } from 'react';
import {Text, StyleSheet, View} from "react-native";
import {Button} from "@rneui/themed";
import {Checkbox} from "react-native-paper";

const choices = () => {
  	const [rectangleCheckboxchecked, setRectangleCheckboxchecked] = useState(false);
  	const [rectangleCheckbox1checked, setRectangleCheckbox1checked] = useState(false);
  	const [rectangleCheckbox2checked, setRectangleCheckbox2checked] = useState(false);
  	const [rectangleCheckbox3checked, setRectangleCheckbox3checked] = useState(false);
  	const [rectangleCheckbox4checked, setRectangleCheckbox4checked] = useState(false);
  	
  	return (
    		<View style={styles.deaconParent}>
      			<Text style={styles.deacon}>Deacon</Text>
      			<Button title="Alhan teacher" radius="5" iconPosition="left" type="clear" color="#8e8e93" titleStyle={styles.alhanTeacherBtn} containerStyle={styles.alhanTeacherBtn1} buttonStyle={styles.alhanTeacherBtn2} />
      			<Button title="Sunday School Teacher" radius="5" iconPosition="left" type="clear" color="#8e8e93" titleStyle={styles.sundaySchoolTeacherBtn} containerStyle={styles.sundaySchoolTeacherBtn1} buttonStyle={styles.sundaySchoolTeacherBtn2} />
      			<Button title="Servants Meeting Attendance Tracker" radius="5" iconPosition="left" type="clear" color="#8e8e93" titleStyle={styles.servantsMeetingAttendanceBtn} containerStyle={styles.servantsMeetingAttendanceBtn1} buttonStyle={styles.servantsMeetingAttendanceBtn2} />
      			<Button title="None applicable" radius="5" iconPosition="left" type="clear" color="#8e8e93" titleStyle={styles.noneApplicableBtn} containerStyle={styles.noneApplicableBtn1} buttonStyle={styles.noneApplicableBtn2} />
      			<View style={[styles.componentChild, styles.componentChildPosition]} />
      			<View style={[styles.componentItem, styles.componentChildPosition]} />
      			<View style={[styles.componentInner, styles.componentChildPosition]} />
      			<View style={[styles.lineView, styles.componentChildPosition]} />
      			<View style={[styles.componentChild1, styles.componentChildPosition]} />
      			<View style={[styles.wrapper, styles.wrapperPosition]}>
        				<Checkbox status={rectangleCheckboxchecked ? 'checked' : 'unchecked' } onPress={() => setRectangleCheckboxchecked(!rectangleCheckboxchecked)} color="#000" />
      			</View>
      			<View style={[styles.container, styles.wrapperPosition]}>
        				<Checkbox status={rectangleCheckbox1checked ? 'checked' : 'unchecked' } onPress={() => setRectangleCheckbox1checked(!rectangleCheckbox1checked)} color="#000" />
      			</View>
      			<View style={[styles.frame, styles.wrapperPosition]}>
        				<Checkbox status={rectangleCheckbox2checked ? 'checked' : 'unchecked' } onPress={() => setRectangleCheckbox2checked(!rectangleCheckbox2checked)} color="#000" />
      			</View>
      			<View style={[styles.rectangleView, styles.wrapperPosition]}>
        				<Checkbox status={rectangleCheckbox3checked ? 'checked' : 'unchecked' } onPress={() => setRectangleCheckbox3checked(!rectangleCheckbox3checked)} color="#000" />
      			</View>
      			<View style={[styles.wrapper1, styles.wrapperPosition]}>
        				<Checkbox status={rectangleCheckbox4checked ? 'checked' : 'unchecked' } onPress={() => setRectangleCheckbox4checked(!rectangleCheckbox4checked)} color="#000" />
      			</View>
    		</View>);
};

const styles = StyleSheet.create({
  	alhanTeacherBtn: {
    		color: "#8e8e93",
    		fontSize: 20,
    		fontFamily: "Roboto-Regular"
  	},
  	alhanTeacherBtn1: {
    		left: "49.62%",
    		top: "21.59%",
    		position: "absolute"
  	},
  	alhanTeacherBtn2: {},
  	sundaySchoolTeacherBtn: {
    		color: "#8e8e93",
    		fontSize: 20,
    		fontFamily: "Roboto-Regular"
  	},
  	sundaySchoolTeacherBtn1: {
    		left: "49.62%",
    		top: "43.18%",
    		position: "absolute"
  	},
  	sundaySchoolTeacherBtn2: {},
  	servantsMeetingAttendanceBtn: {
    		color: "#8e8e93",
    		fontSize: 20,
    		fontFamily: "Roboto-Regular"
  	},
  	servantsMeetingAttendanceBtn1: {
    		left: "49.62%",
    		top: "64.77%",
    		position: "absolute"
  	},
  	servantsMeetingAttendanceBtn2: {
    		width: "198.5%"
  	},
  	noneApplicableBtn: {
    		color: "#8e8e93",
    		fontSize: 20,
    		fontFamily: "Roboto-Regular"
  	},
  	noneApplicableBtn1: {
    		left: "49.62%",
    		top: "90.91%",
    		position: "absolute"
  	},
  	noneApplicableBtn2: {
    		width: "198.5%"
  	},
  	componentChildPosition: {
    		borderTopWidth: 1,
    		borderColor: "#8e8e93",
    		borderStyle: "solid",
    		left: "38.72%",
    		right: "-127.44%",
    		width: "188.72%",
    		height: "0.38%",
    		position: "absolute"
  	},
  	wrapperPosition: {
    		right: "80.45%",
    		left: "-0.75%",
    		position: "absolute"
  	},
  	deacon: {
    		top: "0%",
    		left: "49.62%",
    		fontSize: 20,
    		letterSpacing: -0.2,
    		fontFamily: "Roboto-Regular",
    		color: "#8e8e93",
    		textAlign: "left",
    		position: "absolute"
  	},
  	componentChild: {
    		top: "11.55%",
    		bottom: "88.07%"
  	},
  	componentItem: {
    		top: "33.52%",
    		bottom: "66.1%"
  	},
  	componentInner: {
    		top: "55.87%",
    		bottom: "43.75%"
  	},
  	lineView: {
    		top: "85.42%",
    		bottom: "14.2%"
  	},
  	componentChild1: {
    		top: "101.33%",
    		bottom: "-1.7%"
  	},
  	wrapper: {
    		top: "46.97%",
    		bottom: "42.8%"
  	},
  	container: {
    		top: "68.56%",
    		bottom: "21.21%"
  	},
  	frame: {
    		top: "90.15%",
    		bottom: "-0.38%"
  	},
  	rectangleView: {
    		top: "25.38%",
    		bottom: "64.39%"
  	},
  	wrapper1: {
    		top: "3.79%",
    		bottom: "85.98%"
  	},
  	deaconParent: {
    		flex: 1,
    		width: "100%",
    		height: 264
  	}
});

export default choices;
