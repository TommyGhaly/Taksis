import * as React from "react";
import { StyleSheet, View } from "react-native";
import MagnifyingGlassLine from "./lineMagnifyingGlass";
import Ellipse from "./elipse";

const MagnifyingGlass = () => {
  return (
    <View style={[styles.searchGlass, styles.searchLayout]}>
      <Ellipse style={[styles.searchGlassItem, styles.searchLayout]} />
      <MagnifyingGlassLine
        style={[styles.searchGlassChild, styles.searchLayout]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  searchLayout: {
    maxHeight: "100%",
    overflow: "hidden",
    maxWidth: "100%",
    position: "absolute",
    transform: [
      {
        rotate: "-45deg",
      },
    ],
  },
  searchGlassChild: {
    height: "24.5%",
    width: "35%",
    top: "70.79%",
    right: "-35.9%",
    bottom: "4.71%",
    left: "100.9%",
  },
  searchGlassItem: {
    height: "70%",
    top: "0%",
    right: "0%",
    bottom: "30%",
    left: "0%",
    width: "100%",
    overflow: "hidden",
    maxWidth: "100%",
    position: "absolute",
  },
  searchGlass: {
    flex: 1,
    height: "2.347",
    transform: [
      {
        rotate: "-45deg",
      },
    ],
    width: "100%",
  },
});

export default MagnifyingGlass;
