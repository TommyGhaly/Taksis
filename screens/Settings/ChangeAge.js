import * as React from "react";
import { Text, StyleSheet, TextInput, Pressable, View } from "react-native";
import { Button } from "react-native-paper";

const ChangeAge = () => {
  return (
    <View style={styles.changeage}>
      <Text style={[styles.howOldAre, styles.oldFlexBox]}>
        How old are you?
      </Text>
      <TextInput style={[styles.changeageChild, styles.changeageChildBorder]} />
      <Text style={[styles.yearsOld, styles.oldFlexBox]}>years old</Text>
      <Button
        style={[styles.backarrow, styles.backarrowPosition]}
        mode="outlined"
        onPress={() => navigation.goBack()}
        contentStyle={styles.backArrowIconBtn}
      />
      <Pressable
        style={[styles.continuebutton, styles.backarrowPosition]}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.continue}>Confirm</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  backArrowIconBtn: {
    height: "2.82%",
    width: "6.11%",
  },
  oldFlexBox: {
    display: "flex",
    textAlign: "left",
    color: "#8e8e93",
    fontFamily: "Roboto-Regular",
    alignItems: "center",
    position: "absolute",
  },
  changeageChildBorder: {
    borderWidth: 1,
    borderStyle: "solid",
  },
  backarrowPosition: {
    left: "4.07%",
    position: "absolute",
  },
  howOldAre: {
    height: "6.1%",
    width: "86.77%",
    top: "18.66%",
    left: "6.62%",
    fontSize: 34,
    letterSpacing: -0.3,
    alignItems: "center",
  },
  changeageChild: {
    height: "3.87%",
    width: "7.38%",
    top: "27.58%",
    right: "53.44%",
    bottom: "68.54%",
    left: "39.19%",
    borderRadius: 5,
    borderColor: "#8e8e93",
    position: "absolute",
    borderWidth: 1,
    borderStyle: "solid",
    backgroundColor: "#000",
  },
  yearsOld: {
    height: "3.29%",
    width: "30.03%",
    top: "28.17%",
    left: "49.36%",
    fontSize: 14,
    letterSpacing: -0.1,
    alignItems: "center",
  },
  backarrow: {
    top: "8.69%",
    right: "89.82%",
    bottom: "88.5%",
    overflow: "hidden",
  },
  continue: {
    fontSize: 17,
    letterSpacing: -0.2,
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
    color: "#fff",
    textAlign: "center",
  },
  continuebutton: {
    height: "5.87%",
    width: "91.09%",
    top: "83.57%",
    right: "4.83%",
    bottom: "10.56%",
    borderRadius: 10,
    backgroundColor: "#333",
    borderColor: "rgba(0, 0, 0, 0.15)",
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderWidth: 1,
    borderStyle: "solid",
    alignItems: "center",
  },
  changeage: {
    flex: 1,
    width: "100%",
    height: 852,
    overflow: "hidden",
    backgroundColor: "#000",
  },
});

export default ChangeAge;
