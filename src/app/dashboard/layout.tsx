import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Access your secure chats, manage your profile, and connect with other users on ChatApp.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
