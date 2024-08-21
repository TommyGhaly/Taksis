import * as React from "react";
import { StyleSheet, View } from "react-native";

const MagnifyingGlassLine = () => {
  return <View style={styles.lineView} />;
};

const styles = StyleSheet.create({
  lineView: {
    borderStyle: "solid",
    borderColor: "rgba(142, 142, 147, 0.5)",
    borderWidth: 2,
    flex: 1,
    width: "100%",
    height: 2,
    transform: [
      {
        rotate: "45deg",
      },
    ],
  },
});

export default MagnifyingGlassLine;
