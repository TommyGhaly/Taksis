import * as React from "react";
import {StyleSheet, View, Text, Pressable, TouchableOpacity} from "react-native";
import {ProgressBar, Button} from "react-native-paper";

const Frequency = () => {
    		
    		return (
      			<View style={styles.frequency}>
        				<View style={[styles.frequencySlider, styles.backarrowPosition]}>
          					<View style={styles.slider}>
            						<View style={[styles.unfilled, styles.knob1Layout]} />
            						<View style={styles.filled} />
            						<View style={styles.knob}>
              							<View style={[styles.knob1, styles.knob1Layout]} />
            						</View>
          					</View>
          					<Text style={[styles.notOften, styles.oftenTypo]}>Not often</Text>
          					<Text style={[styles.veryVeryOften, styles.oftenTypo]}>Very Very often</Text>
        				</View>
        				<TouchableOpacity style={[styles.continuebutton, styles.backarrowPosition]} activeOpacity={0.2} onPress={()=>{}}>
          					<Text style={styles.continue}>Continue</Text>
        				</TouchableOpacity>
        				<View style={[styles.progressBar, styles.progressBarLayout]}>
          					<ProgressBar style={[styles.progressbar, styles.progressBarLayout]} progress={0.8} color="rgba(120, 120, 128, 0.32)" />
        				</View>
        				<Button style={[styles.backarrow, styles.backarrowPosition]} mode="outlined" onPress={() => navigation.goBack()} contentStyle={styles.backArrowIconBtn} />
      			</View>);
    		};
    		
    		const styles = StyleSheet.create({
      			progressbar: {
        				backgroundColor: "#000",
        				width: "83.97%",
        				height: "3.29%"
      			},
      			backArrowIconBtn: {
        				height: "2.82%",
        				width: "6.11%"
      			},
      			backarrowPosition: {
        				left: "4.07%",
        				position: "absolute"
      			},
      			knob1Layout: {
        				borderRadius: 100,
        				position: "absolute"
      			},
      			oftenTypo: {
        				textAlign: "left",
        				color: "#8e8e93",
        				fontFamily: "Roboto-Regular",
        				letterSpacing: -0.1,
        				fontSize: 12,
        				top: "0%",
        				position: "absolute"
      			},
      			progressBarLayout: {
        				width: "83.97%",
        				height: "3.29%"
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
        				top: "0%",
        				right: "49.17%",
        				width: "50.83%",
        				left: "0%",
        				bottom: "0%",
        				position: "absolute"
      			},
      			slider: {
        				height: "53.85%",
        				top: "46.15%",
        				right: "0%",
        				left: "0%",
        				bottom: "0%",
        				position: "absolute",
        				width: "100%"
      			},
      			notOften: {
        				left: "0.83%"
      			},
      			veryVeryOften: {
        				left: "75.07%"
      			},
      			frequencySlider: {
        				width: "91.86%",
        				top: "51.29%",
        				right: "4.07%",
        				bottom: "42.61%",
        				height: "6.1%"
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
        				borderStyle: "solid",
        				borderColor: "rgba(0, 0, 0, 0.15)",
        				borderWidth: 1,
        				flexDirection: "row",
        				alignItems: "center",
        				justifyContent: "center",
        				paddingHorizontal: 20,
        				paddingVertical: 15
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
        				overflow: "hidden"
      			},
      			frequency: {
        				flex: 1,
        				height: 852,
        				overflow: "hidden",
        				width: "100%",
        				backgroundColor: "#000"
      			}
    		});
    		
    		export default Frequency;
    		