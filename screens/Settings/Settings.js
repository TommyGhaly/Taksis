import * as React from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
} from "react-native";
import SettingsContent from "../../components/settingsContent";
import { useNavigation } from "@react-navigation/native";

const Settings = () => {
  const navigation = useNavigation();
  return (
    <View style={styles.settings}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <SettingsContent style={styles.settingscontent} navigation={this.navigation}/>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    top: 20,
    height: "100%",
    paddingBottom: 180
  },
  settings: {
    backgroundColor: "#000",
    flex: 1,
    height: 852,
    width: "100%",
    marginTop: 60
  },
});

export default Settings;
