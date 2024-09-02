import React, { createContext, useState, useContext } from 'react';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [signUp, setSignUp] = useState(false);

  return (
    <UserContext.Provider value={{ user, setUser, signUp, setSignUp }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}