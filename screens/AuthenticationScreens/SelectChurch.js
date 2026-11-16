import React, { useState } from "react";
import { View, Pressable, Text, Alert } from "react-native";
import { doc, getFirestore, updateDoc } from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import Churches from "../../components/churches";
import ProgressBar from "../../components/progressBar";
import BackArrow from "../../components/backArrow";
import { makeStyles } from "../../theme";

const SelectChurch = ({ navigation }) => {
  const styles = useStyles();
  const [selectedChurch, setSelectedChurch] = useState(null);
  const user = getAuth().currentUser;

  const handleChurchSelection = (church) => {
    setSelectedChurch(church);
  };

  const handleContinue = async () => {
    if (!selectedChurch) {
      Alert.alert("Selection Required", "Please select a church before proceeding.");
      return;
    }

    try {
      await updateDoc(doc(getFirestore(), "users", user.uid), {
        church: selectedChurch,
      });
      navigation.navigate("SelectApplicable");
    } catch (error) {
      Alert.alert("Error", "Could not update church information. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.backArrow}>
          <BackArrow />
        </View>
        <View style={styles.progressBar}>
          <ProgressBar startPercentage={17} endPercentage={33} />
        </View>
        <Text style={styles.titleText}>Select Your Church</Text>
      </View>

      <View style={styles.content}>
        <Churches onSelectChurch={handleChurchSelection} />
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>
        <Pressable
          style={styles.churchRegisterLink}
          onPress={() => navigation.navigate("ChurchRegistration")}
        >
          <Text style={styles.linkText}>
            <Text style={styles.linkPrefix}>Church not listed? </Text>
            <Text style={styles.linkAction}>Register it</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const useStyles = makeStyles((t) => ({
  container: {
    flex: 1,
    backgroundColor: t.background,
    paddingHorizontal: 16,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
  },
  backArrow: {
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    width: "100%",
    backgroundColor: t.isDark ? t.surfaceElevated : t.surfaceHighest,
    borderRadius: 3,
    marginBottom: 12,
  },
  titleText: {
    fontSize: 36,
    letterSpacing: -0.5,
    fontFamily: "Roboto-Regular",
    fontWeight: "600",
    color: (t.isDark ? "#E0E0E0" : t.text),
    lineHeight: 42,
    maxWidth: "90%",
    marginTop: 30,
  },
  content: {
    flex: 1,
    marginBottom: 24,
  },
  footer: {
    paddingBottom: 32,
    alignItems: "center",
  },
  continueButton: {
    height: 52,
    width: "100%",
    backgroundColor: t.accent,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 35,
    elevation: 4,
    shadowColor: t.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  continueText: {
    fontSize: 18,
    letterSpacing: -0.2,
    fontWeight: "600",
    fontFamily: "Roboto-Medium",
    color: t.onAccent,
  },
  churchRegisterLink: {
    alignSelf: "center",
  },
  linkText: {
    fontSize: 16,
    letterSpacing: -0.1,
    fontFamily: "Roboto-Regular",
  },
  linkPrefix: {
    color: t.isDark ? "#B0BEC5" : t.textSecondary,
  },
  linkAction: {
    color: t.accent,
    fontWeight: "500",
  },
}));

export default SelectChurch;