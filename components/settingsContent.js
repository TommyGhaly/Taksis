import * as React from "react";
import { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

const SettingsContent = () => {
  const navigation = useNavigation();
  const [userRoles, setUserRoles] = useState({
    name: ""
  });

  useEffect(() => {
    const fetchUserRoles = async () => {
      try {
        const user = auth().currentUser;
        if (user) {
          const userDoc = await firestore().collection("users").doc(user.uid).get();
          if (userDoc.exists) {
            setUserRoles(userDoc.data());
          }
        }
      } catch (error) {
        console.error("Error fetching user roles: ", error);
      }
    };

    fetchUserRoles();
  }, []);

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
          onPress={() => navigation.navigate("ChangeEmail")}
        >
          <Text style={styles.optionText}>Change email</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.option}
          onPress={() => navigation.navigate("ChangePhoneNumber")}
        >
          <Text style={styles.optionText}>Change age</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.option}
          onPress={() => navigation.navigate("ChangePassword")}
        >
          <Text style={styles.optionText}>Change password</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.option}
          onPress={() => navigation.navigate("RequestAdmin")}
        >
          <Text style={styles.optionText}>Apply for admin</Text>
        </TouchableOpacity>
      </View>

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
          <Text style={styles.optionText}>Change church services that apply to you</Text>
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
      </View>

      <TouchableOpacity 
        style={styles.signOut}
        onPress={() => auth().signOut()}
      >
        <Text style={styles.signOutText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  profileSection: {
    marginBottom: 20,
    alignItems: 'center',
  },
  userName: {
    fontSize: 36,
    color: "#aaa",
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    color: "#ffffff",
    marginBottom: 10,
    fontWeight: 'bold',
  },
  option: {
    backgroundColor: "#2e2e2e",
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    color: "#8e8e93",
  },
  signOut: {
    backgroundColor: "#147efb",
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 18,
    color: "#ffffff",
    fontWeight: "bold"
  },
});

export default SettingsContent;
