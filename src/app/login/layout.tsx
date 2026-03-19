import type { Metadata } from "next";
import AuthLayout, { createAuthMetadata } from "../auth-layout";

export const metadata: Metadata = createAuthMetadata({
  title: "Login",
  description: "Sign in to your CQgram account to continue your secure conversations.",
});

export default AuthLayout;
