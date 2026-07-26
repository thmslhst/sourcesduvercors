"use client";

/**
 * The ≤3-tap report flow (PRODUCT_PRINCIPLES.md): source is already open,
 * so — tap a status, tap send. Comment stays optional and out of the way.
 */

import { useState } from "react";

import {
  OBSERVATION_STATUSES,
  type ObservationStatus,
} from "@/lib/domain/constants";
import { STATUS_COLORS } from "@/lib/domain/display";
import { COMMENT_MAX_LENGTH } from "@/lib/domain/observation-input";
import { fr } from "@/lib/i18n/fr";

type Phase = "idle" | "sending" | "saved" | "error";

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
    try {
      const res = await fetch("/api/v1/observations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          sourceId,
          status,
          comment: comment.trim() || undefined,
          observedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPhase("saved");
      setStatus(null);
      setComment("");
      onSaved();
    } catch {
      setPhase("error");
    }
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
              if (phase === "saved" || phase === "error") setPhase("idle");
            }}
            aria-pressed={status === s}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
              status === s
                ? "border-neutral-900 bg-neutral-100 font-semibold dark:border-neutral-100 dark:bg-neutral-800"
                : "border-neutral-300 dark:border-neutral-600"
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
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          />
          <button
            type="button"
            onClick={submit}
            disabled={phase === "sending"}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {phase === "sending" ? fr.sending : fr.send}
          </button>
        </>
      )}

      {phase === "saved" && (
        <p className="text-sm text-green-700 dark:text-green-400">
          {fr.observationSaved}
        </p>
      )}
      {phase === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {fr.observationFailed}
        </p>
      )}
    </div>
  );
}
