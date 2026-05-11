import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Calendar from './pages/Calendar';
import Notes from './pages/Notes';
import Sleep from './pages/Sleep';

axios.defaults.baseURL = 'http://localhost:5000/api';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const autoLogin = async () => {
      try {
        const credentials = { email: 'dev@bickle.com', password: 'password', username: 'devuser' };
        let token = null;

        try {
          // Try to login first
          const res = await axios.post('/auth/login', { email: credentials.email, password: credentials.password });
          token = res.data.token;
        } catch (err) {
          // If login fails, register the user
          const res = await axios.post('/auth/register', credentials);
          token = res.data.token;
        }

        if (token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error('Auto-login failed:', err);
        setError('Failed to connect to the backend. Please ensure the backend server is running.');
      }
    };

    autoLogin();
  }, []);

  if (error) {
    return <div className="flex h-screen items-center justify-center bg-background text-destructive p-4 text-center">{error}</div>;
  }

  if (!isAuthenticated) {
    return <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">Authenticating...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="notes" element={<Notes />} />
          <Route path="sleep" element={<Sleep />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
