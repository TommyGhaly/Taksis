import * as React from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Image,
  Text,
  TouchableOpacity,
} from "react-native";
import { ProgressBar, Button } from "react-native-paper";

const ChurchLogo = () => {
  return (
    <View style={styles.churchlogo}>
      <View style={styles.progressBar}>
        <View style={styles.track}>
          <View style={styles.filled} />
        </View>
      </View>
      <Text style={[styles.title, styles.titleText]}>
        Please attatch the church's Logo
      </Text>
      <Pressable style={[styles.rectangleParent, styles.groupChildPosition]}>
        <View style={[styles.groupChild, styles.groupChildPosition]} />
        <Image
          style={styles.attatchimageicon}
          resizeMode="cover"
          source={require("../assets/attatchImageIcon.png")}
        />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  groupChildPosition: {
    height: 280,
    width: 266,
    left: "50%",
    top: "50%",
    position: "absolute",
  },
  groupChild: {
    marginTop: -140,
    marginLeft: -133,
    backgroundColor: "#fff",
    borderRadius: 10,
  },
  attatchimageicon: {
    marginTop: -107,
    marginLeft: -125,
    width: 250,
    height: 227,
    left: "50%",
    top: "50%",
    position: "absolute",
  },
  rectangleParent: {
    marginTop: -131,
    marginLeft: -132.5,
  },
  title: {
    left: "4.071%",
    width: "83.715%",
    top: "17.835%",
  },
  titleText: {
    fontSize: 34,
    letterSpacing: -0.1,
    fontFamily: "Roboto-Regular",
    textAlign: "left",
    color: "#8e8e93",
  },
  progressBar: {
    top: "8.45%",
    right: "12.2137%",
    bottom: "88.26%",
    left: "12.2137%",
    position: "absolute",
  },
  filled: {
    position: "absolute",
    marginTop: -2,
    width: "41.01%",
    top: "50%",
    right: "58.99%",
    left: "0%",
    borderRadius: 100,
    backgroundColor: "#147efb",
    height: 4,
  },
  track: {
    backgroundColor: "rgba(120, 120, 128, 0.32)",
    width: "100%",
    height: 4,
  },
  churchlogo: {
    flex: 1,
    width: "100%",
    height: 852,
    overflow: "hidden",
    backgroundColor: "#000",
  },
});

export default ChurchLogo;
