import { useState } from "react";
import * as React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  SafeAreaView, 
  FlatList
} from "react-native";

const DATA = [
  { id: 1, title: "Chanter (Epsaltos)" },
  { id: 2, title: "Reader (Ognostis)" },
  { id: 3, title: "Subdeacon (Epideacon)" },
  { id: 4, title: "Deacon (Full Deacon)" },
];
const Item = ({ item, onPress, backgroundColor, textColor }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.item, { backgroundColor }]}
  >
    <Text style={[styles.title, { color: textColor }]}>{item.title}</Text>
  </TouchableOpacity>
);

const Rank = ({ onSelectRank , scroll}) => {
  const [selectedId, setSelectedId] = useState();

  const renderItem = ({ item }) => {
    const backgroundColor = item.id === selectedId ? "#147EFB" : "#838393";
    const color = item.id === selectedId ? "white" : "black";

    return (
      <Item
        item={item}
        onPress={() => {
          setSelectedId(item.id)
          onSelectRank(item.title)
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
        keyExtractor={(item) => item.id}
        extraData={selectedId}
        scrollEnabled={false}
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
    textAlign: "center"
 },
 item: {
  padding: 20,
  marginVertical: 16,
  borderRadius: 10
 },

});

export default Rank;
