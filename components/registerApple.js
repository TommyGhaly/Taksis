import * as React from "react";
import { Pressable, Image, StyleSheet, Text, View } from "react-native";

const RegisterApple = () => {
  return (
    <Pressable style={[styles.appleregistration, styles.appleFlexBox]}>
      <View style={styles.appleFlexBox}>
        <Image
          style={styles.applelogoIcon}
          resizeMode="cover"
          source="appleLogo.png"
        />
        <Text style={styles.registerWithApple}>Register with apple</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  appleFlexBox: {
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  applelogoIcon: {
    width: 24,
    height: 24,
    overflow: "hidden",
  },
  registerWithApple: {
    fontSize: 17,
    letterSpacing: -0.2,
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
    color: "#fff",
    textAlign: "left",
    marginLeft: 12,
  },
  appleregistration: {
    borderRadius: 10,
    backgroundColor: "#333",
    flex: 1,
    width: "100%",
    height: 54,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
});

export default RegisterApple;
