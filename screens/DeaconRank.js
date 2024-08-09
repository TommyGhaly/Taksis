import * as React from "react";
import {StyleSheet, View, Pressable, Text, TouchableOpacity} from "react-native";
import {ProgressBar, Button} from "react-native-paper";
import Rank from '../components/rank'
import ContinueButton from "../components/continueButton";
import BackArrow from "../components/backArrow";
//fix the continue button make it not have such weird dimentions and finish bakc arrow
const DeaconRank = ({person}) => {
    		
    		return (
      			<View style={styles.deaconrank}>
						<View style={styles.rank}>
								<Rank style={styles.rank}/>
						</View>
						<View style={styles.title}>
							<Text style={styles.titleText}>What rank of deacon are {person}?</Text>
						</View>
						<View style={styles.progressBar}>
							<View style={styles.track}>
								<View style={styles.filled} />
							</View>
						</View>
					<View style={styles.continue}>
						<ContinueButton/>
					</View>
      			</View>);
    		};
    		
    		const styles = StyleSheet.create({
				progressBar: {
					top: "8.45%",
					right: "7.89%",
					bottom: "88.26%",
					left: "8.14%",
					position: "absolute",
					backgroundColor: "#000"
			    },
				filled: {
					position: "absolute",
					marginTop: -2,
					width: "59.3%",
					top: "50%",
					right: "40.7%",
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
      			rank: {
					top: "30.5164%",
					left: "9.9236%",
					height: "45.529%",
					width: "79.898%"
				},
				title: {
					top: "-30%",
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
				continue: {
					top: "27%",
					left: "4.071%"
				},
      			deaconrank: {
        				flex: 1,
        				height: "100%",
        				overflow: "hidden",
        				width: "100%",
        				backgroundColor: "#000"
      			}
    		});
    		
    		export default DeaconRank;
    		