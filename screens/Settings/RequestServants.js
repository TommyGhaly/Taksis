import * as React from "react";
import { Text, Pressable, Image, View } from "react-native";
import { makeStyles } from "../../theme";

const RequestServants = ({ navigation }) => {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>Send us a message!</Text>
      <Image
        style={styles.verificationImage}
        resizeMode="contain"
        source={require("../../assets/verificationSticker.png")}
      />
      <Text style={styles.message}>
        To be appointed as a servants meeting tracker, please contact us at spsmdevs@gmail.com.
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

const useStyles = makeStyles((t) => ({
  container: {
    backgroundColor: t.background,
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
    alignItems: "center",
  },
  headerText: {
    fontSize: 28,
    fontWeight: "500",
    color: t.text,
    marginVertical: 30,
  },
  verificationImage: {
    width: "80%",
    height: 150,
    marginBottom: 20,
  },
  message: {
    fontSize: 17,
    color: t.textMuted,
    textAlign: "center",
    marginBottom: 30,
  },
  confirmButton: {
    backgroundColor: t.surfaceHighest,
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: {
    fontSize: 17,
    color: t.text,
    fontWeight: "500",
  },
}));

export default RequestServants;
