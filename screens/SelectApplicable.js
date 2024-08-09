import React, { useState } from 'react';
import {StyleSheet, View, Text, Pressable} from "react-native";
import Choices from '../components/choices'
import ContinueButton from "../components/continueButton"
import {Button as RNEButton} from "@rneui/themed";
import {Checkbox, ProgressBar, Button} from "react-native-paper";

const SelectApplicable = ({person}) => {
    		
    		return (
      			<View style={styles.selectapplicable}>
					<View style={styles.continueButton}>
							<ContinueButton location={"DeaconRank"} text={"Continue"}/>
					</View>
					<View style={styles.title}>
							<Text style={styles.titleText}>Select all that apply to {person}</Text>
					</View>
					<View style={styles.choices}>
							<Choices/>
					</View>
					
					<View style={styles.progressBar}>
							<View style={styles.track}>
									<View style={styles.filled} />
							</View>
					</View>

      			</View>);
    		};
    		
    		const styles = StyleSheet.create({
				choices: {
					top: "15%",
					left: "11.959%",

				},
      			progressBar: {
        				top: "8.45%",
        				right: "7.89%",
        				bottom: "88.26%",
        				left: "8.14%",
        				position: "absolute"
      			},
				  filled: {
					position: "absolute",
					marginTop: -2,
					width: "41.01%",
					top: "50%",
					right: "58.99%",
					left: "0%",
					borderRadius: 100,
					backgroundColor: "#147efb",
					height: 4
				},
				track: {
					backgroundColor: "rgba(120, 120, 128, 0.32)",
					width: "100%",
					height: 4
				},
				continueButton: {
					top: "83.568%",
					left: "4.071%"
				},
				title: {
					top: "10%",
					left: "4.071%",
					right: "4.071%",
					width: "88.295%",
				},
				titleText: {
					fontSize: 34,
					letterSpacing: -0.1,
					fontFamily: "Roboto-Regular",
					color: "#8e8e93",
				},
      			selectapplicable: {
        				flex: 1,
        				width: "100%",
        				height: "100%",
        				overflow: "hidden",
        				backgroundColor: "#000"
      			}
    		});
    		
    		export default SelectApplicable;
    		