import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/context/ThemeContext";
import QueryProvider from "@/context/QueryProvider";
import { GlobalLoadingProvider } from "@/context/GlobalLoadingContext";
import dynamic from "next/dynamic";
import "./globals.css";

const OfflineOverlay = dynamic(() => import("@/components/OfflineOverlay"));

/**
 * Only load Inter globally — it's the base body font used everywhere.
 *
 * Playfair Display, Outfit, and Roboto Slab are auth-page-only fonts.
 * They're loaded in (login|signup)/layout.tsx so they don't block
 * rendering on /dashboard or /chat routes.
 *
 * `display: 'swap'` ensures the browser shows fallback text immediately
 * and swaps in Inter when it finishes loading — prevents Flash of
 * Invisible Text (FOIT) that blocks FCP/LCP.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CQgram | End-to-End Encrypted Messaging",
    template: "%s | CQgram",
  },
  description:
    "CQgram delivers end-to-end encrypted real-time messaging with encrypted local message storage on this device.",
  keywords: [
    "chat",
    "end-to-end encryption",
    "e2ee",
    "real-time messaging",
    "privacy",
    "secure messaging",
    "supabase",
    "nextjs",
  ],
  authors: [{ name: "CQgram Team" }],
  creator: "CQgram Team",
  metadataBase: new URL("https://chatapp-encrypted.vercel.app"), // Replace with your actual domain
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://chatapp-encrypted.vercel.app",
    title: "CQgram | End-to-End Encrypted Messaging",
    description:
      "End-to-end encrypted real-time messaging with encrypted local message storage.",
    siteName: "CQgram",
  },
  twitter: {
    card: "summary_large_image",
    title: "CQgram | End-to-End Encrypted Messaging",
    description:
      "End-to-end encrypted real-time messaging with encrypted local message storage.",
  },
  icons: {
    icon: "/logoo.png",
    shortcut: "/favicon.ico",
    apple: "/logoo.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CQgram",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
        )}
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <QueryProvider>
          <ThemeProvider>
            <GlobalLoadingProvider>
              <OfflineOverlay />
              {children}
            </GlobalLoadingProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
