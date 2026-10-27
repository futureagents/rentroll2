// Development-only S-04 demo at /dev/upload. Signed in as a landlord, photos go to the real
// storage bucket; signed out, the page simulates the upload and says so.
import { signInRedirectPath } from "@/lib/auth/paths";
import { getCurrentLandlord } from "@/server/auth/session";

import { UploadDemo } from "./upload-demo";

export default async function UploadDevPage() {
  const landlord = await getCurrentLandlord();
  return (
    <main className="min-h-dvh bg-canvas">
      <UploadDemo
        storage={landlord ? "real" : "simulated"}
        landlordName={landlord?.name ?? null}
        signInHref={signInRedirectPath("/dev/upload")}
      />
    </main>
  );
}
