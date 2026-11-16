import * as React from "react";
import { Text, Pressable, View } from "react-native";
import BackArrow from "../components/backArrow";
import { useNavigation } from "@react-navigation/native";
import { makeStyles } from "../theme";

const ChurchRegistrationV = () => {
  const styles = useStyles();
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register your church</Text>
      <Text style={styles.description}>
        If you would like to register your church, please send an email to 
        spsmdevs@gmail.com. Please verify the name of the church, 
        the location, who the head admin should be, and any other needed 
        information.
      </Text>
      <Pressable style={styles.continueButton} onPress={() => navigation.goBack()}>
        <Text style={styles.buttonText}>Go Back</Text>
      </Pressable>
    </View>
  );
};

const useStyles = makeStyles((t) => ({
  container: {
    flex: 1,
    backgroundColor: t.background,
    paddingHorizontal: 16,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  title: {
    fontSize: 34,
    color: t.textMuted,
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "Roboto-Medium",
    fontWeight: "500",
  },
  description: {
    fontSize: 16,
    color: t.textMuted,
    textAlign: "center",
    marginHorizontal: 20,
    lineHeight: 24,
    marginBottom: 40,
  },
  continueButton: {
    backgroundColor: t.surfaceHighest,
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3, // Adds a shadow effect for better visual
  },
  buttonText: {
    fontSize: 17,
    color: t.text,
    fontFamily: "Roboto-Medium",
    fontWeight: "500",
  },
}));

export default ChurchRegistrationV;
