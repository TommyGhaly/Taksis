import { useState } from "react";
import * as React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Image,
} from "react-native";

const DATA = [
  {
    id: 1,
    title: "St. Philopater and St. Mina, Wayland, MA",
    imageName: require("../assets/StPhiloStMinaLogo.png"),
  },
  {
    id: 2,
    title: "St. Mary and Archangel Michael, Nashua, NH",
    imageName: require("../assets/StMaryArchAMichLogo.png"),
  },
  {
    id: 3,
    title: "St. Mark, Natick, MA",
    imageName: require("../assets/StMarkLogo.png"),
  },
];
const Item = ({ item, onPress, backgroundColor, textColor }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.item, { backgroundColor }]}
  >
    <Image style={styles.image} resizeMode="cover" source={item.imageName} />
    <Text style={[styles.title, { color: textColor }]}>{item.title}</Text>
  </TouchableOpacity>
);

const Churches = ({ onSelectChurch }) => {
  const [selectedId, setSelectedId] = useState();

  const renderItem = ({ item }) => {
    const backgroundColor = item.id === selectedId ? "#147EFB" : "#838393";
    const color = item.id === selectedId ? "white" : "black";

    return (
      <Item
        item={item}
        onPress={() => {
          setSelectedId(item.id);
          onSelectChurch(item.title); // Pass the selected church title to the parent
        }}
        backgroundColor={backgroundColor}
        textColor={color}
      />
    );
  };
  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={DATA}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        extraData={selectedId}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};
const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Roboto-Bold",
    letterSpacing: -0.2,
    textAlign: "center",
  },
  item: {
    padding: 20,
    marginVertical: 16,
    borderRadius: 10,
  },
  image: {
    left: "38%",
    backgroundColor: "#fff",
    borderRadius: 10,
  },
});

export default Churches;
