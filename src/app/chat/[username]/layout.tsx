import type { Metadata } from "next";

type Props = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const username = (await params).username;

  return {
    title: `Chat with ${username}`,
    description: `End-to-end encrypted chat session with ${username} on CQgram.`,
    robots: {
      index: false, // Don't index private chat pages
      follow: false,
    }
  };
}

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
