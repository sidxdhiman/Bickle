// Tiny in-memory stale-while-revalidate cache so navigating between pages
// renders instantly from the last-known data instead of flashing a skeleton.
// Module-level: cleared automatically on full page reload (e.g. logout).
const store = new Map();

export const peek = (key) => store.get(key);

export const stash = (key, value) => {
  store.set(key, value);
};

export const clearPageCache = () => {
  store.clear();
};
