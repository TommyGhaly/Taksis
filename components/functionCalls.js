import { Alert } from "react-native";

export const callFunction = async ({
  user,
  url,
  payload = {},
  errorMessage = "Request failed. Please try again.",
  awaitResponse = false,
}) => {
  try {
    const idToken = await user.getIdToken();

    const request = fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (awaitResponse) {
      const res = await request;
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json().catch(() => null);
    }
  } catch (err) {
    Alert.alert("Error", errorMessage);
    throw err;
  }
};
