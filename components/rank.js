import * as React from "react";
import {Pressable, Text, StyleSheet, View} from "react-native";

const Rank = () => {
  	
  	return (
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
      			<Pressable style={[styles.chanterEpsaltosWrapper, styles.wrapperFlexBox]} onPress={()=>{}}>
        				<Text style={styles.deaconTypo}>Chanter (Epsaltos)</Text>
      			</Pressable>
    		</View>);
};

const styles = StyleSheet.create({
  	wrapperFlexBox: {
    		padding: 20,
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
    		textAlign: "left",
    		color: "#000",
    		fontFamily: "Roboto-Bold",
    		fontWeight: "700",
    		letterSpacing: -0.2,
    		fontSize: 24
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
    		flex: 1,
    		height: 388,
    		width: "100%"
  	}
});

export default Rank;
