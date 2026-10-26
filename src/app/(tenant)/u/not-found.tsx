import { InvalidLink } from "./_components/invalid-link";

// Every `notFound()` under /u renders E1-10, never "not found" (D-04, tenant-routes rules).
export default function TenantNotFound() {
  return <InvalidLink />;
}
