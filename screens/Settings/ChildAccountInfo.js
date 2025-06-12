import * as React from "react";
import { useState, useEffect } from "react";
import {
  Text,
  StyleSheet,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import BackArrow from "../../components/backArrow";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import storage from "@react-native-firebase/storage";

const ChildAccountInfo = ({ route, navigation }) => {
  const { childUid } = route.params;
  const [childData, setChildData] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    // Fetch child data
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
              Alert.alert("Error", "Child data not found.");
            }
          }
        }
      } catch (error) {
        Alert.alert("Error", "Could not fetch child data. Please try again.");
      }
    };

    // Fetch profile image
    const fetchImage = async () => {
      try {
        const url = await storage()
          .ref(`childProfilePictures/${childUid}.png`)
          .getDownloadURL();
        setImageUrl(url);
      } catch (error) {
        setImageUrl(null);
      }
    };

    fetchChildData();
    fetchImage();
  }, [childUid]);

  if (!childData) {
    return <Text style={styles.loadingText}>Loading...</Text>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.header}>
          <BackArrow onPress={() => navigation.goBack()} />
          <Text style={[styles.accountInfo, styles.text]}>Child Account Info</Text>
        </View>

        <View style={styles.profileImageContainer}>
          <Image
            style={styles.profileImage}
            source={
              typeof imageUrl === "string"
                ? { uri: imageUrl }
                : require("../../assets/default_profile.png")
            }
            onError={() => setImageUrl(null)}
          />
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{childData.name || "First Last"}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{childData.DOB || "Date of Birth"}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{childData.rank || "Rank"}</Text>
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoText}>{childData.church || "Church 1"}</Text>
        </View>

        <Text style={styles.disclaimer}>
          To change any child information, please remove the child and add them again.
        </Text>
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
  profileImageContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: "#8e8e93",
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
  disclaimer: {
    fontSize: 14,
    color: "#ff6347",
    textAlign: "center",
    marginTop: 20,
    paddingHorizontal: 16,
  },
  loadingText: {
    fontSize: 16,
    color: "#fff",
    textAlign: "center",
    marginTop: 20,
  },
});

export default ChildAccountInfo;