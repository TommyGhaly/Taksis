import * as React from "react";
import {StyleSheet, View, Image, Text} from "react-native";
const SignIn = () => {
  	
  	return (
    		<View style={styles.signIn}>
      			<View style={styles.signInChild} />
      			<Image style={[styles.chevronLeftIcon, styles.iconLayout]} resizeMode="cover" source={require("../assets/redArrowLeft.png")} />
      			<Text style={[styles.signIn1, styles.orFlexBox]}>Sign in</Text>
      			<View style={[styles.enterYourEmailWrapper, styles.wrapperSpaceBlock]}>
        				<Text style={styles.enterYourEmail}>Enter your password</Text>
      			</View>
      			<View style={[styles.enterYourEmailContainer, styles.wrapperSpaceBlock]}>
        				<Text style={styles.enterYourEmail}>Enter your phone</Text>
      			</View>
      			<Text style={[styles.dontHaveAccountContainer, styles.orTypo]}>
        				<Text style={styles.dontHaveAccount}>{`Don’t have account? `}</Text>
        				<Text style={styles.signUp}>Sign up</Text>
      			</Text>
      			<View style={[styles.signInInner, styles.frameViewFlexBox]}>
        				<View style={styles.frameViewFlexBox}>
          					<Image style={styles.iconLayout} resizeMode="cover" source={require("../assets/appleLogo.png")} />
          					<Text style={[styles.registerWithApple, styles.registerTypo]}>Register with apple</Text>
        				</View>
      			</View>
      			<View style={[styles.frameView, styles.frameViewFlexBox]}>
        				<View style={styles.parentFlexBox}>
          					<Image style={styles.iconLayout} resizeMode="cover" source={require("../assets/googleLogo.png")} />
          					<Text style={[styles.registerWithGoogle, styles.registerTypo]}>Register with google</Text>
        				</View>
      			</View>
      			<Image style={styles.lastSupperIcon} resizeMode="cover"  />
      			<View style={[styles.continueWrapper, styles.frameViewFlexBox]}>
        				<Text style={[styles.continue, styles.registerTypo]}>Continue</Text>
      			</View>
      			<View style={[styles.lineParent, styles.parentFlexBox]}>
        				<View style={styles.frameLayout} />
        				<Text style={[styles.or, styles.orTypo]}>or</Text>
        				<View style={[styles.frameItem, styles.frameLayout]} />
      			</View>
    		</View>);
};

const styles = StyleSheet.create({
  	iconLayout: {
    		height: 24,
    		width: 24,
    		overflow: "hidden"
  	},
  	orFlexBox: {
    		textAlign: "left",
    		color: "#ff0000"
  	},
  	wrapperSpaceBlock: {
    		paddingVertical: 15,
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		left: 16,
    		position: "absolute"
  	},
  	orTypo: {
    		letterSpacing: -0.1,
    		fontSize: 15,
    		fontFamily: "Roboto-Regular"
  	},
  	frameViewFlexBox: {
    		justifyContent: "center",
    		alignItems: "center",
    		flexDirection: "row"
  	},
  	registerTypo: {
    		letterSpacing: -0.2,
    		fontSize: 17,
    		textAlign: "left",
    		fontFamily: "Roboto-Medium",
    		fontWeight: "500"
  	},
  	parentFlexBox: {
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
  	signInChild: {
    		top: 0,
    		left: 0,
    		backgroundColor: "#000",
    		width: 390,
    		position: "absolute",
    		height: 844
  	},
  	chevronLeftIcon: {
    		top: 74,
    		left: 16,
    		position: "absolute"
  	},
  	signIn1: {
    		top: "39.45%",
    		left: "4.1%",
    		fontSize: 34,
    		letterSpacing: -0.3,
    		fontFamily: "Roboto-Medium",
    		fontWeight: "500",
    		color: "#ff0000",
    		position: "absolute"
  	},
  	enterYourEmail: {
    		color: "#c74242",
    		fontFamily: "Roboto-Regular",
    		letterSpacing: -0.2,
    		fontSize: 17,
    		textAlign: "left"
  	},
  	enterYourEmailWrapper: {
    		top: 463,
    		alignItems: "center",
    		flexDirection: "row",
    		borderWidth: 1,
    		borderStyle: "solid",
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		borderColor: "rgba(255, 0, 0, 0.4)"
  	},
  	enterYourEmailContainer: {
    		top: 393,
    		alignItems: "center",
    		flexDirection: "row",
    		borderWidth: 1,
    		borderStyle: "solid",
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		borderColor: "rgba(255, 0, 0, 0.4)"
  	},
  	dontHaveAccount: {
    		color: "#858585"
  	},
  	signUp: {
    		color: "#6e85e3"
  	},
  	dontHaveAccountContainer: {
    		top: 781,
    		left: 103,
    		textAlign: "center",
    		position: "absolute"
  	},
  	registerWithApple: {
    		color: "#fff",
    		marginLeft: 12
  	},
  	signInInner: {
    		top: 641,
    		backgroundColor: "#333",
    		paddingVertical: 15,
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		left: 16,
    		position: "absolute",
    		justifyContent: "center"
  	},
  	registerWithGoogle: {
    		marginLeft: 12,
    		color: "#858585"
  	},
  	frameView: {
    		top: 715,
    		borderColor: "rgba(185, 177, 177, 0.15)",
    		paddingVertical: 15,
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		left: 16,
    		position: "absolute",
    		borderWidth: 1,
    		borderStyle: "solid",
    		justifyContent: "center"
  	},
  	lastSupperIcon: {
    		top: 126,
    		left: -4,
    		width: 398,
    		height: 187,
    		position: "absolute"
  	},
  	continue: {
    		color: "#000"
  	},
  	continueWrapper: {
    		top: 533,
    		backgroundColor: "#ff0303",
    		borderColor: "rgba(0, 0, 0, 0.15)",
    		paddingVertical: 15,
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		left: 16,
    		position: "absolute",
    		borderWidth: 1,
    		borderStyle: "solid",
    		justifyContent: "center"
  	},
  	or: {
    		marginLeft: 12,
    		textAlign: "left",
    		color: "#ff0000"
  	},
  	frameItem: {
    		marginLeft: 12
  	},
  	lineParent: {
    		top: 603,
    		left: 16,
    		position: "absolute"
  	},
  	signIn: {
    		borderRadius: 30,
    		backgroundColor: "#000",
    		flex: 1,
    		width: "100%",
    		overflow: "hidden",
    		height: 844
  	}
});

export default SignIn;
