import * as React from "react";
import {StyleSheet, View, Image, Text} from "react-native";

const SignUp = () => {
  	
  	return (
    		<View style={styles.signUp}>
      			<View style={styles.signUpChild} />
      			<Image style={[styles.chevronLeftIcon, styles.iconLayout]} resizeMode="cover" source={require("../assets/redArrowLeft.png")} />
      			<Text style={[styles.signUp1, styles.registerTypo1]}>Sign up</Text>
      			<View style={[styles.enterYourEmailWrapper, styles.frameInnerSpaceBlock]}>
        				<Text style={[styles.enterYourEmail, styles.orTypo]}>Enter your email</Text>
      			</View>
      			<View style={[styles.enterYourEmailContainer, styles.frameInnerSpaceBlock]}>
        				<Text style={[styles.enterYourEmail, styles.orTypo]}>Enter your password</Text>
      			</View>
      			<View style={[styles.enterYourEmailFrame, styles.frameInnerSpaceBlock]}>
        				<Text style={[styles.enterYourEmail, styles.orTypo]}>Confirm your password</Text>
      			</View>
      			<View style={[styles.frameView, styles.frameInnerSpaceBlock]}>
        				<Text style={[styles.enterYourEmail, styles.orTypo]}>Enter your phone</Text>
      			</View>
      			<View style={[styles.enterYourEmailWrapper1, styles.frameInnerSpaceBlock]}>
        				<Text style={[styles.enterYourEmail, styles.orTypo]}>Enter your name</Text>
      			</View>
      			<View style={[styles.continueWrapper, styles.signInnerFlexBox]}>
        				<Text style={[styles.continue, styles.registerTypo]}>Continue</Text>
      			</View>
      			<View style={[styles.signUpInner, styles.signInnerFlexBox]}>
        				<View style={styles.signInnerFlexBox}>
          					<Image style={styles.iconLayout} resizeMode="cover" source={require("../assets/appleLogo.png")} />
          					<Text style={[styles.registerWithApple, styles.registerTypo]}>Register with apple</Text>
        				</View>
      			</View>
      			<View style={[styles.signUpInner1, styles.signInnerFlexBox]}>
        				<View style={styles.frameParentFlexBox}>
          					<Image style={styles.iconLayout} resizeMode="cover" source={require("../assets/googleLogo.png")} />
          					<Text style={[styles.registerWithGoogle, styles.registerTypo]}>Register with google</Text>
        				</View>
      			</View>
      			<View style={[styles.lineParent, styles.frameParentFlexBox]}>
        				<View style={styles.frameLayout} />
        				<Text style={[styles.or, styles.orTypo]}>or</Text>
        				<View style={[styles.frameItem, styles.frameLayout]} />
      			</View>
      			<View style={styles.progressBar}>
        				<View style={[styles.track, styles.trackPosition]}>
          					<View style={[styles.filled, styles.trackPosition]} />
        				</View>
      			</View>
    		</View>);
};

