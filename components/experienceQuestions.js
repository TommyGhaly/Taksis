import React, { useState } from 'react';
import {StyleSheet, View, Text} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
//finish the formatting for this one 
const ExperienceQuestions = () => {
  	const [rectangleDropdownOpen, setRectangleDropdownOpen] = useState(false);
  	const [rectangleDropdownValue, setRectangleDropdownValue] = useState();
  	
  	return (
    		<View style={styles.experiencequestions}>
      			<View style={styles.component4}>
        				<View style={[styles.wrapper, styles.knobPosition1]}>
          					<DropDownPicker style={styles.dropdownpicker} open={rectangleDropdownOpen} setOpen={setRectangleDropdownOpen} value={rectangleDropdownValue} setValue={setRectangleDropdownValue} items={[]} dropDownContainerStyle={styles.rectangleDropdowndropDownContainer} />
        				</View>
        				<Text style={styles.yearsOld}>years old</Text>
      			</View>
      			<View style={[styles.experienceslider, styles.sliderPosition]}>
        				<View style={[styles.extremes, styles.sliderPosition]}>
          					<Text style={[styles.notExperienced, styles.experiencedTypo]}>Not experienced</Text>
          					<Text style={[styles.veryExperienced, styles.experiencedTypo]}>Very experienced</Text>
        				</View>
        				<View style={[styles.slider, styles.sliderPosition]}>
          					<View style={[styles.unfilled, styles.filledPosition]} />
          					<View style={[styles.filled, styles.knobPosition]} />
          					<View style={[styles.knob, styles.knobPosition]}>
            						<View style={styles.knob1} />
          					</View>
        				</View>
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
  	howLayout: {
    		width: "94.46%",
    		height: "12.15%",
    		position: "absolute"
  	},
  	knobPosition1: {
    		height: "100%",
    		bottom: "0%",
    		top: "0%"
  	},
  	sliderPosition: {
    		right: "0%",
    		position: "absolute"
  	},
  	experiencedTypo: {
    		fontSize: 12,
    		textAlign: "left",
    		color: "#8e8e93",
    		fontFamily: "Roboto-Regular",
    		letterSpacing: -0.1,
    		top: "0%",
    		position: "absolute"
  	},
  	filledPosition: {
    		bottom: "42.86%",
    		top: "42.86%",
    		height: "14.29%",
    		borderRadius: 100
  	},
  	knobPosition: {
    		right: "49.17%",
    		width: "50.83%",
    		left: "0%",
    		position: "absolute"
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
    		borderStyle: "solid",
    		left: "0%",
    		bottom: "0%",
    		position: "absolute"
  	},
  	yearsOld: {
    		height: "84.85%",
    		width: "74.68%",
    		top: "15.15%",
    		left: "25.32%",
    		fontSize: 14,
    		display: "flex",
    		alignItems: "center",
    		textAlign: "left",
    		color: "#8e8e93",
    		fontFamily: "Roboto-Regular",
    		letterSpacing: -0.1,
    		position: "absolute"
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
  	notExperienced: {
    		left: "0%"
  	},
  	veryExperienced: {
    		left: "74.86%"
  	},
  	extremes: {
    		height: "26.92%",
    		width: "99.17%",
    		bottom: "73.08%",
    		left: "0.83%",
    		top: "0%"
  	},
  	unfilled: {
    		right: 0,
    		left: 0,
    		backgroundColor: "rgba(120, 120, 128, 0.32)",
    		borderRadius: 100,
    		position: "absolute"
  	},
  	filled: {
    		backgroundColor: "#147efb",
    		borderRadius: 100,
    		bottom: "42.86%",
    		top: "42.86%",
    		height: "14.29%"
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
    		],
    		borderRadius: 100,
    		position: "absolute"
  	},
  	knob: {
    		bottom: "0%",
    		height: "100%",
    		top: "0%"
  	},
  	slider: {
    		height: "53.85%",
    		top: "46.15%",
    		left: "0%",
    		bottom: "0%",
    		width: "100%"
  	},
  	experienceslider: {
    		top: "87.85%",
    		left: "0%",
    		bottom: "0%",
    		height: "12.15%",
    		right: "0%",
    		width: "100%"
  	},
  	experiencequestions: {
    		flex: 1,
    		height: 428,
    		width: "100%"
  	}
});

export default ExperienceQuestions;
