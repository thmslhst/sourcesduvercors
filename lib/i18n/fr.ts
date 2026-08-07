/**
 * French message catalog — UI is French-first (ARCHITECTURE.md).
 * No i18n library yet: a typed catalog module keeps every user-facing
 * string out of components, so adding English later is mechanical.
 * Terminology follows the DOMAIN.md glossary.
 */

import type {
  Confidence,
  DisplayStatus,
  ObservationTag,
  SourceType,
} from "../domain/constants";

export const fr = {
  appName: "Sources du Vercors",
  loadingSources: "Chargement des sources…",
  loadError: "Impossible de charger les sources.",
  retry: "Réessayer",
  close: "Fermer",
  unnamedSource: "Source sans nom",

  sourceType: {
    spring: "Source naturelle",
    fountain: "Fontaine",
    drinking_water: "Eau potable",
    cistern: "Citerne",
    stream: "Ruisseau",
    other: "Autre point d’eau",
  } satisfies Record<SourceType, string>,

  status: {
    flowing: "Coule bien",
    low_flow: "Faible débit",
    dripping: "Goutte-à-goutte",
    dry: "À sec",
    unknown: "Statut inconnu",
  } satisfies Record<DisplayStatus, string>,

  /**
   * Closed vocabulary of observation details (DOMAIN.md § Observation).
   * Descriptive only — none of these affect the confidence model.
   */
  tag: {
    hard_to_find: "Difficile à trouver",
    hard_to_fill: "Difficile à remplir",
    out_of_order: "Hors service",
    cloudy_water: "Eau trouble",
  } satisfies Record<ObservationTag, string>,

  noObservationYet:
    "Aucune observation pour le moment. Soyez la première personne à signaler l’état de cette source.",

  confidence: {
    high: "Confiance élevée",
    medium: "Confiance moyenne",
    low: "Confiance faible",
    unknown: "Confiance inconnue",
  } satisfies Record<Confidence, string>,

  /** "il y a 3 jours" — relative time for observation facts lines. */
  timeAgo: (iso: string, now: Date = new Date()): string => {
    const minutes = Math.max(
      0,
      Math.round((now.getTime() - Date.parse(iso)) / 60_000),
    );
    if (minutes < 1) return "à l’instant";
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "hier";
    return `il y a ${days} jours`;
  },

  confirmedBy: (n: number) =>
    n === 1 ? "confirmé par 1 randonneur" : `confirmé par ${n} randonneurs`,

  recentObservations: "Observations récentes",
  loadingObservations: "Chargement des observations…",
  yourObservation: "votre observation",
  confirm: "Confirmer",

  /**
   * The one-tap prompt above the report form (components/SourcePrompt.tsx).
   * Inside the week it asks for a confirmation; past it, a confirmation can
   * no longer raise anything, so it asks for the same reading again with
   * today's date (DOMAIN.md § Confirmation).
   */
  sourcePromptTitle: "Toujours d’accord ?",
  sourcePromptClaim: (status: string, when: string) =>
    `Dernière observation : ${status}, ${when}.`,
  sourcePromptAlternative:
    "Si ce n’est plus le cas, signalez l’état actuel ci-dessous.",
  sourcePromptConfirmed: "Vous avez confirmé cette observation.",
  reobserveTitle: "C’est toujours le cas ?",
  reobserveExplainer:
    "Cette observation a plus d’une semaine : la confirmer n’y changerait plus rien. Si l’état est le même, réenregistrez-la en date d’aujourd’hui.",
  reobserve: "Oui, c’est toujours le cas",
  sourcePromptFailed: "Impossible d’enregistrer. Réessayez.",

  /** Author retraction of their own observation (soft-delete, never an edit). */
  retract: "Retirer",
  retractConfirmQuestion: "Retirer cette observation ?",
  retractConfirm: "Oui, retirer",
  retractFailed:
    "Impossible de retirer l’observation. Une connexion est nécessaire.",

  reportTitle: "Signaler l’état actuel",
  tagsTitle: "Précisions (facultatif)",
  send: "Envoyer",
  sending: "Envoi…",
  observationSaved: "Merci ! Observation enregistrée.",
  observationFailed: "Échec de l’envoi. Réessayez.",

  signInTitle: "Connectez-vous pour contribuer",
  signInIntro:
    "Un e-mail avec un lien de connexion vous sera envoyé — pas de mot de passe.",
  emailPlaceholder: "Votre e-mail",
  sendMagicLink: "Recevoir le lien de connexion",
  magicLinkSent: "Lien envoyé ! Ouvrez l’e-mail sur cet appareil.",
  magicLinkFailed: "Impossible d’envoyer le lien. Vérifiez l’adresse.",
  /** Shown to the signed-in person only — observations are published anonymously. */
  signedInAs: (email: string) => `Connecté·e : ${email}`,
  signOut: "Se déconnecter",
  cancel: "Annuler",

  deleteAccount: "Supprimer mon compte",
  /** Honesty principle: say exactly what goes and what stays. */
  deleteAccountExplainer:
    "Votre adresse e-mail sera effacée et vous serez déconnecté·e de tous vos appareils. Les observations que vous avez déjà envoyées restent sur la carte, sans aucun lien avec vous.",
  deleteAccountConfirm: "Supprimer définitivement",
  deleteAccountPending: "Suppression…",
  deleteAccountFailed:
    "Impossible de supprimer le compte. Vérifiez votre connexion et réessayez.",

  elevation: (m: number) => `${m.toLocaleString("fr-FR")} m`,

  // Offline (Phase 3) — honesty principle: always say when data is stale.
  dataAge: (iso: string, now?: Date) =>
    fr.timeAgo(iso, now).replace("à l’instant", "à jour"),
  offlineDataAsOf: (iso: string, now?: Date) =>
    `Hors ligne — données ${fr.dataAge(iso, now)}`,
  refreshFailedDataAsOf: (iso: string, now?: Date) =>
    `Impossible d’actualiser — données ${fr.dataAge(iso, now)}`,
  pendingContributions: (n: number) =>
    n === 1 ? "1 contribution à envoyer" : `${n} contributions à envoyer`,
  observationQueued:
    "Enregistrée hors ligne — envoi automatique au retour du réseau.",
  /** Same promise, for the sheet's one-tap prompt (confirm or re-observe). */
  sourcePromptQueued:
    "Enregistré hors ligne — envoi automatique au retour du réseau.",

  // Deferred auth: captured while signed out. Say plainly that the
  // observation is only on this phone, and that there is a deadline — the
  // server refuses an observation older than 7 days (honesty principle).
  // The preamble is offline-only: online, the sign-in prompt opens at send
  // time and explains itself, so the form needs no warning label.
  contributeOfflineTitle: "Vous n’êtes pas connecté·e",
  contributeOfflineIntro:
    "Pas de réseau ici : notez l’état de la source maintenant, elle sera conservée sur cet appareil. Vous vous connecterez au retour du réseau pour l’envoyer.",
  observationQueuedNeedsSignIn:
    "Enregistrée sur cet appareil. Connectez-vous dans les 7 jours pour l’envoyer — au-delà, l’observation sera trop ancienne.",
  pendingNeedSignIn: (n: number) =>
    n === 1
      ? "1 contribution en attente — connectez-vous"
      : `${n} contributions en attente — connectez-vous`,
  /** Low-key path for someone who wants to sign in without contributing. */
  signInPrompt: "Déjà un compte ?",
  signInAction: "Se connecter",
  signInToSendTitle: "Connectez-vous pour envoyer",
  signInToSendIntro: (n: number) =>
    n === 1
      ? "Votre contribution est enregistrée sur cet appareil. Connectez-vous pour l’envoyer."
      : `Vos ${n} contributions sont enregistrées sur cet appareil. Connectez-vous pour les envoyer.`,
  droppedTooOld: (n: number) =>
    n === 1
      ? "1 contribution n’a pas pu être envoyée : trop ancienne."
      : `${n} contributions n’ont pas pu être envoyées : trop anciennes.`,
  droppedOther: (n: number) =>
    n === 1
      ? "1 contribution n’a pas pu être envoyée."
      : `${n} contributions n’ont pas pu être envoyées.`,
  dismiss: "Ignorer",

  offlineMapButton: "Carte hors ligne",
  offlineMapTitle: "Carte hors ligne",
  offlineMapIntro: (size: string) =>
    `Téléchargez le fond de carte du Vercors (${size}) pour l’afficher sans réseau. Les sources et leurs statuts sont déjà conservés automatiquement.`,
  offlineMapIntroNoSize:
    "Téléchargez le fond de carte du Vercors pour l’afficher sans réseau. Les sources et leurs statuts sont déjà conservés automatiquement.",
  offlineMapDownload: (size: string) => `Télécharger (${size})`,
  offlineMapDownloadNoSize: "Télécharger",
  offlineMapDownloading: (pct: number) => `Téléchargement… ${pct} %`,
  offlineMapReady: (size: string) =>
    `Fond de carte disponible hors ligne (${size}).`,
  offlineMapDelete: "Supprimer",
  offlineMapNeedsNetwork:
    "Connexion requise pour télécharger le fond de carte.",
  offlineMapFailed: "Échec du téléchargement. Réessayez.",
  megabytes: (bytes: number) =>
    `${Math.max(1, Math.round(bytes / 1_000_000)).toLocaleString("fr-FR")} Mo`,

  /** Potability is a property of the source, never certified (DOMAIN.md). */
  potabilityDisclaimer:
    "La potabilité n’est jamais garantie — traitez l’eau en cas de doute.",

  aboutButton: "À propos",

  aboutForWhoTitle: "Pour qui ?",
  aboutForWho:
    "Pour celles et ceux qui marchent dans le Vercors — randonnée, trek, thru-hike, trail — et qui souhaitent connaître l'état d'une source. En effet, le Vercors est un massif karstique et il n'est pas rare l'été de tomber sur une source à sec. Lorsqu'on fait de l'itinérance sur plusieurs jours, savoir sur quels points d'eau on peut compter avant le départ (et une fois sur le terrain) est alors stratégique et vital.",

  aboutHowTitle: "Comment ça marche ?",
  aboutHowSteps: [
    "Touchez un point sur la carte pour voir l’état de la source et certaines observations additionnelles («difficile à trouver», «difficile à remplir», etc).",
    "La couleur donne le débit constaté. L’indice de confiance, quand à lui, dit à quel point l’information est fraîche et corroborée. Un statut ancien perd automatiquement en confiance.",
    "Sur place, signalez ce que vous voyez en deux touches. Confirmez l’observation la plus récente si elle correspond toujours — et si ce n’est plus le cas, signalez simplement l’état actuel.",
    "Si vous n'avez pas de réseau, aucun problème, vos observations sont enregistrées sur votre téléphone et sont synchronisées automatiquement au retour de la connexion.",
    "D'ailleurs, on se retrouve souvent sans réseau sur les Hauts-Plateaux. Pour y pallier, l'app intègre un mode hors-ligne, pensez à l'activer avant de partir !",
  ],

  aboutParticipateTitle: "Participer",
  aboutParticipate:
    "Le projet est open source et vit de ses contributions. Sur le terrain, chaque observation — même (et surtout) «à sec» — rend la carte plus utile pour la personne suivante. Côté code, les idées, retours et pull requests sont les bienvenus.",
  aboutRepoLink: "Le projet sur GitHub",
  aboutAuthor: "Développé et porté par Thomas Lhoest.",

  aboutMoreTitle: "Informations complémentaires",
  aboutContact:
    "Une question, une correction, une source manquante ? Écrivez-nous.",
  /**
   * The park publishes a hand-maintained table for a handful of sources.
   * Say plainly what each covers so the two read as complementary rather
   * than concurrent — the park is the reference, this app is the field view.
   */
  aboutPark:
    "Le Parc naturel régional du Vercors publie et met à jour l’état de quelques sources dans un tableau officiel. C’est une source de référence, vérifiée, mais limitée à quelques points et mise à jour ponctuellement. Cette app la complète : elle couvre toutes les sources du massif, en temps quasi réel, à partir de ce que les randonneurs constatent sur le terrain.",
  aboutParkLink: "Le site officiel du Parc du Vercors",

  aboutDataTitle: "Données & licences",
  /**
   * ODbL attribution, required on the map *and* on an about page
   * (DATA_SOURCES.md § Licensing). The map keeps the short form; the full
   * credit — including the basemap build — lives here.
   */
  aboutData:
    "Les points d’eau proviennent d’OpenStreetMap, sous licence ODbL. Fond de carte construit par Protomaps à partir des mêmes données. Les observations des randonneurs sont publiées ouvertement. Code sous licence MIT.",
  aboutOsmLink: "OpenStreetMap — droits d’auteur et licence",

  /**
   * Short always-visible credit in the map corner. The OSMF guideline asks
   * for attribution to "OpenStreetMap" plus the ODbL mention — the longer
   * "contributors" wording is one accepted form, not a requirement.
   */
  mapAttribution:
    '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a> — ODbL',
} as const;

export type Messages = typeof fr;
