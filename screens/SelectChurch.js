import * as React from "react";
import {StyleSheet, View, Image, Pressable, Text, TextInput} from "react-native";
import {ProgressBar, Button} from "react-native-paper";
import SearchOptions from '../components/searchOptions'
import ContinueButton from '../components/continueButton'
import BackArrow from '../components/backArrow'
const SelectChurch = ({person}) => {
    		let inputProps={
				text: "Continue",
				location: "SelectApplicable"
			};
			//add back Arrow and continue button
    		return (
				<View style={styles.loadout}>
					<View style={styles.backArrow}>
					</View>
					<View style={styles.title}>
						<Text style={styles.titleText}>Select the church(s) {person} regularly attend</Text>
					</View>
					<View style={styles.position}>
						<SearchOptions/>
					</View>
					<View style={styles.continueButton}>
					</View>
					<View style={styles.dontSeeYourChurchRegiste}>
						<Pressable style={styles.dontSeeYourContainer} onPress={()=>{}}>
							<Text style={styles.text}>
							<Text style={styles.dontSeeYour}>{`Don’t see your church? `}</Text>
							<Text style={styles.registerIt}>Register it</Text>
							</Text>
						</Pressable>
					</View>
					<View style={styles.progressBar}>
						<View style={styles.track}>
							<View style={styles.filled} />
						</View>
					</View>
					<View style={styles.backbutton}>
						<BackArrow/>
					</View>
				</View>);
    		};
    		
    		const styles = StyleSheet.create({
      			position: {
						top: "27.230%",
						bottom: "49.882%",
						left: "2.223%",
						right: "2.223%",
						position: "absolute"
      			},
				loadout: {
					width: "100%",
					height: "100%",
					flex: 1
				},
				dontSeeYour: {
					color: "#8e8e93"
				},
				registerIt: {
					color: "#6e85e3"
				},
				text: {
					fontSize: 15,
					letterSpacing: -0.1,
					fontFamily: "Roboto-Regular",
					textAlign: "center"
				},
				dontSeeYourContainer: {
					position: "absolute",
					left: "23.91%",
					top: "80%"
				},
				dontSeeYourChurchRegiste: {
					flex: 1,
					width: "100%",
					height: "2.112%"
				},
				continueButton: {
					top: "83.568%",
					height: "5.86%",
					left: "1.877%",
					right: "1.877%",
					bottom: "89.4366%",
				},
				title: {
					top: "15.023%",
					left: "4.071",
					height: "6.103%",
					width: "88.295%",
					flex: 1
				},
				titleText: {
					fontSize: 34,
					letterSpacing: -0.1,
					fontFamily: "Roboto-Regular",
					textAlign: "left",
					color: "#8e8e93"
				},
				progressBar: {
					top: "8.45%",
					right: "12.2137%",
					bottom: "88.26%",
					left: "12.2137%",
					position: "absolute"
			    },
			    filled: {
					position: "absolute",
					marginTop: -2,
					width: "22.43%",
					top: "50%",
					right: "77.57%",
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
				backbutton: {
					top: "8.68545%",
					left: "4.071%"
				}
    		});
    		
    		export default SelectChurch;
    		