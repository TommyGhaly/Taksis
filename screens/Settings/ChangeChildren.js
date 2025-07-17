import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  Image,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import firestore, { FieldValue } from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import storage from "@react-native-firebase/storage";
import BackArrow from "../../components/backArrow";
import { callDeleteUser } from "../../components/functionCalls";

const ChangeChildren = () => {
  const navigation = useNavigation();
  const [children, setChildren] = useState([]);
  const [profilePictureUrls, setProfilePictureUrls] = useState({});

  useEffect(() => {
    const user = auth().currentUser;

    if (user) {
      // Fetch user data and children
      const unsubscribe = firestore()
        .collection("users")
        .doc(user.uid)
        .onSnapshot(
          (doc) => {
            const userData = doc.data();
            if (userData && userData.children) {
              setChildren(userData.children);
            } else {
              setChildren([]);
            }
          },
          (error) => {
            Alert.alert(
              "Error",
              "Failed to fetch children data. Please try again."
            );
          }
        );

      // Fetch profile pictures
      const fetchProfilePictures = async () => {
        try {
          const doc = await firestore().collection("users").doc(user.uid).get();
          if (doc.exists) {
            const userData = doc.data();
            const children = userData.children || [];
            const urls = {};
            await Promise.all(
              children.map(async (child) => {
                if (child.uid) {
                  try {
                    const url = await storage()
                      .ref(`profilePictures/${child.uid}.png`)
                      .getDownloadURL();
                    if (typeof url === "string" && url.trim() !== "") {
                      urls[child.uid] = url;
                    } else {
                      urls[child.uid] = null;
                    }
                  } catch (error) {
                    urls[child.uid] = null; // Fallback to default image
                  }
                }
              })
            );
            setProfilePictureUrls(urls);
          }
        } catch (error) {
          console.warn("Failed to fetch profile picture URLs:", error);
        }
      };

      // Fetch profile pictures immediately
      fetchProfilePictures();

      // Set up interval to check for updates every 30 seconds
      const intervalId = setInterval(fetchProfilePictures, 30000);

      // Cleanup subscription and interval on unmount
      return () => {
        unsubscribe();
        clearInterval(intervalId);
      };
    }
  }, []);

  const handleRemoveChild = async (childId) => {
    Alert.alert(
      "Remove Child",
      "Are you sure you want to remove this child? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const user = auth().currentUser;
              if (user) {
                const userDoc = await firestore()
                  .collection("users")
                  .doc(user.uid)
                  .get();
                const userData = userDoc.data();

                if (userData && userData.children) {
                  const childToRemove = userData.children.find(
                    (child) => child.uid === childId
                  );

                  if (childToRemove) {
                    // Delete profile picture from storage
                    try {
                      await storage()
                        .ref(`profilePictures/${childId}.png`)
                        .delete();
                    } catch (error) {
                      console.warn("Failed to delete child profile picture:", error);
                      // Continue with removal even if image deletion fails
                    }

                    // Call custom delete function
                    await callDeleteUser(
                      user,
                      userData.church,
                      childId,
                      "https://delete-child-hy6oofbihq-uc.a.run.app"
                    );

                    // Remove child from Firestore
                    await firestore()
                      .collection("users")
                      .doc(user.uid)
                      .update({
                        children: FieldValue.arrayRemove(childToRemove),
                      });

                    // Update local state to remove profile picture
                    setProfilePictureUrls((prev) => {
                      const updated = { ...prev };
                      delete updated[childId];
                      return updated;
                    });
                  } else {
                    Alert.alert("Error", "Child not found.");
                  }
                } else {
                  Alert.alert("Error", "No children found.");
                }
              }
            } catch (error) {
              Alert.alert(
                "Error",
                "Failed to remove the child. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <BackArrow style={styles.backArrow} />
      {children.length === 0 ? (
        <Text style={styles.noChildrenText}>You have no children</Text>
      ) : (
        <ScrollView
          style={styles.childrenList}
          showsVerticalScrollIndicator={false}
        >
          {children.map((child) => (
            <View key={child.uid} style={styles.childContainer}>
              <Image
                style={styles.profileImage}
                source={
                  profilePictureUrls[child.uid] &&
                  typeof profilePictureUrls[child.uid] === "string" &&
                  profilePictureUrls[child.uid].trim() !== ""
                    ? { uri: profilePictureUrls[child.uid] }
                    : require("../../assets/default_profile.png")
                }
                defaultSource={require("../../assets/default_profile.png")}
                onError={() =>
                  setProfilePictureUrls((prev) => ({
                    ...prev,
                    [child.uid]: null,
                  }))
                }
              />
              <Text style={styles.childName}>{child.name}</Text>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveChild(child.uid)}
              >
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
      <TouchableOpacity
        style={styles.confirmButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.confirmButtonText}>Confirm</Text>
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
  backArrow: {
    marginBottom: 20,
  },
  noChildrenText: {
    color: "#8e8e93",
    fontSize: 25,
    textAlign: "center",
    marginTop: 50,
  },
  childrenList: {
    top: 30,
    flex: 1,
  },
  childContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2e2e2e",
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#333333",
  },
  childName: {
    color: "#8e8e93",
    fontSize: 18,
    flex: 1,
  },
  removeButton: {
    backgroundColor: "#ff3b30",
    borderRadius: 5,
    padding: 10,
  },
  removeButtonText: {
    color: "#ffffff",
    fontSize: 16,
  },
  confirmButton: {
    backgroundColor: "#333",
    borderRadius: 10,
    padding: 15,
    marginTop: 20,
    alignItems: "center",
  },
  confirmButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "500",
  },
});

export default ChangeChildren;