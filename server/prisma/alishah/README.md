# For Huzaifa (schema owner)
- `otp-model.prisma` → add the `OtpCode` model + `OtpPurpose` enum to `schema.prisma`
- `auditlog-model.prisma` → add the `AuditLog` model
- `audit_append_only.sql` → after the first migration: `npx prisma migrate dev --create-only --name audit_append_only`, paste this SQL into the new migration, then `npx prisma migrate dev`
Delete this folder once they're in the schema.
