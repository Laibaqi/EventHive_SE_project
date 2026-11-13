-- AUDT-01 / BR-22: the audit log can never be edited or deleted, even by buggy code.
-- How to add it (Prisma can't express triggers in schema.prisma):
--   1. After the AuditLog table exists:  npx prisma migrate dev --create-only --name audit_append_only
--   2. Paste this file into the new prisma/migrations/<timestamp>_audit_append_only/migration.sql
--   3. npx prisma migrate dev
-- Note for the team: seed scripts must NOT call prisma.auditLog.deleteMany(); use `npx prisma migrate reset`
-- to wipe a dev database instead (dropping the schema is still allowed).

CREATE OR REPLACE FUNCTION auditlog_block_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only: % is not allowed (BR-22)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auditlog_no_update_delete
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION auditlog_block_changes();

CREATE TRIGGER auditlog_no_truncate
  BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION auditlog_block_changes();
