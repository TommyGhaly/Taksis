import * as React from "react";
import {StyleSheet, View, Image, Text} from "react-native";

const SignUp = () => {
  	
  	return (
    		<View style={[styles.signUp, styles.signUpFlexBox]}>
      			<View style={[styles.signUpChild, styles.signUpChildPosition]} />
      			<Image style={[styles.chevronLeftIcon, styles.iconLayout]} resizeMode="cover" source="chevron-left.svg" />
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
        				<View style={[styles.icbaselineAppleParent, styles.signInnerFlexBox]}>
          					<Image style={styles.iconLayout} resizeMode="cover" source="ic_baseline-apple.png" />
          					<Text style={[styles.registerWithApple, styles.registerTypo]}>Register with apple</Text>
        				</View>
      			</View>
      			<View style={[styles.signUpInner1, styles.signInnerFlexBox]}>
        				<View style={styles.logosgoogleIconParent}>
          					<Image style={styles.iconLayout} resizeMode="cover" source="logos_google-icon.svg" />
          					<Text style={[styles.registerWithGoogle, styles.registerTypo]}>Register with google</Text>
        				</View>
      			</View>
      			<View style={styles.lineParent}>
        				<View style={styles.frameLayout} />
        				<Text style={[styles.or, styles.orTypo]}>or</Text>
        				<View style={[styles.frameItem, styles.frameLayout]} />
      			</View>
      			<View style={[styles.statusBarAndBackground, styles.signUpChildPosition]}>
        				<View>
          					<View style={[styles.statusBar1, styles.signInnerFlexBox]}>
            						<View style={[styles.leftArea, styles.signInnerFlexBox]}>
              							<View>
                								<Text style={styles.text}>1:47</Text>
              							</View>
            						</View>
            						<View style={styles.statusBarDynamicIsland}>
              							<View style={[styles.hole, styles.signInnerFlexBox]} />
            						</View>
            						<View style={[styles.leftArea, styles.signInnerFlexBox]}>
              							<View style={styles.icons}>
                								<Image style={styles.statusBarCellularIcon} resizeMode="cover" source="🧩 Status Bar › Cellular Icon.png" />
                								<Image style={styles.statusBarWiFiIcon} resizeMode="cover" source="🧩 Status Bar › Wi-Fi Icon.png" />
                								<View style={styles.statusBarBatteryIcon}>
                  									<Image style={styles.icon} resizeMode="cover" source="Icon.png" />
                								</View>
              							</View>
            						</View>
          					</View>
        				</View>
      			</View>
    		</View>);
};

const styles = StyleSheet.create({
  	signUpFlexBox: {
    		flex: 1,
    		overflow: "hidden"
  	},
  	signUpChildPosition: {
    		top: 0,
    		backgroundColor: "#000",
    		position: "absolute"
  	},
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
    		flexDirection: "row",
    		position: "absolute"
  	},
  	orTypo: {
    		fontFamily: "Roboto-Regular",
    		textAlign: "left"
  	},
  	signInnerFlexBox: {
    		justifyContent: "center",
    		alignItems: "center"
  	},
  	registerTypo: {
    		letterSpacing: -0.2,
    		fontSize: 17
  	},
  	frameLayout: {
    		height: 1,
    		width: 161,
    		borderTopWidth: 1,
    		borderColor: "#ff0000",
    		borderStyle: "solid"
  	},
  	signUpChild: {
    		left: 0,
    		width: 390,
    		backgroundColor: "#000",
    		height: 844
  	},
  	chevronLeftIcon: {
    		top: 74,
    		left: 16,
    		position: "absolute"
  	},
  	signUp1: {
    		top: "13.63%",
    		left: "4.36%",
    		fontSize: 34,
    		letterSpacing: -0.3,
    		color: "#ff0000",
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
    		flexDirection: "row",
    		position: "absolute",
    		borderWidth: 1,
    		borderStyle: "solid",
    		justifyContent: "center",
    		left: 16
  	},
  	registerWithApple: {
    		marginLeft: 12,
    		color: "#fff",
    		textAlign: "left",
    		fontFamily: "Roboto-Medium",
    		fontWeight: "500"
  	},
  	icbaselineAppleParent: {
    		flexDirection: "row"
  	},
  	signUpInner: {
    		top: 641,
    		backgroundColor: "#333",
    		paddingVertical: 15,
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		flexDirection: "row",
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
  	logosgoogleIconParent: {
    		alignItems: "center",
    		flexDirection: "row"
  	},
  	signUpInner1: {
    		top: 715,
    		borderColor: "rgba(185, 177, 177, 0.15)",
    		paddingVertical: 15,
    		paddingHorizontal: 20,
    		width: 358,
    		borderRadius: 10,
    		flexDirection: "row",
    		position: "absolute",
    		borderWidth: 1,
    		borderStyle: "solid",
    		justifyContent: "center",
    		left: 16
  	},
  	or: {
    		fontSize: 15,
    		letterSpacing: -0.1,
    		marginLeft: 12,
    		color: "#ff0000"
  	},
  	frameItem: {
    		marginLeft: 12
  	},
  	lineParent: {
    		top: 603,
    		alignItems: "center",
    		flexDirection: "row",
    		left: 16,
    		position: "absolute"
  	},
  	text: {
    		fontSize: 18,
    		letterSpacing: 0,
    		lineHeight: 23,
    		fontWeight: "600",
    		fontFamily: "SF Pro",
    		textAlign: "center",
    		color: "#fff"
  	},
  	leftArea: {
    		paddingTop: 18,
    		paddingBottom: 13,
    		flexDirection: "row",
    		overflow: "hidden",
    		flex: 1
  	},
  	hole: {
    		borderRadius: 100,
    		width: 126,
    		height: 37,
    		backgroundColor: "#000",
    		overflow: "hidden"
  	},
  	statusBarDynamicIsland: {
    		paddingTop: 11,
    		paddingBottom: 6
  	},
  	statusBarCellularIcon: {
    		width: 27,
    		height: 23
  	},
  	statusBarWiFiIcon: {
    		width: 23,
    		marginLeft: 3,
    		height: 23
  	},
  	icon: {
    		width: 36,
    		height: 23
  	},
  	statusBarBatteryIcon: {
    		marginLeft: 3
  	},
  	icons: {
    		flexDirection: "row"
  	},
  	statusBar1: {
    		width: 430,
    		paddingHorizontal: 10,
    		paddingVertical: 0,
    		flexDirection: "row",
    		overflow: "hidden"
  	},
  	statusBarAndBackground: {
    		left: -20,
    		paddingBottom: 4,
    		backgroundColor: "#000"
  	},
  	signUp: {
    		borderRadius: 30,
    		backgroundColor: "#fff",
    		width: "100%",
    		overflow: "hidden",
    		height: 844
  	}
});

export default SignUp;
