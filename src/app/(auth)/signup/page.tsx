import type { Metadata } from "next";

import { SignUpForm } from "./sign-up-form";

// L-01 · /signup. Public; a signed-in user is redirected by src/proxy.ts.
export const metadata: Metadata = { title: "Create an account · RentRoll" };

export default function SignUpPage() {
  return <SignUpForm />;
}
