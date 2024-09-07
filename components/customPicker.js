import * as React from "react";
import {
  Modal,
  View,
  Button,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
} from "react-native";

const CustomPicker = ({ visible, onClose, onSelect, data }) => {
  return (
    <Modal
      transparent={true}
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <FlatList
            data={data}
            keyExtractor={(item) => item.toString()}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                style={styles.item}
              >
                <Text style={styles.itemText}>{item}</Text>
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: 300,
    backgroundColor: "#333",
    borderRadius: 10,
    padding: 20,
  },
  item: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#555",
  },
  itemText: {
    color: "#fff",
    fontSize: 18,
  },
});

export default CustomPicker;
