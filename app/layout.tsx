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
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  title: "Sources du Vercors",
  description:
    "Les sources d'eau du Vercors : coulent-elles ? Observations partagées par les randonneurs.",
  icons: { apple: "/icons/apple-touch-icon.png" },
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
