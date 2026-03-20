import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Playfair_Display, Outfit, Roboto_Slab } from "next/font/google";

/**
 * Auth-only fonts — loaded exclusively on /login and /signup routes.
 *
 * These are decorative fonts used for quotes, taglines, and brand text
 * on auth pages. By loading them here instead of the root layout, we
 * remove 3 font files from the critical rendering path of /dashboard
 * and /chat routes, significantly improving FCP and LCP.
 *
 * `display: 'swap'` shows fallback text instantly while fonts load,
 * preventing Flash of Invisible Text (FOIT).
 */
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const robotoSlab = Roboto_Slab({
  variable: "--font-roboto-slab",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

type AuthMetadataOptions = {
  title: string;
  description: string;
};

export function createAuthMetadata({ title, description }: AuthMetadataOptions): Metadata {
  return {
    title,
    description,
  };
}

/**
 * Auth layout wrapper — injects font CSS variables into a container div
 * so child components can reference them via var(--font-playfair), etc.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${playfair.variable} ${outfit.variable} ${robotoSlab.variable}`}>
      {children}
    </div>
  );
}
