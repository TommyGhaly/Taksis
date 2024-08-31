import React, { useState } from "react";
import { StyleSheet, View, Text } from "react-native";
import Slider from "@react-native-community/slider";
import { Picker } from "@react-native-picker/picker";

const FrequencyQuestions = ({ onAgeChange, onFrequencyChange }) => {
  const [slider, setSlider] = useState(5);
  const [selectedAge, setSelectedAge] = useState(null);
  const handleAge = (age) => {
    setSelectedAge(age);
    onAgeChange(age);
  };
  const handleFrequency = (frequency) => {
    setSlider(frequency);
    onFrequencyChange(frequency);
  };
  return (
    <View style={styles.experiencequestions}>
      <View style={styles.wrapper}>
        <Picker
          selectedValue={selectedAge}
          onValueChange={(itemValue, itemIndex) => handleAge(itemValue)}
          itemStyle={styles.pickertext}
        >
          {Array.from({ length: 100 }, (_, i) => (
            <Picker.Item key={i} label={`${i + 1}`} value={i + 1} />
          ))}
        </Picker>
      </View>
      <Text style={styles.yearsOld}>years old</Text>
      <Text style={[styles.notExperienced, styles.experiencedTypo]}>
        Not experienced
      </Text>
      <Text style={[styles.veryExperienced, styles.experiencedTypo]}>
        Very experienced
      </Text>
      <Text style={[styles.sliderText, styles.sliderTextPosition]}>
        {slider.toString().slice(0, 3)}
      </Text>
      <Slider
        style={styles.slider}
        value={slider}
        onValueChange={(value) => handleFrequency(value)}
        minimumValue={0}
        maximumValue={10}
        minimumTrackTintColor="#147efb"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  rectangleDropdowndropDownContainer: {
    backgroundColor: "#000",
    borderStyle: "solid",
    borderColor: "#8e8e93",
    borderWidth: 1,
  },
  howLayout: {
    width: "94.46%",
    height: "12.15%",
    position: "absolute",
  },
  experiencedTypo: {
    fontSize: 12,
    top: "87.85%",
    textAlign: "left",
    color: "#8e8e93",
    fontFamily: "Roboto-Regular",
    letterSpacing: -0.1,
    position: "absolute",
  },
  knobLayout: {
    borderRadius: 100,
    position: "absolute",
  },
  dropdownpicker: {
    backgroundColor: "#000",
    borderColor: "#8e8e93",
    borderWidth: 1,
    borderStyle: "solid",
  },
  wrapper: {
    top: -20,
    width: 100,
    left: 90,
    borderRadius: 5,
    borderStyle: "solid",
    position: "absolute",
  },
  yearsOld: {
    height: "6.54%",
    width: "32.69%",
    top: "18.93%",
    left: "49.31%",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    textAlign: "left",
    color: "#8e8e93",
    fontFamily: "Roboto-Regular",
    letterSpacing: -0.1,
    position: "absolute",
  },
  notExperienced: {
    left: "0.83%",
  },
  veryExperienced: {
    left: "75.07%",
  },
  unfilled: {
    right: 0,
    left: 0,
    backgroundColor: "rgba(120, 120, 128, 0.32)",
    bottom: "2.8%",
    top: "96.26%",
    height: "0.93%",
    borderRadius: 100,
  },
  filled: {
    width: "50.83%",
    right: "49.17%",
    left: "0%",
    backgroundColor: "#147efb",
    bottom: "2.8%",
    top: "96.26%",
    height: "0.93%",
    borderRadius: 100,
  },
  slider: {
    top: 350,
  },
  sliderText: {
    textAlign: "center",
    color: "#8e8e93",
    fontSize: 50,
    fontWeight: "700",
    fontFamily: "Roboto-Bold",
    justifyContent: "center",
    alignContent: "center",
  },
  sliderTextPosition: {
    top: "74%",
  },
  pickertext: {
    color: "#8e8e93",
    fontSize: 20,
    lineHeight: 21
  },  
  experiencequestions: {
    width: "100%",
    height: 428,
  },
});

export default FrequencyQuestions;
