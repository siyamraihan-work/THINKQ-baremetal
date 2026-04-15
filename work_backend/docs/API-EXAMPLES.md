## Development login

```bash
curl -i -X POST http://localhost/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@example.edu","oid":"oid-student-1","name":"Student One","role":"STUDENT"}'
```

## Promote user to admin

```bash
curl -X PATCH http://localhost/admin/users/1/role \
  -H "Content-Type: application/json" \
  --cookie "sid=YOUR_ADMIN_COOKIE" \
  -d '{"role":"ADMIN"}'
```

## Create building as admin

```bash
curl -X POST http://localhost/admin/buildings \
  -H "Content-Type: application/json" \
  --cookie "sid=YOUR_ADMIN_COOKIE" \
  -d '{"name":"Main Lab"}'
```

## Create room as admin

```bash
curl -X POST http://localhost/admin/rooms \
  -H "Content-Type: application/json" \
  --cookie "sid=YOUR_ADMIN_COOKIE" \
  -d '{"buildingId":1,"name":"101"}'
```

## Create support table as admin

```bash
curl -X POST http://localhost/admin/locations \
  -H "Content-Type: application/json" \
  --cookie "sid=YOUR_ADMIN_COOKIE" \
  -d '{"roomId":1,"tableNumber":"7"}'
```

## Student creates ticket

```bash
curl -X POST http://localhost/tickets \
  -H "Content-Type: application/json" \
  --cookie "sid=YOUR_STUDENT_COOKIE" \
  -d '{"courseId":1,"locationId":1,"issueType":"PROJECT","notes":"Need help with project setup"}'
```

## Teacher accepts ticket

```bash
curl -X POST http://localhost/tickets/1/accept \
  --cookie "sid=YOUR_TEACHER_COOKIE"
```

## Teacher completes ticket

```bash
curl -X POST http://localhost/tickets/1/complete \
  -H "Content-Type: application/json" \
  --cookie "sid=YOUR_TEACHER_COOKIE" \
  -d '{"resolutionNotes":"Explained stack trace and fixed the bug together."}'
```
