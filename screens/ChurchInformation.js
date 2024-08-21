import * as React from "react";
import { Text, View, StyleSheet, TextInput } from "react-native";
//continue button back arrow
const ChurchInformation = () => {
  return (
    <View style={styles.churchinformation}>
      <View style={styles.progressBar}>
        <View style={[styles.track, styles.trackPosition]}>
          <View style={[styles.filled, styles.trackPosition]} />
        </View>
      </View>
      <Text style={[styles.title, styles.titleText]}>
        Please fill out the information needed
      </Text>
      <TextInput
        style={[styles.phoneOrEmail, styles.phoneLayout1]}
        placeholder="Enter the name of the church’s saint(s)"
        placeholderTextColor="#8e8e93"
      />
      <TextInput
        style={[styles.phoneOrEmail1, styles.phoneLayout2]}
        placeholder="Enter the city/town the church is in"
        placeholderTextColor="#8e8e93"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  phoneLayout1: {
    fontSize: 17,
    fontFamily: "Roboto-Regular",
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#8e8e93",
    borderStyle: "solid",
    borderRadius: 10,
    right: "4.83%",
    width: "91.09%",
    height: "5.75%",
    left: "4.07%",
    color: "#8e8e93",
    position: "absolute",
  },
  phoneLayout2: {
    fontSize: 17,
    fontFamily: "Roboto-Regular",
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#8e8e93",
    borderStyle: "solid",
    borderRadius: 10,
    overflow: "visible",
    right: "4.83%",
    width: "91.09%",
    left: "4.07%",
    color: "#8e8e93",
    position: "absolute",
  },
  phoneOrEmail: {
    top: "23.94%",
    bottom: "70.31%",
  },
  phoneOrEmail1: {
    top: "32.98%",
    bottom: "61.27%",
  },
  filled: {
    left: 0,
    borderRadius: 100,
    backgroundColor: "#147efb",
    width: 4,
  },
  track: {
    right: "12.2136%",
    left: 0,
    backgroundColor: "rgba(120, 120, 128, 0.32)",
  },
  progressBar: {
    height: "3.29%",
    width: "84.61%",
    top: "8.45%",
    bottom: "88.26%",
    left: "12.2137%",
    position: "absolute",
    backgroundColor: "#000",
  },
  trackPosition: {
    height: 4,
    top: "50%",
    marginTop: -2,
    position: "absolute",
  },
  title: {
    left: "4.071%",
    top: "12.7887%",
  },
  titleText: {
    fontSize: 34,
    letterSpacing: -0.1,
    fontFamily: "Roboto-Regular",
    textAlign: "left",
    color: "#8e8e93",
  },
  churchinformation: {
    flex: 1,
    width: "100%",
    height: "100%",
    overflow: "hidden",
    backgroundColor: "#000",
  },
});

export default ChurchInformation;
