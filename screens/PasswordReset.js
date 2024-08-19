import * as React from "react";
import {StyleSheet, View, TextInput, Text, Pressable, TouchableOpacity, Image} from "react-native";
import BackArrow from "../components/backArrow";
const PasswordReset = ({navigation}) => {
    		
    		return (
      			<View style={[styles.passwordReset, styles.iconLayout]}>
						<View style={styles.backarrow}>
							<BackArrow/>
						</View>
						<Text style={[styles.title, styles.titleText]}>Change Password</Text>
        				<TextInput style={[styles.password, styles.password1Typo]} placeholder="Enter your password" placeholderTextColor="#8e8e93"/>
        				<TextInput style={[styles.password1, styles.password1Typo]} placeholder="Confirm your password" placeholderTextColor="#8e8e93" />
        				<TextInput style={[styles.phoneOrEmail, styles.password1Typo]} placeholder="Enter your phone or email" placeholderTextColor="#8e8e93" />
        				<Text style={[styles.pleaseVerifyThe, styles.password1Typo]}>Please verify the change through the email sent to the email</Text>
						<View style={styles.continueLayout}>
								<Pressable onPress={()=>(navigation.navigate('PasswordConfirm'))}>
									<Text style={styles.continuetext}>Continue</Text>
								</Pressable>
						</View>
      			</View>);
    		};
    		
    		const styles = StyleSheet.create({
				backarrow: {
					top: 74,
					left: 16
      			},
      			iconLayout: {
        				overflow: "hidden",
        				width: "100%"
      			},
      			backarrowPosition: {
        				left: "4.07%",
        				position: "absolute"
      			},
      			password1Typo: {
        				fontFamily: "Roboto-Regular",
        				position: "absolute"
      			},
      			password1Layout: {
        				borderWidth: 1,
        				paddingVertical: 15,
        				paddingHorizontal: 20,
        				alignItems: "center",
        				flexDirection: "row",
        				borderStyle: "solid",
        				borderRadius: 10,
        				width: "91.09%"
      			},
      			password: {
        				top: "27.82%",
        				bottom: "66.43%",
        				fontSize: 17,
        				borderWidth: 1,
        				paddingVertical: 15,
        				paddingHorizontal: 20,
        				alignItems: "center",
        				flexDirection: "row",
        				borderStyle: "solid",
        				borderRadius: 10,
						color: "#8e8e93",
        				width: "91.09%",
        				borderColor: "#8e8e93",
        				fontFamily: "Roboto-Regular",
        				left: "5.85%",
        				right: "3.05%",
        				height: "5.75%"
      			},
      			password1: {
        				top: "34.98%",
        				bottom: "59.27%",
        				fontSize: 17,
        				borderWidth: 1,
        				paddingVertical: 15,
        				paddingHorizontal: 20,
        				alignItems: "center",
        				flexDirection: "row",
        				borderStyle: "solid",
        				borderRadius: 10,
						color: "#8e8e93",
        				width: "91.09%",
        				borderColor: "#8e8e93",
        				fontFamily: "Roboto-Regular",
        				left: "5.85%",
        				right: "3.05%",
        				height: "5.75%"
      			},
      			phoneOrEmail: {
        				top: "20.66%",
        				bottom: "73.59%",
        				fontSize: 17,
        				borderWidth: 1,
        				paddingVertical: 15,
        				paddingHorizontal: 20,
        				alignItems: "center",
        				flexDirection: "row",
        				borderStyle: "solid",
        				borderRadius: 10,
						color: "#8e8e93",
        				width: "91.09%",
        				borderColor: "#8e8e93",
        				fontFamily: "Roboto-Regular",
        				left: "5.85%",
        				right: "3.05%",
        				height: "5.75%"
      			},
      			pleaseVerifyThe: {
        				height: "11.85%",
        				width: "60.31%",
        				top: "47.07%",
        				left: "19.85%",
        				fontSize: 12,
        				letterSpacing: -0.1,
        				color: "#8e8e93",
        				textAlign: "center"
      			},
				title: {
                    left: "4.071%",
                    top: "10.7887%"
                },
                titleText:{
                    fontSize: 34,
					letterSpacing: -0.1,
					fontFamily: "Roboto-Regular",
					textAlign: "left",
					color: "#8e8e93"
                },
				filled: {
					left: 0,
					borderRadius: 100,
					backgroundColor: "#147efb",
					width: 4
				},
				track: {
					right: "12.2136%",
					left: 0,
					backgroundColor: "rgba(120, 120, 128, 0.32)"
				},
				progressBar: {
					height: "3.29%",
					width: "84.61%",
					top: "8.45%",
					bottom: "88.26%",
					left: "12.2137%",
					position: "absolute",
					backgroundColor: "#000"
				},
				trackPosition: {
					height: 4,
					top: "50%",
					marginTop: -2,
					position: "absolute"
				},
				continueLayout: {
					bottom: -650,
					left: 16, 
					height: 50,
					width: 358,
					backgroundColor: "#333",
					borderRadius: 10
				},
				continuetext: {
					top: 15,
					fontSize: 17,
					letterSpacing: -0.2,
					fontWeight: "500",
					fontFamily: "Roboto-Medium",
					color: "#fff",
					textAlign: "center"
					},
      			passwordReset: {
        				backgroundColor: "#000",
        				flex: 1,
        				height: 852
      			}
    		});
    		
    		export default PasswordReset;
    		