import type { Metadata } from "next";
import Link from "next/link";

import { createSupabaseServerClient } from "@/server/supabase/server";

import { NewPasswordForm } from "./new-password-form";

// L-01 · /reset/new. Reached from the reset email via /auth/callback, which exchanged the code
// for a session. Without a session there is nothing to update, so point back to /reset.
export const metadata: Metadata = { title: "Set a new password · RentRoll" };

export default async function NewPasswordPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div>
        <h1 className="mb-2 text-h1 text-ink">Set a new password</h1>
        <p className="mb-4 text-body">
          This link has expired or was already used. Request a new one and we will email it to you.
        </p>
        <Link href="/reset" className="text-small text-primary hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return <NewPasswordForm />;
}
