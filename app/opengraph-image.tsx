import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { STATUS_COLORS } from "@/lib/domain/display";
import { fr } from "@/lib/i18n/fr";

/**
 * Social preview card. Every link to the app outside a browser — forum post,
 * messaging app, park mailing list — is unfurled from this image, so it has
 * to answer "what is this?" without the page ever loading.
 *
 * The legend is built from STATUS_COLORS and the message catalog rather than
 * retyped: the card a stranger sees first must use the same four colors and
 * the same four words as the map they land on (DOMAIN.md § Status scale).
 */

export const alt =
  "Sources du Vercors — la carte des sources d’eau et de leur état";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND_GREEN = "#4D794E";
const OFF_WHITE = "#FAFAFA";

/** The wordmark is already off-white on transparent — it sits straight on the green. */
const wordmark = `data:image/svg+xml;base64,${readFileSync(
  join(process.cwd(), "public", "logo-big.svg"),
).toString("base64")}`;

/** Ordered driest-last, the way the scale reads in DOMAIN.md. */
const LEGEND = ["flowing", "low_flow", "dripping", "dry"] as const;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 48,
          background: BRAND_GREEN,
          color: OFF_WHITE,
          padding: 64,
        }}
      >
        <img src={wordmark} alt="" width={504} height={270} />

        {/* Two deliberate lines: the question the app exists to answer, then
            how. One long sentence wraps at whatever width the renderer picks,
            which broke mid-clause. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", fontSize: 44 }}>Coulent-elles ?</div>
          <div style={{ display: "flex", fontSize: 28, opacity: 0.85 }}>
            Les observations des randonneurs, même hors ligne.
          </div>
        </div>

        <div style={{ display: "flex", gap: 40 }}>
          {LEGEND.map((status) => (
            <div
              key={status}
              style={{ display: "flex", alignItems: "center", gap: 12 }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  background: STATUS_COLORS[status],
                  border: `3px solid ${OFF_WHITE}`,
                }}
              />
              <div style={{ display: "flex", fontSize: 26, opacity: 0.9 }}>
                {fr.status[status]}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
