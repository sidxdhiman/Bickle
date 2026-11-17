import React, { createContext, useContext } from 'react';
import { ALL_PAGE_KEYS } from '../config/pages';

const AccessContext = createContext({
  isGuest: false,
  allowedPages: ALL_PAGE_KEYS,
  pageAccess: {},
  expiresAt: null,
  endGuest: () => {},
  canEdit: () => true,
  // Modules stripped from this session entirely (restricted first-boot
  // signups lose chat + art; guests get their granted list instead).
  hiddenPages: [],
  restricted: false,
});

export const AccessProvider = ({ value, children }) => (
  <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
);

export const useAccess = () => useContext(AccessContext);

// True when the current user may modify data in this module. Owners can
// always edit; guests can only edit modules shared with 'edit' permission
// (anything unlisted — including legacy sessions — counts as edit).
export const canEditPage = (access, pageKey) => {
  if (!access?.isGuest) return true;
  const mode = access.pageAccess?.[pageKey];
  return mode !== 'view';
};

export default AccessContext;
