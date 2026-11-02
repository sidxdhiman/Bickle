import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Lock, Loader2 } from 'lucide-react';
import { storeSessionToken } from '../utils/backendAuth';
import { beginProfile } from '../utils/profileState';

const FALLBACK_PROFILES = [
  { key: 'me', username: 'Sidharth' },
  { key: 'd', username: 'D' },
];

const PROFILE_STYLE = {
  me: 'from-indigo-500 via-sky-400 to-cyan-300',
  d: 'from-pink-500 via-rose-400 to-amber-300',
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

const Login = ({ onAuthSuccess }) => {
  const [profiles, setProfiles] = useState(null);
  const [selected, setSelected] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    axios
      .get('/auth/profiles')
      .then((res) => {
        if (!cancelled && Array.isArray(res.data) && res.data.length > 0) setProfiles(res.data);
      })
      .catch(() => {
        if (!cancelled) setProfiles(FALLBACK_PROFILES);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selected) setPassword('');
  }, [selected]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setError('');
    setLoading(true);

    try {
      const res = await axios.post('/auth/login', { profile: selected.key, password });
      storeSessionToken(res.data.token);
      beginProfile(selected.key);
      onAuthSuccess();
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl shadow-black/5">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-400 to-cyan-300 shadow-lg">
            <span className="text-xl font-black text-white">B</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {selected ? `Hi ${selected.username}` : 'Who is using Bickle?'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selected
              ? 'Enter your password to unlock your private space.'
              : 'Pick your profile. Each one keeps its own private world.'}
          </p>
        </div>

        {!selected && (
          <div className="flex items-start justify-center gap-6 sm:gap-10">
            {(profiles || []).map((profile) => (
              <button
                key={profile.key}
                type="button"
                onClick={() => setSelected(profile)}
                className="group flex w-28 flex-col items-center gap-3 rounded-2xl p-3 transition-all hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="transition-transform duration-200 group-hover:-translate-y-1 group-hover:scale-105">
                  <ProfileAvatar profile={profile} />
                </span>
                <span className="text-sm font-semibold">{profile.username}</span>
              </button>
            ))}
            {!profiles && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
          </div>
        )}

        {selected && (
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
                  className="w-full rounded-lg border border-input bg-transparent py-3 pl-10 pr-4 text-sm outline-none transition focus:border-primary"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  autoFocus
                />
              </div>
            </label>

            {error && (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setError('');
              }}
              className="flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              Choose another profile
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
