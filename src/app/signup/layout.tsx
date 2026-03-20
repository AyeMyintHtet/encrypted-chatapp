import type { Metadata } from "next";
import AuthLayout, { createAuthMetadata } from "../auth-layout";

export const metadata: Metadata = createAuthMetadata({
  title: "Create Account",
  description:
    "Join CQgram to start end-to-end encrypted real-time messaging with your contacts.",
});

export default AuthLayout;
