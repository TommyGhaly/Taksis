import * as React from "react";
import { Text, StyleSheet, Pressable, View, Image } from "react-native";
import BackArrow from "../components/backArrow";
import { useNavigation } from "@react-navigation/native";

const ChurchRegistrationV = () => {
  const navigation = useNavigation()
  return (
    <View style={styles.churchregistrationverification}>
      <View style={styles.backarrow}>
        <BackArrow />
      </View>
      <Text style={styles.churchHasBeen}>Register your church</Text>
      <Text style={[styles.youHaveBeen, styles.backToSignTypo]}>
        If you would like to register your church, please send an email to stphilopaterstmina@gmail.com. Please verify the name of the church, the location, who the head admin should be, and any other needed information. 
      </Text>

    </View>
  );
};

const styles = StyleSheet.create({
  backarrow: {
    top: 74,
    left: 16,
  },
  progressbar: {
    backgroundColor: "#000",
  },
  backArrowIconBtn: {
    height: "2.82%",
    width: "6.11%",
  },
  backarrowPosition: {
    left: "4.07%",
    position: "absolute",
  },
  backToSignTypo: {
    textAlign: "center",
    letterSpacing: -0.2,
    fontFamily: "Roboto-Medium",
    fontWeight: "500",
  },
  progressBarLayout: {
    width: "83.97%",
    height: "3.17%",
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
    position: "absolute",
  },
  backToSign: {
    fontSize: 17,
    color: "#fff",
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
    alignItems: "center",
  },
  progressBar: {
    top: "8.45%",
    right: "8.14%",
    bottom: "88.38%",
    left: "7.89%",
    position: "absolute",
  },
  youHaveBeen: {
    height: "100%",
    width: 370,
    top: "40%",
    left: "4.6%",

    fontSize: 16,
    color: "#8e8e93",
    position: "absolute",
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
    overflow: "hidden",
  },
  churchregistrationverification: {
    flex: 1,
    width: "100%",
    height: 852,
    overflow: "hidden",
    backgroundColor: "#000",
  },
});

export default ChurchRegistrationV;
