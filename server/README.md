# EventHive Server

## Setup
1. `cd server`
2. `npm install`
3. `cp .env.example .env` and fill in the values (never commit `.env`)
4. `npx prisma migrate dev` (once the Prisma schema exists)
5. `npm run dev` (starts on http://localhost:4000)
6. Check: http://localhost:4000/health returns `{ "ok": true }`

## Conventions
- Shared Prisma client: `require('../lib/prisma')`
- Validate bodies with `validate(zodSchema)` from `middleware/validate.js`
- Errors are always `{ "error": "message", "field": "fieldName or null" }`
- Rate limit sensitive routes with `authLimiter` from `middleware/rateLimit.js`
- Times: store UTC, show PKT with `lib/time.js`

## Auth (Laiba): sign-up, OTP, login, guards
- Routes in `src/routes/auth.js`: `POST /api/auth/register`, `/verify-otp`, `/resend-otp`, `/login` → `{ token, user, dashboard }`, `/logout`, `GET /api/auth/me` → `{ user }`
- Guards for other routes: `const { requireAuth, requireRole, requireVerified } = require('../middleware/auth')`. After `requireAuth`, `req.user = { id, role, emailVerified }`
- Logic lives in `src/auth/` (lockout, tokens, password, schemas, login, signup); `src/auth/deps.js` connects it to Prisma and Alishah's lib
- End a user's sessions (logout, password reset): `require('../auth/deps').endSessions(userId)`
- User fields used: `passwordHash`, `role`, `emailVerifiedAt`, `failedLogins`, `lockedUntil`, `tokenVersion`
- Tests: `npm test` (no database needed)

## Database (Prisma 7 + PostgreSQL)
- Schema: `prisma/schema.prisma`. Database address: `DATABASE_URL` in `.env`, read by `prisma.config.ts`.
- Prisma 7 needs the PostgreSQL driver adapter: `npm install @prisma/adapter-pg pg` (already in package.json once merged).
- Check the schema without a database: `npx prisma validate` and `npx prisma generate`.
- With a database: `npx prisma migrate dev --name init`, then add `prisma/sql/audit_append_only.sql` as a second migration (steps inside the file), then `npx prisma db seed`.
- Seed logins (all verified), password `Test1234`: admin@eventhive.test, organizer@eventhive.test, attendee@eventhive.test.
