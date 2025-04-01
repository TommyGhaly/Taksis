import React, { useState } from "react";
import { TouchableOpacity, StyleSheet, View, Text, SafeAreaView, Alert} from "react-native";
import BackArrow from "../../components/backArrow";
import ProgressBar from "../../components/progressBar";
import Rank from "../../components/rank"; // Import Rank component

const ChildRank = ({ route, navigation }) => {
  const { childData } = route.params; // Get child data from the previous screen
  const [selectedRank, setSelectedRank] = useState(childData.rank || ""); // Default rank to the value from childData

  // Handle rank selection in the Rank component
  const handleSelectRank = (rank) => {
    setSelectedRank(rank);
  };

  const handleContinue = async () => {
    if (!selectedRank) {
      Alert.alert("Please select a rank before continuing.");
      return;
    }
    // Update childData with selectedRank
    const updatedChildData = { ...childData, rank: selectedRank };

    // Navigate to ChildAge screen and pass updated data
    navigation.navigate("ChildExperience", { childData: updatedChildData });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.backarrow}>
        <BackArrow onPress={() => navigation.goBack()} />
      </View>
      <View style={styles.progressBar}>
        <ProgressBar startPercentage={1} endPercentage={33} />
      </View>

      {/* Title Section */}
      <Text style={styles.title}>What is your child's rank?</Text>

      {/* Rank Component for selecting rank */}
      <View style={styles.rankContainer}>
        <Rank onSelectRank={handleSelectRank} />
      </View>

      {/* Continue Button */}
      <View style={styles.continueLayout}>
        <TouchableOpacity onPress={handleContinue} style={styles.continueButton}>
          <Text style={styles.continuetext}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  backarrow: {
    top: 10,
    left: 16,
    position: "absolute",
  },
  progressBar: {
    height: 12,
    width: "84%",
    top: 60,
    alignSelf: "center",
    position: "absolute",
  },
  title: {
    marginTop: 100, // Adjusted to move title further down for better alignment
    textAlign: "center",
    fontSize: 32, // Adjusted font size for better readability
    fontFamily: "Roboto-Regular",
    color: "#8e8e93",
    letterSpacing: -0.5,
    marginBottom: 30, // Added margin for spacing between title and Rank component
  },
  rankContainer: {
    flex: 1,
    paddingHorizontal: 30,
    marginBottom: 0, // Added margin for spacing between Rank and button
  },
  continueLayout: {
    bottom: 20,
    height: 50,
    width: "91%", // Kept for consistency, but centered
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center", // Centers the entire layout horizontally
    position: "absolute",
  },
  continueButton: {
    width: "100%",
    backgroundColor: "#333",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
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

export default ChildRank;
