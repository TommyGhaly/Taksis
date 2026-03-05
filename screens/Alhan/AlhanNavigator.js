import { createStackNavigator } from '@react-navigation/stack';
import AlhanAttendance from './AlhanAttendance';
import IndividualAttendance from '../AdminScreens/IndividualAttendance';

const Stack = createStackNavigator();

const AlhanNavigator = () => {
  return (
    <Stack.Navigator initialRouteName="AlhanAttendance">
      <Stack.Screen 
        name="AlhanAttendance" 
        component={AlhanAttendance} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="IndividualAttendance" 
        component={IndividualAttendance} 
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default AlhanNavigator;