import axios from 'axios';

const clearTokens = () => {
  localStorage.removeItem('backendToken');
  localStorage.removeItem('token');
  localStorage.removeItem('authUnlocked');
  delete axios.defaults.headers.common['Authorization'];
};

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
    await axios.get('/auth/me');
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
