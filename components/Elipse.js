import * as React from "react";
import { StyleSheet, View } from "react-native";

const Ellipse = () => {
  return <View style={styles.ellipseView} />;
};

const styles = StyleSheet.create({
  ellipseView: {
    backgroundColor: "#000",
    borderStyle: "solid",
    borderColor: "rgba(142, 142, 147, 0.5)",
    borderWidth: 2,
    flex: 1,
    width: "100%",
    height: 14,
  },
});

export default Ellipse;
