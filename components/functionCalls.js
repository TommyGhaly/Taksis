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
  } catch (error) {
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
    });

    return;
  } catch (error) {
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
    });

  } catch (error) {
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
    });

  } catch (error) {
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
    });

  } catch (error) {
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
    });

  } catch (error) {
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
    });

  } catch (error) {
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
    });

  } catch (error) {
  }
};

export const removeFamilySchedule = async (user, church, url) => {
  try {
    const idToken = await user.getIdToken(); // Make sure user is still the full user object here.

    const payload = {
      uid: user.uid,
      church: church,
    };

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    }).catch((error) => {
    });

  } catch (error) {
  }
};
