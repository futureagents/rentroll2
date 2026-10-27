// S-02 · Public surface for openers (L-05 L05-BTN-PAYLINK, L-07 "Send payment request").
// Openers pass the pre-filled amount and note and the landlord's payee; the sheet writes nothing.
export { PaymentSheet, DESKTOP_PAY_REASON, type PayeeState, type PaymentSheetProps } from "./payment-sheet";
export {
  payeeFromLandlord,
  rentPaymentNote,
  capPaymentNote,
  paymentLink,
  type LandlordPaymentRow,
  type PaymentPayee,
  type PaymentRequest,
} from "./links";
export { detectPlatform, type PaymentPlatform } from "./platform";
