import * as React from "react";
import { StyleSheet, View, Text, Image } from "react-native";
import MagnifyingGlass from "./magnifyingGlass";
import Microphone from "./microphone";

const SearchBar = () => {
  return (
    <View style={styles.rectangleParent}>
      <View style={styles.frameChild} />
      <Text style={styles.search}>Search</Text>
      <MagnifyingGlass style={[styles.searchGlassIcon, styles.iconLayout]} />
      <Microphone style={[styles.microphoneIcon, styles.iconLayout]} />
    </View>
  );
};

const styles = StyleSheet.create({
  iconLayout: {
    maxHeight: "100%",
    overflow: "hidden",
    maxWidth: "100%",
    position: "absolute",
  },
  frameChild: {
    top: "0%",
    right: "0%",
    bottom: "0%",
    left: "0%",
    borderRadius: 8,
    backgroundColor: "rgba(85, 85, 85, 0.33)",
    position: "absolute",
  },
  search: {
    top: "17.14%",
    left: "9.3%",
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Inter-Regular",
    color: "#8e8e93",
    textAlign: "left",
    position: "absolute",
  },
  searchGlassIcon: {
    top: "14.29%",
    right: "91.55%",
    bottom: "16.86%",
    left: "1.69%",
    color: "#8e8e93",
  },
  microphoneIcon: {
    top: "22.86%",
    right: "2.96%",
    bottom: "28.57%",
    left: "94.23%",
  },
  rectangleParent: {
    flex: 1,
    height: "4.10798%",
    width: "100%",
  },
});

export default SearchBar;
