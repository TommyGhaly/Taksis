import * as React from "react";
import { ImageBackground, StyleSheet, View, TextInput, Pressable, Text, TouchableOpacity, Image } from "react-native";
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import BackArrow from '../components/backArrow';

//do the back arrow and set up the continue button with the right parameters
function tabs(navigation) {
	navigation.reset({
		index: 0,
		routes: [{ name: 'MainContainer' }],
	});
	return
};
const SignIn = ({ navigation }) => {
	return (
		<View style={[styles.signIn, styles.iconLayout]}>
			<View style={styles.backarrow}>
				<BackArrow />
			</View>
			<View style={styles.title}>
				<Text style={styles.titleText}>Sign In</Text>
			</View>
			<ImageBackground style={styles.lastsuppericon} resizeMode="cover" source={require("../assets/lastSupperIcon.png")} />
			<TextInput style={[styles.phoneOrEmail, styles.passwordBorder]} placeholder="Enter your phone or email" placeholderTextColor="#8e8e93" />
			<TextInput style={[styles.password, styles.passwordBorder]} placeholder="Enter your password" placeholderTextColor="#8e8e93" />
			<TouchableOpacity style={[styles.continuebutton, styles.appleFlexBox]} activeOpacity={0.2} onPress={() => (tabs(navigation))}>
				<Text style={styles.continue}>Continue</Text>
			</TouchableOpacity>
			<Pressable style={[styles.forgotPasswordSetContainer, styles.containerPosition]} onPress={() => { navigation.navigate('PasswordReset') }}>
				<Text style={[styles.text1, styles.orTypo]}>
					<Text style={styles.forgotPassword}>{`Forgot password? `}</Text>
					<Text style={styles.setNewPassword}>Set new password</Text>
				</Text>
			</Pressable>
			<View style={styles.dividerWrapper}>
				<View style={styles.divider}>
					<View style={[styles.dividerChild, styles.dividerPosition]} />
					<Text style={[styles.or, styles.orTypo]}>or</Text>
					<View style={[styles.dividerItem, styles.dividerPosition]} />
				</View>
			</View>
			<View style={styles.component2}>
				<Pressable style={[styles.appleregistration, styles.appleregistrationLayout]}>
					<View style={styles.appleFlexBox}>
						<Image style={styles.applelogoIcon} resizeMode="cover" source={require("../assets/appleLogo.png")} />
						<Text style={[styles.registerWithApple, styles.registerTypo]}>Sign in with apple</Text>
					</View>
				</Pressable>
				<Pressable 
				style={[styles.googleregistration, styles.appleregistrationLayout]}
				onPress={onGoogleButtonPress}
				>
					<View style={styles.google}>
						<Image style={styles.applelogoIcon} resizeMode="cover" source={require("../assets/googleLogo.png")} />
						<Text style={[styles.registerWithGoogle, styles.registerTypo]}>Sign in with Google</Text>
					</View>
				</Pressable>
			</View>
			<TouchableOpacity style={[styles.dontHaveAccountContainer, styles.containerPosition]} activeOpacity={0.2} onPress={() => { navigation.navigate("SignUp") }}>
				<Text style={[styles.text2, styles.orTypo]}>
					<Text style={styles.forgotPassword}>{`Don’t have account? `}</Text>
					<Text style={styles.setNewPassword}>Sign up</Text>
				</Text>
			</TouchableOpacity>
		</View>);
};

async function onGoogleButtonPress(navigation) {
	try {
		// Check if your device supports Google Play
		await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
		// Get the users ID token
		const { idToken } = await GoogleSignin.signIn();

		// Create a Google credential with the token
		const googleCredential = auth.GoogleAuthProvider.credential(idToken);

		// Sign-in the user with the credential
		const userCredential = await auth().signInWithCredential(googleCredential);

		return userCredential;
	} catch (error) {
		console.error(error);
	}
}

