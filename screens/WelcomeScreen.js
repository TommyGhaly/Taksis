import * as React from "react";
import {Text, StyleSheet, View, Image} from "react-native";

const WelcomeScreen = () => {
  	
  	return (
    		<View style={styles.welcomescreen}>
      			<View style={[styles.signInParent, styles.groupChildLayout]}>
        				<Text style={styles.signIn}>Sign in</Text>
        				<View style={[styles.groupChild, styles.groupChildLayout]} />
        				<Text style={styles.signUp}>Sign up</Text>
        				<Text style={[styles.signIn1, styles.signIn1Clr]}>Sign in</Text>
      			</View>
      			<Image style={styles.crucifixionIcon} resizeMode="cover" source={require("../assets/crucifixionIcon.png")}/>
      			<Text style={[styles.deaconServiceApp, styles.signIn1Clr]}>Deacon Service App</Text>
    		</View>);
};

const styles = StyleSheet.create({
  	groupChildLayout: {
    		width: 300,
    		position: "absolute"
  	},
  	signIn1Clr: {
    		color: "#ff0000",
    		textAlign: "center",
    		position: "absolute"
  	},
  	signIn: {
    		top: 16,
    		fontSize: 24,
    		color: "#fff",
    		textAlign: "left",
    		width: 78,
    		fontFamily: "SF Pro Display",
    		fontWeight: "600",
    		left: 111,
    		position: "absolute"
  	},
  	groupChild: {
    		top: 0,
    		left: 0,
    		borderRadius: 10,
    		backgroundColor: "#ff0000",
    		height: 60
  	},
  	signUp: {
    		top: 18,
    		left: 100,
    		color: "#000",
    		width: 99,
    		textAlign: "center",
    		fontSize: 20,
    		fontFamily: "SF Pro Display",
    		fontWeight: "600",
    		position: "absolute"
  	},
  	signIn1: {
    		top: 95,
    		fontSize: 20,
    		color: "#ff0000",
    		width: 78,
    		fontFamily: "SF Pro Display",
    		fontWeight: "600",
    		left: 111
  	},
  	signInParent: {
    		top: 588,
    		left: 45,
    		height: 119
  	},
  	crucifixionIcon: {
    		top: 205,
    		left: 3,
    		width: 384,
    		height: 252,
    		position: "absolute"
  	},
  	deaconServiceApp: {
    		top: 86,
    		left: 14,
    		fontSize: 36,
    		fontWeight: "800",
    		fontFamily: "Roboto-Black",
    		display: "flex",
    		alignItems: "center",
    		justifyContent: "center",
    		width: 362,
    		height: 103
  	},
  	welcomescreen: {
    		borderRadius: 30,
    		backgroundColor: "#000",
    		flex: 1,
    		width: "100%",
    		height: 844,
    		overflow: "hidden"
  	}
});

export default WelcomeScreen;
