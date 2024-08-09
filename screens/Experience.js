import React, { useState } from 'react';
import {StyleSheet, View, Text, Pressable, TouchableOpacity} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import {ProgressBar, Button} from "react-native-paper";
import ContinueButton from '../components/continueButton';
import BackArrow from '../components/backArrow';
import ExperienceQuestions from '../components/experienceQuestions'

const Experience = ({person}) => {
    		return (
      			<View style={styles.experience}>
        				<View>
							<ExperienceQuestions style={styles.experienceQuesitons}/>
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

      			progressbar: {
        				backgroundColor: "#000"
      			},
      			backArrowIconBtn: {
        				height: "2.82%",
        				width: "6.11%"
      			},
      			experienceQuesitons: {
					top: "18.661%",
					left: "4.07%"
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
    		