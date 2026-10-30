import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { ensureBackendToken } from './utils/backendAuth';
import { clearSearchIndex } from './utils/searchIndex';
import { AccessProvider, useAccess } from './context/AccessContext';
import { ALL_PAGE_KEYS, PAGES, pageKeyForApiUrl } from './config/pages';
import GuestWelcomeModal from './components/GuestWelcomeModal';
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
import Translator from './pages/Translator';
import Habits from './pages/Habits';
import Whiteboard from './pages/Whiteboard';
import PdfEditor from './pages/PdfEditor';
import Art from './pages/Art';
import Workflows from './pages/Workflows';
import SidArt from './pages/SidArt';

axios.defaults.baseURL = 'http://localhost:5000/api';

const storedToken = localStorage.getItem('token');
if (storedToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
}

const GUEST_STORAGE_KEY = 'bickleGuest';

const readStoredGuest = () => {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

const readGuestTokenFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const queryToken = params.get('guest');
  if (queryToken) return queryToken;
  const match = window.location.pathname.match(/^\/guest\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

// Shared workflows ride along in the grant link as JSON payloads (workflows
// live in localStorage, not the DB) — merge them into the guest's store.
const mergeSharedWorkflows = (sharedItems) => {
  const workflows = (sharedItems || []).filter(
    (item) => item.page === 'workflows' && item.payload?.workflow?.id && item.payload?.workflow?.title
  );
  if (workflows.length === 0) return;
  try {
    const raw = localStorage.getItem('bickle-workflows');
    const state = raw
      ? JSON.parse(raw)
      : { folders: [], workflows: [], runs: [], selectedFolderId: null };
    if (!Array.isArray(state.workflows)) state.workflows = [];
    if (!Array.isArray(state.folders)) state.folders = [];
    if (!Array.isArray(state.runs)) state.runs = [];
    let changed = false;
    for (const { payload } of workflows) {
      const wf = payload.workflow;
      if (state.workflows.some((existing) => existing.id === wf.id)) continue;
      const folderExists = state.folders.some((f) => f.id === wf.folderId);
      state.workflows.push({
        ...wf,
        folderId: folderExists ? wf.folderId : (state.folders[0]?.id ?? null),
      });
      changed = true;
    }
    if (!changed) return;
    if (!state.selectedFolderId && state.folders.length) {
      state.selectedFolderId = state.folders[0].id;
    }
    localStorage.setItem('bickle-workflows', JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('bickle-workflows-change'));
  } catch (error) {
    console.error('Could not merge shared workflows:', error);
  }
};

// Reject write requests client-side when the guest's module is view-only.
// The backend enforces the same rule — this just fails fast with a clean error.
axios.interceptors.request.use((config) => {
  const guest = readStoredGuest();
  if (!guest?.token) return config;
  const auth = config.headers?.Authorization || config.headers?.authorization || '';
  if (!auth.includes(guest.token)) return config;
  if (['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) return config;
  const pageKey = pageKeyForApiUrl(config.url);
  if (pageKey && guest.pageAccess?.[pageKey] === 'view') {
    const error = new Error('This area was shared as view-only');
    error.response = { status: 403, data: { message: 'This area was shared as view-only' } };
    return Promise.reject(error);
  }
  return config;
});

const RequireAccess = ({ pageKey, children }) => {
  const { isGuest, allowedPages } = useAccess();
  if (!isGuest || allowedPages.includes(pageKey)) {
    return children;
  }
  const firstAllowed = PAGES.find((page) => allowedPages.includes(page.key));
  if (!firstAllowed) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-center text-muted-foreground">
        This shared link does not include any modules.
      </div>
    );
  }
  return <Navigate to={firstAllowed.path} replace />;
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [guest, setGuest] = useState(null);
  const [guestError, setGuestError] = useState(null);
  const [showGuestWelcome, setShowGuestWelcome] = useState(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  const endGuest = useCallback(async () => {
    const stored = readStoredGuest();
    if (stored?.token) {
      try {
        await axios.post(`/guest/session/${stored.token}/end`);
      } catch (error) {
        // Session may already be expired/ended; ignore.
      }
    }
    localStorage.removeItem(GUEST_STORAGE_KEY);
    clearSearchIndex().catch(() => {});
    window.location.href = '/';
  }, []);

  useEffect(() => {
    const init = async () => {
      const urlToken = readGuestTokenFromUrl();
      const storedGuest = readStoredGuest();
      const guestToken = urlToken || storedGuest?.token;

      if (guestToken) {
        try {
          const res = await axios.get(`/guest/session/${guestToken}`);
          axios.defaults.headers.common['Authorization'] = `Bearer ${guestToken}`;
          const guestData = {
            token: guestToken,
            allowedPages: res.data.allowedPages,
            pageAccess: res.data.pageAccess || {},
            sharedItems: res.data.sharedItems || [],
            expiresAt: res.data.expiresAt,
          };
          localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(guestData));
          mergeSharedWorkflows(guestData.sharedItems);
          setGuest(guestData);
          if (urlToken) {
            setShowGuestWelcome(true);
            window.history.replaceState({}, '', '/');
          }
        } catch (error) {
          setGuestError(error.response?.data?.message || 'This access link is invalid or has expired.');
        }
        setHasCheckedAuth(true);
        return;
      }

      const unlocked = localStorage.getItem('authUnlocked') === 'true';
      const token = localStorage.getItem('token');

      if (unlocked && token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        await ensureBackendToken();
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('authUnlocked');
      }

      setHasCheckedAuth(true);
    };

    init();
  }, []);

  useEffect(() => {
    if (!guest) return undefined;
    const ms = new Date(guest.expiresAt).getTime() - Date.now();
    if (ms <= 0) {
      endGuest();
      return undefined;
    }
    const timer = setTimeout(endGuest, ms);
    return () => clearTimeout(timer);
  }, [guest, endGuest]);

  if (!hasCheckedAuth) {
    const onSidArt = window.location.pathname.startsWith('/sid-art');
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={onSidArt ? { backgroundColor: '#F7F2E7', color: 'rgba(11, 11, 11, 0.4)' } : undefined}
      >
        Loading...
      </div>
    );
  }

  if (guestError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-6 text-center">
        <div>
          <h1 className="text-xl font-bold mb-2">Access unavailable</h1>
          <p className="text-muted-foreground mb-4">{guestError}</p>
          <button
            onClick={endGuest}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !guest) {
    return (
      <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Routes>
          <Route path="/sid-art" element={<SidArt />} />
          <Route path="/*" element={<Login onAuthSuccess={() => setIsAuthenticated(true)} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  const accessValue = {
    isGuest: !!guest,
    allowedPages: guest ? guest.allowedPages : ALL_PAGE_KEYS,
    pageAccess: guest?.pageAccess || {},
    expiresAt: guest?.expiresAt || null,
    endGuest,
    canEdit: (pageKey) => {
      if (!guest) return true;
      return (guest.pageAccess || {})[pageKey] !== 'view';
    },
  };

  return (
    <AccessProvider value={accessValue}>
      <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Routes>
          <Route path="/sid-art" element={<SidArt />} />
          <Route path="/" element={<MainLayout />}>
            <Route index element={<RequireAccess pageKey="dashboard"><Dashboard /></RequireAccess>} />
            <Route path="tasks" element={<RequireAccess pageKey="tasks"><Tasks /></RequireAccess>} />
            <Route path="calendar" element={<RequireAccess pageKey="calendar"><Calendar /></RequireAccess>} />
            <Route path="notes" element={<RequireAccess pageKey="notes"><Notes /></RequireAccess>} />
            <Route path="sleep" element={<RequireAccess pageKey="sleep"><Sleep /></RequireAccess>} />
            <Route path="money" element={<RequireAccess pageKey="money"><Money /></RequireAccess>} />
            <Route path="focus" element={<RequireAccess pageKey="focus"><Focus /></RequireAccess>} />
            <Route path="settings" element={<RequireAccess pageKey="settings"><Settings /></RequireAccess>} />
            <Route path="translator" element={<RequireAccess pageKey="translator"><Translator /></RequireAccess>} />
            <Route path="workflows" element={<RequireAccess pageKey="workflows"><Workflows /></RequireAccess>} />
            <Route path="habits" element={<RequireAccess pageKey="habits"><Habits /></RequireAccess>} />
            <Route path="whiteboard" element={<RequireAccess pageKey="whiteboard"><Whiteboard /></RequireAccess>} />
            <Route path="pdf-editor" element={<RequireAccess pageKey="pdf-editor"><PdfEditor /></RequireAccess>} />
            <Route path="art" element={<RequireAccess pageKey="art"><Art /></RequireAccess>} />
          </Route>
        </Routes>
      </BrowserRouter>

      {guest && showGuestWelcome && (
        <GuestWelcomeModal
          allowedPages={guest.allowedPages}
          pageAccess={guest.pageAccess || {}}
          sharedItems={guest.sharedItems || []}
          expiresAt={guest.expiresAt}
          onClose={() => setShowGuestWelcome(false)}
          onEnd={endGuest}
        />
      )}
    </AccessProvider>
  );
};

export default App;
