import React, { useState } from 'react';
import {StyleSheet, View, Text, Pressable, TouchableOpacity} from "react-native";
import { useNavigation } from "@react-navigation/native";
import ExperienceQuestions from '../components/experienceQuestions'
import BackArrow from '../components/backArrow';

function tabs(navigation){
	navigation.reset({
		index: 0,
		routes: [{ name: 'MainContainer' }],
	  });
	return
};

const Experience = ({route, navigation}) => {
	const {person} = route.params;
    		return (
      			<View style={styles.experience}>
					<View style={styles.backarrow}>
								<BackArrow/>
					</View>
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
					<View style={styles.continueLayout}>
								<Pressable onPress={()=>(tabs(navigation))}>
									<Text style={styles.continuetext}>Continue</Text>
								</Pressable>
					</View>
      			</View>);
    		};

    		const styles = StyleSheet.create({
				backarrow: {
					top: 74,
					left: 16
      			},
				continueLayout: {
					bottom: -142,
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
				wrapper: {
					top: "18.661%",
				},	
      			progressbar: {
					top: 84
				},
				trackLayout: {
					height: 4,
					left: "12.2137%",
					right: "12.2137%",
					top: 84
	
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
    		