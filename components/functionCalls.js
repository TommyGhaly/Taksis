export const callFunction = async (user, url) => {
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
        body: JSON.stringify({ uid: user.uid }), // Send the correct uid parameter
      }).catch((error) => {
        console.error("Error calling function in the background:", error);
      });
  
      console.log("Function call fired, backend will process the request.");
    } catch (error) {
      console.error("Error preparing function call:", error);
    }
  };
  
  export const callFunctionNavigate = async (user, url, screen) => {
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
        body: JSON.stringify({ uid: user.uid }), // Send the correct uid parameter
      }).catch((error) => {
        console.error("Error calling function in the background:", error);
      });
  
      console.log("Function call fired, backend will process the request.");
      return screen; // If screen navigation depends on this function call, ensure it's awaited where used.
    } catch (error) {
      console.error("Error preparing function call:", error);
      return null; // Return null in case of failure
    }
  };
  