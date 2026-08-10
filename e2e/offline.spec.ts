/**
 * ROADMAP Phase 3 exit criteria, as one scenario: a phone in airplane mode
 * can browse sources with statuses and queue an observation that syncs
 * later. "Airplane mode" is real here — the server process is killed, so
 * page fetches AND service-worker fetches fail alike.
 *
 * Requires a production build with NEXT_PUBLIC_E2E=1 (the __selectSource
 * hook) — `npm run test:e2e` does both.
 */

import { test, expect, type Page } from "@playwright/test";

import { fr } from "../lib/i18n/fr";
import { cleanupE2eUser } from "./db";
import { AppServer, loadDotEnv } from "./helpers";

const PORT = 3210;
const E2E_EMAIL = "e2e-offline@sources-du-vercors.test";
/** Second scenario signs in only at the end — its own user, its own cleanup. */
const E2E_DEFERRED_EMAIL = "e2e-deferred@sources-du-vercors.test";
/** The two scenarios about refused contributions. */
const E2E_BLOCKED_EMAIL = "e2e-blocked@sources-du-vercors.test";
const E2E_OWN_EMAIL = "e2e-own@sources-du-vercors.test";

const EMAILS = [
  E2E_EMAIL,
  E2E_DEFERRED_EMAIL,
  E2E_BLOCKED_EMAIL,
  E2E_OWN_EMAIL,
];

let server: AppServer;

test.beforeAll(async () => {
  loadDotEnv();
  // Leftovers from an aborted run.
  for (const email of EMAILS) await cleanupE2eUser(email);
  server = new AppServer(PORT);
  await server.start();
});

test.afterAll(async () => {
  await server.stop();
  for (const email of EMAILS) await cleanupE2eUser(email);
});

/** Drive selection through the e2e hook — no flaky canvas-pixel clicks. */
async function selectSource(page: Page, id: string | null): Promise<void> {
  await page.waitForFunction(() => "__selectSource" in window);
  await page.evaluate(
    (sourceId) =>
      (
        window as unknown as {
          __selectSource: (id: string | null) => void;
        }
      ).__selectSource(sourceId),
    id,
  );
}

/** Magic-link sign-in, from wherever the form currently is on screen. */
async function signIn(page: Page, email: string): Promise<void> {
  await page.getByPlaceholder("Votre e-mail").fill(email);
  await page.getByRole("button", { name: /Recevoir le lien/ }).click();
  const link = await server.waitForLog(/Lien de connexion pour \S+ : (http\S+)/);
  await page.goto(link[1]); // verifies the token, redirects to /
}

/** Polled via waitForFunction: is the sources snapshot persisted locally? */
const snapshotInIdb = () =>
  new Promise<boolean>((resolve) => {
    const req = indexedDB.open("sdv-offline");
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("snapshot")) {
        db.close();
        resolve(false);
        return;
      }
      const get = db
        .transaction("snapshot")
        .objectStore("snapshot")
        .get("current");
      get.onsuccess = () => {
        db.close();
        resolve(get.result != null);
      };
      get.onerror = () => {
        db.close();
        resolve(false);
      };
    };
    req.onerror = () => resolve(false);
  });

