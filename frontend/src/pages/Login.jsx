import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const PERSONAL_ACCESS = {
  id: 'a1e6tp8k',
  password: '0]Hyisgh',
};

const BACKEND_CREDENTIALS = {
  email: 'dev@bickle.com',
  password: 'password',
  username: 'devuser',
};

const Login = ({ onAuthSuccess }) => {
  const [accessId, setAccessId] = useState('');
  const [accessPassword, setAccessPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (accessId.trim() !== PERSONAL_ACCESS.id || accessPassword.trim() !== PERSONAL_ACCESS.password) {
      setError('Access denied. Please use your personal login code.');
      return;
    }

    setLoading(true);

    try {
      const localToken = 'local-access-token';
      localStorage.setItem('token', localToken);
      localStorage.setItem('authUnlocked', 'true');
      axios.defaults.headers.common['Authorization'] = `Bearer ${localToken}`;
      onAuthSuccess();
      navigate('/');

      // Try to fetch a real backend token in the background, but don't block login.
      if (!localStorage.getItem('backendToken')) {
        try {
          const res = await axios.post('/auth/login', {
            email: BACKEND_CREDENTIALS.email,
            password: BACKEND_CREDENTIALS.password,
          });
          localStorage.setItem('backendToken', res.data.token);
          localStorage.setItem('token', res.data.token);
          axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
        } catch (err) {
          try {
            const res = await axios.post('/auth/register', BACKEND_CREDENTIALS);
            localStorage.setItem('backendToken', res.data.token);
            localStorage.setItem('token', res.data.token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
          } catch (registerErr) {
            console.warn('Backend token unavailable; continuing with local unlock.', registerErr);
          }
        }
      }
    } catch (err) {
      console.error('Login failed:', err);
      setError('Unable to unlock the app. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-xl shadow-black/5">
        <h1 className="mb-4 text-3xl font-semibold">Secure Access</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          This page is only for the authorized user. Enter your personal access code to continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-foreground">
            Access ID
            <input
              value={accessId}
              onChange={(event) => setAccessId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm outline-none transition focus:border-primary"
              placeholder="Enter your ID"
              autoComplete="off"
            />
          </label>

          <label className="block text-sm font-medium text-foreground">
            Password
            <input
              type="password"
              value={accessPassword}
              onChange={(event) => setAccessPassword(event.target.value)}
              className="mt-2 w-full rounded-xl border border-input bg-transparent px-4 py-3 text-sm outline-none transition focus:border-primary"
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </label>

          {error && <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
