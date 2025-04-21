import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

const ServantsAttendance = ({ navigation }) => {
  const user = auth().currentUser;
  const [servants, setServants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newServantName, setNewServantName] = useState("");
  const [submitting, setSubmitting] = useState(false); // State for add servant loading
  const scrollViewRef = useRef(null); // Ref for ScrollView
  const roleRefs = useRef({}); // Refs for each role section
  const [roles, setRoles] = useState([]); // List of unique roles

  useEffect(() => {
    if (!user) {
      Alert.alert("Error", "No user found.");
      return;
    }

    // Fetch user data in real-time
    const unsubscribeUserData = firestore()
      .collection("users")
      .doc(user.uid)
      .onSnapshot(
        (userDoc) => {
          if (userDoc.exists) {
            setUserData(userDoc.data());
          } else {
            Alert.alert("Error", "User not found.");
          }
        },
        (error) => {
          Alert.alert("Error", error.message);
        }
      );

    return () => unsubscribeUserData();
  }, [user]);

  useEffect(() => {
    if (!userData) return;

    // Fetch servants data in real-time
    const servantsMeetingRef = firestore()
      .collection("churches")
      .doc(userData.church)
      .collection("Servants Meeting");

    const unsubscribeServants = servantsMeetingRef.onSnapshot(async (snapshot) => {
      let servantsData = snapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      }));
      servantsData.sort((a, b) => a.name.localeCompare(b.name));

      // Extract unique roles (assuming a 'role' field exists; adjust as needed)
      const uniqueRoles = [
        ...new Set(servantsData.map((servant) => servant.role || "General")),
      ];
      setRoles(uniqueRoles);

      const dateKey = getNextSunday();
      const servantsWithAttendance = await Promise.all(
        servantsData.map(async (servant) => {
          const attendanceDoc = await firestore()
            .collection("churches")
            .doc(userData.church)
            .collection("Servants Meeting")
            .doc(servant.uid)
            .get();

          const attendanceStatus = attendanceDoc.exists
            ? attendanceDoc.data()[dateKey]
            : null;

          return {
            ...servant,
            attendance: attendanceStatus,
          };
        })
      );

      setServants(servantsWithAttendance);
      setLoading(false);
    });

    return () => unsubscribeServants();
  }, [userData]);

  const getNextSunday = () => {
    const today = new Date();
    const currentDay = today.getDay();
    if (currentDay === 0) return formatDate(today);
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + (7 - currentDay));
    return formatDate(nextSunday);
  };

  const formatDate = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  const handleAttendance = (servantID, status) => {
    const dateKey = getNextSunday();
    firestore()
      .collection("churches")
      .doc(userData.church)
      .collection("Servants Meeting")
      .doc(servantID)
      .update({
        [dateKey]: status,
      })
      .then(() => {
        setServants((prevServants) =>
          prevServants.map((servant) =>
            servant.uid === servantID
              ? { ...servant, attendance: status }
              : servant
          )
        );
      });
  };

  const addServant = async () => {
    if (!newServantName.trim()) {
      Alert.alert("Error", "Please enter a servant name");
      return;
    }

    setSubmitting(true);
    const newServantRef = firestore()
      .collection("churches")
      .doc(userData.church)
      .collection("Servants Meeting")
      .doc();

    try {
      await newServantRef.set({
        name: newServantName,
        uid: newServantRef.id,
        role: "General", // Default role; adjust based on your data model
        phone: "",
        address: "",
        description: "",
      });
      setModalVisible(false);
      setNewServantName("");
    } catch (error) {
      console.error("Error adding servant:", error);
      Alert.alert("Error", "Failed to add servant");
    } finally {
      setSubmitting(false);
    }
  };

  const scrollToRole = (role) => {
    if (roleRefs.current[role]) {
      roleRefs.current[role].measureLayout(
        scrollViewRef.current.getScrollableNode(),
        (x, y) => {
          scrollViewRef.current.scrollTo({ y, animated: true });
        },
        () => {
          console.error("Failed to measure layout for role:", role);
        }
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#147efb" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const dateKey = getNextSunday();

  const renderRole = ({ item }) => (
    <TouchableOpacity
      style={styles.roleTag}
      onPress={() => scrollToRole(item)}
      activeOpacity={0.7}
    >
      <Text style={styles.roleTagText}>{item}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>Attendance for the week of {dateKey}</Text>

      {roles.length > 0 && (
        <View style={styles.rolesContainer}>
          <FlatList
            data={roles}
            renderItem={renderRole}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rolesList}
          />
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.studentsContainer}
        showsVerticalScrollIndicator={false}
      >
        {servants.length === 0 ? (
          <Text style={styles.noStudentsText}>Church has no servants</Text>
        ) : (
          roles.map((role) => (
            <View
              key={role}
              ref={(ref) => (roleRefs.current[role] = ref)}
              style={{ paddingTop: 10 }}
            >
              <Text style={styles.roleHeader}>{role}</Text>
              {servants
                .filter((servant) => (servant.role || "General") === role)
                .map((servant) => (
                  <View key={servant.uid} style={styles.studentContainer}>
                    <View style={styles.studentHeader}>
                      <Text style={styles.studentName}>{servant.name}</Text>
                      <TouchableOpacity
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        onPress={() =>
                          navigation.navigate("IndividualServant", {
                            church: userData.church,
                            servantID: servant.uid,
                          })
                        }
                      >
                        <Image
                          source={require("../../assets/vector.png")}
                          style={styles.icon}
                        />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.attendanceButtons}>
                      <TouchableOpacity
                        style={[
                          styles.attendanceButton,
                          servant.attendance === false && styles.absentSelected,
                        ]}
                        onPress={() => handleAttendance(servant.uid, false)}
                      >
                        <Text style={styles.attendanceButtonText}>Absent</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.attendanceButton,
                          servant.attendance === true && styles.presentSelected,
                        ]}
                        onPress={() => handleAttendance(servant.uid, true)}
                      >
                        <Text style={styles.attendanceButtonText}>Present</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.addButtonText}>Add Servant</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            {submitting ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#147efb" />
                <Text style={styles.loadingText}>Adding Servant...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>Add New Servant</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    autoCapitalize="words"
                    placeholder="Enter servant name"
                    placeholderTextColor="#888"
                    value={newServantName}
                    onChangeText={setNewServantName}
                    accessible={true}
                    accessibilityLabel="Enter servant name"
                  />
                </View>
                <TouchableOpacity
                  style={[styles.modalButton, submitting && { opacity: 0.5 }]}
                  onPress={addServant}
                  activeOpacity={0.7}
                  disabled={submitting}
                  accessible={true}
                  accessibilityLabel="Add servant"
                >
                  <Text style={styles.modalButtonText}>Add Servant</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  accessible={true}
                  accessibilityLabel="Cancel adding servant"
                  disabled={submitting}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#121212" },
  headerText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 20,
  },
  rolesContainer: {
    height: 48,
    marginBottom: 20,
    justifyContent: "center",
  },
  rolesList: {
    alignItems: "center",
  },
  roleTag: {
    backgroundColor: "#2a2a2a",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 10,
  },
  roleTagText: {
    fontSize: 16,
    color: "#ccc",
    fontWeight: "600",
  },
  roleHeader: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#ccc",
    marginTop: 20,
    marginBottom: 10,
  },
  studentContainer: {
    backgroundColor: "#1e1e1e",
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  studentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  studentName: { fontSize: 20, color: "#ffffff", fontWeight: "600" },
  icon: { width: 8, height: 15 },
  attendanceButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  attendanceButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
    marginHorizontal: 5,
    backgroundColor: "#444",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  presentSelected: { backgroundColor: "#147efb" },
  absentSelected: { backgroundColor: "#D32F2F" },
  attendanceButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ffffff",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
    width: "100%",
    height: "100%",
  },
  loadingText: {
    fontSize: 18,
    color: "#fff",
    marginTop: 10,
  },
  noStudentsText: {
    fontSize: 18,
    color: "#b0b0b0",
    textAlign: "center",
    marginTop: 20,
  },
  addButton: {
    backgroundColor: "#147efb",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: 20,
    width: "100%",
    alignSelf: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ffffff",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  modalContent: {
    width: 340,
    padding: 25,
    backgroundColor: "#1e1e1e",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#333",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 15,
  },
  modalTitle: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  inputContainer: {
    width: "100%",
    marginBottom: 20,
  },
  input: {
    width: "100%",
    padding: 12,
    backgroundColor: "#2a2a2a",
    color: "#fff",
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#444",
    fontSize: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  modalButton: {
    width: "100%",
    backgroundColor: "#147efb",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  modalButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.5,
  },
  cancelButtonText: {
    fontSize: 16,
    color: "#f44336",
    marginTop: 15,
    fontWeight: "600",
  },
});

export default ServantsAttendance;