import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, FileUp, Lock, Loader2, Mail, UserPlus } from 'lucide-react';
import { storeSessionToken, storeUser } from '../utils/backendAuth';
import { beginProfile } from '../utils/profileState';
import { applyTheme } from '../utils/themeUtils';

const FALLBACK_PROFILES = [
  { key: 'me', username: 'Sidharth' },
  { key: 'd', username: 'D' },
];

// Password profiles only exist on the updated backend. When the old backend
// is still running (its /auth/profiles route 404s), sign the owner in through
// the legacy account instead so the known seed password keeps working.
const SEED_PASSWORD = '0]Hyisgh';
const LEGACY_OWNER = { email: 'dev@bickle.com', password: 'password' };

const PROFILE_STYLE = {
  me: 'from-indigo-500 via-sky-400 to-cyan-300',
  d: 'from-pink-500 via-rose-400 to-amber-300',
};

// Human labels for the backup summary shown under a chosen import file.
const IMPORT_LABELS = {
  taskLists: 'lists',
  tasks: 'tasks',
  calendarEvents: 'events',
  habits: 'habits',
  notes: 'notes',
  categories: 'note categories',
  sleeps: 'sleeps',
  transactions: 'transactions',
  userCategories: 'money categories',
  whiteboards: 'whiteboards',
};

const readSlotPic = (profileKey) => {
  try {
    return localStorage.getItem(`bickle-slot:${profileKey}:profilePic`);
  } catch (error) {
    return null;
  }
};

const initialsOf = (name = '?') => name.trim().slice(0, 1).toUpperCase();

const ProfileAvatar = ({ profile, size = 'w-20 h-20' }) => {
  const pic = readSlotPic(profile.key);
  return (
    <div className={`relative ${size} rounded-full p-[3px] bg-gradient-to-br ${PROFILE_STYLE[profile.key] || 'from-primary to-primary/40'}`}>
      <div className="w-full h-full rounded-full overflow-hidden bg-background flex items-center justify-center">
        {pic ? (
          <img src={pic} alt={profile.username} className="w-full h-full object-cover" />
        ) : (
          <span className="font-bold text-foreground" style={{ fontSize: '1.6rem' }}>
            {initialsOf(profile.username)}
          </span>
        )}
      </div>
    </div>
  );
};

const fieldClass =
  'w-full rounded-lg border border-input bg-transparent py-3 pl-10 pr-4 text-sm outline-none transition focus:border-primary';

