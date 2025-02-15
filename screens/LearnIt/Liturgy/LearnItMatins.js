import * as React from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import BackArrow from "../../../components/backArrow";
import InAppBrowser from "react-native-inappbrowser-reborn";

const openUrl = async (url) => {
  try {
    const isAvailable = await InAppBrowser.isAvailable();
    if (isAvailable) {
      await InAppBrowser.open(url, {
        dismissButtonStyle: "close",
        preferredBarTintColor: "#000",
        preferredControlTintColor: "white",
        readerMode: false,
        animated: true,
        modalPresentationStyle: "fullScreen",
        modalTransitionStyle: "coverVertical",
        modalEnabled: true,
        enableBarCollapsing: false,
        showTitle: false,
        enableUrlBarHiding: true,
        enableDefaultShare: true,
        forceCloseOnRedirection: false,
        headers: { "my-custom-header": "my-custom-header-value" },
      });
    } else {
      console.error("InAppBrowser is not available");
    }
  } catch (error) {
    console.error(error);
  }
};

const LearnItMatins = () => {
  return (
    <View style={styles.container}>
      <BackArrow style={styles.backbutton} />
      <Text style={styles.title}>Learn Matins Hymn</Text>
      <View style={styles.buttonContainer}>
        <Pressable style={styles.button} onPress={() => openUrl("https://tasbeha.org/hymn_library/cat/220")}>
          <Text style={styles.buttonText}>Deacon Responses</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => openUrl("https://tasbeha.org/hymn_library/cat/60")}>
          <Text style={styles.buttonText}>Verses of the Symbols</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => openUrl("https://tasbeha.org/hymn_library/cat/40")}>
          <Text style={styles.buttonText}>Doxology</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => openUrl("https://tasbeha.org/hymn_library/cat/193")}>
          <Text style={styles.buttonText}>Full Service</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    padding: 20,
    justifyContent: "space-around",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 40,
    marginTop: 60,
  },
  buttonContainer: {
    alignItems: "center",
    justifyContent: "space-between",
    flexGrow: 1,
    paddingVertical: 20,
  },
  button: {
    backgroundColor: "#2c2c2c",
    paddingVertical: 25,
    width: "90%",
    borderRadius: 12,
    marginBottom: 20,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 22,
    color: "#ffffff",
    fontWeight: "bold",
  },
  backbutton: {
    position: "absolute",
    top: 20,
    left: 20,
  },
});

export default LearnItMatins;
