"use client";

import { InvalidLink } from "./_components/invalid-link";

// An unexpected fault on a tenant page still shows E1-10: never an error page, a code or a stack.
export default function TenantError() {
  return <InvalidLink />;
}
