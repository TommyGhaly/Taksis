import * as React from "react";
import { Text, StyleSheet, Pressable, View, Image } from "react-native";
import { ProgressBar, Button } from "react-native-paper";

const ChurchVerification = () => {
  return (
    <View style={styles.churchregistrationverification}>
      <Text style={styles.churchHasBeen}>Church has been registered!</Text>
      <View style={[styles.filled, styles.trackLayout]} />
      <Text style={[styles.youHaveBeen, styles.backToSignTypo]}>
        You have been appointed head admin of your church. If you would like to
        give the position to someone else go to settings and click “appoint head
        admin”
      </Text>
      <Image
        style={styles.verificationstickerIcon}
        resizeMode="cover"
        source={require("../assets/verificationSticker.png")}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  churchHasBeen: {
    width: "83.72%",
    top: "17.95%",
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
  youHaveBeen: {
    width: "83.04%",
    top: "65.02%",
    left: "5.6%",
    fontSize: 16,
    color: "#8e8e93",
    textAlign: "center",
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
  trackLayout: {
    height: 4,
    left: "12.2137%",
    right: "12.2137%",
    top: "8.4507%",
  },
  filled: {
    position: "absolute",
    marginTop: -2,
    top: "50%",
    right: "8.1429%",
    left: "8.1429%",
    borderRadius: 100,
    backgroundColor: "#007bfe",
  },
  churchregistrationverification: {
    flex: 1,
    width: "100%",
    height: 852,
    overflow: "hidden",
    backgroundColor: "#000",
  },
});

export default ChurchVerification;
