import * as React from "react";
import {StyleSheet, View, Image, Text} from "react-native";

const DeaconRank = () => {
  	
  	return (
    		<View style={styles.deaconrank}>
      			<View style={styles.deaconrankChild} />
      			<Image style={styles.chevronLeftIcon} resizeMode="cover" source="chevron-left.png" />
      			<Text style={styles.whatRankOf}>What rank of deacon are you?</Text>
        				<View style={styles.progressBar}>
          					<View style={styles.track}>
            						<View style={styles.filled} />
          					</View>
        				</View>
        				<View style={styles.frameParent}>
          					<View style={[styles.deaconFullDeaconWrapper, styles.wrapperFlexBox]}>
            						<Text style={styles.deaconFullDeacon}>Deacon (Full Deacon)</Text>
          					</View>
          					<View style={[styles.subdeaconEpideaconWrapper, styles.wrapperFlexBox]}>
            						<Text style={styles.deaconFullDeacon}>Subdeacon (Epideacon)</Text>
          					</View>
          					<View style={[styles.readerOgnostisWrapper, styles.wrapperFlexBox]}>
            						<Text style={styles.deaconFullDeacon}>Reader (Ognostis)</Text>
          					</View>
          					<View style={[styles.chanterEpsaltosWrapper, styles.wrapperFlexBox]}>
            						<Text style={styles.deaconFullDeacon}>Chanter (Epsaltos)</Text>
          					</View>
        				</View>
        				<View style={styles.continueWrapper}>
          					<Text style={styles.continue}>Continue</Text>
        				</View>
        				</View>);
      			};
      			
      			const styles = StyleSheet.create({
        				wrapperFlexBox: {
          					padding: 20,
          					justifyContent: "space-between",
          					height: 58,
          					flexDirection: "row",
          					borderRadius: 10,
          					width: 314,
          					backgroundColor: "#aa0b0b",
          					alignItems: "center",
          					left: 0,
          					position: "absolute"
        				},
        				deaconrankChild: {
          					width: 494,
          					height: 978,
          					backgroundColor: "#000",
          					left: 0,
          					position: "absolute",
          					top: 0
        				},
        				chevronLeftIcon: {
          					top: 74,
          					width: 24,
          					height: 24,
          					left: 16,
          					position: "absolute",
          					overflow: "hidden"
        				},
        				whatRankOf: {
          					marginLeft: -164.5,
          					top: 160,
          					left: "50%",
          					fontSize: 34,
          					letterSpacing: -0.3,
          					fontFamily: "Roboto-Regular",
          					color: "rgba(255, 0, 0, 0.8)",
          					display: "flex",
          					width: 290,
          					height: 40,
          					alignItems: "center",
          					textAlign: "left",
          					position: "absolute"
        				},
        				filled: {
          					width: "59.3%",
          					right: "40.7%",
          					left: "0%",
          					borderRadius: 100,
          					backgroundColor: "#aa0b0b",
          					height: 4,
          					marginTop: -2,
          					top: "50%",
          					position: "absolute"
        				},
        				track: {
          					right: 16,
          					backgroundColor: "rgba(120, 120, 128, 0.32)",
          					height: 4,
          					marginTop: -2,
          					top: "50%",
          					left: 16,
          					position: "absolute"
        				},
        				progressBar: {
          					marginTop: -354,
          					width: "83.97%",
          					right: "8.14%",
          					left: "7.89%",
          					height: 28,
          					top: "50%",
          					backgroundColor: "#000",
          					position: "absolute"
        				},
        				deaconFullDeacon: {
          					fontSize: 20,
          					fontWeight: "700",
          					fontFamily: "Roboto-Bold",
          					color: "#000",
          					letterSpacing: -0.2,
          					textAlign: "left"
        				},
        				deaconFullDeaconWrapper: {
          					top: 330
        				},
        				subdeaconEpideaconWrapper: {
          					top: 220
        				},
        				readerOgnostisWrapper: {
          					top: 110
        				},
        				chanterEpsaltosWrapper: {
          					top: 0,
          					justifyContent: "space-between",
          					height: 58
        				},
        				frameParent: {
          					top: 260,
          					left: 47,
          					height: 388,
          					width: 314,
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
        				continueWrapper: {
          					top: 729,
          					backgroundColor: "#333",
          					borderStyle: "solid",
          					borderColor: "rgba(0, 0, 0, 0.15)",
          					borderWidth: 1,
          					width: 358,
          					justifyContent: "center",
          					paddingHorizontal: 20,
          					paddingVertical: 15,
          					flexDirection: "row",
          					borderRadius: 10,
          					alignItems: "center",
          					left: 16,
          					position: "absolute"
        				},
        				deaconrank: {
          					borderRadius: 30,
          					backgroundColor: "#fff",
          					flex: 1,
          					width: "100%",
          					height: 852,
          					overflow: "hidden"
        				}
      			});
      			
      			export default DeaconRank;
      			