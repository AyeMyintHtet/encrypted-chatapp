import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/context/ThemeContext";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ChatApp | Secure P2P Encrypted Messaging",
    template: "%s | ChatApp",
  },
  description: "Experience ultimate privacy with ChatApp. Real-time, peer-to-peer encrypted messaging built with Next.js and Supabase.",
  keywords: ["chat", "encrypted", "p2p", "real-time", "privacy", "secure messaging", "supabase", "nextjs"],
  authors: [{ name: "ChatApp Team" }],
  creator: "ChatApp Team",
  metadataBase: new URL("https://chatapp-encrypted.vercel.app"), // Replace with your actual domain
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://chatapp-encrypted.vercel.app",
    title: "ChatApp | Secure P2P Encrypted Messaging",
    description: "Secure, real-time, peer-to-peer encrypted messaging.",
    siteName: "ChatApp",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChatApp | Secure P2P Encrypted Messaging",
    description: "Secure, real-time, peer-to-peer encrypted messaging.",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.ico", // Usually best to have a specific apple-touch-icon, but this fulfills the request
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
