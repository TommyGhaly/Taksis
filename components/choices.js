import React, { useState } from "react";
import { Text, StyleSheet, View, TouchableOpacity } from "react-native";
import { CheckBox } from "@rneui/themed";
import * as Haptics from "react-native-haptic-feedback";

const Choices = ({ onDeaconChange, onAlhanChange, onSSTeachChange }) => {
  const [deacon, setDeacon] = useState(false);
  const [alhan, setAlhan] = useState(false);
  const [ssTeach, setSSTeach] = useState(false);
  const [none, setNone] = useState(false);

  const handleDeacon = (checked) => {
    setDeacon(checked);
    if (checked && none) setNone(false);
    onDeaconChange(checked);
  };
  const handleAlhan = (checked) => {
    setAlhan(checked);
    if (checked && none) setNone(false);
    onAlhanChange(checked);
  };
  const handleSSTeach = (checked) => {
    setSSTeach(checked);
    if (checked && none) setNone(false);
    onSSTeachChange(checked);
  };
  const handleNone = (checked) => {
    setNone(checked);
    if (checked) {
      setDeacon(false);
      setAlhan(false);
      setSSTeach(false);
      onDeaconChange(false);
      onAlhanChange(false);
      onSSTeachChange(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.option}
        onPress={() => {
          Haptics.trigger("impactLight");
          handleDeacon(!deacon);
        }}
        activeOpacity={0.7}
      >
        <CheckBox
          checked={deacon}
          onPress={() => {
            Haptics.trigger("impactLight");
            handleDeacon(!deacon);
          }}
          containerStyle={styles.checkbox}
          iconType="material-community"
          checkedIcon="checkbox-outline"
          uncheckedIcon="checkbox-blank-outline"
          size={35}
          checkedColor="#147EFB"
          uncheckedColor="#B0BEC5"
        />
        <Text style={styles.optionText}>Deacon</Text>
      </TouchableOpacity>
      <View style={styles.divider} />

      <TouchableOpacity
        style={styles.option}
        onPress={() => {
          Haptics.trigger("impactLight");
          handleAlhan(!alhan);
        }}
        activeOpacity={0.7}
      >
        <CheckBox
          checked={alhan}
          onPress={() => {
            Haptics.trigger("impactLight");
            handleAlhan(!alhan);
          }}
          containerStyle={styles.checkbox}
          iconType="material-community"
          checkedIcon="checkbox-outline"
          uncheckedIcon="checkbox-blank-outline"
          size={35}
          checkedColor="#147EFB"
          uncheckedColor="#B0BEC5"
        />
        <Text style={styles.optionText}>Alhan Teacher</Text>
      </TouchableOpacity>
      <View style={styles.divider} />

      <TouchableOpacity
        style={styles.option}
        onPress={() => {
          Haptics.trigger("impactLight");
          handleSSTeach(!ssTeach);
        }}
        activeOpacity={0.7}
      >
        <CheckBox
          checked={ssTeach}
          onPress={() => {
            Haptics.trigger("impactLight");
            handleSSTeach(!ssTeach);
          }}
          containerStyle={styles.checkbox}
          iconType="material-community"
          checkedIcon="checkbox-outline"
          uncheckedIcon="checkbox-blank-outline"
          size={35}
          checkedColor="#147EFB"
          uncheckedColor="#B0BEC5"
        />
        <Text style={styles.optionText}>Sunday School Teacher</Text>
      </TouchableOpacity>
      <View style={styles.divider} />

      <TouchableOpacity
        style={styles.option}
        onPress={() => {
          Haptics.trigger("impactLight");
          handleNone(!none);
        }}
        activeOpacity={0.7}
      >
        <CheckBox
          checked={none}
          onPress={() => {
            Haptics.trigger("impactLight");
            handleNone(!none);
          }}
          containerStyle={styles.checkbox}
          iconType="material-community"
          checkedIcon="checkbox-outline"
          uncheckedIcon="checkbox-blank-outline"
          size={35}
          checkedColor="#147EFB"
          uncheckedColor="#B0BEC5"
        />
        <Text style={styles.optionText}>None Applicable</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#121212", // Match screen background
    borderRadius: 12,
    padding: 25,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12, // Corrected from HygieaService12
  },
  checkbox: {
    backgroundColor: "transparent",
    padding: 0,
    marginRight: 12,
  },
  optionText: {
    fontSize: 20,
    fontFamily: "Roboto-Regular",
    fontWeight: "400", // Lighter weight to look less clickable
    color: "#B0BEC5", // Muted color to indicate non-interactivity
    flexShrink: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#B0BEC5",
    opacity: 0.3,
    marginHorizontal: 16,
  },
});

export default Choices;