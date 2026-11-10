// GuestSession.isLive() as a plain function: the session row comes back as
// a mapped object (active is a real boolean, expiresAt an ISO string).
const isSessionLive = (session) =>
  !!session && session.active === true && Date.parse(session.expiresAt) > Date.now();

module.exports = { isSessionLive };
