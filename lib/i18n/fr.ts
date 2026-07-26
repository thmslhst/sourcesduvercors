/**
 * French message catalog — UI is French-first (ARCHITECTURE.md).
 * No i18n library yet: a typed catalog module keeps every user-facing
 * string out of components, so adding English later is mechanical.
 * Terminology follows the DOMAIN.md glossary.
 */

import type { DisplayStatus, SourceType } from "../domain/constants";

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

  /** Phase 1 placeholder: everything is `unknown` until observations exist. */
  noObservationYet:
    "Aucune observation pour le moment. Bientôt, les randonneurs pourront signaler l’état de cette source.",

  elevation: (m: number) => `${m.toLocaleString("fr-FR")} m`,

  /** Potability is a property of the source, never certified (DOMAIN.md). */
  potabilityDisclaimer:
    "La potabilité n’est jamais garantie — traitez l’eau en cas de doute.",
} as const;

export type Messages = typeof fr;
