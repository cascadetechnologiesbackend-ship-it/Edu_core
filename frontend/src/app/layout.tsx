import type { Metadata, Viewport } from "next";
import "./globals.css";

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
  metadataBase: new URL(
    process.env["NEXT_PUBLIC_APP_URL"] ?? "https://schoolmitra.in",
  ),
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "SchoolMitra ERP",
  },
  robots: {
    index: false, // ERP — not for search engine indexing
    follow: false,
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

import { Providers } from "@/components/providers/Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
