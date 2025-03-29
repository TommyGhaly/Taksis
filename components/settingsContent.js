import * as React from "react";
import { useState, useEffect } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import * as AppleAuthentication from "expo-apple-authentication";
import { useUser } from "../UserContext";
import { callFunction, removeFamilySchedule } from "./functionCalls";

const SettingsContent = () => {
  const { signUp, setSignUp } = useUser(true);
  const navigation = useNavigation();
  const [userRoles, setUserRoles] = useState({
    name: "",
  });
  const [isLoading, setIsLoading] = useState(false); // New state variable for loading

  useEffect(() => {
    const user = auth().currentUser;
    if (user) {
      const unsubscribe = firestore()
        .collection("users")
        .doc(user.uid)
        .onSnapshot(
          (doc) => {
            if (doc.exists) {
              setUserRoles(doc.data());
            }
          },
          (error) => {
            console.error("Error fetching user roles: ", error);
          }
        );
      return () => unsubscribe();
    }
  }, []);


  
  const wait = (time) =>
    new Promise((resolve) => setTimeout(resolve, time * 1000));

  const handleSignOut = () => {
    setSignUp(false);
    console.log("sign Up :", signUp);
    auth().signOut();
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true); // Show loading indicator
            try {
              const user = auth().currentUser;
              if (user) {
                await removeFamilySchedule(
                  user,
                  userRoles.church,
                  "https://remove-family-schedules-hy6oofbihq-uc.a.run.app"
                );
                await callFunction(
                  user,
                  "https://delete-user-hy6oofbihq-uc.a.run.app"
                );
                setSignUp(false);
                await wait(2);
                Alert.alert("Success", "Your account has been deleted.");
              }
              await wait(2);
              await firestore().collection("users").doc(user.uid).delete();
              await wait(2);
              await user.delete();
            } catch (error) {
                await handleSignOut();
            } finally {
              setIsLoading(false); // Hide loading indicator
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Display ActivityIndicator when loading */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
      <View style={styles.profileSection}>
        <Text style={styles.userName}>{userRoles.name}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity
          style={styles.option}
          onPress={() => navigation.navigate("AccountInfo")}
        >
          <Text style={styles.optionText}>Account info</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.option}
          onPress={() => navigation.navigate("ChangeName")}
        >
          <Text style={styles.optionText}>Change name</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.option}
          onPress={() => navigation.navigate("ChangeAge")}
        >
          <Text style={styles.optionText}>Change age</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.option}
          onPress={() => navigation.navigate("ChangePassword")}
        >
          <Text style={styles.optionText}>Change password</Text>
        </TouchableOpacity>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Role</Text>
          <TouchableOpacity
            style={styles.option}
            onPress={() => navigation.navigate("ChangeRank")}
          >
            <Text style={styles.optionText}>Change deacon rank</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.option}
            onPress={() => navigation.navigate("ChangeRoles")}
          >
            <Text style={styles.optionText}>
              Change church services that apply to you
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.option}
            onPress={() => navigation.navigate("RequestServants")}
          >
            <Text style={styles.optionText}>
              Apply to be a servants meeting tracker
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Children</Text>
          <TouchableOpacity
            style={styles.option}
            onPress={() => navigation.navigate("ChangeChildren")}
          >
            <Text style={styles.optionText}>Change your children</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.option}
            onPress={() => navigation.navigate("AddChild")}
          >
            <Text style={styles.optionText}>Add child</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Church Adjustments</Text>
          <TouchableOpacity
            style={styles.option}
            onPress={() => navigation.navigate("ChangeChurch")}
          >
            <Text style={styles.optionText}>Change church</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.option}
            onPress={() => navigation.navigate("RequestAdmin")}
          >
            <Text style={styles.optionText}>Apply for admin</Text>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Log out</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteAccount}
        onPress={handleDeleteAccount}
      >
        <Text style={styles.deleteAccountText}>Delete Account</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  profileSection: {
    marginBottom: 20,
    alignItems: "center",
  },
  userName: {
    fontSize: 36,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    color: "#4d9cff",
    marginBottom: 10,
    fontWeight: "bold",
  },
  option: {
    backgroundColor: "#2e2e2e",
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionText: {
    fontSize: 16,
    color: "#fff",
  },
  signOut: {
    backgroundColor: "#147efb",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  signOutText: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "bold",
  },
  deleteAccount: {
    backgroundColor: "#ff3b30",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  deleteAccountText: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "bold",
  },
});

export default SettingsContent;
