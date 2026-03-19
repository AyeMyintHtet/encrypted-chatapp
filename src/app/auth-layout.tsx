import type { Metadata } from "next";
import type { ReactNode } from "react";

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

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
