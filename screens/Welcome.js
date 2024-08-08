import * as React from "react";
import {ImageBackground, StyleSheet, Pressable, TouchableOpacity, Text, View} from "react-native";

const Welcome = () => {
  	
  	return (
    		<View style={styles.welcomescreen}>
      			<ImageBackground style={styles.icon} resizeMode="cover" source="Ⲧⲁⲝⲓⲥ.png" />
      			<ImageBackground style={styles.crucifixionicon} resizeMode="center" source="crucifixionIcon.png" />
      			<View style={[styles.rectangleParent, styles.rectangleLayout]}>
        				<TouchableOpacity style={[styles.frameChild, styles.frameLayout]} activeOpacity={0.2} onPress={()=>{}} />
        				<Text style={[styles.signUp, styles.signTypo]}>Sign up</Text>
      			</View>
      			<Pressable style={[styles.rectangleGroup, styles.rectangleLayout]}>
        				<Pressable style={[styles.frameItem, styles.frameLayout]} onPress={()=>{}} />
        				<Text style={[styles.signIn, styles.signTypo]}>Sign in</Text>
      			</Pressable>
    		</View>);
};

const styles = StyleSheet.create({
  	rectangleLayout: {
    		height: "2.7%",
    		position: "absolute"
  	},
  	frameLayout: {
    		height: 60,
    		width: 300,
    		borderRadius: 10,
    		position: "absolute"
  	},
  	signTypo: {
    		textAlign: "center",
    		fontFamily: "Roboto-Bold",
    		fontWeight: "600",
    		fontSize: 20,
    		left: 0,
    		top: 0,
    		position: "absolute"
  	},
  	icon: {
    		height: "11.27%",
    		width: "90.59%",
    		top: "8.45%",
    		right: "4.71%",
    		bottom: "80.28%",
    		left: "4.71%",
    		position: "absolute"
  	},
  	crucifixionicon: {
    		height: "27.82%",
    		width: "87.02%",
    		top: "30.52%",
    		right: "6.49%",
    		bottom: "41.67%",
    		left: "6.49%",
    		position: "absolute"
  	},
  	frameChild: {
    		top: -18,
    		left: -100,
    		backgroundColor: "#8e8e93"
  	},
  	signUp: {
    		color: "#000",
    		width: 99
  	},
  	rectangleParent: {
    		width: "25.19%",
    		top: "71.24%",
    		right: "37.66%",
    		bottom: "26.06%",
    		left: "37.15%"
  	},
  	frameItem: {
    		top: -19,
    		left: -110,
    		backgroundColor: "#000"
  	},
  	signIn: {
    		color: "#8e8e93",
    		width: 78
  	},
  	rectangleGroup: {
    		width: "19.77%",
    		top: "80.28%",
    		right: "40.28%",
    		bottom: "17.02%",
    		left: "39.95%"
  	},
  	welcomescreen: {
    		flex: 1,
    		width: "100%",
    		height: 852,
    		backgroundColor: "#000"
  	}
});

export default Welcome;
