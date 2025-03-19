import * as React from "react";
import { useState, useEffect } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { UserProvider, useUser } from "../UserContext";
import { callFunction } from "./functionCalls";




const SettingsContent = () => {
  const { signUp, setSignUp } = useUser(true);
  const navigation = useNavigation();
  const [userRoles, setUserRoles] = useState({
    name: "",
  });

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

      // Cleanup subscription on unmount
      return () => unsubscribe();
    }
  }, []);

  const revokeSignInWithAppleToken = async () => {
    // Get an authorizationCode from Apple
    const { authorizationCode } = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.REFRESH,
    });

    // Ensure Apple returned an authorizationCode
    if (!authorizationCode) {
      throw new Error(
        "Apple Revocation failed - no authorizationCode returned"
      );
    }

    // Revoke the token
    return auth().revokeToken(authorizationCode);
  };

  const handleDelete = async () => {
    const user = auth().currentUser;
    if (!user) {
      console.log('No authenticated user found.');
      return;
    }

    if (userRoles && userRoles.children) {
      for (const child of userRoles.children) {
        try {
          await callDeleteUser(user, child.uid, "https://delete-user-hy6oofbihq-uc.a.run.app");
          console.log(`Successfully deleted child user with UID: ${child.uid}`);
        } catch (error) {
          console.error(`Failed to delete child user with UID: ${child.uid}`, error);
        }
      }
    } else {
      console.log('No child users found.');
    }
    await callDeleteUser(user, user.uid, "https://delete-user-hy6oofbihq-uc.a.run.app");
  };

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
            try {
              const user = auth().currentUser;
              if (user) {
                await callFunction(user, "https://delete-user-hy6oofbihq-uc.a.run.app");
                await setSignUp(false);
                await firestore().collection("users").doc(user.uid).delete();
                await user.delete();
                await revokeSignInWithAppleToken;
                Alert.alert("Success", "Your account has been deleted.");
                // Navigate to a safe screen or log out
              }
            } catch (error) {
              Alert.alert(
                "Error",
                "Failed to delete the account. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
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
            <Text style={styles.optionText}>Apply to be a servants meeting tracker</Text>
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
  profileSection: {
    marginBottom: 20,
    alignItems: "center",
  },
  userName: {
    fontSize: 36,
    fontWeight: 600,
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
