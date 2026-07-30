"use client";

/**
 * The signed-in footer of the source sheet: who you are, sign out, and
 * delete the account.
 *
 * Deletion confirms inline rather than through window.confirm — a system
 * dialog in a PWA is easy to dismiss by accident and impossible to word.
 * The copy states plainly what survives (honesty principle): the account is
 * anonymised, the observations stay on the map.
 *
 * Offline: requires connectivity. A failed request surfaces an error instead
 * of going to the outbox — the outbox is for field observations, and quietly
 * destroying an account on reconnect is not a behaviour to queue.
 */

import { useState } from "react";

import { signOut } from "@/lib/auth-client";
import { clearSessionMirror } from "@/lib/offline/session";
import { fr } from "@/lib/i18n/fr";

type Phase = "idle" | "confirming" | "deleting" | "error";

export default function AccountActions({ email }: { email: string }) {
  const [phase, setPhase] = useState<Phase>("idle");

  const deleteAccount = async () => {
    setPhase("deleting");
    try {
      const res = await fetch("/api/v1/account", { method: "DELETE" });
      if (!res.ok) {
        setPhase("error");
        return;
      }
    } catch {
      setPhase("error");
      return;
    }
    // The session row is already gone server-side; drop the local mirror so
    // the app can't fall back to it, then reload into the signed-out state.
    clearSessionMirror();
    location.reload();
  };

  return (
    <div className="flex flex-col gap-1 text-xs text-secondary/75">
      <p>
        {fr.signedInAs(email)}{" "}
        <button
          type="button"
          onClick={() => void signOut()}
          className="font-semibold underline"
        >
          {fr.signOut}
        </button>
      </p>

      {phase === "confirming" || phase === "deleting" ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-secondary/40 p-2">
          <p>{fr.deleteAccountExplainer}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void deleteAccount()}
              disabled={phase === "deleting"}
              className="rounded-full border border-secondary/50 px-3 py-1 font-semibold text-secondary disabled:opacity-50"
            >
              {phase === "deleting"
                ? fr.deleteAccountPending
                : fr.deleteAccountConfirm}
            </button>
            <button
              type="button"
              onClick={() => setPhase("idle")}
              disabled={phase === "deleting"}
              className="rounded-full px-3 py-1 underline disabled:opacity-50"
            >
              {fr.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPhase("confirming")}
          className="self-start underline"
        >
          {fr.deleteAccount}
        </button>
      )}

      {phase === "error" && (
        <p className="font-medium text-red-200">{fr.deleteAccountFailed}</p>
      )}
    </div>
  );
}
