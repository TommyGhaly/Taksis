import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import SettingsContent from "../../components/settingsContent";

const Settings = () => {
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollViewContent}
        showsVerticalScrollIndicator={false}
      >
        <SettingsContent />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1e1e1e",  // Black background
  },
  scrollViewContent: {
  },
});

export default Settings;
