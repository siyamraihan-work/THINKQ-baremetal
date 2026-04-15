# ThinkQ Frontend (Wired to Backend)

This frontend is wired to the backend gateway structure from the `helpdesk-polyglot-platform` zip you uploaded.

## Backend paths used

The frontend reads your real backend paths, not invented `/api/*` placeholders:

- `/auth/login`
- `/users/me`
- `/admin/*`
- `/tickets/*`
- `/analytics/*`
- `/events/*`
- `/queue/*`
- `/student/live/*`

## Auth flow used

1. React boots.
2. Frontend calls `GET /users/me` with `credentials: include`.
3. If the backend session cookie is valid, the app routes by role:
   - `STUDENT` -> `/student/dashboard`
   - `TEACHER` -> `/teacher/dashboard`
   - `ADMIN` -> `/admin/dashboard`
4. If there is no session, the app stays on `/login`.
5. Clicking **Login using WebAuth** redirects to `/auth/login`.

## Why this is the right single-PC setup

Because both frontend and backend live on one PC, the cleanest enterprise-style browser path is:

browser -> frontend nginx -> backend nginx gateway -> backend microservices

That keeps the browser on one origin and preserves the backend cookie flow.

## Docker note

The provided Nginx config proxies to `http://host.docker.internal:8080`.
That assumes your backend gateway is reachable on port `8080` from the same PC.
If your backend gateway uses a different port, update `nginx/default.conf`.

The Docker Compose file includes:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

That is important on Linux so the frontend container can reach services running on the host machine.
