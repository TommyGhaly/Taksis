import React, { useState } from 'react';
import {StyleSheet, View, Text} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
//add slider component 
const Experience = () => {
  	const [rectangleDropdownOpen, setRectangleDropdownOpen] = useState(false);
  	const [rectangleDropdownValue, setRectangleDropdownValue] = useState();
  	
  	return (
    		<View style={styles.howMuchExperienceDoYouHavParent}>
      			<View style={[styles.experienceslider, styles.sliderPosition]}>
        				<View style={styles.extremes}>
          					<Text style={[styles.notExperienced, styles.experiencedTypo]}>Not experienced</Text>
          					<Text style={[styles.veryExperienced, styles.experiencedTypo]}>Very experienced</Text>
        				</View>
        				<View style={[styles.slider, styles.sliderPosition]}>
          					<View style={[styles.unfilled, styles.knob1Layout]} />
          					<View style={[styles.filled, styles.knobPosition1]} />
          					<View style={[styles.knob, styles.knobPosition]}>
            						<View style={[styles.knob1, styles.knob1Layout]} />
          					</View>
        				</View>
      			</View>
      			<View style={styles.component4}>
        				<View style={[styles.wrapper, styles.knobPosition]}>
          					<DropDownPicker style={styles.dropdownpicker} open={rectangleDropdownOpen} setOpen={setRectangleDropdownOpen} value={rectangleDropdownValue} setValue={setRectangleDropdownValue} items={[]} dropDownContainerStyle={styles.rectangleDropdowndropDownContainer} />
        				</View>
        				<Text style={[styles.yearsOld, styles.experiencedTypo]}>years old</Text>
      			</View>
    		</View>);
};

const styles = StyleSheet.create({
  	rectangleDropdowndropDownContainer: {
    		backgroundColor: "#000",
    		borderStyle: "solid",
    		borderColor: "#8e8e93",
    		borderWidth: 1
  	},
  	sliderPosition: {
    		bottom: "0%",
    		left: "0%",
    		right: "0%",
    		position: "absolute",
    		width: "100%"
  	},
  	experiencedTypo: {
    		textAlign: "left",
    		color: "#8e8e93",
    		fontFamily: "Roboto-Regular",
    		letterSpacing: -0.1,
    		position: "absolute"
  	},
  	knob1Layout: {
    		borderRadius: 100,
    		position: "absolute"
  	},
  	knobPosition1: {
    		right: "49.17%",
    		width: "50.83%"
  	},
  	knobPosition: {
    		height: "100%",
    		left: "0%",
    		bottom: "0%",
    		top: "0%",
    		position: "absolute"
  	},
  	notExperienced: {
    		fontSize: 12,
    		color: "#8e8e93",
    		fontFamily: "Roboto-Regular",
    		letterSpacing: -0.1,
    		top: "0%",
    		left: "0%"
  	},
  	veryExperienced: {
    		left: "74.86%",
    		fontSize: 12,
    		color: "#8e8e93",
    		fontFamily: "Roboto-Regular",
    		letterSpacing: -0.1,
    		top: "0%"
  	},
  	extremes: {
    		height: "26.92%",
    		width: "99.17%",
    		bottom: "73.08%",
    		left: "0.83%",
    		right: "0%",
    		top: "0%",
    		position: "absolute"
  	},
  	unfilled: {
    		right: 0,
    		left: 0,
    		backgroundColor: "rgba(120, 120, 128, 0.32)",
    		bottom: "42.86%",
    		top: "42.86%",
    		height: "14.29%",
    		borderRadius: 100
  	},
  	filled: {
    		backgroundColor: "#147efb",
    		borderRadius: 100,
    		position: "absolute",
    		bottom: "42.86%",
    		top: "42.86%",
    		height: "14.29%",
    		left: "0%"
  	},
  	knob1: {
    		marginTop: -14,
    		top: "50%",
    		right: -41,
    		shadowColor: "rgba(0, 0, 0, 0.12)",
    		shadowOffset: {
      			width: 0,
      			height: 0.5
    		},
    		shadowRadius: 4,
    		elevation: 4,
    		shadowOpacity: 1,
    		backgroundColor: "#fff",
    		width: 28,
    		height: 28,
    		transform: [
      			{
        				rotate: "180deg"
      			}
    		]
  	},
  	knob: {
    		right: "49.17%",
    		width: "50.83%"
  	},
  	slider: {
    		height: "53.85%",
    		top: "46.15%",
    		left: "0%"
  	},
  	experienceslider: {
    		top: "87.85%",
    		left: "0%",
    		height: "12.15%",
    		bottom: "0%"
  	},
  	dropdownpicker: {
    		backgroundColor: "#000",
    		borderColor: "#8e8e93",
    		borderWidth: 1,
    		borderStyle: "solid"
  	},
  	wrapper: {
    		width: "18.35%",
    		right: "81.65%",
    		borderRadius: 5,
    		borderStyle: "solid"
  	},
  	yearsOld: {
    		height: "84.85%",
    		width: "74.68%",
    		top: "15.15%",
    		left: "25.32%",
    		fontSize: 14,
    		display: "flex",
    		alignItems: "center"
  	},
  	component4: {
    		height: "7.71%",
    		width: "43.77%",
    		top: "17.76%",
    		right: "18.01%",
    		bottom: "74.53%",
    		left: "38.23%",
    		position: "absolute"
  	},
  	howMuchExperienceDoYouHavParent: {
    		flex: 1,
    		height: 428,
    		width: "100%"
  	}
});

export default Experience;
