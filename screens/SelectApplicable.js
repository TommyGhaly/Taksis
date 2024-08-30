  import React, { useState } from "react";
  import { StyleSheet, View, Text, Pressable } from "react-native";
  import firestore from '@react-native-firebase/firestore';
  import Choices from "../components/choices";
  import { useNavigation } from "@react-navigation/native";
  import BackArrow from "../components/backArrow";
  import auth from '@react-native-firebase/auth';

  const SelectApplicable = ({ navigation }) => {
    const user = auth().currentUser;
    const [isDeacon, setDeacon] = useState(false);
    const [isAlhan, setAlhan] = useState(false);
    const [isSSTeach, setSSTeach] = useState(false);
    const [isServants, setServant] = useState(false);

    const handleDeacon = (checked) => {
      setDeacon(checked);
    };
    const handleAlhan = (checked) => {
      setAlhan(checked);
    };
    const handleSSTeacher = (checked) => {
      setSSTeeach(checked);
    };
    const handleServant = (checked) => {
      setServant(checked)
    };
    
  
    const handleContinue = async (user) => {
      try {
        await firestore().collection('users').doc(user.uid).update({
          isDeacon: isDeacon, 
          isAlhan: isAlhan,
          isSSTeach: isSSTeach,
          isServants: isServants,
        });
      }
      
      catch (error) {
        console.error("Error uploading selected boxes into database ", error);
        Alert.alert("Error", "Could not update roles");
      }
      if (isDeacon) {
        navigation.navigate("DeaconRank"); // Navigate to rank.js
      } else {
        navigation.navigate("Experience"); // Navigate to Experience.js
      }
    };

    return (
      <View style={styles.selectapplicable}>
        <View style={styles.backarrow}>
          <BackArrow />
        </View>
        <View style={styles.title}>
          <Text style={styles.titleText}>Select all that apply</Text>
        </View>
        <View style={styles.choices}>
          <Choices onDeaconChange={handleDeacon} onAlhanChange={handleAlhan} onSSTeacherChange={handleSSTeacher} onServantChange={handleServant}/>
        </View>
        <View style={styles.continueLayout}>
          <Pressable onPress={() => handleContinue(user)}>
            <Text style={styles.continuetext}>Continue</Text>
          </Pressable>
        </View>
        <View style={styles.progressBar}>
          <View style={styles.track}>
            <View style={styles.filled} />
          </View>x
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    choices: {
      top: 158,
      left: 47,
    },
    backarrow: {
      top: 74,
      left: 16,
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
    continueButton: {
      top: "83.568%",
      left: "4.071%",
    },
    title: {
      top: "13%",
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
    selectapplicable: {
      flex: 1,
      width: "100%",
      height: "100%",
      overflow: "hidden",
      backgroundColor: "#000",
    },

    continueLayout: {
      top: 654,
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

  export default SelectApplicable;
