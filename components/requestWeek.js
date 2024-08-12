import * as React from "react";
import {Pressable, Image, StyleSheet, Text, View, TouchableOpacity} from "react-native";

const FrameScreen = () => {
  	
  	return (
    		<TouchableOpacity style={styles.attendancetitleParent} activeOpacity={0.2} onPress={()=>{}}>
      			<View style={styles.attendancetitlePosition}>
        				<Image style={[styles.attendancetitleChild, styles.attendancetitlePosition]} resizeMode="cover" source="Rectangle 17.png" />
        				<Text style={styles.requestAWeek}>Request a week</Text>
      			</View>
    		</TouchableOpacity>);
};

const styles = StyleSheet.create({
  	attendancetitlePosition: {
    		left: "0%",
    		bottom: "0%",
    		right: "0%",
    		top: "0%",
    		height: "100%",
    		position: "absolute",
    		width: "100%"
  	},
  	attendancetitleChild: {
    		borderRadius: 10,
    		maxWidth: "100%",
    		overflow: "hidden",
    		maxHeight: "100%"
  	},
  	requestAWeek: {
    		height: "52.11%",
    		width: "82.5%",
    		top: "23.94%",
    		left: "8.57%",
    		fontSize: 24,
    		lineHeight: 22,
    		fontFamily: "Roboto-Regular",
    		color: "#8e8e93",
    		textAlign: "center",
    		display: "flex",
    		alignItems: "center",
    		justifyContent: "center",
    		position: "absolute"
  	},
  	attendancetitleParent: {
    		flex: 1,
    		height: 71,
    		width: "100%"
  	}
});

export default FrameScreen;
