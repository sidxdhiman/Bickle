import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Calendar from './pages/Calendar';
import Notes from './pages/Notes';
import Sleep from './pages/Sleep';
import Money from './pages/Money';
import Settings from './pages/Settings';
import Focus from './pages/Focus';
import Login from './pages/Login';

axios.defaults.baseURL = 'http://localhost:5000/api';

const storedToken = localStorage.getItem('token');
if (storedToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
}

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unlocked = localStorage.getItem('authUnlocked') === 'true';
    const token = localStorage.getItem('token');

    if (unlocked && token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setIsAuthenticated(true);
    } else {
      localStorage.removeItem('authUnlocked');
    }

    setHasCheckedAuth(true);
  }, []);

  if (error) {
    return <div className="flex h-screen items-center justify-center bg-background text-destructive p-4 text-center">{error}</div>;
  }

  if (!hasCheckedAuth) {
    return <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/*" element={<Login onAuthSuccess={() => setIsAuthenticated(true)} />} />
        </Routes>
      </BrowserRouter>
    );
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
          <Route path="money" element={<Money />} />
          <Route path="focus" element={<Focus />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
