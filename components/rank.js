import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, FlatList, SafeAreaView } from "react-native";

const DATA = [
  { id: 1, title: "Chanter (Epsaltos)" },
  { id: 2, title: "Reader (Ognostis)" },
  { id: 3, title: "Subdeacon (Epideacon)" },
  { id: 4, title: "Deacon (Full Deacon)" },
];

const Item = ({ item, onPress, backgroundColor, textColor }) => (
  <TouchableOpacity onPress={onPress} style={[styles.item, { backgroundColor }]}>
    <Text style={[styles.title, { color: textColor }]}>{item.title}</Text>
  </TouchableOpacity>
);

const Rank = ({ onSelectRank }) => {
  const [selectedId, setSelectedId] = useState(null);

  const renderItem = ({ item }) => {
    const backgroundColor = item.id === selectedId ? "#147EFB" : "#2A2A2A";
    const color = item.id === selectedId ? "#FFF" : "#E0E0E0";

    return (
      <Item
        item={item}
        onPress={() => {
          setSelectedId(item.id);
          onSelectRank(item.title);
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
  container: {
    flex: 1,
  },
  item: {
    padding: 25, // Matches Churches spacing
    marginVertical: 8, // Matches Churches spacing
    borderRadius: 12, // Matches Churches
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  title: {
    fontSize: 18, // Matches Choices text size
    fontFamily: "Roboto-Regular",
    fontWeight: "500", // Matches Choices
    textAlign: "left", // Consistent with other components
  },
});

export default Rank;