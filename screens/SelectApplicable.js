import React, { useState } from 'react';
import {StyleSheet, View, Text, Pressable} from "react-native";
import {Button as RNEButton} from "@rneui/themed";
import {Checkbox, ProgressBar, Button} from "react-native-paper";

const SelectApplicable = () => {
  	const [rectangleCheckboxchecked, setRectangleCheckboxchecked] = useState(false);
  	const [rectangleCheckbox1checked, setRectangleCheckbox1checked] = useState(false);
  	const [rectangleCheckbox2checked, setRectangleCheckbox2checked] = useState(false);
  	const [rectangleCheckbox3checked, setRectangleCheckbox3checked] = useState(false);
  	const [rectangleCheckbox4checked, setRectangleCheckbox4checked] = useState(false);
    		
    		return (
      			<View style={styles.selectapplicable}>
        				<View style={styles.deaconParent}>
          					<Text style={styles.deacon}>Deacon</Text>
          					<RNEButton title="Alhan teacher" radius="5" iconPosition="left" type="clear" color="#8e8e93" titleStyle={styles.alhanTeacherBtn} containerStyle={styles.alhanTeacherBtn1} buttonStyle={styles.alhanTeacherBtn2} />
          					<RNEButton title="Sunday School Teacher" radius="5" iconPosition="left" type="clear" color="#8e8e93" titleStyle={styles.sundaySchoolTeacherBtn} containerStyle={styles.sundaySchoolTeacherBtn1} buttonStyle={styles.sundaySchoolTeacherBtn2} />
          					<RNEButton title="Servants Meeting Attendance Tracker" radius="5" iconPosition="left" type="clear" color="#8e8e93" titleStyle={styles.servantsMeetingAttendanceBtn} containerStyle={styles.servantsMeetingAttendanceBtn1} buttonStyle={styles.servantsMeetingAttendanceBtn2} />
          					<RNEButton title="None applicable" radius="5" iconPosition="left" type="clear" color="#8e8e93" titleStyle={styles.noneApplicableBtn} containerStyle={styles.noneApplicableBtn1} buttonStyle={styles.noneApplicableBtn2} />
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
        				</View>
        				<Pressable style={styles.continuebutton} onPress={()=>{}}>
          					<Text style={styles.continue}>Continue</Text>
        				</Pressable>
        				<View style={[styles.progressBar, styles.progressBarLayout]}>
          					<ProgressBar style={[styles.progressbar, styles.progressBarLayout]} progress={0.4} color="rgba(120, 120, 128, 0.32)" />
        				</View>
        				<Button style={[styles.backarrow, styles.backarrowPosition]} mode="outlined" onPress={() => navigation.goBack()} contentStyle={styles.backArrowIconBtn} />
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
      			progressbar: {
        				backgroundColor: "#000"
      			},
      			backArrowIconBtn: {
        				height: "2.82%",
        				width: "6.11%"
      			},
      			backarrowPosition: {
        				left: "4.07%",
        				position: "absolute"
      			},
      			componentChildPosition: {
        				borderTopWidth: 1,
        				borderColor: "#8e8e93",
        				left: "38.72%",
        				right: "-127.44%",
        				width: "188.72%",
        				height: "0.38%",
        				borderStyle: "solid",
        				position: "absolute"
      			},
      			wrapperPosition: {
        				right: "80.45%",
        				left: "-0.75%",
        				position: "absolute"
      			},
      			progressBarLayout: {
        				width: "83.97%",
        				height: "3.29%"
      			},
      			deacon: {
        				top: "0%",
        				left: "49.62%",
        				fontSize: 20,
        				fontFamily: "Roboto-Regular",
        				color: "#8e8e93",
        				textAlign: "left",
        				letterSpacing: -0.2,
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
        				height: "30.99%",
        				width: "33.84%",
        				top: "27.93%",
        				right: "54.2%",
        				bottom: "41.08%",
        				left: "11.96%",
        				position: "absolute"
      			},
      			continue: {
        				fontSize: 17,
        				fontWeight: "500",
        				fontFamily: "Roboto-Medium",
        				color: "#fff",
        				textAlign: "center",
        				letterSpacing: -0.2
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
        				alignItems: "center",
        				justifyContent: "center",
        				paddingHorizontal: 20,
        				paddingVertical: 15,
        				borderStyle: "solid",
        				left: "4.07%",
        				position: "absolute"
      			},
      			progressBar: {
        				top: "8.45%",
        				right: "7.89%",
        				bottom: "88.26%",
        				left: "8.14%",
        				position: "absolute"
      			},
      			backarrow: {
        				top: "8.69%",
        				right: "89.82%",
        				bottom: "88.5%",
        				overflow: "hidden"
      			},
      			selectapplicable: {
        				flex: 1,
        				width: "100%",
        				height: 852,
        				overflow: "hidden",
        				backgroundColor: "#000"
      			}
    		});
    		
    		export default SelectApplicable;
    		