"use client";

/**
 * Offline-tolerant session: Better Auth's useSession needs the network to
 * answer, but a signed-in hiker on the plateau must still see the report
 * form (the outbox holds the write until reconnect, and the replay carries
 * the auth cookie). We mirror the last *definitive* session answer into
 * localStorage and fall back to it only when the session fetch errors —
 * a definitive signed-out clears the mirror.
 */

import { useEffect } from "react";

import { useSession } from "@/lib/auth-client";

const SESSION_MIRROR_KEY = "sdv-session-user";

export interface OfflineSessionUser {
  id: string;
  /** Shown back to the signed-in user only — never published (DOMAIN.md). */
  email: string;
}

function readMirror(): { user: OfflineSessionUser } | null {
  try {
    const raw = localStorage.getItem(SESSION_MIRROR_KEY);
    if (!raw) return null;
    const user = JSON.parse(raw) as OfflineSessionUser;
    return typeof user?.id === "string" ? { user } : null;
  } catch {
    return null;
  }
}

/**
 * Drop-in for the `session ? … : sign-in` branches: returns the live
 * session when the network answered, the mirrored one when it couldn't.
 */
export function useOfflineSession(): { user: OfflineSessionUser } | null {
  const { data, isPending, error } = useSession();

  useEffect(() => {
    if (isPending) return;
    try {
      if (data) {
        const user: OfflineSessionUser = {
          id: data.user.id,
          email: data.user.email,
        };
        localStorage.setItem(SESSION_MIRROR_KEY, JSON.stringify(user));
      } else if (!error) {
        // The server really said "signed out" — don't keep pretending.
        localStorage.removeItem(SESSION_MIRROR_KEY);
      }
    } catch {
      // localStorage unavailable — the online path still works.
    }
  }, [data, isPending, error]);

  if (data) return { user: data.user };
  if (error) return readMirror();
  return null;
}
