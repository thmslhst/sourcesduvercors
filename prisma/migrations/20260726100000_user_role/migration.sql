-- Moderation role for Better Auth users: 'user' | 'admin' (DOMAIN.md
-- § Users & trust). Promotion to admin is manual SQL — no UI for it.
ALTER TABLE "user" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
