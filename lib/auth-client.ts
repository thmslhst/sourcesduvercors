/**
 * Better Auth browser client — used by the sign-in flow in the source
 * sheet. Same origin as the app, so no baseURL needed.
 */

"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});

export const { useSession, signOut } = authClient;
