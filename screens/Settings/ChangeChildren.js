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
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import BackArrow from "../../components/backArrow"; // Import your BackButton component

const ChangeChildren = () => {
  const navigation = useNavigation();
  const [children, setChildren] = useState([]);

  useEffect(() => {
    const user = auth().currentUser;

    if (user) {
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
            console.error("Error fetching children data: ", error);
          }
        );

      // Cleanup subscription on unmount
      return () => unsubscribe();
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
                    await firestore()
                      .collection("users")
                      .doc(user.uid)
                      .update({
                        children:
                          firestore.FieldValue.arrayRemove(childToRemove),
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
              console.error("Error removing child: ", error);
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
        <ScrollView style={styles.childrenList}>
          {children.map((child) => (
            <View key={child.uid} style={styles.childContainer}>
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
    backgroundColor: "#1e1e1e",
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
  childName: {
    color: "#8e8e93",
    fontSize: 18,
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
