import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const CustomHeader = ({ navigation }) => {
  if (!navigation) return null; // Prevent errors when navigation is undefined

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 10 }}>
      <TouchableOpacity onPress={() => navigation.toggleDrawer()}>
        <MaterialIcons name="menu" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

export default CustomHeader;