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
  namePlaceholder: "Nom affiché (ex. « Rando26 »)",
  sendMagicLink: "Recevoir le lien de connexion",
  magicLinkSent: "Lien envoyé ! Ouvrez l’e-mail sur cet appareil.",
  magicLinkFailed: "Impossible d’envoyer le lien. Vérifiez l’adresse.",
  signedInAs: (name: string) => `Connecté·e : ${name}`,
  signOut: "Se déconnecter",

  elevation: (m: number) => `${m.toLocaleString("fr-FR")} m`,

  /** Potability is a property of the source, never certified (DOMAIN.md). */
  potabilityDisclaimer:
    "La potabilité n’est jamais garantie — traitez l’eau en cas de doute.",
} as const;

export type Messages = typeof fr;
