import React from "react";
import { ScrollView, View } from "react-native";
import { makeStyles, useTabBarInset } from "../../theme";
import SettingsContent from "../../components/settingsContent";

const Settings = () => {
  const styles = useStyles();
  // Keeps Log out / Delete Account clear of the floating glass tab bar.
  const tabBarInset = useTabBarInset();
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scrollViewContent, { paddingBottom: tabBarInset }]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsContent />
      </ScrollView>
    </View>
  );
};

const useStyles = makeStyles((t) => ({
  container: {
    flex: 1,
    backgroundColor: t.background,
  },
  // Breathing room under the header, matching the drawer screens (Admin Manager).
  scrollViewContent: {
    paddingTop: 12,
  },
}));

export default Settings;
