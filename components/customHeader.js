import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme, HeaderGlassButton } from '../theme';

const CustomHeader = ({ navigation }) => {
  const theme = useTheme();
  if (!navigation) return null; // Prevent errors when navigation is undefined

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 10 }}>
      <TouchableOpacity onPress={() => navigation.toggleDrawer()}>
        <HeaderGlassButton>
          <MaterialIcons name="menu" size={24} color={theme.text} />
        </HeaderGlassButton>
      </TouchableOpacity>
    </View>
  );
};

export default CustomHeader;