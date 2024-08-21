import * as React from "react";
import { Text, StyleSheet, View, Pressable, TextInput } from "react-native";
import { Button } from "react-native-paper";


const ChangePhoneNumber = () => {
  return (
    <View style={styles.changephonenumber}>
      <View style={styles.frame}>
        <Text style={[styles.changePhoneNumber, styles.continueTypo]}>
          Change Phone Number
        </Text>
      </View>
      <Pressable
        style={[styles.continuebutton, styles.phoneLayout]}
        onPress={() => navigation.goBack()}
      >
        <Text style={[styles.continue, styles.continueTypo]}>Confirm</Text>
      </Pressable>
      <Button
        style={styles.backarrow}
        mode="outlined"
        onPress={() => navigation.goBack()}
        contentStyle={styles.backArrowIconBtn}
      />
      <TextInput
        style={[styles.phone, styles.phoneLayout]}
        placeholder="Enter your phone"
        placeholderTextColor="#8e8e93"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  backArrowIconBtn: {
    height: "2.82%",
    width: "6.11%",
  },
  continueTypo: {
    fontFamily: "Roboto-Medium",
    fontWeight: "500",
  },
  phoneLayout: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
    flexDirection: "row",
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: 10,
    right: "4.83%",
    width: "91.09%",
    left: "4.07%",
    position: "absolute",
  },
  changePhoneNumber: {
    height: "101.49%",
    width: "101.44%",
    top: "-0.36%",
    left: "-0.03%",
    fontSize: 34,
    letterSpacing: -0.3,
    color: "rgba(142, 142, 147, 0.8)",
    textAlign: "left",
    position: "absolute",
  },
  frame: {
    height: "4.74%",
    width: "91.81%",
    top: "14.34%",
    right: "4.09%",
    bottom: "80.92%",
    left: "4.1%",
    position: "absolute",
    overflow: "hidden",
  },
  continue: {
    letterSpacing: -0.2,
    color: "#fff",
    textAlign: "center",
    fontSize: 17,
  },
  continuebutton: {
    height: "5.87%",
    top: "83.57%",
    bottom: "10.56%",
    backgroundColor: "#333",
    borderColor: "rgba(0, 0, 0, 0.15)",
    justifyContent: "center",
  },
  backarrow: {
    top: "8.69%",
    right: "89.82%",
    bottom: "88.5%",
    left: "4.07%",
    position: "absolute",
    overflow: "hidden",
  },
  phone: {
    height: "5.75%",
    top: "21.95%",
    bottom: "72.3%",
    borderColor: "#8e8e93",
    fontFamily: "Roboto-Regular",
    fontSize: 17,
  },
  changephonenumber: {
    backgroundColor: "#000",
    flex: 1,
    width: "100%",
    height: 852,
    overflow: "hidden",
  },
});

export default ChangePhoneNumber;
