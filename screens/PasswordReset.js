import * as React from "react";
import {StyleSheet, View, TextInput, Text, Pressable, TouchableOpacity, Image} from "react-native";
import {TextInput as RNPTextInput} from "react-native-paper";
const PasswordReset = () => {
    		
    		return (
      			<View style={[styles.passwordReset, styles.iconLayout]}>
        				<RNPTextInput style={styles.password} placeholder="Enter your password" mode="outlined" placeholderTextColor="#8e8e93" theme={{"fonts":{"regular":{"fontFamily":"Roboto","fontWeight":"Regular"}},"colors":{"text":"#8e8e93"}}} />
        				<TextInput style={[styles.password1, styles.password1Typo]} placeholder="Confirm your password" placeholderTextColor="#8e8e93" />
        				<TextInput style={[styles.phoneOrEmail, styles.password1Typo]} placeholder="Enter your phone or email" placeholderTextColor="#8e8e93" />
        				<Text style={[styles.pleaseVerifyThe, styles.password1Typo]}>Please verify the change through the email sent to the email</Text>
        				<TouchableOpacity style={[styles.continuebutton, styles.password1Layout]} activeOpacity={0.2} onPress={()=>{}}>
          					<Text style={styles.continue}>Confirm</Text>
        				</TouchableOpacity>
        				<Pressable style={[styles.backarrow, styles.backarrowPosition]} onPress={() => navigation.goBack()}>
          					<Image style={[styles.icon, styles.iconLayout]} resizeMode="cover" source="backArrow.png" />
        				</Pressable>
      			</View>);
    		};
    		
    		const styles = StyleSheet.create({
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
        				paddingVertical: 15,
        				paddingHorizontal: 20,
        				alignItems: "center",
        				flexDirection: "row",
        				borderStyle: "solid",
        				borderRadius: 10,
        				left: "5.85%",
        				right: "3.05%",
        				width: "91.09%",
        				height: "5.75%",
        				position: "absolute"
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
      			continue: {
        				letterSpacing: -0.2,
        				fontWeight: "500",
        				fontFamily: "Roboto-Medium",
        				color: "#fff",
        				textAlign: "center",
        				fontSize: 17
      			},
      			continuebutton: {
        				height: "5.87%",
        				top: "83.57%",
        				right: "4.83%",
        				bottom: "10.56%",
        				backgroundColor: "#333",
        				borderColor: "rgba(0, 0, 0, 0.15)",
        				justifyContent: "center",
        				left: "4.07%",
        				position: "absolute"
      			},
      			icon: {
        				height: "100%",
        				maxWidth: "100%",
        				maxHeight: "100%"
      			},
      			backarrow: {
        				top: "8.69%",
        				right: "89.82%",
        				bottom: "88.5%",
        				width: "6.11%",
        				height: "2.82%"
      			},
      			passwordReset: {
        				backgroundColor: "#000",
        				flex: 1,
        				height: 852
      			}
    		});
    		
    		export default PasswordReset;
    		