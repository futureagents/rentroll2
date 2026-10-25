// Development-only preview of P-03 from the props fixture, at /print/door-qr/sample.
// `?print=0` skips the dialog. The real route renders one card per selected unit
// (L08-BTN-PRINTQR) with the same <DoorQrCards />.
import { DoorQrCards } from "../door-qr-cards";
import { doorQrFixture } from "../../fixtures";

export default async function DoorQrSamplePage({
  searchParams,
}: {
  searchParams: Promise<{ print?: string }>;
}) {
  const { print } = await searchParams;
  return <DoorQrCards {...doorQrFixture} autoPrint={print !== "0"} />;
}
