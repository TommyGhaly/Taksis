import React, { useState } from "react";
import { StyleSheet, View, Pressable, Text, Alert } from "react-native";
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Churches from "../components/churches";
import BackArrow from "../components/backArrow";
import ProgressBar from "../components/progressBar";

const SelectChurch = ({navigation}) => {
  const [selectedChurch, setSelectedChurch] = useState(null);
  const user = auth().currentUser;
  const handleChurchSelection = (church) => {
    setSelectedChurch(church);
  };
  const handleContinue = async (user) => {
      try {
        await firestore().collection('users').doc(user.uid).update({
          church: selectedChurch, 
        });

        // Navigate to the next screen or show a success message
        navigation.navigate("SelectApplicable");
      } catch (error) {
        console.error("Error updating user church: ", error);
        Alert.alert("Error", "Could not update church information. Please try again.");
      }
  };

  return (
    <View style={styles.loadout}>
      <View style={styles.backarrow}>
        <BackArrow />
      </View>
      <View style={styles.title}>
        <Text style={styles.titleText}>
          Select the church you regularly attend
        </Text>
      </View>
      <View style={styles.position}>
        <Churches onSelectChurch={handleChurchSelection} />
      </View>
      <View
        style={[styles.dontSeeYourChurchRegiste, styles.dontSeeYourContainer]}
      >
        <Pressable
          onPress={() => {
            navigation.navigate("ChurchRegistration");
          }}
        >
          <Text style={styles.text}>
            <Text style={styles.dontSeeYour}>{`Don’t see your church? `}</Text>
            <Text style={styles.registerIt}>Register it</Text>
          </Text>
        </Pressable>
      </View>
      <View style={styles.continueLayout}>
        <Pressable
          onPress={() =>
            handleContinue(user)
          }
        >
          <Text style={styles.continuetext}>Continue</Text>
        </Pressable>
      </View>
      <View style={styles.progressBar}>
        <ProgressBar startPercentage={1} endPercentage={20}/>
      </View>
      <View style={styles.backbutton}>
        <BackArrow />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backarrow: {
    top: 74,
    left: 16,
  },
  position: {
    top: "27.230%",
    height: 450,
    left: "2.223%",
    right: "2.223%",
    position: "absolute",
  },
  loadout: {
    width: "100%",
    height: "100%",
    flex: 1,
    backgroundColor: "#000",
  },
  dontSeeYour: {
    color: "#8e8e93",
  },
  registerIt: {
    color: "#6e85e3",
  },
  text: {
    fontSize: 15,
    letterSpacing: -0.1,
    fontFamily: "Roboto-Regular",
    textAlign: "center",
  },
  dontSeeYourContainer: {
    position: "absolute",
    left: 0,
    top: 782,
  },
  dontSeeYourChurchRegiste: {
    width: "100%",
    height: "2.112%",
  },
  title: {
    top: 100,
    left: 16,
    height: "6.103%",
    width: "88.295%",
    flex: 1,
  },
  titleText: {
    fontSize: 34,
    letterSpacing: -0.1,
    fontFamily: "Roboto-Regular",
    textAlign: "left",
    color: "#8e8e93",
  },
  progressBar: {
    top: 84,
    right: "12.2137%",
    bottom: "88.26%",
    left: "12.2137%",
    position: "absolute",
  },
  filled: {
    position: "absolute",
    marginTop: -2,
    width: "22.43%",
    top: "50%",
    right: "77.57%",
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
  backbutton: {
    top: "8.68545%",
    left: "4.071%",
  },
  continueLayout: {
    bottom: 60,
    left: 16,
    height: 50,
    width: 358,
    backgroundColor: "#333",
    borderRadius: 10,
  },
  continuetext: {
    top: 15,
    fontSize: 17,
    letterSpacing: -0.2,
    fontWeight: "500",
    fontFamily: "Roboto-Medium",
    color: "#fff",
    textAlign: "center",
  },
});

export default SelectChurch;