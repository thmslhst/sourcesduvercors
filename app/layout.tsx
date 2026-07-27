import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

import PWARegister from "@/components/PWARegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4D794E",
};

export const metadata: Metadata = {
  title: "Sources du Vercors",
  description:
    "Les sources d'eau du Vercors : coulent-elles ? Observations partagées par les randonneurs.",
  // favicon.ico / icon0.svg / icon1.png / apple-icon.png in app/ are
  // auto-linked by Next — no manual `icons` entry needed.
  // iOS has no install prompt; these make "Add to Home Screen" behave.
  appleWebApp: { capable: true, title: "Sources du Vercors" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
