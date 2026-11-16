import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  FlatList,
  Image,
} from "react-native";
import * as Haptics from "react-native-haptic-feedback";
import { makeStyles } from "../theme";

const DATA = [
  {
    id: 1,
    title: "St. Philopater and St. Mina, Wayland, MA",
    imageName: require("../assets/stPhiloStMinaLogo.png"),
  },
  {
    id: 2,
    title: "St. Mary and Archangel Michael, Nashua, NH",
    imageName: require("../assets/stMaryArchAMichLogo.png"),
  },
  {
    id: 3,
    title: "St. Shenouda and St. Karas, Uxbridge, MA",
    imageName: require("../assets/stShenoudaStKarasLogo.png"),
  },
];

const ChurchItem = ({ item, onPress, isSelected }) => {
  const styles = useStyles();
  return (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.item, isSelected && styles.selectedItem]}
    activeOpacity={0.7} // Subtle press feedback
  >
    <Image style={styles.image} resizeMode="cover" source={item.imageName} />
    <Text style={[styles.title, isSelected && styles.selectedText]}>
      {item.title}
    </Text>
  </TouchableOpacity>
  );
};

const Churches = ({ onSelectChurch }) => {
  const styles = useStyles();
  const [selectedId, setSelectedId] = useState(null);

  const renderItem = ({ item }) => {
    const isSelected = item.id === selectedId;

    return (
      <ChurchItem
        item={item}
        onPress={() => {
          Haptics.trigger("impactLight"); // Trigger haptic feedback
          setSelectedId(item.id);
          onSelectChurch(item.title);
        }}
        isSelected={isSelected}
      />
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={DATA}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        extraData={selectedId}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const useStyles = makeStyles((t) => ({
  container: {
    flex: 1,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginVertical: 8,
    backgroundColor: t.surfaceElevated,
    borderRadius: 12,
    elevation: 3,
    shadowColor: t.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  selectedItem: {
    backgroundColor: t.accent,
    elevation: 5,
    shadowOpacity: 0.25,
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: "#FFF", // White mat behind the church logos in both modes.
  },
  title: {
    fontSize: 18,
    fontFamily: "Roboto-Regular",
    fontWeight: "500",
    color: t.isDark ? "#E0E0E0" : t.text,
    flexShrink: 1,
  },
  selectedText: {
    color: t.onAccent,
    fontWeight: "600",
  },
}));

export default Churches;