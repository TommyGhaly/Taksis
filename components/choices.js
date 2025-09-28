import React, { useState, useEffect } from "react";
import { Text, StyleSheet, View, TouchableOpacity } from "react-native";
import { CheckBox } from "@rneui/themed";
import * as Haptics from "react-native-haptic-feedback";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

const Choices = ({ onDeaconChange, onAlhanChange, onSSTeachChange }) => {
  const [deacon, setDeacon] = useState(false);
  const [alhan, setAlhan] = useState(false);
  const [ssTeach, setSSTeach] = useState(false);
  const [none, setNone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRoles = async () => {
      try {
        const user = auth().currentUser;
        if (!user) {
          setLoading(false);
          return;
        }

        const userDoc = await firestore()
          .collection("users")
          .doc(user.uid)
          .get();
          
        if (userDoc.exists) {
          const data = userDoc.data();
          
          // Get values from database, default to false if not present
          const isDeacon = data.isDeacon || false;
          const isAlhan = data.isAlhan || false;
          const isSSTeacher = data.isSSTeacher || false;
          
          // Set states based on database values
          setDeacon(isDeacon);
          setAlhan(isAlhan);
          setSSTeach(isSSTeacher);
          
          // If all three are false (either not initialized or explicitly false), set none to true
          if (!isDeacon && !isAlhan && !isSSTeacher) {
            setNone(true);
          }
          
          // Notify parent of initial values
          onDeaconChange(isDeacon);
          onAlhanChange(isAlhan);
          onSSTeachChange(isSSTeacher);
        } else {
          // No document exists, everything is false, none is true
          setNone(true);
        }
      } catch (error) {
        console.error("Error fetching user roles:", error);
        // On error, default to none selected
        setNone(true);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRoles();
  }, []);

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

  if (loading) {
    // You can return a loading indicator here if desired
    return <View style={styles.container} />;
  }

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
    backgroundColor: "#121212",
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
    paddingVertical: 12,
  },
  checkbox: {
    backgroundColor: "transparent",
    padding: 0,
    marginRight: 12,
  },
  optionText: {
    fontSize: 20,
    fontFamily: "Roboto-Regular",
    fontWeight: "400",
    color: "#B0BEC5",
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