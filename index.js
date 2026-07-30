// Must be the very first import in the entry file (react-native-gesture-handler
// requirement). It was previously only imported inside three navigator modules,
// which meant initialization order depended on which screen mounted first.
import 'react-native-gesture-handler';

// Stop inactive screens from re-rendering in the background. Without this,
// every screen still mounted behind the current one keeps reconciling on each
// state change, competing with navigation animations for the JS thread.
import { enableFreeze, enableScreens } from 'react-native-screens';
enableScreens(true);
enableFreeze(true);

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
