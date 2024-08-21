import * as React from "react";
import {
  Text,
  StyleSheet,
  View,
  Pressable,
  Image,
  TouchableOpacity,
} from "react-native";
import { Button } from "react-native-paper";

const AccountInfo = () => {
  return (
    <View style={styles.accountinfo}>
      <Text style={[styles.accountInfo, styles.firstLastTypo]}>
        Account info
      </Text>
      <View style={styles.component6}>
        <View style={[styles.rectangleParent, styles.rectanglePosition]}>
          <View style={[styles.groupChild, styles.groupPosition]} />
          <Text style={[styles.firstLast, styles.firstLastTypo]}>
            First Last
          </Text>
        </View>
        <View style={[styles.rectangleGroup, styles.rectanglePosition]}>
          <View style={[styles.groupChild, styles.groupPosition]} />
          <Text style={[styles.firstLast, styles.firstLastTypo]}>
            example@gmail.com
          </Text>
        </View>
        <View style={[styles.rectangleContainer, styles.rectanglePosition]}>
          <View style={[styles.groupChild, styles.groupPosition]} />
          <Text style={[styles.firstLast, styles.firstLastTypo]}>
            555-555-5555
          </Text>
        </View>
        <View style={[styles.groupView, styles.groupPosition]}>
          <View style={[styles.groupChild, styles.groupPosition]} />
          <Text style={[styles.firstLast, styles.firstLastTypo]}>
            password923
          </Text>
        </View>
      </View>
      <View style={[styles.rectangleParent1, styles.rectangleParentPosition]}>
        <View style={[styles.groupChild, styles.groupPosition]} />
        <Text style={[styles.firstLast, styles.firstLastTypo]}>
          child 1 First last
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.groupTouchableopacity, styles.rectangleParentPosition]}
        activeOpacity={0.2}
        onPress={() => {}}
      >
        <View style={[styles.groupChild, styles.groupPosition]} />
        <Text style={[styles.firstLast, styles.firstLastTypo]}>
          child 1 Info
        </Text>
        <Image
          style={styles.vectorIcon}
          resizeMode="cover"
          source="Vector.png"
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.rectangleParent2, styles.rectangleParentPosition]}
        activeOpacity={0.2}
        onPress={() => {}}
      >
        <View style={[styles.groupChild, styles.groupPosition]} />
        <Text style={[styles.firstLast, styles.firstLastTypo]}>
          child 2 Info
        </Text>
        <Image
          style={styles.vectorIcon}
          resizeMode="cover"
          source="Vector.png"
        />
      </TouchableOpacity>
      <View style={[styles.rectangleParent3, styles.rectangleParentPosition]}>
        <View style={[styles.groupChild, styles.groupPosition]} />
        <Text style={[styles.firstLast, styles.firstLastTypo]}>Rank</Text>
      </View>
      <View style={[styles.rectangleParent4, styles.rectangleParentPosition]}>
        <View style={[styles.groupChild, styles.groupPosition]} />
        <Text style={[styles.firstLast, styles.firstLastTypo]}>Church 1</Text>
      </View>
      <View style={[styles.rectangleParent5, styles.rectangleParentPosition]}>
        <View style={[styles.groupChild, styles.groupPosition]} />
        <Text style={[styles.firstLast, styles.firstLastTypo]}>Age</Text>
      </View>
      <View style={[styles.rectangleParent6, styles.rectangleParentPosition]}>
        <View style={[styles.groupChild, styles.groupPosition]} />
        <Text style={[styles.firstLast, styles.firstLastTypo]}>
          child 2 First last
        </Text>
      </View>
      <Button
        style={styles.backarrow}
        mode="outlined"
        onPress={() => navigation.goBack()}
        contentStyle={styles.backArrowIconBtn}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  backArrowIconBtn: {
    height: "2.82%",
    width: "6.11%",
  },
  firstLastTypo: {
    textAlign: "left",
    color: "#8e8e93",
    fontFamily: "Roboto-Regular",
    lineHeight: 22,
    width: "57.76%",
    position: "absolute",
  },
  rectanglePosition: {
    left: "0%",
    right: "0%",
    height: "24.27%",
    position: "absolute",
    width: "100%",
  },
  groupPosition: {
    bottom: "0%",
    left: "0%",
    right: "0%",
    position: "absolute",
    width: "100%",
  },
  rectangleParentPosition: {
    height: "2.93%",
    left: "0%",
    right: "0%",
    position: "absolute",
    width: "100%",
  },
  accountInfo: {
    height: "2.58%",
    top: "13.97%",
    left: "4.33%",
    fontSize: 24,
  },
  groupChild: {
    height: "100%",
    backgroundColor: "#1e1e1e",
    top: "0%",
  },
  firstLast: {
    height: "88%",
    top: "4%",
    left: "9.16%",
    fontSize: 16,
  },
  rectangleParent: {
    bottom: "75.73%",
    top: "0%",
  },
  rectangleGroup: {
    top: "25.24%",
    bottom: "50.49%",
  },
  rectangleContainer: {
    top: "50.49%",
    bottom: "25.24%",
  },
  groupView: {
    top: "75.73%",
    height: "24.27%",
    bottom: "0%",
  },
  component6: {
    top: 172,
    left: 0,
    width: 393,
    height: 103,
    position: "absolute",
  },
  rectangleParent1: {
    top: "35.45%",
    bottom: "61.62%",
  },
  vectorIcon: {
    height: "48%",
    width: "1.53%",
    top: "24%",
    right: "3.56%",
    bottom: "28%",
    left: "94.91%",
    maxWidth: "100%",
    maxHeight: "100%",
    position: "absolute",
    overflow: "hidden",
  },
  groupTouchableopacity: {
    top: "38.5%",
    bottom: "58.57%",
  },
  rectangleParent2: {
    top: "44.6%",
    bottom: "52.46%",
  },
  rectangleParent3: {
    top: "50%",
    bottom: "47.07%",
  },
  rectangleParent4: {
    top: "53.05%",
    bottom: "44.01%",
  },
  rectangleParent5: {
    top: "56.1%",
    bottom: "40.96%",
  },
  rectangleParent6: {
    top: "41.55%",
    bottom: "55.52%",
  },
  backarrow: {
    top: "8.69%",
    right: "89.82%",
    bottom: "88.5%",
    left: "4.07%",
    position: "absolute",
    overflow: "hidden",
  },
  accountinfo: {
    backgroundColor: "#000",
    flex: 1,
    height: 852,
    overflow: "hidden",
    width: "100%",
  },
});

export default AccountInfo;
