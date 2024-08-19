import * as React from "react";
import {Text, StyleSheet, Pressable, View, Image} from "react-native";
import {ProgressBar, Button} from "react-native-paper";

const ChurchRegistrationVerification = ({navigation}) => {
    		
    		return (
      			<View style={styles.churchregistrationverification}>
        				<Text style={styles.churchHasBeen}>Church has been registered!</Text>
        				<Pressable style={[styles.continuebutton, styles.backarrowPosition]} onPress={()=>{}}>
          					<Text style={[styles.backToSign, styles.backToSignTypo]}>Back to sign up</Text>
        				</Pressable>

        				<Text style={[styles.youHaveBeen, styles.backToSignTypo]}>You have been appointed head admin of your church. If you would like to give the position to someone else go to settings and click “appoint head admin”</Text>
        				<Image style={styles.verificationstickerIcon} resizeMode="cover" source={require("../assets/verificationSticker.png")} />
        				</View>);
        				};
        				
        				const styles = StyleSheet.create({
          					progressbar: {
            						backgroundColor: "#000"
          					},
          					backArrowIconBtn: {
            						height: "2.82%",
            						width: "6.11%"
          					},
          					backarrowPosition: {
            						left: "4.07%",
            						position: "absolute"
          					},
          					backToSignTypo: {
            						textAlign: "center",
            						letterSpacing: -0.2,
            						fontFamily: "Roboto-Medium",
            						fontWeight: "500"
          					},
          					progressBarLayout: {
            						width: "83.97%",
            						height: "3.17%"
          					},
          					churchHasBeen: {
            						height: "6.1%",
            						width: "83.72%",
            						top: "19.95%",
            						left: "5.09%",
            						fontSize: 34,
            						letterSpacing: -0.3,
            						color: "rgba(142, 142, 147, 0.8)",
            						textAlign: "left",
            						display: "flex",
            						alignItems: "center",
            						fontFamily: "Roboto-Medium",
            						fontWeight: "500",
            						position: "absolute"
          					},
          					backToSign: {
            						fontSize: 17,
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
            						justifyContent: "center",
            						paddingHorizontal: 20,
            						paddingVertical: 15,
            						alignItems: "center"
          					},
          					progressBar: {
            						top: "8.45%",
            						right: "8.14%",
            						bottom: "88.38%",
            						left: "7.89%",
            						position: "absolute"
          					},
          					youHaveBeen: {
            						height: "4.81%",
            						width: "88.04%",
            						top: "65.02%",
            						left: "5.6%",
            						fontSize: 16,
            						color: "#8e8e93",
            						position: "absolute"
          					},

          					verificationstickerIcon: {
            						height: "30.05%",
            						width: "65.14%",
            						top: "30.52%",
            						right: "17.81%",
            						bottom: "39.44%",
            						left: "17.05%",
            						maxWidth: "100%",
            						maxHeight: "100%",
            						position: "absolute",
            						overflow: "hidden"
          					},
          					churchregistrationverification: {
            						flex: 1,
            						width: "100%",
            						height: 852,
            						overflow: "hidden",
            						backgroundColor: "#000"
          					}
        				});
        				
        				export default ChurchRegistrationVerification;
        				