const styles = StyleSheet.create({
  	iconLayout: {
    		height: 24,
    		width: 24,
    		overflow: "hidden"
  	},
  	registerTypo1: {
    		textAlign: "left",
    		fontFamily: "Roboto-Medium",
    		fontWeight: "500"
  	},
  	frameInnerSpaceBlock: {
    		paddingVertical: 15,
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		position: "absolute"
  	},
  	orTypo: {
    		fontFamily: "Roboto-Regular",
    		textAlign: "left"
  	},
  	signInnerFlexBox: {
    		justifyContent: "center",
    		alignItems: "center",
    		flexDirection: "row"
  	},
  	registerTypo: {
    		letterSpacing: -0.2,
    		fontSize: 17
  	},
  	frameParentFlexBox: {
    		alignItems: "center",
    		flexDirection: "row"
  	},
  	frameLayout: {
    		height: 1,
    		width: 161,
    		borderTopWidth: 1,
    		borderColor: "#ff0000",
    		borderStyle: "solid"
  	},
  	trackPosition: {
    		height: 4,
    		marginTop: -2,
    		top: "50%",
    		position: "absolute"
  	},
  	signUpChild: {
    		top: 0,
    		width: 390,
    		backgroundColor: "#000",
    		left: 0,
    		position: "absolute",
    		height: 844
  	},
  	chevronLeftIcon: {
    		top: 74,
    		left: 16,
    		position: "absolute"
  	},
  	signUp1: {
    		top: "14.34%",
    		left: "4.1%",
    		fontSize: 34,
    		letterSpacing: -0.3,
    		color: "rgba(255, 0, 0, 0.8)",
    		position: "absolute"
  	},
  	enterYourEmail: {
    		color: "#c74242",
    		letterSpacing: -0.2,
    		fontSize: 17
  	},
  	enterYourEmailWrapper: {
    		top: 325,
    		alignItems: "center",
    		flexDirection: "row",
    		borderWidth: 1,
    		borderStyle: "solid",
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		borderColor: "rgba(255, 0, 0, 0.4)",
    		left: 16
  	},
  	enterYourEmailContainer: {
    		top: 397,
    		alignItems: "center",
    		flexDirection: "row",
    		borderWidth: 1,
    		borderStyle: "solid",
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		borderColor: "rgba(255, 0, 0, 0.4)",
    		left: 16
  	},
  	enterYourEmailFrame: {
    		top: 464,
    		left: 17,
    		alignItems: "center",
    		flexDirection: "row",
    		borderWidth: 1,
    		borderStyle: "solid",
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		borderColor: "rgba(255, 0, 0, 0.4)"
  	},
  	frameView: {
    		top: 255,
    		alignItems: "center",
    		flexDirection: "row",
    		borderWidth: 1,
    		borderStyle: "solid",
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		borderColor: "rgba(255, 0, 0, 0.4)",
    		left: 16
  	},
  	enterYourEmailWrapper1: {
    		top: 185,
    		alignItems: "center",
    		flexDirection: "row",
    		borderWidth: 1,
    		borderStyle: "solid",
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		borderColor: "rgba(255, 0, 0, 0.4)",
    		left: 16
  	},
  	continue: {
    		color: "#000",
    		textAlign: "left",
    		fontFamily: "Roboto-Medium",
    		fontWeight: "500"
  	},
  	continueWrapper: {
    		top: 533,
    		backgroundColor: "#ff0303",
    		borderColor: "rgba(0, 0, 0, 0.15)",
    		paddingVertical: 15,
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		position: "absolute",
    		borderWidth: 1,
    		borderStyle: "solid",
    		justifyContent: "center",
    		left: 16
  	},
  	registerWithApple: {
    		color: "#fff",
    		marginLeft: 12,
    		textAlign: "left",
    		fontFamily: "Roboto-Medium",
    		fontWeight: "500"
  	},
  	signUpInner: {
    		top: 641,
    		backgroundColor: "#333",
    		paddingVertical: 15,
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		position: "absolute",
    		justifyContent: "center",
    		left: 16
  	},
  	registerWithGoogle: {
    		color: "#adadad",
    		marginLeft: 12,
    		textAlign: "left",
    		fontFamily: "Roboto-Medium",
    		fontWeight: "500"
  	},
  	signUpInner1: {
    		top: 715,
    		borderColor: "rgba(185, 177, 177, 0.15)",
    		paddingVertical: 15,
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		position: "absolute",
    		borderWidth: 1,
    		borderStyle: "solid",
    		justifyContent: "center",
    		left: 16
  	},
  	or: {
    		fontSize: 15,
    		letterSpacing: -0.1,
    		color: "#ff0000",
    		marginLeft: 12
  	},
  	frameItem: {
    		marginLeft: 12
  	},
  	lineParent: {
    		top: 603,
    		left: 16,
    		position: "absolute"
  	},
  	filled: {
    		borderRadius: 100,
    		backgroundColor: "#aa0b0b",
    		width: 4,
    		left: 0,
    		height: 4,
    		marginTop: -2
  	},
  	track: {
    		right: 16,
    		backgroundColor: "rgba(120, 120, 128, 0.32)",
    		left: 16
  	},
  	progressBar: {
    		marginTop: -350,
    		width: "84.62%",
    		right: "7.44%",
    		left: "7.95%",
    		height: 28,
    		top: "50%",
    		backgroundColor: "#000",
    		position: "absolute"
  	},
  	signUp: {
    		borderRadius: 30,
    		backgroundColor: "#000",
    		flex: 1,
    		width: "100%",
    		overflow: "hidden",
    		height: 844
  	}
});

export default SignUp;
