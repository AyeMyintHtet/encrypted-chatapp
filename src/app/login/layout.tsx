import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your CQgram account to continue your secure conversations.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
