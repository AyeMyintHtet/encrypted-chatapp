import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile",
  description: "Manage your profile on CQgram.",
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
