import * as React from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import BackArrow from "../../../components/backArrow";
import InAppBrowser from "react-native-inappbrowser-reborn";

const handleOpenInAppBrowser = async () => {
  try {
    const url = "https://tasbeha.org/hymn_library/view/1909";
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
        showTitle: true,
        enableUrlBarHiding: true,
        enableDefaultShare: true,
        forceCloseOnRedirection: false,
        headers: {
          "my-custom-header": "my-custom-header-value",
        },
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
      <BackArrow />
      <Text style={styles.title}>Learn Matins Hymn</Text>
      <Pressable style={styles.button} onPress={handleOpenInAppBrowser}>
        <Text style={styles.buttonText}>Open Hymn</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#1e88e5",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    color: "#ffffff",
    fontWeight: "bold",
  },
});

export default LearnItMatins;
