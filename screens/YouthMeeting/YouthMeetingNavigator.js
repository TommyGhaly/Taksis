import { createStackNavigator } from '@react-navigation/stack';
import YouthMeetingAttendance from './YouthMeetingAttendance';
import IndividualAttendance from '../AdminScreens/IndividualAttendance';

const Stack = createStackNavigator();

const YouthMeetingNavigator = () => {
  return (
    <Stack.Navigator initialRouteName="YouthMeetingAttendance">
      <Stack.Screen 
        name="YouthMeetingAttendance" 
        component={YouthMeetingAttendance} 
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

export default YouthMeetingNavigator;
