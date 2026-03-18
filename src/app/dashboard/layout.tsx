import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Access your secure chats, manage your profile, and connect with other users on Kito.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="safe-bottom-area">{children}</div>;
}
