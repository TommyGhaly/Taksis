import React, { useState, useEffect } from "react";
import {
  TextInput,
  View,
  Text,
  Alert,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BackArrow from "../../components/backArrow";
import ProgressBar from "../../components/progressBar";
import { collection, doc, getDoc, getFirestore } from '@react-native-firebase/firestore';
import { getAuth } from "@react-native-firebase/auth";
import { deleteObject, getStorage, ref } from '@react-native-firebase/storage';
import { makeStyles, useTheme, useTabBarInset } from "../../theme";

// Custom function to generate a UID
const generateUID = () => doc(collection(getFirestore(), "dummy")).id;

const AddChild = ({ navigation }) => {
  const styles = useStyles();
  const t = useTheme();
  const tabBarInset = useTabBarInset();
  const [name, setName] = useState("");
  const [childData, setChildData] = useState({
    uid: generateUID(),
    name: "",
    age: "",
    rank: "",
    experience: "",
    church: "",
    frequency: "",
    isDeacon: true,
    isSSTeacher: false,
  });

  useEffect(() => {
    const getUserData = async () => {
      try {
        const user = getAuth().currentUser;
        if (user) {
          const userDoc = await getDoc(doc(getFirestore(), "users", user.uid));
          if (userDoc.exists) {
            const userData = userDoc.data();
            setChildData((prevData) => ({
              ...prevData,
              church: userData.church,
              frequency: userData.frequency,
            }));
          }
        }
      } catch (error) {
        Alert.alert(
          "Error",
          "Failed to fetch user data. Please try again."
        );
      }
    };

    getUserData();
  }, []);

  const handleBackPress = async () => {
    try {
      // Attempt to delete the profile picture from cloud storage if it exists
      const storageRef = ref(getStorage(), `profilePictures/${childData.uid}.png`);
      await deleteObject(storageRef);
    } catch (error) {
      // Ignore error if file doesn't exist (error code 'storage/object-not-found')
      if (error.code !== 'storage/object-not-found') {
        // Error handling for profile picture deletion
      }
    }
    // Navigate back
    navigation.goBack();
  };

  const handleContinue = () => {
    if (!name) {
      Alert.alert("Please input a name before continuing.");
      return;
    }
    const words = name.trim().split(/\s+/).filter(word => word.length > 0);
    if (!(words.length >= 2)) {
      Alert.alert("Please input the first and last name.");
      return;
    }
    const updatedChildData = { ...childData, name };
    navigation.navigate("ChildPhoto", { childData: updatedChildData });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Back Arrow */}
      <View style={styles.backarrow}>
        <BackArrow onPress={handleBackPress} />
      </View>
      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <ProgressBar startPercentage={0} endPercentage={20} />
      </View>
      {/* Title */}
      <Text style={styles.title}>AddChild</Text>
      {/* Text Input */}
      <TextInput
        value={name}
        autoCapitalize="words"
        style={styles.textInput}
        placeholder="Enter your child's full name"
        placeholderTextColor={t.placeholder}
        keyboardAppearance={t.keyboardAppearance}
        onChangeText={(text) => setName(text)}
        color={t.textMuted}
      />
      {/* Disclaimer Text */}
      <Text style={styles.disclaimerText}>
        Please only add a child if they are a deacon and not already registered.
      </Text>
      {/* Continue Button */}
      <View style={[styles.continueLayout, { bottom: 20 + tabBarInset }]}>
        <TouchableOpacity onPress={handleContinue} style={styles.continueButton}>
          <Text style={styles.continueText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const useStyles = makeStyles((t) => ({
  container: {
    flex: 1,
    backgroundColor: t.background,
  },
  backarrow: {
    position: "absolute",
    top: 10,
    left: 16,
  },
  progressBar: {
    position: "absolute",
    top: 60,
    width: "84%",
    height: 12,
    alignSelf: "center",
  },
  title: {
    marginTop: 100,
    textAlign: "center",
    fontSize: 32,
    fontFamily: "Roboto-Regular",
    color: t.textMuted,
    letterSpacing: -0.5,
  },
  textInput: {
    marginTop: 30,
    fontSize: 17,
    fontFamily: "Roboto-Regular",
    borderColor: t.textMuted,
    height: 55,
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: t.background,
    color: t.textMuted,
    alignSelf: "center",
    width: "84%",
  },
  disclaimerText: {
    fontSize: 14,
    fontFamily: "Roboto-Regular",
    color: t.textMuted,
    textAlign: "center",
    marginTop: 20,
    paddingHorizontal: 16,
  },
  continueLayout: {
    position: "absolute",
    bottom: 20,
    height: 50,
    width: "91%",
    alignSelf: "center",
  },
  continueButton: {
    width: "100%",
    backgroundColor: t.surfaceHighest,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  continueText: {
    fontSize: 17,
    fontFamily: "Roboto-Medium",
    color: t.text,
    letterSpacing: -0.2,
    fontWeight: "500",
  },
}));

export default AddChild;