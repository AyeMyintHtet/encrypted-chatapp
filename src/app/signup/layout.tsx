import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Join ChatApp today to start secure, peer-to-peer encrypted messaging with your friends.",
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
