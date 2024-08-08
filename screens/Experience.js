import React, { useState } from 'react';
import {StyleSheet, View, Text, Pressable, TouchableOpacity} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import {ProgressBar, Button} from "react-native-paper";

const Experience = () => {
  	const [rectangleDropdownOpen, setRectangleDropdownOpen] = useState(false);
  	const [rectangleDropdownValue, setRectangleDropdownValue] = useState();
    		
    		return (
      			<View style={styles.experience}>
        				<View style={styles.howMuchExperienceDoYouHavParent}>
          					<View style={[styles.experienceslider, styles.sliderPosition]}>
            						<View style={styles.extremes}>
              							<Text style={[styles.notExperienced, styles.experiencedTypo]}>Not experienced</Text>
              							<Text style={[styles.veryExperienced, styles.experiencedTypo]}>Very experienced</Text>
            						</View>
            						<View style={[styles.slider, styles.sliderPosition]}>
              							<View style={[styles.unfilled, styles.knob1Layout]} />
              							<View style={styles.filled} />
              							<View style={styles.knob}>
                								<View style={[styles.knob1, styles.knob1Layout]} />
              							</View>
            						</View>
          					</View>
          					<View style={styles.component4}>
            						<View style={styles.wrapper}>
              							<DropDownPicker style={[styles.dropdownpicker, styles.dropdownpickerBorder]} open={rectangleDropdownOpen} setOpen={setRectangleDropdownOpen} value={rectangleDropdownValue} setValue={setRectangleDropdownValue} items={[]} dropDownContainerStyle={styles.rectangleDropdowndropDownContainer} />
            						</View>
            						<Text style={[styles.yearsOld, styles.yearsOldFlexBox]}>years old</Text>
          					</View>
        				</View>
        				<TouchableOpacity style={[styles.continuebutton, styles.yearsOldFlexBox]} activeOpacity={0.2} onPress={()=>{}}>
          					<Text style={styles.continue}>Continue</Text>
        				</TouchableOpacity>
        				<View style={[styles.progressBar, styles.progressBarLayout]}>
          					<ProgressBar style={[styles.progressbar, styles.progressBarLayout]} progress={1} color="rgba(120, 120, 128, 0.32)" />
        				</View>
        				<Button style={styles.backarrow} mode="outlined" onPress={() => navigation.goBack()} contentStyle={styles.backArrowIconBtn} />
      			</View>);
    		};
    		
    		const styles = StyleSheet.create({
      			rectangleDropdowndropDownContainer: {
        				backgroundColor: "#000",
        				borderStyle: "solid",
        				borderColor: "#8e8e93",
        				borderWidth: 1
      			},
      			progressbar: {
        				backgroundColor: "#000"
      			},
      			backArrowIconBtn: {
        				height: "2.82%",
        				width: "6.11%"
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
        				letterSpacing: -0.1
      			},
      			knob1Layout: {
        				borderRadius: 100,
        				position: "absolute"
      			},
      			dropdownpickerBorder: {
        				borderWidth: 1,
        				borderStyle: "solid"
      			},
      			yearsOldFlexBox: {
        				alignItems: "center",
        				position: "absolute"
      			},
      			progressBarLayout: {
        				width: "83.97%",
        				height: "3.29%"
      			},
      			notExperienced: {
        				fontSize: 12,
        				color: "#8e8e93",
        				fontFamily: "Roboto-Regular",
        				letterSpacing: -0.1,
        				top: "0%",
        				position: "absolute",
        				left: "0%"
      			},
      			veryExperienced: {
        				left: "74.86%",
        				fontSize: 12,
        				color: "#8e8e93",
        				fontFamily: "Roboto-Regular",
        				letterSpacing: -0.1,
        				top: "0%",
        				position: "absolute"
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
        				right: "49.17%",
        				width: "50.83%",
        				borderRadius: 100,
        				bottom: "42.86%",
        				top: "42.86%",
        				height: "14.29%",
        				left: "0%",
        				position: "absolute"
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
        				height: "100%",
        				right: "49.17%",
        				width: "50.83%",
        				left: "0%",
        				bottom: "0%",
        				top: "0%",
        				position: "absolute"
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
        				borderColor: "#8e8e93",
        				backgroundColor: "#000"
      			},
      			wrapper: {
        				width: "18.35%",
        				right: "81.65%",
        				borderRadius: 5,
        				borderStyle: "solid",
        				height: "100%",
        				left: "0%",
        				bottom: "0%",
        				top: "0%",
        				position: "absolute"
      			},
      			yearsOld: {
        				height: "84.85%",
        				width: "74.68%",
        				top: "15.15%",
        				left: "25.32%",
        				fontSize: 14,
        				display: "flex",
        				textAlign: "left",
        				color: "#8e8e93",
        				fontFamily: "Roboto-Regular",
        				letterSpacing: -0.1
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
        				height: "50.23%",
        				width: "91.86%",
        				top: "18.66%",
        				right: "4.07%",
        				bottom: "31.1%",
        				left: "4.07%",
        				position: "absolute"
      			},
      			continue: {
        				fontSize: 17,
        				letterSpacing: -0.2,
        				fontWeight: "500",
        				fontFamily: "Roboto-Medium",
        				color: "#fff",
        				textAlign: "center"
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
        				flexDirection: "row",
        				justifyContent: "center",
        				paddingHorizontal: 20,
        				paddingVertical: 15,
        				borderWidth: 1,
        				borderStyle: "solid",
        				left: "4.07%"
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
        				left: "4.07%",
        				position: "absolute",
        				overflow: "hidden"
      			},
      			experience: {
        				flex: 1,
        				height: 852,
        				overflow: "hidden",
        				width: "100%",
        				backgroundColor: "#000"
      			}
    		});
    		
    		export default Experience;
    		