import * as React from "react";
import {StyleSheet, View, Image, Text} from "react-native";

const SelectApplicable = () => {
  	
  	return (
    		<View style={styles.selectapplicable}>
      			<View style={styles.selectapplicableChild} />
      			<Image style={styles.chevronLeftIcon} resizeMode="cover" source={require("../assets/redArrowLeft.png")} />
      			<Text style={[styles.selectAllThat, styles.selectAllThatFlexBox]}>Select all that apply</Text>
      			<View style={styles.progressBar}>
        				<View style={[styles.track, styles.trackPosition]}>
          					<View style={[styles.filled, styles.trackPosition]} />
        				</View>
      			</View>
      			<Image style={[styles.selectapplicableItem, styles.selectapplicableLayout]} resizeMode="cover" source={require("../assets/redCheckBox.png")} />
      			<Image style={[styles.selectapplicableInner, styles.selectapplicableLayout]} resizeMode="cover" source={require("../assets/redCheckBox.png")}  />
      			<Image style={[styles.rectangleIcon, styles.selectapplicableLayout]} resizeMode="cover" source={require("../assets/redCheckBox.png")}  />
      			<Image style={[styles.selectapplicableChild1, styles.selectapplicableLayout]} resizeMode="cover" source={require("../assets/redCheckBox.png")}  />
      			<Text style={[styles.deacon, styles.teacherTypo]}>Deacon</Text>
      			<Text style={[styles.alhanTeacher, styles.teacherTypo]}>Alhan teacher</Text>
      			<Text style={[styles.sundaySchoolTeacher, styles.teacherTypo]}>Sunday School Teacher</Text>
      			<Text style={[styles.servantsMeetingAttendance, styles.teacherTypo]}>Servants Meeting Attendance Tracker</Text>
      			<View style={[styles.lineView, styles.selectapplicableChildLayout]} />
      			<View style={[styles.selectapplicableChild2, styles.selectapplicableChildLayout]} />
      			<View style={[styles.selectapplicableChild3, styles.selectapplicableChildLayout]} />
      			<View style={[styles.selectapplicableChild4, styles.selectapplicableChildLayout]} />
    		</View>);
};

const styles = StyleSheet.create({
  	selectAllThatFlexBox: {
    		alignItems: "center",
    		display: "flex"
  	},
  	trackPosition: {
    		height: 4,
    		marginTop: -2,
    		top: "50%",
    		position: "absolute"
  	},
  	selectapplicableLayout: {
    		height: 25,
    		width: 25,
    		borderRadius: 5,
    		left: 48,
    		position: "absolute"
  	},
  	teacherTypo: {
    		color: "#ad0000",
    		letterSpacing: -0.2,
    		fontSize: 20,
    		left: 113,
    		textAlign: "left",
    		fontFamily: "Roboto-Regular",
    		position: "absolute"
  	},
  	selectapplicableChildLayout: {
    		height: 1,
    		width: 251,
    		borderTopWidth: 1,
    		borderColor: "#ad0000",
    		borderStyle: "solid",
    		left: 99,
    		position: "absolute"
  	},
  	selectapplicableChild: {
    		top: 0,
    		left: 0,
    		width: 494,
    		height: 978,
    		backgroundColor: "#000",
    		position: "absolute"
  	},
  	chevronLeftIcon: {
    		top: 74,
    		width: 24,
    		height: 24,
    		left: 16,
    		position: "absolute",
    		overflow: "hidden"
  	},
  	selectAllThat: {
    		top: 126,
    		fontSize: 30,
    		letterSpacing: -0.1,
    		color: "rgba(255, 0, 0, 0.8)",
    		width: 328,
    		height: 52,
    		textAlign: "left",
    		fontFamily: "Roboto-Regular",
    		alignItems: "center",
    		display: "flex",
    		left: 16,
    		position: "absolute"
  	},
  	filled: {
    		width: "41.01%",
    		right: "58.99%",
    		left: "0%",
    		borderRadius: 100,
    		backgroundColor: "#aa0b0b"
  	},
  	track: {
    		right: 16,
    		backgroundColor: "rgba(120, 120, 128, 0.32)",
    		left: 16
  	},
  	progressBar: {
    		marginTop: -354,
    		width: "83.97%",
    		right: "8.14%",
    		left: "7.89%",
    		height: 28,
    		top: "50%",
    		backgroundColor: "#000",
    		position: "absolute"
  	},
  	selectapplicableItem: {
    		top: 211
  	},
  	selectapplicableInner: {
    		top: 268
  	},
  	rectangleIcon: {
    		top: 325
  	},
  	selectapplicableChild1: {
    		top: 382
  	},
  	deacon: {
    		top: 212
  	},
  	alhanTeacher: {
    		top: 269
  	},
  	sundaySchoolTeacher: {
    		top: 326
  	},
  	servantsMeetingAttendance: {
    		top: 383,
    		width: 264,
    		alignItems: "center",
    		display: "flex"
  	},
  	lineView: {
    		top: 243
  	},
  	selectapplicableChild2: {
    		top: 301
  	},
  	selectapplicableChild3: {
    		top: 360
  	},
  	selectapplicableChild4: {
    		top: 438
  	},
  	selectapplicable: {
    		borderRadius: 30,
    		backgroundColor: "#fff",
    		flex: 1,
    		width: "100%",
    		height: 852,
    		overflow: "hidden"
  	}
});

export default SelectApplicable;
