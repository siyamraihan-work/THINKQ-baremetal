# API Examples

These examples assume requests go through the public Nginx origin in production, for example `https://thinkq.arizona.edu`. For local service testing, use the service ports shown in `deploy/bare-metal/README.md`.

## Development Login

Only enable this route in local development with `DEV_AUTH_ENABLED=true`.

```bash
curl -i -X POST http://localhost:3001/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.edu","oid":"oid-student-1","name":"Student One","role":"STUDENT"}'
```

## Current User

```bash
curl -i http://localhost/users/me \
  --cookie "sid=YOUR_SESSION_COOKIE"
```

## Promote User To Admin

```bash
curl -X PATCH http://localhost/api/admin/users/1/role \
  -H "Content-Type: application/json" \
  --cookie "sid=YOUR_ADMIN_COOKIE" \
  -d '{"role":"ADMIN"}'
```

## Create Building As Admin

```bash
curl -X POST http://localhost/api/admin/buildings \
  -H "Content-Type: application/json" \
  --cookie "sid=YOUR_ADMIN_COOKIE" \
  -d '{"name":"Main Lab"}'
```

## Create Room As Admin

```bash
curl -X POST http://localhost/api/admin/rooms \
  -H "Content-Type: application/json" \
  --cookie "sid=YOUR_ADMIN_COOKIE" \
  -d '{"buildingId":1,"name":"101"}'
```

## Create Support Table As Admin

```bash
curl -X POST http://localhost/api/admin/locations \
  -H "Content-Type: application/json" \
  --cookie "sid=YOUR_ADMIN_COOKIE" \
  -d '{"roomId":1,"tableNumber":"7"}'
```

## Student Creates Ticket

```bash
curl -X POST http://localhost/tickets \
  -H "Content-Type: application/json" \
  --cookie "sid=YOUR_STUDENT_COOKIE" \
  -d '{"courseId":1,"locationId":1,"issueType":"PROJECT","notes":"Need help with project setup","preferredContact":"IN_PERSON"}'
```

## Teacher Selects Active Room

```bash
curl -X POST http://localhost/tickets/teacher/active-room \
  -H "Content-Type: application/json" \
  --cookie "sid=YOUR_TEACHER_COOKIE" \
  -d '{"buildingId":1,"roomId":1}'
```

## Teacher Accepts Ticket

```bash
curl -X POST http://localhost/tickets/1/accept \
  --cookie "sid=YOUR_TEACHER_COOKIE"
```

## Teacher Completes Ticket

```bash
curl -X POST http://localhost/tickets/1/complete \
  -H "Content-Type: application/json" \
  --cookie "sid=YOUR_TEACHER_COOKIE" \
  -d '{"resolutionNotes":"Explained stack trace and fixed the bug together."}'
```

## SAML Metadata

```bash
curl -i http://localhost/auth/metadata
```
