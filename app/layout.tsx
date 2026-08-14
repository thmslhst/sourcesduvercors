import type { Metadata, Viewport } from "next";
import { Geist, Maname } from "next/font/google";
import "./globals.css";

import PWARegister from "@/components/PWARegister";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Main titles only (style guide) — Maname ships regular weight only.
const maname = Maname({
  variable: "--font-maname",
  weight: "400",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4D794E",
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sourcesduvercors.fr";
const DESCRIPTION =
  "Les sources d'eau du Vercors : coulent-elles ? Observations partagées par les randonneurs.";

export const metadata: Metadata = {
  // Makes the relative opengraph-image URL absolute, which every unfurler
  // requires; also anchors the canonical link on the www host the apex
  // redirects to.
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  title: "Sources du Vercors",
  description: DESCRIPTION,
  // app/opengraph-image.tsx fills og:image and twitter:image alike; only the
  // card type has to be declared, or X unfurls to a thumbnail.
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Sources du Vercors",
    title: "Sources du Vercors",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sources du Vercors",
    description: DESCRIPTION,
  },
  // favicon.ico / icon0.svg / icon1.png / apple-icon.png in app/ are
  // auto-linked by Next — no manual `icons` entry needed.
  // iOS has no install prompt; these make "Add to Home Screen" behave.
  appleWebApp: { capable: true, title: "Sources du Vercors" },
  // iOS data detectors turn plain text into links (the signed-in e-mail became
  // a mailto:, and relative dates are candidates too). Nothing here is meant
  // to be tappable, so opt the whole document out.
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
    date: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${maname.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PWARegister />
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
