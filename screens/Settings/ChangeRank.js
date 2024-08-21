import * as React from "react";
import { Text, StyleSheet, Pressable, View } from "react-native";
import { Button } from "react-native-paper";

const ChangeRank = () => {
  return (
    <View style={styles.changerank}>
      <Text style={styles.whatRankOf}>What rank of deacon are you?</Text>
      <Button
        style={styles.backarrow}
        mode="outlined"
        onPress={() => navigation.goBack()}
        contentStyle={styles.backArrowIconBtn}
      />
      <Pressable
        style={styles.continuebutton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.continue}>Confirm</Text>
      </Pressable>
      <View style={styles.options}>
        <Pressable style={styles.deaconFullDeaconWrapper}>
          <Text style={[styles.deaconFullDeacon, styles.deaconTypo]}>
            Deacon (Full Deacon)
          </Text>
        </Pressable>
        <Pressable style={[styles.optionsInner, styles.wrapperFlexBox]}>
          <View
            style={[
              styles.subdeaconEpideaconWrapper,
              styles.readerOgnostisPosition,
            ]}
          >
            <Text style={[styles.subdeaconEpideacon, styles.deaconTypo]}>
              Subdeacon (Epideacon)
            </Text>
          </View>
        </Pressable>
        <Pressable
          style={[styles.readerOgnostisWrapper, styles.wrapperFlexBox]}
        >
          <Text style={[styles.readerOgnostis, styles.readerOgnostisPosition]}>
            Reader (Ognostis)
          </Text>
        </Pressable>
        <Pressable
          style={[styles.chanterEpsaltosWrapper, styles.wrapperFlexBox]}
        >
          <Text style={styles.deaconTypo}>Chanter (Epsaltos)</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backArrowIconBtn: {
    height: "2.82%",
    width: "6.11%",
  },
  deaconTypo: {
    color: "#000",
    fontFamily: "Roboto-Bold",
    fontWeight: "700",
    fontSize: 24,
    letterSpacing: -0.2,
    textAlign: "left",
  },
  wrapperFlexBox: {
    padding: 20,
    justifyContent: "space-between",
    backgroundColor: "#8e8e93",
    left: "0%",
    right: "0%",
    height: "14.95%",
    flexDirection: "row",
    borderRadius: 10,
    alignItems: "center",
    position: "absolute",
    width: "100%",
  },
  readerOgnostisPosition: {
    zIndex: 0,
    top: 15,
    position: "absolute",
  },
  whatRankOf: {
    height: "4.69%",
    width: "73.79%",
    top: "18.78%",
    left: "8.14%",
    fontSize: 34,
    letterSpacing: -0.3,
    fontFamily: "Roboto-Regular",
    color: "#8e8e93",
    display: "flex",
    alignItems: "center",
    textAlign: "left",
    position: "absolute",
  },
  backarrow: {
    top: "8.69%",
    right: "89.82%",
    bottom: "88.5%",
    left: "4.07%",
    position: "absolute",
    overflow: "hidden",
  },
  continue: {
    fontSize: 17,
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
    color: "#fff",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  continuebutton: {
    height: "5.87%",
    width: "91.09%",
    top: "83.57%",
    right: "4.83%",
    bottom: "10.56%",
    backgroundColor: "#333",
    borderStyle: "solid",
    borderColor: "rgba(0, 0, 0, 0.15)",
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: "row",
    borderRadius: 10,
    left: "4.07%",
    alignItems: "center",
    position: "absolute",
  },
  deaconFullDeacon: {
    top: 17,
    left: 31,
    height: 23,
    width: 251,
    position: "absolute",
  },
  deaconFullDeaconWrapper: {
    top: "85.05%",
    bottom: "0%",
    backgroundColor: "#8e8e93",
    left: "0%",
    right: "0%",
    height: "14.95%",
    borderRadius: 10,
    position: "absolute",
    width: "100%",
  },
  subdeaconEpideacon: {
    top: 0,
    left: 0,
    position: "absolute",
  },
  subdeaconEpideaconWrapper: {
    left: 32,
    height: 28,
    width: 251,
  },
  optionsInner: {
    top: "56.7%",
    bottom: "28.35%",
  },
  readerOgnostis: {
    left: 61,
    color: "#000",
    fontFamily: "Roboto-Bold",
    fontWeight: "700",
    fontSize: 24,
    letterSpacing: -0.2,
    textAlign: "left",
  },
  readerOgnostisWrapper: {
    top: "28.35%",
    bottom: "56.7%",
  },
  chanterEpsaltosWrapper: {
    top: "0%",
    bottom: "85.05%",
  },
  options: {
    height: "45.54%",
    width: "79.9%",
    top: "30.52%",
    right: "10.18%",
    bottom: "23.94%",
    left: "9.92%",
    position: "absolute",
  },
  changerank: {
    backgroundColor: "#000",
    flex: 1,
    height: 852,
    overflow: "hidden",
    width: "100%",
  },
});

export default ChangeRank;
