import React, { useState } from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import BackArrow from "../../components/backArrow";
import ProgressBar from "../../components/progressBar";
import Rank from "../../components/rank";

const ChildDeaconRank = ({ route, navigation }) => {
  const { childData } = route.params; // Get child data from the previous screen
  const [deaconRank, setDeaconRank] = useState(childData.deaconRank || "");
  const handleRank = (rank) => {
    setDeaconRank(rank);
  };
  const handleContinue = () => {
    const updatedChildData = { ...childData, deaconRank };
    navigation.navigate("ChildAge", { childData: updatedChildData });
  };

  return (
    <View style={styles.childdeaconrank}>
      <View style={styles.backarrow}>
        <BackArrow onPress={() => navigation.goBack()} />
      </View>
      <View style={styles.progressBar}>
        <ProgressBar startPercentage={1} endPercentage={50} />
      </View>
      <Text style={styles.title}>What rank of deacon is your child?</Text>
      <View style={styles.rank}>
        <Rank onSelectRank={handleRank} />
      </View>
      <TouchableOpacity
        onPress={handleContinue}
        style={styles.continueLayout}
        activeOpacity={0.8}
      >
        <Text style={styles.continuetext}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  childdeaconrank: {
    flex: 1,
    backgroundColor: "#000",
  },
  backarrow: {
    top: 10,
    left: 16,
    position: "absolute",
  },
  progressBar: {
    height: 12,
    width: "84%", // Ensures width matches the AddChild progress bar
    top: 60, // Keeps the same top offset as in AddChild
    alignSelf: "center",
    position: "absolute",
    backgroundColor: "#000",
  },
  title: {
    top: 85,
    left: 20,
    width: "88%",
    textAlign: "center",
    position: "absolute",
    fontSize: 34,
    letterSpacing: -0.1,
    fontFamily: "Roboto-Regular",
    color: "#8e8e93",
  },
  rank: {
    top: 160,
    marginTop: 10,
  },
  continueLayout: {
    bottom: 20,
    left: 16,
    height: 50,
    width: "91%",
    backgroundColor: "#333",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
  },
  continuetext: {
    fontSize: 17,
    letterSpacing: -0.2,
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
    color: "#fff",
    textAlign: "center",
  },
});

export default ChildDeaconRank;
