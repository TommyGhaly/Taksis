import * as React from "react";
import { useState, useEffect } from "react";
import {
  Text,
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import BackArrow from "../../components/backArrow";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

const AccountInfo = ({ navigation }) => {
  const [userData, setUserData] = useState(null); // Initialize as null or {}

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth().currentUser;
        if (user) {
          const userDoc = await firestore()
            .collection("users")
            .doc(user.uid)
            .get();
          if (userDoc.exists) {
            setUserData(userDoc.data());
          }
        }
      } catch (error) {
        console.error("Error fetching user data: ", error);
      }
    };

    fetchUserData();
  }, []);

  if (!userData) {
    return <Text>Loading...</Text>; // Or any loading indicator
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.header}>
          <BackArrow />
          <Text style={[styles.accountInfo, styles.text]}>Account info</Text>
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{userData.name || "First Last"}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>
            {userData.email || "example@gmail.com"}
          </Text>
        </View>

        {/* Conditionally render the Rank field if the user is a deacon */}
        {userData.isDeacon && (
          <View style={styles.infoBlock}>
            <Text style={styles.infoText}>{userData.rank || "Deacon"}</Text>
          </View>
        )}

        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{userData.church || "Church 1"}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{userData.age || "Age"}</Text>
        </View>

        <Text style={[styles.childHeading, styles.text]}>Children</Text>

        {/* Safely map over children with fallback */}
        {(userData.children || []).map((child, index) => (
          <TouchableOpacity
            key={index}
            style={styles.childInfo}
            onPress={() => {}}
          >
            <Text style={styles.infoText}>
              {child.name || `Child ${index + 1} First Last`}
            </Text>
            <Image
              style={styles.vectorIcon}
              resizeMode="cover"
              source={require("../../assets/Vector.png")}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  scrollViewContent: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  text: {
    color: "#8e8e93",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  accountInfo: {
    fontSize: 24,
    marginLeft: 16, // Creates spacing between the back arrow and the title
  },
  infoBlock: {
    backgroundColor: "#1e1e1e",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: "#8e8e93",
  },
  childHeading: {
    fontSize: 18,
    marginTop: 20,
    marginBottom: 12,
  },
  childInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  vectorIcon: {
    width: 8,
    height: 16,
  },
});

export default AccountInfo;
