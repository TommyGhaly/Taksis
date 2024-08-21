import * as React from "react";
import { Pressable, Text, StyleSheet, View } from "react-native";
import { Button } from "react-native-paper";

const ChangeHeadAdmin = () => {
  return (
    <View style={styles.changeheadadmin}>
      <Pressable
        style={[styles.continuebutton, styles.ifYouWouldFlexBox]}
        onPress={() => navigation.goBack()}
      >
        <Text style={[styles.continue, styles.continueFlexBox]}>Return</Text>
      </Pressable>
      <Text style={[styles.ifYouWould, styles.continueFlexBox]}>
        If you would like to change the head admin, please have a priest from
        your church email stphilostmina@gmail.com
      </Text>
      <Button
        style={styles.backarrow}
        mode="outlined"
        onPress={() => navigation.goBack()}
        contentStyle={styles.backArrowIconBtn}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  backArrowIconBtn: {
    height: "2.82%",
    width: "6.11%",
  },
  ifYouWouldFlexBox: {
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
  },
  continueFlexBox: {
    textAlign: "center",
    letterSpacing: -0.2,
  },
  continue: {
    fontSize: 17,
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    left: "4.07%",
  },
  ifYouWould: {
    height: "6.1%",
    width: "86.77%",
    top: "33.69%",
    left: "6.62%",
    fontSize: 24,
    fontFamily: "Roboto-Regular",
    color: "#8e8e93",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
  },
  backarrow: {
    top: "8.69%",
    right: "89.82%",
    bottom: "88.5%",
    left: "4.07%",
    position: "absolute",
    overflow: "hidden",
  },
  changeheadadmin: {
    backgroundColor: "#000",
    flex: 1,
    width: "100%",
    height: 852,
    overflow: "hidden",
  },
});

export default ChangeHeadAdmin;
