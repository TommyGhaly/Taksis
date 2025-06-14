import * as React from "react";
import { useState, useEffect } from "react";
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import storage from "@react-native-firebase/storage";
import { useUser } from "../UserContext";
import { callFunction, removeFamilySchedule } from "./functionCalls";
import { deleteUser } from "@react-native-firebase/auth";

const SettingsContent = () => {
  const { signUp, setSignUp } = useUser(true);
  const navigation = useNavigation();
  const [userRoles, setUserRoles] = useState({ name: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    const user = auth().currentUser;
    if (user) {
      // Fetch user data
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
            console.warn("Failed to fetch user data:", error);
          }
        );

      // Fetch profile picture
      const fetchImage = async () => {
        try {
          const url = await storage().ref(`profilePictures/${user.uid}.png`).getDownloadURL();
          // Ensure the URL is a non-empty string before setting it
          if (typeof url === "string" && url.trim() !== "") {
            setImageUrl(url);
          } else {
            setImageUrl(null);
          }
        } catch (error) {
          setImageUrl(null); // Fallback to default image on error
        }
      };

      // Fetch image immediately
      fetchImage();

      // Set up interval to check for updates every 30 seconds
      const intervalId = setInterval(fetchImage, 10000);

      // Cleanup interval and Firestore listener
      return () => {
        clearInterval(intervalId);
        unsubscribe();
      };
    }
  }, []);

  const wait = (time) =>
    new Promise((resolve) => setTimeout(resolve, time * 1000));

  const handleSignOut = () => {
    setSignUp(false);
    auth().signOut();
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              const user = auth().currentUser;
              if (user) {
                // Remove family schedule
                await removeFamilySchedule(
                  user,
                  userRoles.church,
                  "https://remove-family-schedules-hy6oofbihq-uc.a.run.app"
                );

                // Call custom delete function
                await callFunction(
                  user,
                  "https://delete-user-hy6oofbihq-uc.a.run.app"
                );

                // Delete profile picture from storage
                try {
                  await storage().ref(`profilePictures/${user.uid}.png`).delete();
                } catch (error) {
                  console.warn("Failed to delete profile picture:", error);
                  // Continue with deletion even if image deletion fails
                }

                // Update user context
                setSignUp(false);

                // Delete Firestore user document
                await firestore().collection("users").doc(user.uid).delete();

                // Wait briefly to ensure operations complete
                await wait(2);

                // Delete Firebase Auth user
                await deleteUser(user);

                Alert.alert("Success", "Your account has been deleted.");
              }
            } catch (error) {
              console.warn("Account deletion failed:", error);
              await handleSignOut(); // Fallback to sign out on error
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
      <View style={styles.profileSection}>
        <Image
          style={styles.profileImage}
          source={
            typeof imageUrl === "string" && imageUrl.trim() !== ""
              ? { uri: imageUrl }
              : require("../assets/default_profile.png")
          }
          defaultSource={require("../assets/default_profile.png")}
          onError={() => setImageUrl(null)}
        />
        <Text style={styles.userName}>{userRoles.name}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate("AccountInfo")}>
          <Text style={styles.optionText}>Account info</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate("ChangeName")}>
          <Text style={styles.optionText}>Change name</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate("ChangeEmail")}>
          <Text style={styles.optionText}>Change email</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate("ChangeNumber")}>
          <Text style={styles.optionText}>Change phone number</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate("ChangeAge")}>
          <Text style={styles.optionText}>Change date of birth</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate("ChangePhoto")}>
          <Text style={styles.optionText}>Change profile picture</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate("ChangePassword")}>
          <Text style={styles.optionText}>Change password</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Role</Text>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate("ChangeRank")}>
          <Text style={styles.optionText}>Change deacon rank</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate("ChangeRoles")}>
          <Text style={styles.optionText}>Change church services that apply to you</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate("RequestServants")}>
          <Text style={styles.optionText}>Apply to be a servants meeting tracker</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Children</Text>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate("ChangeChildren")}>
          <Text style={styles.optionText}>Change your children</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate("AddChild")}>
          <Text style={styles.optionText}>Add child</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Church Adjustments</Text>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate("ChangeChurch")}>
          <Text style={styles.optionText}>Change church</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate("RequestAdmin")}>
          <Text style={styles.optionText}>Apply for admin</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.signOut} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Log out</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteAccount} onPress={handleDeleteAccount}>
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
    position: "absolute", // Changed to fixed position
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#333333",
  },
  userName: {
    fontSize: 28,
    fontWeight: "600",
    color: "#fff",
    flex: 1,
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