import * as React from "react";
import {Text, StyleSheet, View, Image} from "react-native";
import appleIcon from '../assets/ic_baseline-apple.png';

const SignUp = () => {
  	
  	return (
    		<View style={[styles.signUp, styles.signUpFlexBox]}>
      			<View style={[styles.iphoneWithNotch, styles.parentFlexBox]}>
        				<View style={[styles.leftArea, styles.signUpFlexBox]}>
          					<View style={[styles.time, styles.parentFlexBox]}>
            						{/* <Text style={styles.text}>9:41</Text> */}
          					</View>
        				</View>
        				<View style={styles.notchArea} />
        				<View style={styles.rightArea}>
          					<View style={[styles.statusArea, styles.statusAreaPosition]}>
            						<View style={[styles.autoLayout, styles.statusAreaPosition]}>
              							<View style={[styles.sim1SingleSim, styles.sim1SingleSimLayout]}>
                								<View style={[styles.bar4, styles.barLayout]} />
                								<View style={[styles.bar3, styles.barLayout]} />
                								<View style={[styles.bar2, styles.barLayout]} />
                								<View style={[styles.bar1, styles.bar1Position]} />
              							</View>
              							<Image style={[styles.networkWifiFull, styles.sim1SingleSimLayout]} resizeMode="cover" source="Network / WiFi Full.png" />
              							<Image style={styles.batteryFullUncharged} resizeMode="cover" source="Battery / Full Uncharged.png" />
            						</View>
          					</View>
          					<Image style={styles.privacyIndicatorNone} resizeMode="cover" source="Privacy Indicator / None.png" />
        				</View>
      			</View>
      			<Image style={[styles.chevronLeftIcon, styles.iconLayout]} resizeMode="cover" source="chevron-left.png" />
      			<Text style={styles.signUp1}>Sign up</Text>
      			<View style={[styles.enterYourEmailWrapper, styles.signWrapperSpaceBlock]}>
        				<Text style={styles.enterYourEmail}>Enter your password</Text>
      			</View>
      			<View style={[styles.enterYourEmailContainer, styles.signWrapperSpaceBlock]}>
        				<Text style={styles.enterYourEmail}>Enter your phone</Text>
      			</View>
      			<View style={[styles.continueWrapper, styles.signWrapperSpaceBlock]}>
        				<Text style={styles.continueTypo}>Continue</Text>
      			</View>
      			<Text style={[styles.dontHaveAccountContainer, styles.orTypo]}>
        				<Text style={styles.dontHaveAccount}>{`Don’t have account? `}</Text>
        				<Text style={styles.signUp2}>Sign up</Text>
      			</Text>
      			<View style={[styles.signUpInner, styles.signWrapperSpaceBlock]}>
        				<View style={[styles.icbaselineAppleParent, styles.parentFlexBox]}>
          					<Image style={styles.iconLayout} resizeMode="cover" source={appleIcon} />
          					<Text style={[styles.registerWithApple, styles.continueTypo]}>Register with apple</Text>
        				</View>
      			</View>
      			<View style={[styles.signUpChild, styles.signWrapperSpaceBlock]}>
        				<View style={styles.parentFlexBox}>
          					<Image style={styles.iconLayout} resizeMode="cover" source="logos:google-icon.png" />
          					<Text style={styles.registerWithGoogle}>Register with google</Text>
        				</View>
      			</View>
      			<View style={[styles.lineParent, styles.lineParentPosition]}>
        				<View style={styles.frameLayout} />
        				<Text style={[styles.or, styles.orTypo]}>or</Text>
        				<View style={[styles.frameItem, styles.frameLayout]} />
      			</View>
      			<Image style={styles.youngWomanSittingInFrontO} resizeMode="cover" source="young woman sitting in front of laptop and having an idea.png" />
      			{/* <View style={[styles.homeIndicator, styles.bar1Position]} /> */}
    		</View>);
};

