import * as React from "react";
import { Text, StyleSheet, Pressable, View } from "react-native";
import BackArrow from "../components/backArrow";
import { useNavigation } from "@react-navigation/native";

const ChurchRegistrationV = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <View style={styles.backarrow}>
        <BackArrow />
      </View>
      <Text style={styles.title}>Register your church</Text>
      <Text style={styles.description}>
        If you would like to register your church, please send an email to 
        stphilopaterstmina@gmail.com. Please verify the name of the church, 
        the location, who the head admin should be, and any other needed 
        information.
      </Text>
      <Pressable style={styles.continueButton} onPress={() => navigation.goBack()}>
        <Text style={styles.buttonText}>Go Back</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 16,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backarrow: {
    position: "absolute",
    top: 40,
    left: 16,
  },
  title: {
    fontSize: 34,
    color: "#8e8e93",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "Roboto-Medium",
    fontWeight: "500",
  },
  description: {
    fontSize: 16,
    color: "#8e8e93",
    textAlign: "center",
    marginHorizontal: 20,
    lineHeight: 24,
    marginBottom: 40,
  },
  continueButton: {
    backgroundColor: "#333",
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3, // Adds a shadow effect for better visual
  },
  buttonText: {
    fontSize: 17,
    color: "#fff",
    fontFamily: "Roboto-Medium",
    fontWeight: "500",
  },
});

export default ChurchRegistrationV;
