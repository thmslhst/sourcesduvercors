/**
 * French message catalog — UI is French-first (ARCHITECTURE.md).
 * No i18n library yet: a typed catalog module keeps every user-facing
 * string out of components, so adding English later is mechanical.
 * Terminology follows the DOMAIN.md glossary.
 */

import type {
  Confidence,
  DisplayStatus,
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
  disputedBy: (n: number) =>
    n === 1 ? "contesté par 1 randonneur" : `contesté par ${n} randonneurs`,

  recentObservations: "Observations récentes",
  loadingObservations: "Chargement des observations…",
  yourObservation: "votre observation",
  confirm: "Confirmer",
  dispute: "Signaler obsolète",
  reactionFailed: "Impossible d’enregistrer votre avis. Réessayez.",

  reportTitle: "Signaler l’état actuel",
  commentPlaceholder: "Commentaire (facultatif)",
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
  reactionQueued:
    "Avis enregistré hors ligne — envoi automatique au retour du réseau.",

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
    "Pour celles et ceux qui marchent dans le Vercors — randonnée à la journée, bivouac, trail — et qui doivent savoir si une source coule encore avant de compter dessus. L’app fonctionne sans réseau : c’est justement là-haut qu’on n’en a pas.",

  aboutHowTitle: "Comment ça marche ?",
  aboutHowSteps: [
    "Touchez un point sur la carte pour voir l’état de la source, sa fiabilité et les dernières observations.",
    "La couleur donne le débit constaté ; l’indice de confiance dit à quel point l’information est fraîche et corroborée. Un statut ancien perd automatiquement en confiance.",
    "Sur place, signalez ce que vous voyez en deux touches. Confirmez ou contestez l’observation la plus récente si elle ne correspond plus.",
    "Sans réseau, tout est enregistré sur le téléphone et part tout seul au retour de la connexion. Téléchargez le fond de carte avant de partir pour garder la carte lisible hors ligne.",
  ],

  aboutParticipateTitle: "Participer",
  aboutParticipate:
    "Le projet est open source et vit de ses contributions. Sur le terrain, chaque observation — même « à sec » — rend la carte plus utile pour la personne suivante. Côté code, les idées, retours et pull requests sont les bienvenus.",
  aboutRepoLink: "Le projet sur GitHub",
  aboutAuthor: "Développé et porté par Thomas Lhoest.",

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