test("mode avion : consulter, signaler, reconnecter, synchroniser", async ({
  page,
}) => {
  // --- Online first visit: SW installs the app shell, snapshot lands in IDB.
  await page.goto(server.baseURL);
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForFunction(snapshotInIdb, undefined, { timeout: 15_000 });

  // A real source to act on (the snapshot is the source of truth).
  const res = await page.request.get(`${server.baseURL}/api/v1/sources`);
  const snapshot = (await res.json()) as { sources: { id: string }[] };
  const sourceId = snapshot.sources[0].id;

  // --- Magic-link sign-in; without RESEND_API_KEY the link goes to stdout.
  // The sheet leads with the report form now, so signing in proactively goes
  // through the quiet "se connecter" link rather than an inline form.
  await selectSource(page, sourceId);
  await page.getByRole("button", { name: fr.signInAction }).click();
  // Email is the only field — no display name is collected or stored.
  await signIn(page, E2E_EMAIL);
  await selectSource(page, sourceId);
  await expect(page.getByText(/Signaler l.état actuel/)).toBeVisible();
  // Session mirror + snapshot must both be persisted before going dark.
  await page.waitForFunction(
    () => localStorage.getItem("sdv-session-user") !== null,
  );
  await page.waitForFunction(snapshotInIdb);

  // --- Download the basemap for offline use: size is shown *before* the
  // download starts (ROADMAP Phase 3), then the archive lands in Cache
  // Storage. Close the sheet first — it covers the corner button on mobile.
  await selectSource(page, null);
  await page.getByRole("button", { name: "Carte hors ligne" }).click();
  const downloadButton = page.getByRole("button", { name: /^Télécharger \(\d+ Mo\)$/ });
  await expect(downloadButton).toBeVisible();
  await downloadButton.click();
  await expect(page.getByText(/Fond de carte disponible hors ligne/)).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("button", { name: "Carte hors ligne" }).click(); // close

  // --- Airplane mode.
  await server.stop();
  await page.reload();

  // The service worker serves the downloaded archive to MapLibre's Range
  // requests even with the server gone.
  const rangeStatus = await page.evaluate(async () => {
    const res = await fetch("/basemap/vercors.pmtiles", {
      headers: { Range: "bytes=0-16383" },
    });
    return res.status;
  });
  expect(rangeStatus).toBe(206);

  // Shell and data render from cache — and say so honestly. The killed
  // server leaves navigator.onLine true, so the banner is the
  // "unreachable while online" wording, not "Hors ligne".
  // The app name is the logo's accessible name, not page text — matching on
  // text silently stopped finding anything when the <h1> became an SVG.
  await expect(
    page.getByRole("heading", { name: fr.appName, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText(/Impossible d’actualiser — données/),
  ).toBeVisible();

  // The about card is help content — it has to open with zero connectivity,
  // wordmark included (the SVG is precached by hand in public/sw.js).
  await page.getByRole("button", { name: fr.aboutButton }).click();
  const wordmark = page
    .getByRole("region", { name: fr.aboutButton })
    .getByRole("img", { name: fr.appName });
  await expect(wordmark).toBeVisible();
  expect(
    await wordmark.evaluate((el) => (el as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  await page
    .getByRole("region", { name: fr.aboutButton })
    .getByRole("button", { name: fr.close })
    .click();

  // Browse offline, then queue an observation (form still there thanks to
  // the mirrored session).
  await selectSource(page, sourceId);
  await page.getByRole("button", { name: "Coule bien" }).click();
  // Tags ride in the same outbox body — assert one survives the round trip.
  await page.getByRole("button", { name: fr.tag.hard_to_find }).click();
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(page.getByText(/Enregistrée hors ligne/)).toBeVisible();
  await expect(page.getByText("1 contribution à envoyer")).toBeVisible();

  // --- Reconnect: app focus is a sync trigger (the iOS-safe one).
  await server.start();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText(/contribution(s)? à envoyer/)).toHaveCount(0, {
    timeout: 30_000,
  });

  // The observation is really on the server: history shows it as ours,
  // and the staleness indicator is gone after the post-sync re-fetch.
  await selectSource(page, null);
  await selectSource(page, sourceId);
  await expect(page.getByText("votre observation")).toBeVisible();
  // The chip itself, not the observation row that contains its text.
  await expect(
    page.getByText(fr.tag.hard_to_find, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/— données/)).toHaveCount(0);

  // --- Retract it again: the author can undo their own mis-tap (the network
  // is back, which retraction requires).
  await page.getByRole("button", { name: fr.retract, exact: true }).click();
  await page.getByRole("button", { name: fr.retractConfirm }).click();
  await expect(page.getByText("votre observation")).toHaveCount(0);
});

/**
 * The signed-out hiker already on the plateau. Magic-link sign-in needs both
 * the network and a mail round-trip, so it cannot happen in the field —
 * capture is therefore unauthenticated and local, and the session is owed at
 * flush time (ARCHITECTURE.md § Write path offline).
 */
test("hors ligne sans compte : capturer maintenant, se connecter au retour", async ({
  page,
}) => {
  // --- Online first visit, deliberately WITHOUT signing in. Reaching the app
  // offline at all implies this visit happened (shell + snapshot come from it).
  await page.goto(server.baseURL);
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForFunction(snapshotInIdb, undefined, { timeout: 15_000 });
  expect(
    await page.evaluate(() => localStorage.getItem("sdv-session-user")),
  ).toBeNull();

  const res = await page.request.get(`${server.baseURL}/api/v1/sources`);
  const snapshot = (await res.json()) as { sources: { id: string }[] };
  const sourceId = snapshot.sources[0].id;

  // Online and signed out: the form is still the default view. Connectivity
  // must not change what the sheet offers — the sign-in is asked at send
  // time, after the taps are spent, never before them.
  await selectSource(page, sourceId);
  await expect(page.getByText(/Signaler l.état actuel/)).toBeVisible();
  await expect(page.getByPlaceholder("Votre e-mail")).toHaveCount(0);
  await selectSource(page, null);

  // --- Airplane mode, still signed out.
  await server.stop();
  await page.reload();

  // The regression this whole flow exists to prevent: the report form must be
  // there. Before, the sheet showed a sign-in form that cannot be completed
  // without a network — a dead end.
  await selectSource(page, sourceId);
  await expect(page.getByText(fr.contributeOfflineTitle)).toBeVisible();
  await expect(page.getByText(/Signaler l.état actuel/)).toBeVisible();

  await page.getByRole("button", { name: "Coule bien" }).click();
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();
  // Honest copy: on this device, not "sent" — and it names the deadline.
  // The badge says what is actually true straight away: this one is waiting
  // on a sign-in, not on the network. Waiting for a flush to prove it would
  // promise automatic delivery for up to a minute.
  await expect(page.getByText(/Enregistrée sur cet appareil/)).toBeVisible();
  const signInPill = page.getByRole("button", {
    name: fr.pendingNeedSignIn(1),
  });
  await expect(signInPill).toBeVisible();

  // --- Reconnect. The replay 401s, which no retry can ever clear, so the
  // badge must stay a way in rather than spinning forever.
  await server.start();
  await selectSource(page, null);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(signInPill).toBeVisible({ timeout: 30_000 });

  // --- Sign in from the prompt; the queue drains on its own afterwards.
  await signInPill.click();
  await signIn(page, E2E_DEFERRED_EMAIL);

  // Sync runs at app start: the observation captured while signed out is now
  // attributed to the account that claimed it.
  await expect(page.getByText(/contribution(s)? (à envoyer|en attente)/)).toHaveCount(
    0,
    { timeout: 30_000 },
  );
  await selectSource(page, sourceId);
  await expect(page.getByText("votre observation")).toBeVisible();
});

/**
 * The same rule with full bars: connectivity does not decide whether the form
 * is shown. A 401 keeps the observation and asks for the session, instead of
 * spending the hiker's taps and answering "Échec de l'envoi".
 */
test("en ligne sans compte : l’observation est gardée, la connexion est demandée après", async ({
  page,
}) => {
  await page.goto(server.baseURL);
  await page.waitForFunction(snapshotInIdb, undefined, { timeout: 15_000 });

  const res = await page.request.get(`${server.baseURL}/api/v1/sources`);
  const snapshot = (await res.json()) as { sources: { id: string }[] };
  await selectSource(page, snapshot.sources[0].id);

  await page.getByRole("button", { name: "Coule bien" }).click();
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();

  // Kept, not lost — and the prompt opens on its own, at the moment the
  // hiker is most invested.
  await expect(page.getByText(/Enregistrée sur cet appareil/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: fr.pendingNeedSignIn(1) }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: fr.signInToSendTitle }),
  ).toBeVisible();
});

/**
 * The bug this pair of scenarios exists to prevent, from both ends.
 *
 * `GET /api/v1/sources/:id` answers `isMine` from the session, so a
 * signed-out sheet was told `false` for every observation — including the
 * hiker's own. It offered "Confirmer", the tap queued behind the missing
 * session, and the sign-in that was supposed to *send* the queue instead
 * got the whole thing refused with `own_observation`.
 */
test("déconnecté : sa propre observation n’est pas proposée à la confirmation", async ({
  page,
}) => {
  await page.goto(server.baseURL);
  await page.waitForFunction(snapshotInIdb, undefined, { timeout: 15_000 });

  const res = await page.request.get(`${server.baseURL}/api/v1/sources`);
  const snapshot = (await res.json()) as { sources: { id: string }[] };
  const sourceId = snapshot.sources[0].id;

  // Sign in and file an observation of our own.
  await selectSource(page, sourceId);
  await page.getByRole("button", { name: fr.signInAction }).click();
  await signIn(page, E2E_OWN_EMAIL);
  await selectSource(page, sourceId);
  await page.getByRole("button", { name: "Coule bien" }).click();
  await page.getByRole("button", { name: "Envoyer", exact: true }).click();
  await expect(page.getByText(fr.observationSaved)).toBeVisible();

  // Sign out: the server can no longer say whose observation that is, but
  // this device still knows it wrote it.
  await page.getByRole("button", { name: fr.signOut }).click();
  await page.waitForTimeout(1_000);
  await page.reload();
  await selectSource(page, sourceId);

  // The report form is still the default view for everyone (the promise of
  // the deferred-auth flow) — only the impossible tap is withheld.
  await expect(page.getByText(/Signaler l.état actuel/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(fr.confirm) }),
  ).toHaveCount(0);
  await expect(page.getByText(/contribution/)).toHaveCount(0);
});

/**
 * And when a write really is refused — here a source that no longer exists,
 * which is terminal — it stays on the device. The old behaviour reported
 * "1 contribution n’a pas pu être envoyée" over a single "Ignorer" that
 * deleted it: a loss announced after the fact, with no way to inspect or
 * act on it.
 */
test("une contribution refusée reste sur l’appareil jusqu’à décision", async ({
  page,
}) => {
  await page.goto(server.baseURL);
  await page.waitForFunction(snapshotInIdb, undefined, { timeout: 15_000 });

  const res = await page.request.get(`${server.baseURL}/api/v1/sources`);
  const snapshot = (await res.json()) as { sources: { id: string }[] };
  await selectSource(page, snapshot.sources[0].id);
  await page.getByRole("button", { name: fr.signInAction }).click();
  await signIn(page, E2E_BLOCKED_EMAIL);

  // An observation of a source the server has never heard of — the shape a
  // terminal refusal takes without waiting a week for one to go stale.
  await page.evaluate(() => {
    const item = {
      kind: "observation",
      id: crypto.randomUUID(),
      enqueuedAt: new Date().toISOString(),
      body: {
        id: crypto.randomUUID(),
        sourceId: crypto.randomUUID(), // no such source
        status: "dry",
        observedAt: new Date().toISOString(),
      },
    };
    item.body.id = item.id;
    return new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("sdv-offline");
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("outbox", "readwrite");
        tx.objectStore("outbox").put(item);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  });
  await page.reload();

  // Refused, and *kept*: the pill leads to the contribution, not to a way
  // of making it disappear.
  const pill = page.getByRole("button", { name: fr.blockedPill(1) });
  await expect(pill).toBeVisible({ timeout: 30_000 });

  // It survives a restart — this is storage, not a toast.
  await page.reload();
  await expect(pill).toBeVisible({ timeout: 30_000 });

  await pill.click();
  const sheet = page.getByRole("region", { name: fr.blockedTitle });
  await expect(sheet.getByText(fr.status.dry)).toBeVisible();
  await expect(sheet.getByText(fr.blockedReason.rejected)).toBeVisible();

  // Deleting is explicit, per contribution, with the reason on screen.
  await sheet.getByRole("button", { name: fr.blockedDelete }).click();
  await expect(sheet.getByText(fr.blockedEmpty)).toBeVisible();
  await sheet.getByRole("button", { name: fr.close }).click();
  await expect(page.getByText(/contribution/)).toHaveCount(0);
});
