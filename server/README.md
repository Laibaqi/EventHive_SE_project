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
