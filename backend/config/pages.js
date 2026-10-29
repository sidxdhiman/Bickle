// Modules that the owner can grant to a guest session.
const GRANTABLE_PAGE_KEYS = [
  'tasks',
  'habits',
  'focus',
  'calendar',
  'notes',
  'whiteboard',
  'pdf-editor',
  'sleep',
  'money',
  'translator',
  'workflows',
  'art',
];

// Maps an API url prefix to the module key used for guest access checks.
const API_PAGE_MAP = [
  ['/api/lists', 'tasks'],
  ['/api/tasks', 'tasks'],
  ['/api/calendar', 'calendar'],
  ['/api/notes', 'notes'],
  ['/api/sleep', 'sleep'],
  ['/api/money', 'money'],
  ['/api/habits', 'habits'],
  ['/api/whiteboards', 'whiteboard'],
  ['/api/art', 'art'],
  ['/api/settings', 'settings'],
  // Guests must never manage/share access themselves.
  ['/api/guest', 'owner-management'],
];

// Paths that a guest may always reach regardless of granted modules.
const ALWAYS_ALLOWED_PREFIXES = ['/api/auth'];

const pageKeyForUrl = (url) => {
  const path = url.split('?')[0];
  if (ALWAYS_ALLOWED_PREFIXES.some(prefix => path.startsWith(prefix))) return null;
  for (const [prefix, key] of API_PAGE_MAP) {
    if (path.startsWith(prefix)) return key;
  }
  return null;
};

module.exports = { GRANTABLE_PAGE_KEYS, pageKeyForUrl };
