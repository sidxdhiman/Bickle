import axios from 'axios';

const BACKEND_CREDENTIALS = {
  email: 'dev@bickle.com',
  password: 'password',
  username: 'devuser',
};

const persistToken = (token) => {
  localStorage.setItem('backendToken', token);
  localStorage.setItem('token', token);
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  return token;
};

export const ensureBackendToken = async () => {
  const stored = localStorage.getItem('backendToken') || localStorage.getItem('token');

  if (stored) {
    try {
      axios.defaults.headers.common['Authorization'] = `Bearer ${stored}`;
      await axios.get('/auth/me');
      localStorage.setItem('backendToken', stored);
      localStorage.setItem('token', stored);
      return stored;
    } catch (error) {
      // Stored token is missing/invalid; fall through and request a fresh one.
    }
  }

  try {
    const res = await axios.post('/auth/login', {
      email: BACKEND_CREDENTIALS.email,
      password: BACKEND_CREDENTIALS.password,
    });
    return persistToken(res.data.token);
  } catch (loginError) {
    try {
      const res = await axios.post('/auth/register', BACKEND_CREDENTIALS);
      return persistToken(res.data.token);
    } catch (registerError) {
      console.warn('Backend token unavailable; continuing with local unlock.', registerError);
      return null;
    }
  }
};