const styles = StyleSheet.create({
  	signUpFlexBox: {
    		overflow: "hidden",
    		flex: 1
  	},
  	parentFlexBox: {
    		alignItems: "center",
    		flexDirection: "row"
  	},
  	statusAreaPosition: {
    		top: "50%",
    		position: "absolute"
  	},
  	sim1SingleSimLayout: {
    		width: 20,
    		overflow: "hidden"
  	},
  	barLayout: {
    		width: 3,
    		borderRadius: 1,
    		top: "50%"
  	},
  	bar1Position: {
    		height: 5,
    		backgroundColor: "#333",
    		left: "50%",
    		position: "absolute"
  	},
  	iconLayout: {
    		height: 24,
    		width: 24,
    		overflow: "hidden"
  	},
  	signWrapperSpaceBlock: {
    		paddingVertical: 15,
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		left: 16,
    		alignItems: "center",
    		flexDirection: "row",
    		position: "absolute"
  	},
  	orTypo: {
    		letterSpacing: -0.1,
    		fontSize: 15,
    		fontFamily: "Roboto-Regular"
  	},
  	continueTypo: {
    		color: "#fff",
    		letterSpacing: -0.2,
    		fontFamily: "Roboto-Medium",
    		fontWeight: "500",
    		textAlign: "left",
    		fontSize: 17
  	},
  	lineParentPosition: {
    		left: 16,
    		position: "absolute"
  	},
  	frameLayout: {
    		height: 1,
    		width: 161,
    		borderTopWidth: 1,
    		borderColor: "#f5f5f7",
    		borderStyle: "solid"
  	},
  	text: {
    		letterSpacing: -0.7,
    		fontWeight: "600",
    		fontFamily: "SF Pro Text",
    		textAlign: "left",
    		color: "#333",
    		fontSize: 17
  	},
  	time: {
    		marginLeft: -17,
    		top: 16,
    		left: "50%",
    		justifyContent: "center",
    		position: "absolute"
  	},
  	leftArea: {
    		height: 44
  	},
  	notchArea: {
    		width: 164,
    		height: 44
  	},
  	bar4: {
    		marginTop: -6,
    		marginLeft: 6.35,
    		height: 12,
    		backgroundColor: "#333",
    		width: 3,
    		borderRadius: 1,
    		left: "50%",
    		position: "absolute"
  	},
  	bar3: {
    		marginTop: -3.6,
    		marginLeft: 1.05,
    		height: 10,
    		backgroundColor: "#333",
    		width: 3,
    		borderRadius: 1,
    		left: "50%",
    		position: "absolute"
  	},
  	bar2: {
    		marginTop: -1,
    		marginLeft: -4.25,
    		height: 7,
    		backgroundColor: "#333",
    		width: 3,
    		borderRadius: 1,
    		left: "50%",
    		position: "absolute"
  	},
  	bar1: {
    		marginTop: 1.4,
    		marginLeft: -9.55,
    		width: 3,
    		borderRadius: 1,
    		top: "50%",
    		height: 5
  	},
  	sim1SingleSim: {
    		height: 14
  	},
  	networkWifiFull: {
    		marginLeft: 4,
    		height: 12
  	},
  	batteryFullUncharged: {
    		width: 28,
    		marginLeft: 4,
    		height: 14
  	},
  	autoLayout: {
    		marginTop: -7,
    		right: 0,
    		justifyContent: "flex-end",
    		alignItems: "center",
    		flexDirection: "row"
  	},
  	statusArea: {
    		marginTop: -4,
    		marginLeft: -37.5,
    		width: 76,
    		height: 14,
    		left: "50%"
  	},
  	privacyIndicatorNone: {
    		top: 6,
    		left: 6,
    		width: 6,
    		height: 6,
    		position: "absolute"
  	},
  	rightArea: {
    		height: 44,
    		flex: 1
  	},
  	iphoneWithNotch: {
    		top: 0,
    		left: 0,
    		width: 390,
    		paddingHorizontal: 12,
    		paddingVertical: 0,
    		justifyContent: "center",
    		position: "absolute"
  	},
  	chevronLeftIcon: {
    		top: 74,
    		left: 16,
    		position: "absolute"
  	},
  	signUp1: {
    		top: "39.45%",
    		left: "4.1%",
    		fontSize: 34,
    		letterSpacing: -0.3,
    		fontFamily: "Roboto-Medium",
    		fontWeight: "500",
    		textAlign: "left",
    		color: "#333",
    		position: "absolute"
  	},
  	enterYourEmail: {
    		color: "#bdbdbd",
    		fontFamily: "Roboto-Regular",
    		letterSpacing: -0.2,
    		textAlign: "left",
    		fontSize: 17
  	},
  	enterYourEmailWrapper: {
    		top: 463,
    		borderWidth: 1,
    		borderColor: "rgba(0, 0, 0, 0.15)",
    		borderStyle: "solid",
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10
  	},
  	enterYourEmailContainer: {
    		top: 393,
    		borderWidth: 1,
    		borderColor: "rgba(0, 0, 0, 0.15)",
    		borderStyle: "solid",
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10
  	},
  	continueWrapper: {
    		top: 533,
    		backgroundColor: "#2f80ed",
    		borderWidth: 1,
    		borderColor: "rgba(0, 0, 0, 0.15)",
    		borderStyle: "solid",
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		justifyContent: "center"
  	},
  	dontHaveAccount: {
    		color: "#333"
  	},
  	signUp2: {
    		color: "#6e85e3"
  	},
  	dontHaveAccountContainer: {
    		top: 781,
    		left: 103,
    		textAlign: "center",
    		position: "absolute"
  	},
  	registerWithApple: {
    		marginLeft: 12
  	},
  	icbaselineAppleParent: {
    		justifyContent: "center"
  	},
  	signUpInner: {
    		top: 641,
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		backgroundColor: "#333",
    		justifyContent: "center"
  	},
  	registerWithGoogle: {
    		marginLeft: 12,
    		letterSpacing: -0.2,
    		fontFamily: "Roboto-Medium",
    		fontWeight: "500",
    		textAlign: "left",
    		color: "#333",
    		fontSize: 17
  	},
  	signUpChild: {
    		top: 715,
    		borderWidth: 1,
    		borderColor: "rgba(0, 0, 0, 0.15)",
    		borderStyle: "solid",
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		justifyContent: "center"
  	},
  	or: {
    		color: "#000",
    		marginLeft: 12,
    		textAlign: "left"
  	},
  	frameItem: {
    		marginLeft: 12
  	},
  	lineParent: {
    		top: 603,
    		alignItems: "center",
    		flexDirection: "row"
  	},
  	youngWomanSittingInFrontO: {
    		top: 106,
    		left: 79,
    		width: 255,
    		height: 215,
    		position: "absolute"
  	},
  	homeIndicator: {
    		marginLeft: -67,
    		top: 831,
    		borderRadius: 100,
    		width: 134
  	},
  	signUp: {
    		borderRadius: 30,
    		backgroundColor: "#fff",
    		width: "100%",
    		height: 844
  	}
});

export default SignUp;
