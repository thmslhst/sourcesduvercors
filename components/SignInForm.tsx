"use client";

/**
 * Magic-link sign-in, inline in the source sheet: email (+ display name for
 * first-time accounts) → link lands in the inbox. No passwords (ARCHITECTURE.md).
 */

import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import { fr } from "@/lib/i18n/fr";

type Phase = "idle" | "sending" | "sent" | "error";

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");

  if (phase === "sent") {
    return (
      <p className="rounded-lg border border-secondary/40 bg-secondary/15 p-3 text-sm text-secondary">
        {fr.magicLinkSent}
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setPhase("sending");
        const { error } = await authClient.signIn.magicLink({
          email: email.trim(),
          name: name.trim() || undefined,
          callbackURL: "/",
        });
        setPhase(error ? "error" : "sent");
      }}
    >
      <p className="text-sm font-medium">{fr.signInTitle}</p>
      <p className="text-xs text-secondary/75">{fr.signInIntro}</p>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={fr.emailPlaceholder}
        autoComplete="email"
        className="rounded-lg border border-secondary/50 bg-transparent px-3 py-2 text-sm text-secondary placeholder:text-secondary/60"
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={fr.namePlaceholder}
        maxLength={40}
        className="rounded-lg border border-secondary/50 bg-transparent px-3 py-2 text-sm text-secondary placeholder:text-secondary/60"
      />
      <button
        type="submit"
        disabled={phase === "sending"}
        className="rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-primary disabled:opacity-50"
      >
        {phase === "sending" ? fr.sending : fr.sendMagicLink}
      </button>
      {phase === "error" && (
        <p className="text-sm font-medium text-red-200">
          {fr.magicLinkFailed}
        </p>
      )}
    </form>
  );
}
