import type { Metadata, Viewport } from "next";
import "./globals.css";

function getMetadataBase(): URL {
  const rawUrl = process.env["NEXT_PUBLIC_APP_URL"] || process.env["VERCEL_URL"];
  if (!rawUrl || rawUrl.trim() === "") {
    return new URL("https://schoolmitra.in");
  }
  try {
    const formatted = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    return new URL(formatted);
  } catch {
    return new URL("https://schoolmitra.in");
  }
}

export const metadata: Metadata = {
  title: {
    default: "SchoolMitra ERP",
    template: "%s | SchoolMitra ERP",
  },
  description:
    "Smart School Management for Every Indian Classroom — Nursery to Class 10. DPDP Act 2023 Compliant.",
  keywords: [
    "school management",
    "ERP",
    "CBSE",
    "ICSE",
    "DPDP",
    "school software",
    "Indian school",
    "student management",
  ],
  authors: [{ name: "SchoolMitra" }],
  creator: "SchoolMitra ERP",
  metadataBase: getMetadataBase(),
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "SchoolMitra ERP",
  },
  robots: {
    index: false, // ERP — not for search engine indexing
    follow: false,
  },
  icons: {
    icon: "/icon.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SchoolMitra",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e40af" },
    { media: "(prefers-color-scheme: dark)", color: "#172554" },
  ],
};

import { Inter } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import { Suspense } from "react";
import { TopProgressBar } from "@/components/layout/TopProgressBar";
import { ClarityScript } from "@/components/analytics/ClarityScript";
import { PwaManager } from "@/components/pwa/PwaManager";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
  variable: "--font-inter",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className={`min-h-screen bg-background antialiased ${inter.className}`}>
        <Providers>
          <Suspense fallback={null}>
            <TopProgressBar />
            <ClarityScript />
          </Suspense>
          <PwaManager />
          {children}
        </Providers>
      </body>
    </html>
  );
}
