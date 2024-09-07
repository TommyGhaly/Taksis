import * as React from "react";
import { StyleSheet, Text, Pressable, Image, View } from "react-native";
import BackArrow from "../../components/backArrow"; // Assuming you have a BackArrow component

const RequestAdmin = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>Request Sent</Text>
      <Image
        style={styles.verificationImage}
        resizeMode="contain"
        source={require("../../assets/verificationSticker.png")}
      />
      <Text style={styles.message}>
        A request has been sent to the head admin. Waiting on approval to
        appoint you admin.
      </Text>
      <Pressable
        style={styles.confirmButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.confirmText}>Confirm</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000",
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
    alignItems: "center",
  },
  headerText: {
    fontSize: 28,
    fontWeight: "500",
    color: "#ffffff",
    marginVertical: 30,
  },
  verificationImage: {
    width: "80%",
    height: 150,
    marginBottom: 20,
  },
  message: {
    fontSize: 17,
    color: "#8e8e93",
    textAlign: "center",
    marginBottom: 30,
  },
  confirmButton: {
    backgroundColor: "#333",
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    fontSize: 17,
    color: "#fff",
    fontWeight: "500",
  },
});

export default RequestAdmin;
