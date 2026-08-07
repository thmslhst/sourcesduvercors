"use client";

/**
 * The ≤3-tap report flow (PRODUCT_PRINCIPLES.md): source is already open,
 * so — tap a status, tap send. Tags are optional extra taps that appear
 * only once a status is chosen, so the happy path keeps its budget.
 *
 * Offline (ARCHITECTURE.md § Write path): when the network is unreachable
 * the observation goes to the IndexedDB outbox with its client UUID and
 * `observedAt` = now, and lib/offline/sync replays it later.
 *
 * A missing session is handled the same way, online or off: auth gates the
 * flush, not the capture, so a 401 queues the observation and asks for the
 * sign-in *after* the taps are spent rather than gating the form behind one.
 */

import { useId, useState } from "react";

import {
  OBSERVATION_STATUSES,
  OBSERVATION_TAGS,
  type ObservationStatus,
  type ObservationTag,
} from "@/lib/domain/constants";
import { STATUS_COLORS } from "@/lib/domain/display";
import { submitObservation } from "@/lib/offline/submit-observation";
import { fr } from "@/lib/i18n/fr";

type Phase =
  | "idle"
  | "sending"
  | "saved"
  /** Queued behind the network; the replay carries the existing cookie. */
  | "queued"
  /** Queued behind a missing session; only a sign-in can send it. */
  | "queuedNeedsSignIn"
  | "error";

interface ObservationFormProps {
  sourceId: string;
  /** Called after a successful save so detail + map refresh. */
  onSaved: () => void;
  /**
   * No session: the queued observation needs one before it can be sent, so
   * promise that instead of automatic delivery. Known up front when offline;
   * discovered from a 401 when online.
   */
  deferredAuth?: boolean;
  /** Ask for the sign-in that would unblock what we just queued. */
  onNeedsSignIn?: () => void;
}

export default function ObservationForm({
  sourceId,
  onSaved,
  deferredAuth = false,
  onNeedsSignIn,
}: ObservationFormProps) {
  const [status, setStatus] = useState<ObservationStatus | null>(null);
  const [tags, setTags] = useState<ObservationTag[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const tagsLabelId = useId();

  const toggleTag = (tag: ObservationTag) =>
    setTags((current) =>
      current.includes(tag)
        ? current.filter((t) => t !== tag)
        : [...current, tag],
    );

  const submit = async () => {
    if (!status) return;
    setPhase("sending");
    const outcome = await submitObservation(
      {
        id: crypto.randomUUID(),
        sourceId,
        status,
        tags,
        // When the hiker is at the source — distinct from server receipt time.
        observedAt: new Date().toISOString(),
      },
      deferredAuth,
    );
    setPhase(outcome);
    if (outcome === "error") return;
    setStatus(null);
    setTags([]);
    if (outcome === "queuedNeedsSignIn") onNeedsSignIn?.();
    if (outcome === "saved") onSaved();
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
          {/* A labelled group rather than <fieldset>/<legend>: the legend is
              laid out inside the fieldset's border box, and engines disagree
              on how much room that leaves — WebKit left dead space under the
              chips that snapped away on the next relayout (a re-render from
              picking another status). A div groups the chips identically for
              assistive tech and lays out the same everywhere. */}
          <div
            role="group"
            aria-labelledby={tagsLabelId}
            className="flex flex-col gap-1.5"
          >
            <p id={tagsLabelId} className="text-xs text-secondary/75">
              {fr.tagsTitle}
            </p>
            {/* Two columns, echoing the status grid above: the four French
                labels can't fit on one line at 390pt, so the wrap is made
                deliberate instead of ragged. Kept lighter than the statuses
                (smaller text, shorter) — these are optional. */}
            <div className="grid grid-cols-2 gap-2">
              {OBSERVATION_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  aria-pressed={tags.includes(t)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    tags.includes(t)
                      ? "border-secondary bg-secondary text-primary"
                      : "border-secondary/50 text-secondary"
                  }`}
                >
                  {fr.tag[t]}
                </button>
              ))}
            </div>
          </div>
          {/* mt-1 lifts the container's 8px to the 12px the section separator
              already uses above the heading — the send button closes the
              block, so it gets the same breathing room that opens it. */}
          <button
            type="button"
            onClick={submit}
            disabled={phase === "sending"}
            className="mt-1 rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50"
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
      {phase === "queuedNeedsSignIn" && (
        <p className="text-sm text-secondary/80">
          {fr.observationQueuedNeedsSignIn}
        </p>
      )}
      {phase === "error" && (
        <p className="text-sm font-medium text-red-200">
          {fr.observationFailed}
        </p>
      )}
    </div>
  );
}
