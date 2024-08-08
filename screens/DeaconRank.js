import * as React from "react";
import {StyleSheet, View, Pressable, Text, TouchableOpacity} from "react-native";
import {ProgressBar, Button} from "react-native-paper";

const DeaconRank = () => {
    		
    		return (
      			<View style={styles.deaconrank}>
        				<View style={styles.options}>
          					<Pressable style={[styles.deaconFullDeaconWrapper, styles.wrapperFlexBox]}>
            						<Text style={[styles.deaconFullDeacon, styles.deaconTypo]}>Deacon (Full Deacon)</Text>
          					</Pressable>
          					<Pressable style={[styles.subdeaconEpideaconWrapper, styles.wrapperFlexBox]}>
            						<Text style={styles.deaconTypo}>Subdeacon (Epideacon)</Text>
          					</Pressable>
          					<Pressable style={[styles.readerOgnostisWrapper, styles.wrapperFlexBox]}>
            						<Text style={styles.deaconTypo}>Reader (Ognostis)</Text>
          					</Pressable>
          					<Pressable style={[styles.chanterEpsaltosWrapper, styles.wrapperFlexBox]}>
            						<Text style={styles.deaconTypo}>Chanter (Epsaltos)</Text>
          					</Pressable>
        				</View>
        				<TouchableOpacity style={[styles.continuebutton, styles.backarrowPosition]} activeOpacity={0.2} onPress={()=>{}}>
          					<Text style={styles.continue}>Continue</Text>
        				</TouchableOpacity>
        				<View style={[styles.progressBar, styles.progressBarLayout]}>
          					<ProgressBar style={[styles.progressbar, styles.progressBarLayout]} progress={0.6} color="rgba(120, 120, 128, 0.32)" />
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
      			whatRankOfPosition: {
        				left: "8.14%",
        				position: "absolute"
      			},
      			wrapperFlexBox: {
        				padding: 20,
        				justifyContent: "space-between",
        				backgroundColor: "#8e8e93",
        				left: "0%",
        				right: "0%",
        				height: "14.95%",
        				alignItems: "center",
        				flexDirection: "row",
        				borderRadius: 10,
        				position: "absolute",
        				width: "100%"
      			},
      			deaconTypo: {
        				textAlign: "left",
        				color: "#000",
        				fontFamily: "Roboto-Bold",
        				fontWeight: "700",
        				fontSize: 24,
        				letterSpacing: -0.2
      			},
      			backarrowPosition: {
        				left: "4.07%",
        				position: "absolute"
      			},
      			progressBarLayout: {
        				width: "83.97%",
        				height: "3.29%"
      			},
      			deaconFullDeacon: {
        				width: 251,
        				height: 23
      			},
      			deaconFullDeaconWrapper: {
        				top: "85.05%",
        				bottom: "0%"
      			},
      			subdeaconEpideaconWrapper: {
        				top: "56.7%",
        				bottom: "28.35%"
      			},
      			readerOgnostisWrapper: {
        				top: "28.35%",
        				bottom: "56.7%"
      			},
      			chanterEpsaltosWrapper: {
        				top: "0%",
        				bottom: "85.05%"
      			},
      			options: {
        				height: "45.54%",
        				width: "79.9%",
        				top: "30.52%",
        				right: "10.18%",
        				bottom: "23.94%",
        				left: "9.92%",
        				position: "absolute"
      			},
      			continue: {
        				fontSize: 17,
        				fontWeight: "500",
        				fontFamily: "Roboto-Medium",
        				color: "#fff",
        				textAlign: "center",
        				letterSpacing: -0.2
      			},
      			continuebutton: {
        				height: "5.87%",
        				width: "91.09%",
        				top: "83.57%",
        				right: "4.83%",
        				bottom: "10.56%",
        				backgroundColor: "#333",
        				borderStyle: "solid",
        				borderColor: "rgba(0, 0, 0, 0.15)",
        				borderWidth: 1,
        				justifyContent: "center",
        				paddingHorizontal: 20,
        				paddingVertical: 15,
        				alignItems: "center",
        				flexDirection: "row",
        				borderRadius: 10,
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
        				overflow: "hidden"
      			},
      			deaconrank: {
        				flex: 1,
        				height: 852,
        				overflow: "hidden",
        				width: "100%",
        				backgroundColor: "#000"
      			}
    		});
    		
    		export default DeaconRank;
    		