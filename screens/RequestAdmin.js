import * as React from "react";
import {Button} from "react-native-paper";
import {StyleSheet, Text, Pressable, Image, View} from "react-native";

const RequestAdmin = () => {
    		
    		return (
      			<View style={styles.requestadmin}>
        				<Button style={[styles.backarrow, styles.backarrowPosition]} mode="outlined" onPress={() => navigation.goBack()} contentStyle={styles.backArrowIconBtn} />
        				<Text style={[styles.aRequestHas, styles.continueTypo]}>A request has been sent to the head admin. Waiting on approval to appoint you admin</Text>
        				<Pressable style={[styles.continuebutton, styles.backarrowPosition]} onPress={() => navigation.goBack()}>
          					<Text style={[styles.continue, styles.continueTypo]}>Confirm</Text>
        				</Pressable>
        				<Image style={styles.verificationstickerIcon} resizeMode="cover" source="verificationSticker.png" />
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
      			continueTypo: {
        				textAlign: "center",
        				fontFamily: "Roboto-Medium",
        				fontWeight: "500",
        				letterSpacing: -0.2,
        				fontSize: 17
      			},
      			backarrow: {
        				top: "8.69%",
        				right: "89.82%",
        				bottom: "88.5%",
        				overflow: "hidden"
      			},
      			aRequestHas: {
        				width: "72.52%",
        				top: "68.54%",
        				left: "13.23%",
        				color: "#8e8e93",
        				position: "absolute"
      			},
      			continue: {
        				color: "#fff"
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
      			requestadmin: {
        				borderRadius: 30,
        				backgroundColor: "#000",
        				flex: 1,
        				width: "100%",
        				height: 852,
        				overflow: "hidden"
      			}
    		});
    		
    		export default RequestAdmin;
    		