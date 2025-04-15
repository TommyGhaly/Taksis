import { createStackNavigator } from '@react-navigation/stack';
import SundaySchoolAttendance from './SundaySchoolAttendance';
import IndividualAttendance from '../IndividualAttendance';

const Stack = createStackNavigator();

const SundaySchoolNavigator = () => {
  return (
    <Stack.Navigator initialRouteName="SundaySchoolAttendance">
      <Stack.Screen 
        name="SundaySchoolAttendance" 
        component={SundaySchoolAttendance} 
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

export default SundaySchoolNavigator;