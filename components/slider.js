import * as React from "react";
import { StyleSheet, View } from "react-native";

const Slider = () => {
  return (
    <View style={styles.slider}>
      <View style={[styles.unfilled, styles.filledPosition]} />
      <View style={[styles.filled, styles.knobPosition]} />
      <View style={[styles.knob, styles.knobPosition]}>
        <View style={styles.knob1} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  filledPosition: {
    bottom: "42.86%",
    top: "42.86%",
    height: "14.29%",
    borderRadius: 100,
  },
  knobPosition: {
    left: "0%",
    right: "49.17%",
    width: "50.83%",
    position: "absolute",
  },
  unfilled: {
    right: 0,
    left: 0,
    backgroundColor: "rgba(120, 120, 128, 0.32)",
    borderRadius: 100,
    position: "absolute",
  },
  filled: {
    backgroundColor: "#147efb",
    borderRadius: 100,
    bottom: "42.86%",
    top: "42.86%",
    height: "14.29%",
  },
  knob1: {
    marginTop: -14,
    top: "50%",
    right: -41,
    shadowColor: "rgba(0, 0, 0, 0.12)",
    shadowOffset: {
      width: 0,
      height: 0.5,
    },
    shadowRadius: 4,
    elevation: 4,
    shadowOpacity: 1,
    backgroundColor: "#fff",
    width: 28,
    transform: [
      {
        rotate: "180deg",
      },
    ],
    borderRadius: 100,
    position: "absolute",
    height: 28,
  },
  knob: {
    height: "100%",
    top: "0%",
    bottom: "0%",
  },
  slider: {
    flex: 1,
    width: "100%",
    height: 28,
  },
});

export default Slider;
