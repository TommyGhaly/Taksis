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

const ChildAccountInfo = ({ route, navigation }) => {
  const { childUid } = route.params;
  const [childData, setChildData] = useState(null);

  useEffect(() => {
    const fetchChildData = async () => {
      try {
        const user = auth().currentUser;
        if (user) {
          const userDoc = await firestore().collection("users").doc(user.uid).get();

          if (userDoc.exists) {
            const userData = userDoc.data();
            const child = userData.children?.find((child) => child.uid === childUid);
            if (child) {
              setChildData(child);
            } else {
              console.warn("Child not found in user's document");
            }
          }
        }
      } catch (error) {
        console.error("Error fetching child data: ", error);
      }
    };

    fetchChildData();
  }, [childUid]);

  if (!childData) {
    return <Text>Loading...</Text>; // Loading indicator
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.header}>
          <BackArrow onPress={() => navigation.goBack()} />
          <Text style={[styles.accountInfo, styles.text]}>Child Account Info</Text>
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{childData.name || "First Last"}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{childData.age || "Age"}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{childData.rank || "Rank"}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{childData.church || "Church 1"}</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  scrollViewContent: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  text: {
    color: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  accountInfo: {
    fontSize: 24,
    marginLeft: 16,
  },
  infoBlock: {
    backgroundColor: "#2e2e2e",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: "#fff",
  },
});

export default ChildAccountInfo;
