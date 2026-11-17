import axios from 'axios';

// The signed-in profile (id, username, key, showcase, restricted) — the
// feature gates read `restricted` from here before /auth/me answers again.
const USER_KEY = 'bickleUser';

const clearTokens = () => {
  localStorage.removeItem('backendToken');
  localStorage.removeItem('token');
  localStorage.removeItem('authUnlocked');
  localStorage.removeItem(USER_KEY);
  delete axios.defaults.headers.common['Authorization'];
};

export const storeUser = (user) => {
  if (!user || user.isGuest) return null;
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    // Storage unavailable (private mode) — gating then falls back to full.
  }
  return user;
};

export const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

export const clearStoredUser = () => localStorage.removeItem(USER_KEY);

// Validates the stored session token against the backend. There is no
// silent fallback account anymore — every session belongs to a real profile
// chosen on the login screen. Returns the token, or null when it is gone.
export const validateStoredToken = async () => {
  const stored = localStorage.getItem('backendToken') || localStorage.getItem('token');

  if (!stored) {
    clearTokens();
    return null;
  }

  try {
    axios.defaults.headers.common['Authorization'] = `Bearer ${stored}`;
    const res = await axios.get('/auth/me');
    storeUser(res.data);
    localStorage.setItem('backendToken', stored);
    localStorage.setItem('token', stored);
    return stored;
  } catch (error) {
    // Token missing/expired/foreign — send the user back to the profile picker.
    clearTokens();
    return null;
  }
};

export const storeSessionToken = (token) => {
  localStorage.setItem('backendToken', token);
  localStorage.setItem('token', token);
  localStorage.setItem('authUnlocked', 'true');
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  return token;
};
