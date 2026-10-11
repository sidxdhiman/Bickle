import React, { createContext, useContext } from 'react';
import { ALL_PAGE_KEYS } from '../config/pages';

const AccessContext = createContext({
  isGuest: false,
  allowedPages: ALL_PAGE_KEYS,
  expiresAt: null,
  endGuest: () => {},
});

export const AccessProvider = ({ value, children }) => (
  <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
);

export const useAccess = () => useContext(AccessContext);

export default AccessContext;
