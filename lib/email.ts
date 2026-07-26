/**
 * Magic-link email delivery. With RESEND_API_KEY set, sends through the
 * Resend HTTP API (no SDK dependency); without it — local dev — the link
 * is printed to the server console instead.
 */

const FROM_FALLBACK = "Sources du Vercors <onboarding@resend.dev>";

export async function sendMagicLinkEmail(
  to: string,
  url: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[auth] Lien de connexion pour ${to} : ${url}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? FROM_FALLBACK,
      to: [to],
      subject: "Connexion à Sources du Vercors",
      text: `Bonjour,\n\nCliquez sur ce lien pour vous connecter à Sources du Vercors :\n${url}\n\nCe lien expire rapidement. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend a répondu ${res.status}: ${await res.text()}`);
  }
}
