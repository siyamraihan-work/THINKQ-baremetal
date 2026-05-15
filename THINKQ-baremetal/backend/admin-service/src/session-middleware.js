import { dataRequest } from './http.js';

const SESSION_TTL_SECONDS = 60 * 60 * 8;

async function refreshSession(redis, sid, session) {
  if (!session || !session.user || !session.user.id) {
    await redis.del(`session:${sid}`);
    const error = new Error('Invalid session');
    error.status = 401;
    throw error;
  }

  const currentUser = await dataRequest(`/internal/users/${session.user.id}`);
  const refreshed = {
    ...session,
    user: currentUser,
    lastSeenAt: new Date().toISOString()
  };

  await redis.set(`session:${sid}`, JSON.stringify(refreshed), 'EX', SESSION_TTL_SECONDS);
  return refreshed;
}

export function requireSession(redis) {
  return async function(req, res, next) {
    try {
      const sid = req.cookies.sid;
      if (!sid) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const raw = await redis.get(`session:${sid}`);
      if (!raw) {
        return res.status(401).json({ error: 'Session expired or missing' });
      }

      const session = JSON.parse(raw);
      const refreshedSession = await refreshSession(redis, sid, session);
      req.session = refreshedSession;
      req.user = refreshedSession.user;

      try {
        await dataRequest(`/internal/sessions/${sid}/touch`, { method: 'PATCH' });
      } catch (error) {
        console.error('Session touch failed', error.message || error);
      }

      next();
    } catch (error) {
      if (error.status === 401) {
        return res.status(401).json({ error: error.message || 'Not authenticated' });
      }
      next(error);
    }
  };
}

export function requireRole(...roles) {
  return function(req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
