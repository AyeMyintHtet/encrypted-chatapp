import type { Metadata } from "next";
import AuthLayout, { createAuthMetadata } from "../auth-layout";

export const metadata: Metadata = createAuthMetadata({
  title: "Create Account",
  description: "Join CQgram today to start secure, peer-to-peer encrypted messaging with your friends.",
});

export default AuthLayout;