const styles = StyleSheet.create({
	iconLayout: {
		width: "100%",
		overflow: "hidden"
	},
	containerPosition: {
		left: "3.05%",
		position: "absolute"
	},
	passwordBorder: {
		fontSize: 17,
		fontFamily: "Roboto-Regular",
		borderColor: "#8e8e93",
		height: "5.75%",
		paddingVertical: 15,
		paddingHorizontal: 20,
		alignItems: "center",
		flexDirection: "row",
		borderWidth: 1,
		borderStyle: "solid",
		borderRadius: 10,
		right: "5.85%",
		width: "91.09%",
		left: "3.05%",
		position: "absolute"
	},
	appleFlexBox: {
		justifyContent: "center",
		alignItems: "center",
		flexDirection: "row"
	},
	orTypo: {
		letterSpacing: -0.1,
		fontSize: 15,
		fontFamily: "Roboto-Regular"
	},
	dividerPosition: {
		borderTopWidth: 1,
		bottom: "41.67%",
		top: "52.78%",
		width: "44.97%",
		height: "5.56%",
		borderColor: "#8e8e93",
		borderStyle: "solid",
		position: "absolute"
	},
	appleregistrationLayout: {
		left: "0%",
		right: "0%",
		justifyContent: "center",
		paddingVertical: 15,
		paddingHorizontal: 20,
		alignItems: "center",
		flexDirection: "row",
		borderRadius: 10,
		position: "absolute",
	},
	registerTypo: {
		marginLeft: 12,
		textAlign: "left",
		fontFamily: "Roboto-Medium",
		fontWeight: "500",
		letterSpacing: -0.2,
		fontSize: 17
	},
	lastsuppericon: {
		top: "12.21%",
		right: "3.82%",
		bottom: "68.31%",
		left: "3.82%",
		position: "absolute"
	},
	phoneOrEmail: {
		top: "40.87%",
		bottom: "53.38%",
		color: "#8e8e93",
	},
	password: {
		top: "48.85%",
		bottom: "45.4%",
		color: "#8e8e93",
	},
	continue: {
		color: "#000",
		textAlign: "left",
		fontFamily: "Roboto-Medium",
		fontWeight: "500",
		letterSpacing: -0.2,
		fontSize: 17
	},
	continuebutton: {
		height: "5.87%",
		top: "56.83%",
		bottom: "37.3%",
		backgroundColor: "#8e8e93",
		borderColor: "#000",
		paddingVertical: 15,
		paddingHorizontal: 20,
		borderWidth: 1,
		borderStyle: "solid",
		borderRadius: 10,
		justifyContent: "center",
		right: "5.85%",
		width: "91.09%",
		left: "3.05%",
		position: "absolute"
	},
	forgotPassword: {
		color: "#8e8e93"
	},
	setNewPassword: {
		color: "#6e85e3"
	},
	text1: {
		textAlign: "center",
		left: "20%"
	},
	text2: {
		textAlign: "center",
		left: "50%",
	},
	forgotPasswordSetContainer: {
		top: "64.93%"
	},
	dividerChild: {
		right: "55.17%",
		left: "-0.14%"
	},
	or: {
		width: "3.91%",
		left: "48.04%",
		top: "0%",
		height: "100%",
		color: "#8e8e93",
		textAlign: "left",
		position: "absolute"
	},
	dividerItem: {
		right: "-0.14%",
		left: "55.17%"
	},
	divider: {
		left: "0%",
		right: "0%",
		bottom: "0%",
		top: "0%",
		height: "100%",
		position: "absolute",
		width: "100%"
	},
	dividerWrapper: {
		height: "2.11%",
		top: "69.27%",
		bottom: "28.62%",
		right: "5.85%",
		width: "91.09%",
		left: "3.05%",
		position: "absolute"
	},
	applelogoIcon: {
		width: 24,
		height: 24,
		overflow: "hidden"
	},
	registerWithApple: {
		color: "#fff"
	},
	appleregistration: {
		bottom: "57.48%",
		backgroundColor: "#333",
		top: "0%"
	},
	registerWithGoogle: {
		color: "#8e8e93"
	},
	google: {
		alignItems: "center",
		flexDirection: "row"
	},
	googleregistration: {
		top: "57.48%",
		borderColor: "rgba(185, 177, 177, 0.15)",
		bottom: "0%",
		height: "42.52%",
		borderWidth: 1,
		borderStyle: "solid"
	},
	component2: {
		height: "14.91%",
		top: "73.59%",
		right: "4.07%",
		bottom: "11.5%",
		left: "4.83%",
		width: "91.09%",
		position: "absolute"
	},
	dontHaveAccountContainer: {
		top: "90.75%"
	},
	icon: {
		maxWidth: "100%",
		maxHeight: "100%",
		height: "100%",
		overflow: "hidden"
	},
	backarrow: {
		top: 74,
		left: 16
	},
	title: {
		top: 260,
		left: 12,
		height: "6.103%",
		width: "88.295%",
		flex: 1
	},
	titleText: {
		fontSize: 34,
		letterSpacing: -0.1,
		fontFamily: "Roboto-Regular",
		textAlign: "left",
		color: "#8e8e93"
	},
	signIn: {
		backgroundColor: "#000",
		flex: 1,
		height: "100%",
		width: "100%",
		overflow: "hidden"
	}
});

export default SignIn;