const Login = ({ onAuthSuccess }) => {
  const [profiles, setProfiles] = useState(null);
  const [selected, setSelected] = useState(null);
  // 'picker' shows the profile tiles (+ password step), 'email' is the
  // email+password form, 'register' is the first-boot Create account form.
  const [view, setView] = useState('picker');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  // Optional bickle-export file chosen on the register form. `createdAuth`
  // keeps the register response so a failed import can be retried without
  // hitting "User already exists".
  const [regImport, setRegImport] = useState(null);
  const [createdAuth, setCreatedAuth] = useState(null);
  const importInputRef = useRef(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [legacyBackend, setLegacyBackend] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    axios
      .get('/auth/profiles')
      .then((res) => {
        if (!cancelled && Array.isArray(res.data) && res.data.length > 0) setProfiles(res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 404) setLegacyBackend(true);
        setProfiles(FALLBACK_PROFILES);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selected) setPassword('');
  }, [selected]);

  const enterApp = (data, profileKey) => {
    storeSessionToken(data.token);
    storeUser(data);
    beginProfile(profileKey || data.key || data.username);
    onAuthSuccess();
    navigate('/');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setError('');
    setLoading(true);

    try {
      let payload = { profile: selected.key, password };
      if (legacyBackend) {
        if (selected.key !== 'me') {
          setError("D's profile needs the updated server. Deploy the backend update first.");
          setLoading(false);
          return;
        }
        if (password !== SEED_PASSWORD) {
          setError('Invalid password.');
          setLoading(false);
          return;
        }
        payload = { email: LEGACY_OWNER.email, password: LEGACY_OWNER.password };
      }
      const res = await axios.post('/auth/login', payload);
      enterApp(res.data, legacyBackend ? 'me' : undefined);
    } catch (err) {
      if (legacyBackend && err.response?.status === 401) {
        setError('Server is out of date — deploy the backend update, then sign in again.');
      } else {
        setError(err.response?.data?.message || 'Unable to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/auth/login', { email: email.trim(), password });
      enterApp(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportFile = async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = ''; // re-picking the same file must fire change again
    if (!file) return;
    setError('');
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || parsed.kind !== 'bickle-export' || !parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
        setError("That file isn't a Bickle export.");
        return;
      }
      setRegImport({ name: file.name, data: parsed });
    } catch (err) {
      setError("That file isn't a Bickle export.");
    }
  };

  const applyImportedPreferences = (preferences) => {
    if (!preferences || typeof preferences !== 'object') return;
    if (preferences.theme) {
      localStorage.setItem('bickle-theme', preferences.theme);
      applyTheme(preferences.theme);
    }
    if (preferences.font) localStorage.setItem('bickle-font', preferences.font);
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError('');
    if (regPassword !== regConfirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    // Captured before the try so the catch can tell "register just succeeded"
    // apart from "register failed" even though setState hasn't flushed yet.
    let auth = createdAuth;
    try {
      if (!auth) {
        const res = await axios.post('/auth/register', {
          username: regUsername.trim(),
          email: regEmail.trim(),
          password: regPassword,
        });
        auth = res.data;
        setCreatedAuth(auth);
      }
      if (regImport) {
        // Token first so the import request authenticates as the new account.
        storeSessionToken(auth.token);
        await axios.post('/settings/import', regImport.data);
        applyImportedPreferences(regImport.data.data.preferences);
      }
      enterApp(auth);
    } catch (err) {
      if (auth && regImport) {
        setError(
          `Account created, but the import failed: ${
            err.response?.data?.message || 'could not read the backup'
          } Press the button to retry the import.`
        );
      } else {
        setError(err.response?.data?.message || 'Could not create the account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const backToPicker = () => {
    setView('picker');
    setSelected(null);
    setError('');
  };

  const titles =
    view === 'register'
      ? { title: 'Create your account', subtitle: 'Your own private space — sign in with email and password.' }
      : view === 'email'
        ? { title: 'Sign in with email', subtitle: 'Use the email address linked to your account.' }
        : selected
          ? { title: `Hi ${selected.username}`, subtitle: 'Enter your password to unlock your private space.' }
          : { title: 'Who is using Bickle?', subtitle: 'Pick your profile. Each one keeps its own private world.' };

  const errorBox = error && (
    <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {error}
    </div>
  );

  const importSummary = regImport
    ? Object.entries(regImport.data.data || {})
        .filter(([, rows]) => Array.isArray(rows) && rows.length)
        .map(([key, rows]) => `${rows.length} ${IMPORT_LABELS[key] || key}`)
        .join(', ')
    : '';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-xl shadow-black/5">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-400 to-cyan-300 shadow-lg">
            <span className="text-xl font-black text-white">B</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{titles.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{titles.subtitle}</p>
        </div>

        {view === 'picker' && !selected && (
          <>
            {legacyBackend && (
              <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-xs text-amber-600 dark:text-amber-400">
                Server update not deployed yet — only Sidharth can sign in. Deploy the
                backend to unlock D&apos;s profile and chat.
              </div>
            )}
            <div className="flex flex-wrap items-start justify-center gap-4 sm:gap-6">
              {(profiles || []).map((profile) => (
                <button
                  key={profile.key}
                  type="button"
                  onClick={() => setSelected(profile)}
                  className="group flex w-32 flex-col items-center gap-3 whitespace-nowrap rounded-2xl p-3 transition-all hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="transition-transform duration-200 group-hover:-translate-y-1 group-hover:scale-105">
                    <ProfileAvatar profile={profile} />
                  </span>
                  <span className="text-sm font-semibold">{profile.username}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setView('register');
                  setError('');
                }}
                className="group flex w-32 flex-col items-center gap-3 whitespace-nowrap rounded-2xl p-3 transition-all hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-border transition-all duration-200 group-hover:-translate-y-1 group-hover:border-primary/60">
                  <UserPlus className="h-7 w-7 text-muted-foreground transition group-hover:text-primary" />
                </span>
                <span className="text-sm font-semibold">Create account</span>
              </button>
              {!profiles && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
            </div>

            {error && <div className="mt-5">{errorBox}</div>}

            <button
              type="button"
              onClick={() => {
                setView('email');
                setError('');
              }}
              className="mt-6 flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <Mail className="w-4 h-4" />
              Sign in with email instead
            </button>
          </>
        )}

        {view === 'picker' && selected && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <ProfileAvatar profile={selected} size="w-24 h-24" />
            </div>

            <label className="block text-sm font-medium text-foreground">
              Password
              <div className="relative mt-2">
                <Lock className="absolute left-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={fieldClass}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  autoFocus
                />
              </div>
            </label>

            {errorBox}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <button
              type="button"
              onClick={backToPicker}
              className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Choose another profile
            </button>
          </form>
        )}

        {view === 'email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-foreground">
              Email
              <div className="relative mt-2">
                <Mail className="absolute left-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={fieldClass}
                  placeholder="you@example.com"
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
            </label>

            <label className="block text-sm font-medium text-foreground">
              Password
              <div className="relative mt-2">
                <Lock className="absolute left-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={fieldClass}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </label>

            {errorBox}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <button
              type="button"
              onClick={backToPicker}
              className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Choose a profile
            </button>
          </form>
        )}

        {view === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <label className="block text-sm font-medium text-foreground">
              Name
              <div className="relative mt-2">
                <UserPlus className="absolute left-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={regUsername}
                  onChange={(event) => setRegUsername(event.target.value)}
                  className={fieldClass}
                  placeholder="Your name"
                  maxLength={32}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>
            </label>

            <label className="block text-sm font-medium text-foreground">
              Email
              <div className="relative mt-2">
                <Mail className="absolute left-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={regEmail}
                  onChange={(event) => setRegEmail(event.target.value)}
                  className={fieldClass}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
            </label>

            <label className="block text-sm font-medium text-foreground">
              Password
              <div className="relative mt-2">
                <Lock className="absolute left-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={regPassword}
                  onChange={(event) => setRegPassword(event.target.value)}
                  className={fieldClass}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  required
                />
              </div>
            </label>

            <label className="block text-sm font-medium text-foreground">
              Confirm password
              <div className="relative mt-2">
                <Lock className="absolute left-3.5 top-1/2 w-4 h-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={regConfirm}
                  onChange={(event) => setRegConfirm(event.target.value)}
                  className={fieldClass}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  required
                />
              </div>
            </label>

            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportFile}
            />
            <div className="rounded-2xl border border-dashed border-border p-3">
              {regImport ? (
                <div className="flex items-start gap-2.5">
                  <FileUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{regImport.name}</p>
                    {importSummary && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{importSummary}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRegImport(null)}
                    className="shrink-0 text-xs text-muted-foreground transition hover:text-foreground"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => importInputRef.current && importInputRef.current.click()}
                  className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
                >
                  <FileUp className="h-4 w-4" />
                  Import data from a previous export (optional)
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Brings tasks, notes, lists, calendar, habits, sleep, money and whiteboards from a
              Bickle export file.
            </p>

            {errorBox}

            <button
              type="submit"
              disabled={loading || !regUsername.trim() || !regEmail || !regPassword || !regConfirm}
              className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? createdAuth && regImport
                  ? 'Importing...'
                  : 'Creating account...'
                : createdAuth && regImport
                  ? 'Retry import'
                  : 'Create account'}
            </button>

            <button
              type="button"
              onClick={backToPicker}
              className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to profiles
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
