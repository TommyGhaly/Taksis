import * as React from "react";
import { StyleSheet, Text, Pressable, View } from "react-native";

const ChangeHeadAdmin = ({ navigation }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>Change Head Admin</Text>
      <Text style={styles.message}>
        If you would like to change the head admin, please have a priest from
        your church email stphilostmina@gmail.com
      </Text>
      <Pressable
        style={styles.confirmButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.confirmText}>Return</Text>
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
  backArrow: {
    position: "absolute",
    top: 20,
    left: 10,
  },
  headerText: {
    fontSize: 28,
    fontWeight: "500",
    color: "#ffffff",
    marginVertical: 30,
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

export default ChangeHeadAdmin;
