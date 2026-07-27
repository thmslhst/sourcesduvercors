"use client";

/**
 * The ≤3-tap report flow (PRODUCT_PRINCIPLES.md): source is already open,
 * so — tap a status, tap send. Comment stays optional and out of the way.
 *
 * Offline (ARCHITECTURE.md § Write path): when the network is unreachable
 * the observation goes to the IndexedDB outbox with its client UUID and
 * `observedAt` = now, and lib/offline/sync replays it later.
 */

import { useState } from "react";

import {
  OBSERVATION_STATUSES,
  type ObservationStatus,
} from "@/lib/domain/constants";
import { STATUS_COLORS } from "@/lib/domain/display";
import { COMMENT_MAX_LENGTH } from "@/lib/domain/observation-input";
import { enqueueOutbox } from "@/lib/offline/outbox";
import { fr } from "@/lib/i18n/fr";

type Phase = "idle" | "sending" | "saved" | "queued" | "error";

interface ObservationFormProps {
  sourceId: string;
  /** Called after a successful save so detail + map refresh. */
  onSaved: () => void;
}

export default function ObservationForm({
  sourceId,
  onSaved,
}: ObservationFormProps) {
  const [status, setStatus] = useState<ObservationStatus | null>(null);
  const [comment, setComment] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");

  const submit = async () => {
    if (!status) return;
    setPhase("sending");
    const body = {
      id: crypto.randomUUID(),
      sourceId,
      status,
      comment: comment.trim() || undefined,
      // When the hiker is at the source — distinct from server receipt time.
      observedAt: new Date().toISOString(),
    };
    let res: Response;
    try {
      res = await fetch("/api/v1/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // Network unreachable → outbox; sync replays it (idempotent by UUID).
      try {
        await enqueueOutbox({
          kind: "observation",
          id: body.id,
          enqueuedAt: new Date().toISOString(),
          body,
        });
        setPhase("queued");
        setStatus(null);
        setComment("");
      } catch {
        setPhase("error");
      }
      return;
    }
    if (!res.ok) {
      // Server reached but refused (signed out, invalid…) — queueing
      // wouldn't help; surface the failure.
      setPhase("error");
      return;
    }
    setPhase("saved");
    setStatus(null);
    setComment("");
    onSaved();
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{fr.reportTitle}</p>
      <div className="grid grid-cols-2 gap-2">
        {OBSERVATION_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setStatus(s);
              if (phase !== "idle" && phase !== "sending") setPhase("idle");
            }}
            aria-pressed={status === s}
            className={`flex items-center gap-2 rounded-lg border border-secondary px-3 py-2 text-sm ${
              status === s
                ? "bg-secondary font-semibold text-primary"
                : "border-secondary/50 text-secondary"
            }`}
          >
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[s] }}
            />
            {fr.status[s]}
          </button>
        ))}
      </div>

      {status !== null && (
        <>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={fr.commentPlaceholder}
            maxLength={COMMENT_MAX_LENGTH}
            className="rounded-lg border border-secondary/50 bg-transparent px-3 py-2 text-sm text-secondary placeholder:text-secondary/60"
          />
          <button
            type="button"
            onClick={submit}
            disabled={phase === "sending"}
            className="rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50"
          >
            {phase === "sending" ? fr.sending : fr.send}
          </button>
        </>
      )}

      {phase === "saved" && (
        <p className="text-sm font-medium text-secondary">
          {fr.observationSaved}
        </p>
      )}
      {phase === "queued" && (
        <p className="text-sm text-secondary/80">{fr.observationQueued}</p>
      )}
      {phase === "error" && (
        <p className="text-sm font-medium text-red-200">
          {fr.observationFailed}
        </p>
      )}
    </div>
  );
}
