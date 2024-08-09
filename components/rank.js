import * as React from "react";
import {Pressable, Text, StyleSheet, View} from "react-native";

const Rank = () => {
  	
  	return (
    		<View style={styles.options}>
      			<Pressable style={[styles.deaconFullDeaconWrapper, styles.wrapperFlexBox]}>
        				<Text style={[styles.fullDeacon, styles.deaconTypo]}>Deacon (Full Deacon)</Text>
      			</Pressable>
      			<Pressable style={[styles.subdeaconEpideaconWrapper, styles.wrapperFlexBox]}>
        				<Text style={[styles.deaconTypo, styles.subdeacon]}>Subdeacon (Epideacon)</Text>
      			</Pressable>
      			<Pressable style={[styles.readerOgnostisWrapper, styles.wrapperFlexBox]}>
        				<Text style={[styles.deaconTypo, styles.reader]}>Reader (Ognostis)</Text>
      			</Pressable>
      			<Pressable style={[styles.chanterEpsaltosWrapper, styles.wrapperFlexBox]} onPress={()=>{}}>
        				<Text style={[styles.deaconTypo, styles.chanter]}>Chanter (Epsaltos)</Text>
      			</Pressable>
    		</View>);
};

const styles = StyleSheet.create({
  	wrapperFlexBox: {
    		justifyContent: "space-between",
    		alignItems: "center",
    		flexDirection: "row",
    		backgroundColor: "#8e8e93",
    		borderRadius: 10,
    		left: "0%",
    		right: "0%",
    		height: "14.95%",
    		position: "absolute",
    		width: "100%"
  	},
  	deaconTypo: {
    		textAlign: "center",
    		color: "#000",
    		fontFamily: "Roboto-Bold",
    		fontWeight: "700",
    		letterSpacing: -0.2,
    		fontSize: 24
  	},
  	fullDeacon: {
			left: "63.867%",
  	},
	subdeacon: {
			left: "50%"
	},
	reader: {
			left: "105%"
	},
	chanter: {
		left: "100%"
	},
  	deaconFullDeaconWrapper: {
    		top: "85.05%",
    		bottom: "0%",
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
    		bottom: "85.%"
  	},
  	options: {
    		flex: 1,
    		height: 388,
    		width: "100%"
  	}
});

export default Rank;
