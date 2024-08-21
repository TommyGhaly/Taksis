import * as React from "react";
import { Text, StyleSheet, View } from "react-native";

const AlphabetShortcut = () => {
  return (
    <View style={styles.aParent}>
      <Text style={styles.aTypo}>A</Text>
      <Text style={[styles.b, styles.aTypo]}>B</Text>
      <Text style={[styles.b, styles.aTypo]}>C</Text>
      <Text style={[styles.b, styles.aTypo]}>D</Text>
      <Text style={[styles.b, styles.aTypo]}>E</Text>
      <Text style={[styles.b, styles.aTypo]}>F</Text>
      <Text style={[styles.b, styles.aTypo]}>G</Text>
      <Text style={[styles.b, styles.aTypo]}>H</Text>
      <Text style={[styles.b, styles.aTypo]}>I</Text>
      <Text style={[styles.b, styles.aTypo]}>J</Text>
      <Text style={[styles.b, styles.aTypo]}>K</Text>
      <Text style={[styles.b, styles.aTypo]}>L</Text>
      <Text style={[styles.b, styles.aTypo]}>M</Text>
      <Text style={[styles.b, styles.aTypo]}>N</Text>
      <Text style={[styles.b, styles.aTypo]}>O</Text>
      <Text style={[styles.b, styles.aTypo]}>P</Text>
      <Text style={[styles.b, styles.aTypo]}>Q</Text>
      <Text style={[styles.b, styles.aTypo]}>R</Text>
      <Text style={[styles.b, styles.aTypo]}>S</Text>
      <Text style={[styles.b, styles.aTypo]}>T</Text>
      <Text style={[styles.b, styles.aTypo]}>U</Text>
      <Text style={[styles.b, styles.aTypo]}>V</Text>
      <Text style={[styles.b, styles.aTypo]}>W</Text>
      <Text style={[styles.b, styles.aTypo]}>X</Text>
      <Text style={[styles.b, styles.aTypo]}>Y</Text>
      <Text style={[styles.b, styles.aTypo]}>Z</Text>
      <Text style={[styles.b, styles.aTypo]}>#</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  aTypo: {
    textAlign: "left",
    color: "#007aff",
    fontFamily: "SF Pro Text",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0,
    fontSize: 11,
  },
  b: {
    marginTop: 1,
  },
  aParent: {
    flex: 1,
    width: "100%",
  },
});

export default AlphabetShortcut;
