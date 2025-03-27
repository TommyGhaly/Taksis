import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import auth from "@react-native-firebase/auth";
import { getCurrentLocation } from "../screens/Home/HomeScreen"; // adjust the path

const LOCATION_TASK = "background-location-task";

// Define the background task
TaskManager.defineTask(LOCATION_TASK, async () => {
  try {

    if (!firebase.apps.length) {
        initializeApp({
          projectId: "taksis-a8ba7",
          apiKey: "AIzaSyBWxEgHXcJx19Rklr7P6HhhweT9_I70WkA",
          authDomain: "taksis-a8ba7.firebaseapp.com",
        });
      }
    const now = new Date();
    const user = auth().currentUser;
    // Check if today is Sunday (0 = Sunday) and the hour is 9 (you may add minute verification if needed)
    if (now.getDay() === 0 && now.getHours() === 9) {
      console.log("It is Sunday at 9AM – getting current location");
      await getCurrentLocation();
    } else {
      console.log("Background task ran, but condition not met:", now);
    }
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error("Error in background location task:", error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Function to register the background fetch task
export async function registerBackgroundFetchAsync() {
    try {
      await BackgroundFetch.registerTaskAsync(LOCATION_TASK, {
        minimumInterval: 3600,
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log("Background task registered successfully");
      return true;
    } catch (error) {
      console.error("Error registering background task:", error);
      return false;
    }
  }

// Optionally, function to unregister the task if needed
export async function unregisterBackgroundFetchAsync() {
  return BackgroundFetch.unregisterTaskAsync(LOCATION_TASK);
}
