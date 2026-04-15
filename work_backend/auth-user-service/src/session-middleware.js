import { dataRequest } from './http.js';

const SESSION_TTL_SECONDS = 60 * 60 * 8;

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

      await redis.expire(`session:${sid}`, SESSION_TTL_SECONDS);

      const session = JSON.parse(raw);
      req.session = session;
      req.user = session.user;

      try {
        await dataRequest(`/internal/sessions/${sid}/touch`, { method: 'PATCH' });
      } catch (error) {
        console.error('Session touch failed', error.message || error);
      }

      next();
    } catch (error) {
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
