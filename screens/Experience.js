import React, { useState } from 'react';
import {StyleSheet, View, Text, Pressable, TouchableOpacity} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import {ProgressBar, Button} from "react-native-paper";
import ContinueButton from '../components/continueButton';
import BackArrow from '../components/backArrow';
import ExperienceQuestions from '../components/experienceQuestions'
//add back arrow and continue button
const Experience = ({person}) => {
    		return (
      			<View style={styles.experience}>
					<View style={styles.title}>
						<Text style={styles.titleText}>How old are {person}?</Text>
					</View>
					
        			<View style={styles.wrapper}>
							<ExperienceQuestions/>
					</View>
					<View style={styles.title2}>
						<Text style={styles.titleText}>How much experience do {person} have as a deacon?</Text>
					</View>
					<View style={[styles.filled, styles.trackLayout]} />
      			</View>);
    		};
    		
    		const styles = StyleSheet.create({
				wrapper: {
					top: "18.661%",
				},	
      			progressbar: {
					top: "8.4507%"
				},
				trackLayout: {
					height: 4,
					left: "12.2137%",
					right: "12.2137%",
					top: "8.4507%"
	
				},
				filled: {
					position: "absolute",
					marginTop: -2,
					top: "50%",
					right: "8.1429%",
					left: "8.1429%",
					borderRadius: 100,
					backgroundColor: "#007bfe"
				},
				experience: {
        				flex: 1,
        				height: "100%",
        				overflow: "hidden",
        				width: "100%",
        				backgroundColor: "#000"
      			},
				title: {
					top: "18.663%",
					left: "6.615%",
					width: "68.7023%"
				},
				titleText:{
					fontSize: 34,
					letterSpacing: -0.1,
					fontFamily: "Roboto-Regular",
					color: "#8e8e93",
				},
				title2: {
					top: "-10%",
					left: "5.85242%",
					width: "86.768%"
				},
    		});
    		
    		export default Experience;
    		