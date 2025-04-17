export const callFunction = async (user, url) => {
  try {
    const idToken = await user.getIdToken();

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ uid: user.uid }),
    });

    const text = await res.text(); // Get server response
    console.log("Function response:", text);
  } catch (error) {
    console.error("Error calling function in the background:", error);
  }
};


export const callDeleteUser = async (user, church, uid, url) => {
  try {
    // Await the Firebase ID token
    const idToken = await user.getIdToken();

    // Fire the request without awaiting the response (runs in the background)
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`, // Use the actual token here
      },
      body: JSON.stringify({ uid: uid, church: church }), // Send the correct uid parameter
    }).catch((error) => {
      console.error("Error calling function in the background:", error);
    });

    console.log("Function call fired, backend will process the request.");
    return;
  } catch (error) {
    console.error("Error preparing function call:", error);
    return null; // Return null in case of failure
  }
};
export const frequencyUpdate = async (user, url) => {
  try {
    // Ensure the user is logged in and get the Firebase ID token
    const idToken = await user.getIdToken(); // Use the user object to get the token

    // Fire the request without awaiting the response (runs in the background)
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`, // Send the token in the Authorization header
      },
      body: JSON.stringify({}), // Send an empty body if no parameters are needed
    }).catch((error) => {
      console.error("Error calling function in the background:", error);
    });

    console.log("Function call fired, backend will process the request.");
  } catch (error) {
    console.error("Error preparing function call:", error);
  }
};

export const removeServer = async (user, church, week, server, url) => {
  try {
    // Await the Firebase ID token
    const idToken = await user.getIdToken();

    // Fire the request without awaiting the response (runs in the background)
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`, // Use the actual token here
      },
      body: JSON.stringify({ church: church, week: week, server: server }), // Send the correct uid parameter
    }).catch((error) => {
      console.error("Error calling function in the background:", error);
    });

    console.log("Function call fired, backend will process the request.");
  } catch (error) {
    console.error("Error preparing function call:", error);
  }
};

export const addServer = async (user, church, week, url) => {
  try {
    // Await the Firebase ID token
    const idToken = await user.getIdToken();

    // Fire the request without awaiting the response (runs in the background)
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`, // Use the actual token here
      },
      body: JSON.stringify({ church: church, week: week }), // Send the correct uid parameter
    }).catch((error) => {
      console.error("Error calling function in the background:", error);
    });

    console.log("Function call fired, backend will process the request.");
  } catch (error) {
    console.error("Error preparing function call:", error);
  }
};

export const switchServers = async (
  user,
  church,
  week,
  firstServer,
  secondServer,
  url
) => {
  try {
    // Await the Firebase ID token
    const idToken = await user.getIdToken();

    // Fire the request without awaiting the response (runs in the background)
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`, // Use the actual token here
      },
      body: JSON.stringify({
        church: church,
        week: week,
        firstServer: firstServer,
        secondServer: secondServer,
      }), // Send the correct uid parameter
    }).catch((error) => {
      console.error("Error calling function in the background:", error);
    });

    console.log("Function call fired, backend will process the request.");
  } catch (error) {
    console.error("Error preparing function call:", error);
  }
};
export const unavailableToServe = async (user, church, week, family, url) => {
  try {
    // Await the Firebase ID token
    const idToken = await user.getIdToken();

    // Fire the request without awaiting the response (runs in the background)
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`, // Use the actual token here
      },
      body: JSON.stringify({
        church: church,
        week: week,
        uid: user.uid,
        family: family,
      }), // Send the correct uid parameter
    }).catch((error) => {
      console.error("Error calling function in the background:", error);
    });

    console.log("Function call fired, backend will process the request.");
  } catch (error) {
    console.error("Error preparing function call:", error);
  }
};

export const checkClasses = async (user, url) => {
  try {
    // Await the Firebase ID token
    const idToken = await user.getIdToken();

    // Fire the request without awaiting the response (runs in the background)
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`, // Use the actual token here
      },
      body: JSON.stringify({}), // Send the correct uid parameter
    }).catch((error) => {
      console.error("Error calling function in the background:", error);
    });

    console.log("Function call fired, backend will process the request.");
  } catch (error) {
    console.error("Error preparing function call:", error);
  }
};

export const removeFamilySchedule = async (user, church, url) => {
  try {
    console.log("Before getIdToken");
    const idToken = await user.getIdToken(); // Make sure user is still the full user object here.
    console.log("ID Token acquired", idToken);

    const payload = {
      uid: user.uid,
      church: church,
    };

    console.log("About to send payload:", payload);
    console.log("Stringified Payload:", JSON.stringify(payload));

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    }).catch((error) => {
      console.error("Error calling function in the background:", error);
    });

    console.log("Function call fired, backend will process the request.");
  } catch (error) {
    console.error("Error preparing function call:", error);
  }
};
