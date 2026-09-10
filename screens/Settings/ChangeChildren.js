import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  arrayRemove,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  updateDoc,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import BackArrow from "../../components/backArrow";
import { callFunction } from "../../components/functionCalls";
import Avatar from "../../components/Avatar";
import * as avatarCache from "../../utils/avatarCache";

const ChangeChildren = () => {
  const navigation = useNavigation();
  const [children, setChildren] = useState([]);

  useEffect(() => {
    const user = getAuth().currentUser;

    if (user) {
      // Fetch user data and children
      const unsubscribe = onSnapshot(
        doc(getFirestore(), "users", user.uid),
        (doc) => {
          const userData = doc.data();
          if (userData && userData.children) {
            setChildren(userData.children);
            // Adopt any photoURL already on these records — no Storage request.
            avatarCache.primeMany(userData.children);
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

      // Cleanup subscription on unmount
      return () => {
        unsubscribe();
      };
    }
  }, []);

  const handleRemoveChild = async (childId) => {
    Alert.alert(
      "Remove Child",
      "Are you sure you want to remove this child? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const user = getAuth().currentUser;
            if (!user) {
              Alert.alert(
                "Error",
                "User not authenticated. Please sign in again."
              );
              return;
            }

            try {
              const userDoc = await getDoc(doc(getFirestore(), "users", user.uid));
              const userData = userDoc.data();

              if (!userData?.children) {
                Alert.alert("Error", "No children found.");
                return;
              }

              const childToRemove = userData.children.find(
                (child) => child.uid === childId
              );

              if (!childToRemove) {
                Alert.alert("Error", "Child not found.");
                return;
              }

              // Delete profile picture from storage, plus the cached url. A
              // child has no users/{uid} doc, so removePhoto's field clear just
              // fails and logs; it is used here to keep every removal path on
              // one helper.
              try {
                await avatarCache.removePhoto(childId);
              } catch (error) {
                // Continue even if image deletion fails
              }

              // Call delete function
              await callFunction(
                user,
                "https://delete-child-hy6oofbihq-uc.a.run.app",
                { church: userData.church, uid: childId },
                "Failed to remove child. Please try again."
              );

              // Remove child from Firestore
              await updateDoc(doc(getFirestore(), "users", user.uid), {
                children: arrayRemove(childToRemove),
              });
            } catch (error) {
              console.error("Remove child error:", error);
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
              <Avatar
                uid={child.uid}
                user={child}
                size={40}
                borderRadius={20}
                style={styles.profileImage}
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
