// Development-only preview of P-01 from the props fixture, at /print/receipt/sample.
// `?variant=minimal` shows the receipt with nothing optional saved; `?print=0` skips the dialog.
// The real routes (`/print/receipt/:paymentId`, `/u/:token/receipts/:receiptNumber/print`, D-03)
// load a payment and render the same <Receipt />.
import { receiptFixture, receiptFixtureMinimal } from "../../fixtures";
import { Receipt } from "../receipt";

export default async function ReceiptSamplePage({
  searchParams,
}: {
  searchParams: Promise<{ variant?: string; print?: string }>;
}) {
  const { variant, print } = await searchParams;
  const props = variant === "minimal" ? receiptFixtureMinimal : receiptFixture;
  return <Receipt {...props} autoPrint={print !== "0"} />;
}
