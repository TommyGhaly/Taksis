import * as React from "react";
import { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  Text,
  TouchableOpacity,
} from "react-native";
import Rank from "../components/rank";
import BackArrow from "../components/backArrow";
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import ProgressBar from "../components/progressBar";

const DeaconRank = ({ navigation }) => {
  const [rank, setRank] = useState(null);
  const user = auth().currentUser;
  const handleRank = (selectedRank) => {
    setRank(selectedRank);
  }
  const handleContinue = async (user) => {
    try {
      await firestore().collection('users').doc(user.uid).update({
        rank: rank, 
      });

      // Navigate to the next screen or show a success message
      navigation.navigate("Experience");
    } catch (error) {
      console.error("Error updating user deacon: ", error);
      Alert.alert("Error", "Could not update deacon information. Please try again.");
    }
};
  return (
    <View style={styles.deaconrank}>
      <View style={styles.backarrow}>
        <BackArrow />
      </View> 
      <View style={styles.rank}>
        <Rank style={styles.rank} onSelectRank={handleRank}/>
      </View>
      <View style={styles.title}>
        <Text style={styles.titleText}>What rank of deacon are you?</Text>
      </View> 

      <View style={styles.continueLayout}>
        <Pressable
          onPress={() => handleContinue(user)}
        >
          <Text style={styles.continuetext}>Continue</Text>
        </Pressable>
      </View>
      <View style={styles.progressBar}>
        <ProgressBar startPercentage={40} endPercentage={60}/>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backarrow: {
    top: 74,
    left: 16,
  },
  continueLayout: {
    top: 225,
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
  progressBar: {
    top: 84,
    right: "12.2137%",
    bottom: "88.26%",
    left: "12.2137%",
    position: "absolute",
    backgroundColor: "#000",
  },
  filled: {
    position: "absolute",
    marginTop: -2,
    width: "59.3%",
    top: "50%",
    right: "40.7%",
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
  rank: {
    top: "28.5164%",
    left: "9.9236%",
    height: "45.529%",
    width: "79.898%",
  },
  title: {
    top: "-30%",
    left: "4.071%",
    right: "4.071%",
    width: "88.295%",
  },
  titleText: {
    fontSize: 34,
    letterSpacing: -0.1,
    fontFamily: "Roboto-Regular",
    color: "#8e8e93",
  },
  continue: {
    top: "27%",
    left: "4.071%",
  },
  deaconrank: {
    flex: 1,
    height: "100%",
    overflow: "hidden",
    width: "100%",
    backgroundColor: "#000",
  },
});

export default DeaconRank;
