import type { Metadata } from "next";
import { Inter, Playfair_Display, Outfit, Roboto_Slab } from "next/font/google";
import { ThemeProvider } from "@/context/ThemeContext";
import QueryProvider from "@/context/QueryProvider";
import OfflineOverlay from "@/components/OfflineOverlay";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Elegant serif font for prominent quotes on auth pages
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Modern geometric sans-serif for taglines
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

// Bold slab-serif for the "CQgram" brand name
const robotoSlab = Roboto_Slab({
  variable: "--font-roboto-slab",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: {
    default: "CQgram | Secure P2P Encrypted Messaging",
    template: "%s | CQgram",
  },
  description: "Experience ultimate privacy with CQgram. Real-time, peer-to-peer encrypted messaging built with Next.js and Supabase.",
  keywords: ["chat", "encrypted", "p2p", "real-time", "privacy", "secure messaging", "supabase", "nextjs"],
  authors: [{ name: "CQgram Team" }],
  creator: "CQgram Team",
  metadataBase: new URL("https://chatapp-encrypted.vercel.app"), // Replace with your actual domain
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://chatapp-encrypted.vercel.app",
    title: "CQgram | Secure P2P Encrypted Messaging",
    description: "Secure, real-time, peer-to-peer encrypted messaging.",
    siteName: "CQgram",
  },
  twitter: {
    card: "summary_large_image",
    title: "CQgram | Secure P2P Encrypted Messaging",
    description: "Secure, real-time, peer-to-peer encrypted messaging.",
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
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
      </head>
      <body className={`${inter.variable} ${playfair.variable} ${outfit.variable} ${robotoSlab.variable} font-sans antialiased overflow-hidden`}>
        <QueryProvider>
          <ThemeProvider>
            <OfflineOverlay />
            {children}
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
