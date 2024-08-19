import React, { useState } from 'react';
import {StyleSheet, View, Text, Pressable} from "react-native";
import Choices from '../components/choices'
import {useNavigation} from "@react-navigation/native";
import BackArrow from '../components/backArrow'

const SelectApplicable = ({route, navigation}) => {
	const {person} = route.params
    		return (
      			<View style={styles.selectapplicable}>
					<View style={styles.backarrow}>
							<BackArrow/>
					</View>
					<View style={styles.title}>
							<Text style={styles.titleText}>Select all that apply to {person}</Text>
					</View>
					<View style={styles.choices}>
							<Choices/>
					</View>
					<View style={styles.continueLayout}>
								<Pressable onPress={()=>(navigation.navigate('DeaconRank', {person: person}))}>
									<Text style={styles.continuetext}>Continue</Text>
								</Pressable>
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
				backarrow: {
					top: 74,
					left: 16
      			},
      			progressBar: {
        				top: 84,
        				right: "12.2137%",
        				bottom: "88.26%",
        				left: "12.2137%",
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
      			},

				continueLayout: {
					top: 385,
					left: 16, 
					height: 50,
					width: 358,
					backgroundColor: "#333",
					borderRadius: 10
				},
				continuetext: {
					top: 15,
					fontSize: 17,
					letterSpacing: -0.2,
					fontWeight: "500",
					fontFamily: "Roboto-Medium",
					color: "#fff",
					textAlign: "center"
				},
    		});
    		
    		export default SelectApplicable;
    		