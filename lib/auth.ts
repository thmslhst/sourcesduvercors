/**
 * Better Auth server instance (ARCHITECTURE.md — auth). Magic-link only:
 * no passwords to manage. The Better Auth core tables live in
 * prisma/schema.prisma; `user.role` ('user' | 'admin') gates moderation
 * (DOMAIN.md § Users & trust).
 *
 * `user.name` is a Better Auth core column the app never reads or shows —
 * sign-up leaves it "". Observations are attributed by id, never by name.
 */

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";

import { prisma } from "./db/client";
import { sendMagicLinkEmail } from "./email";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  /**
   * Better Auth defaults to a 7-day session. That is a trap here: a hiker
   * who installs the PWA in June and walks in August arrives on the plateau
   * signed out, with no way to sign in. A year, refreshed on any online
   * visit, makes that rare — the outbox covers what's left.
   */
  session: {
    expiresIn: 60 * 60 * 24 * 365,
    updateAge: 60 * 60 * 24,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false, // never settable from the client
      },
      /** Stamped by lib/db/users.ts when an account is anonymised. */
      deletedAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url);
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;

/** Session lookup for API route handlers; null when not signed in. */
export async function getSession(request: Request): Promise<Session | null> {
  return auth.api.getSession({ headers: request.headers });
}

export function isAdmin(session: Session): boolean {
  return session.user.role === "admin";
}
