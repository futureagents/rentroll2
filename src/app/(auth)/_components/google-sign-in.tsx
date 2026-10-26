"use client";
// L-01 · "Continue with Google" above the email fields, then an "or" divider. Its own form: it
// cannot sit inside the email form. Built on the A2 secondary Button.
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui";
import { NEXT_PARAM } from "@/lib/auth/paths";

import { continueWithGoogle } from "./google-actions";

export function GoogleSignIn({ next }: { next?: string | null }) {
  return (
    <>
      <form action={continueWithGoogle}>
        {next ? <input type="hidden" name={NEXT_PARAM} value={next} /> : null}
        <GoogleButton />
      </form>
      <p className="my-4 flex items-center gap-3 text-small text-muted">
        <span aria-hidden className="h-px flex-1 bg-line" />
        or
        <span aria-hidden className="h-px flex-1 bg-line" />
      </p>
    </>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" block loading={pending}>
      {pending ? null : <GoogleLogo />}
      Continue with Google
    </Button>
  );
}

// Google's standard "G" mark, unaltered and on a white (surface) button, as Google's sign-in
// branding guidelines require. It is a static brand asset in public/brand, not a component: its
// four colours may not be recoloured, so they stay out of the A1 tokens.
function GoogleLogo() {
  // A fixed 18px SVG gains nothing from next/image optimisation.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/google-g.svg" alt="" width={18} height={18} className="shrink-0" />;
}
