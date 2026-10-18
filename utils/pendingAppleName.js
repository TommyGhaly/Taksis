/**
 * Apple sends the user's name only on the first authorization, and Firebase
 * does not copy it onto the user. The screens park it here just before
 * signInWithCredential so the auth listener in App.js, which creates the users
 * doc, can save it. Set before the call, so the listener always finds it.
 */
let pendingAppleName = "";

export const setPendingAppleName = (fullName) => {
  pendingAppleName = [fullName?.givenName, fullName?.familyName]
    .filter(Boolean)
    .join(" ");
};

export const takePendingAppleName = () => {
  const name = pendingAppleName;
  pendingAppleName = "";
  return name;
};
