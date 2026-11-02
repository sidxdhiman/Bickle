import { clearSearchIndex } from './searchIndex';

// Browser-local state that must never bleed between the two profiles when they
// share a browser. Each key is stashed under the profile that owns it and
// restored when that profile signs in again — workflows and the profile pic
// therefore stay "hers" vs "mine", exactly like the server-side data.
const STATE_KEYS = ['bickle-workflows', 'profilePic'];
const MARKER_KEY = 'bickleActiveProfile';

const slotKey = (profileKey, key) => `bickle-slot:${profileKey}:${key}`;

const hasActiveData = () => STATE_KEYS.some((key) => localStorage.getItem(key) !== null);

const move = (from, to) => {
  const value = localStorage.getItem(from);
  if (value === null) {
    localStorage.removeItem(to);
    return;
  }
  localStorage.setItem(to, value);
  localStorage.removeItem(from);
};

export const getActiveProfileKey = () => localStorage.getItem(MARKER_KEY);

// Called on logout: park the active profile's local state in its slot.
export const endActiveProfile = () => {
  if (!hasActiveData()) {
    localStorage.removeItem(MARKER_KEY);
    return;
  }
  const from = getActiveProfileKey() || 'me';
  STATE_KEYS.forEach((key) => move(key, slotKey(from, key)));
  localStorage.removeItem(MARKER_KEY);
};

// Called right after a successful login: park whatever profile was active
// before (defaulting to "me" for pre-profile databases) and load the chosen
// profile's own slot. The search index follows the profile, never the browser.
export const beginProfile = (profileKey) => {
  const previous = getActiveProfileKey();
  const from = previous || 'me';
  const active = hasActiveData();

  if (from !== profileKey) {
    // Unmarked active state belongs to the legacy "me" profile.
    if (previous || active) {
      STATE_KEYS.forEach((key) => move(key, slotKey(from, key)));
    }
    clearSearchIndex().catch(() => {});
  }

  // Restore this profile's slot unless its own data is already live.
  if (from !== profileKey || !active) {
    STATE_KEYS.forEach((key) => move(slotKey(profileKey, key), key));
  }

  localStorage.setItem(MARKER_KEY, profileKey);
  // Let open listeners (workflows hook) pick up the restored state.
  window.dispatchEvent(new CustomEvent('bickle-workflows-change'));
};
