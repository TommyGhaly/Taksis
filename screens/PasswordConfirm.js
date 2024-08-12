import * as React from "react";
import {Pressable, Text, StyleSheet, Image, View} from "react-native";
import {Button} from "react-native-paper";

const PasswordConfirm = () => {
    		
    		return (
      			<View style={styles.passwordConfirm}>

        				<Text style={[styles.allSet, styles.allSetTypo]}>All set!</Text>
        				<Text style={[styles.anAdminRequest, styles.allSetTypo]}>An admin request has been sent to the head admin of your church. You will be emailed when it is approved.</Text>
        				<Image style={styles.verificationstickerIcon} resizeMode="cover" source={require("../assets/verificationSticker.png")} />
      			</View>);
    		};
    		
    		const styles = StyleSheet.create({
      			backArrowIconBtn: {
        				height: "2.82%",
        				width: "6.11%"
      			},
      			backarrowPosition: {
        				left: "4.07%",
        				position: "absolute"
      			},
      			allSetTypo: {
        				height: "4.81%",
        				textAlign: "center",
        				fontFamily: "Roboto-Medium",
        				fontWeight: "500",
        				position: "absolute"
      			},
      			backToSign: {
        				fontSize: 17,
        				color: "#fff",
        				textAlign: "center",
        				fontFamily: "Roboto-Medium",
        				fontWeight: "500",
        				letterSpacing: -0.2
      			},
      			continuebutton: {
        				height: "5.87%",
        				width: "91.09%",
        				top: "83.57%",
        				right: "4.83%",
        				bottom: "10.56%",
        				borderRadius: 10,
        				backgroundColor: "#333",
        				borderStyle: "solid",
        				borderColor: "rgba(0, 0, 0, 0.15)",
        				borderWidth: 1,
        				flexDirection: "row",
        				alignItems: "center",
        				justifyContent: "center",
        				paddingHorizontal: 20,
        				paddingVertical: 15
      			},
      			allSet: {
        				width: "64.63%",
        				top: "19.01%",
        				left: "17.3%",
        				fontSize: 34,
        				letterSpacing: -0.3,
        				color: "rgba(142, 142, 147, 0.8)"
      			},
      			anAdminRequest: {
        				width: "88.04%",
        				top: "65.02%",
        				left: "5.6%",
        				fontSize: 16,
        				color: "#8e8e93",
        				letterSpacing: -0.2,
        				height: "4.81%"
      			},
      			verificationstickerIcon: {
        				height: "30.05%",
        				width: "65.14%",
        				top: "27.23%",
        				right: "17.81%",
        				bottom: "42.72%",
        				left: "17.05%",
        				maxWidth: "100%",
        				maxHeight: "100%",
        				position: "absolute",
        				overflow: "hidden"
      			},
      			backarrow: {
        				top: "8.69%",
        				right: "89.82%",
        				bottom: "88.5%",
        				overflow: "hidden"
      			},
      			passwordConfirm: {
        				backgroundColor: "#000",
        				flex: 1,
        				width: "100%",
        				height: 852,
        				overflow: "hidden"
      			}
    		});
    		
    		export default PasswordConfirm;
    		