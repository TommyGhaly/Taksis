import * as React from "react";
import { Pressable, Image, StyleSheet, Text, View } from "react-native";

const RegisterGoogle = () => {
  return (
    <Pressable style={[styles.googleregistration, styles.googleFlexBox]}>
      <View style={styles.googleFlexBox}>
        <Image
          style={styles.googlelogoIcon}
          resizeMode="cover"
          source="googleLogo.png"
        />
        <Text style={styles.registerWithGoogle}>Register with google</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  googleFlexBox: {
    alignItems: "center",
    flexDirection: "row",
  },
  googlelogoIcon: {
    width: 24,
    height: 24,
    overflow: "hidden",
  },
  registerWithGoogle: {
    fontSize: 17,
    letterSpacing: -0.2,
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
    color: "#8e8e93",
    textAlign: "left",
    marginLeft: 12,
  },
  googleregistration: {
    borderRadius: 10,
    borderStyle: "solid",
    borderColor: "rgba(185, 177, 177, 0.15)",
    borderWidth: 1,
    flex: 1,
    width: "100%",
    height: 54,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
});

export default RegisterGoogle;
