"use client";

/**
 * Offline-tolerant session: Better Auth's useSession needs the network to
 * answer, but a hiker on the plateau must still see the report form (the
 * outbox holds the write until reconnect, and the replay carries the auth
 * cookie). We mirror the last *definitive* session answer into localStorage
 * and fall back to it only when the session fetch errors — a definitive
 * signed-out clears the mirror.
 *
 * The four states are distinguished rather than collapsed to user-or-null,
 * because the contribute branch needs all of them: "unreachable" (the
 * session call failed and nothing was mirrored) is the signed-out hiker
 * already offline, who may still capture into the outbox and sign in on
 * return — auth gates the flush, not the capture (ARCHITECTURE.md § Write
 * path offline). It is a direct measurement of "the server didn't answer",
 * which navigator.onLine is not.
 */

import { useEffect } from "react";

import { useSession } from "@/lib/auth-client";

const SESSION_MIRROR_KEY = "sdv-session-user";

export interface OfflineSessionUser {
  id: string;
  /** Shown back to the signed-in user only — never published (DOMAIN.md). */
  email: string;
}

/**
 * Drop the mirrored session immediately, without waiting for a definitive
 * signed-out answer — used when the client already knows the account is gone
 * (account deletion), so a network hiccup can't resurrect it offline.
 */
export function clearSessionMirror(): void {
  try {
    localStorage.removeItem(SESSION_MIRROR_KEY);
  } catch {
    // localStorage unavailable — nothing was mirrored either.
  }
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

export type OfflineSessionState =
  /** First session fetch still in flight — commit to nothing yet. */
  | { status: "pending" }
  /** Live session, or the mirrored one when the network couldn't answer. */
  | { status: "signed-in"; user: OfflineSessionUser }
  /** The server really said "signed out" — signing in now is possible. */
  | { status: "signed-out" }
  /** Session call failed and nothing was mirrored: offline, never signed in here. */
  | { status: "unreachable" };

/**
 * Drives the contribute branch in SourceSheet: live session when the
 * network answered, the mirrored one when it couldn't, and an explicit
 * "unreachable" when neither is available.
 */
export function useOfflineSession(): OfflineSessionState {
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

  if (data) return { status: "signed-in", user: data.user };
  if (error) {
    const mirrored = readMirror();
    return mirrored
      ? { status: "signed-in", user: mirrored.user }
      : { status: "unreachable" };
  }
  // Pending and signed-out both answered `null` before; the report form
  // used to flash the sign-in branch for a beat because of it.
  return isPending ? { status: "pending" } : { status: "signed-out" };
}
