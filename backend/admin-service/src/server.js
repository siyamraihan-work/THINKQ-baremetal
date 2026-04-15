import express from 'express';
import cookieParser from 'cookie-parser';
import Redis from 'ioredis';
import { z } from 'zod';
import { PORT, REDIS_URL } from './settings.js';
import { dataRequest } from './http.js';
import { requireSession, requireRole } from './session-middleware.js';

const app = express();
const redis = new Redis(REDIS_URL);

app.use(express.json());
app.use(cookieParser());

app.get('/health', function(req, res) {
  res.json({ status: 'ok', service: 'admin-service' });
});

app.get('/admin/users', requireSession(redis), requireRole('ADMIN'), async function(req, res, next) {
  try {
    const users = await dataRequest('/internal/users');
    res.json(users);
  } catch (error) {
    next(error);
  }
});

app.patch('/admin/users/:id/role', requireSession(redis), requireRole('ADMIN'), async function(req, res, next) {
  try {
    const body = z.object({
      role: z.enum(['ADMIN', 'TEACHER', 'STUDENT'])
    }).parse(req.body);

    const updated = await dataRequest(`/internal/users/${req.params.id}/role`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.post('/admin/courses', requireSession(redis), requireRole('ADMIN'), async function(req, res, next) {
  try {
    const body = z.object({
      subject: z.string().min(2).max(10).transform(function(value) { return value.toUpperCase(); }),
      code: z.string().min(1).max(10),
      title: z.string().min(2).max(120).optional(),
      active: z.boolean().optional()
    }).parse(req.body);

    const created = await dataRequest('/internal/courses', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.patch('/admin/courses/:id/status', requireSession(redis), requireRole('ADMIN'), async function(req, res, next) {
  try {
    const body = z.object({ active: z.boolean() }).parse(req.body);

    const updated = await dataRequest(`/internal/courses/${req.params.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete('/admin/courses/:id', requireSession(redis), requireRole('ADMIN'), async function(req, res, next) {
  try {
    await dataRequest(`/internal/courses/${req.params.id}`, { method: 'DELETE' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post('/admin/buildings', requireSession(redis), requireRole('ADMIN'), async function(req, res, next) {
  try {
    const body = z.object({
      name: z.string().min(2).max(120)
    }).parse(req.body);

    const created = await dataRequest('/internal/buildings', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.post('/admin/rooms', requireSession(redis), requireRole('ADMIN'), async function(req, res, next) {
  try {
    const body = z.object({
      buildingId: z.coerce.number().int().positive(),
      name: z.string().min(1).max(60)
    }).parse(req.body);

    const created = await dataRequest('/internal/rooms', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.post('/admin/locations', requireSession(redis), requireRole('ADMIN'), async function(req, res, next) {
  try {
    const body = z.object({
      roomId: z.coerce.number().int().positive(),
      tableNumber: z.string().min(1).max(20),
      active: z.boolean().optional()
    }).parse(req.body);

    const created = await dataRequest('/internal/locations', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.patch('/admin/locations/:id/status', requireSession(redis), requireRole('ADMIN'), async function(req, res, next) {
  try {
    const body = z.object({ active: z.boolean() }).parse(req.body);

    const updated = await dataRequest(`/internal/locations/${req.params.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete('/admin/locations/:id', requireSession(redis), requireRole('ADMIN'), async function(req, res, next) {
  try {
    await dataRequest(`/internal/locations/${req.params.id}`, { method: 'DELETE' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get('/admin/lookups', requireSession(redis), requireRole('ADMIN'), async function(req, res, next) {
  try {
    const [courses, buildings, rooms, locations] = await Promise.all([
      dataRequest('/internal/courses'),
      dataRequest('/internal/buildings'),
      dataRequest('/internal/rooms'),
      dataRequest('/internal/locations')
    ]);

    res.json({ courses, buildings, rooms, locations });
  } catch (error) {
    next(error);
  }
});

app.use(function(error, req, res, next) {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
});

app.listen(PORT, function() {
  console.log(`admin-service listening on ${PORT}`);
});
