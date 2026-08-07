/**
 * The one write path for a new observation, shared by the report form and the
 * sheet's re-observe prompt.
 *
 * Both send the same append-only fact and owe the hiker the same promises
 * (ARCHITECTURE.md § Write path offline): unreachable network or a missing
 * session parks the observation in the outbox under its client UUID, so the
 * replay is idempotent and auth gates the flush rather than the capture. That
 * dance is easy to get subtly wrong twice, so it lives here once.
 */

import type { ObservationStatus, ObservationTag } from "@/lib/domain/constants";
import { enqueueOutbox } from "./outbox";

export interface NewObservationBody {
  /** Client-generated UUID — the outbox key and the observation id. */
  id: string;
  sourceId: string;
  status: ObservationStatus;
  tags: ObservationTag[];
  /** When the hiker was at the source, not when the server received it. */
  observedAt: string;
}

export type SubmitObservationOutcome =
  | "saved"
  /** In the outbox; the replay carries the existing cookie. */
  | "queued"
  /** In the outbox behind a missing session — only a sign-in can send it. */
  | "queuedNeedsSignIn"
  | "error";

export async function submitObservation(
  body: NewObservationBody,
  /** Known signed-out up front (offline); online a 401 tells us instead. */
  deferredAuth: boolean,
): Promise<SubmitObservationOutcome> {
  const queue = async (
    needsSignIn: boolean,
  ): Promise<SubmitObservationOutcome> => {
    try {
      await enqueueOutbox({
        kind: "observation",
        id: body.id,
        enqueuedAt: new Date().toISOString(),
        body,
      });
      return needsSignIn ? "queuedNeedsSignIn" : "queued";
    } catch {
      return "error";
    }
  };

  let res: Response;
  try {
    res = await fetch("/api/v1/observations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return queue(deferredAuth);
  }
  if (res.status === 401) {
    // Signed out, but the observation itself is good — keep it and ask for
    // the one thing that can send it, now that the taps are already spent.
    return queue(true);
  }
  // Refused on the merits (invalid, source gone…) — queueing can't help.
  if (!res.ok) return "error";
  return "saved";
}
