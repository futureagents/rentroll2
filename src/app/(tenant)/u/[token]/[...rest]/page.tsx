import { notFound } from "next/navigation";

// Not a tenant route (D-03 lists them all). Anything under /u/:token that D-03 does not name
// renders E1-10 instead of the framework's "not found" page. Named routes (reported/…, and later
// reports, unit, receipts) match before this catch-all.
export default function UnknownTenantPath() {
  notFound();
}
