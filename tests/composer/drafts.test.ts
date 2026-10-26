// S-01 template drafts (E1-09 fallback) and the hand-off text (D-17 body, D-27 payment link).
import { describe, expect, it } from "vitest";

import { emailUrl, outgoingText, whatsappUrl } from "@/components/composer/handoff";
import { rentReminderTemplate, TEMPLATE_VARIANTS } from "@/components/composer/templates";
import { buildUpiPaymentLink } from "@/components/composer/upi";

const fields = {
  recipient: { name: "Suresh Khan", firstName: "Suresh", phone: "+919876543210", email: null },
  unitLabel: "Flat 4C",
  month: "2026-10-01",
  dueOn: "2026-10-05",
  daysOverdue: 18,
  amountDue: 186000,
  balance: 186000,
  agreementStartsOn: "2025-04-01",
  signOff: "Kulkarni Rentals",
};

describe("rent reminder templates", () => {
  it("Gentle nudges without stating the amount", () => {
    const text = rentReminderTemplate(fields, "gentle");
    expect(text).toContain("Hi Suresh");
    expect(text).toContain("October 2026");
    expect(text).toContain("was due on 05 Oct 2026");
    expect(text).not.toContain("₹");
  });

  it("Direct states the amount (Indian grouping) and the date", () => {
    for (let variant = 0; variant < TEMPLATE_VARIANTS; variant++) {
      const text = rentReminderTemplate(fields, "direct", variant);
      expect(text).toContain("₹1,86,000");
      expect(text).toContain("05 Oct 2026");
    }
  });

  it("Formal refers to the agreement date and quotes no clause (D-38)", () => {
    for (let variant = 0; variant < TEMPLATE_VARIANTS; variant++) {
      const text = rentReminderTemplate(fields, "formal", variant);
      expect(text).toContain("Dear Suresh Khan");
      expect(text).toContain("our agreement dated 01 Apr 2025");
      expect(text).not.toMatch(/clause/i);
    }
  });

  it("uses the remaining balance when part has been paid (D-10)", () => {
    expect(rentReminderTemplate({ ...fields, balance: 4000 }, "direct")).toContain("the remaining ₹4,000");
  });

  it("speaks of a future due date before the due date", () => {
    expect(rentReminderTemplate({ ...fields, daysOverdue: -3, dueOn: "2026-10-29" }, "gentle")).toContain(
      "is due on 29 Oct 2026",
    );
  });

  it("gives different wording for Write it differently", () => {
    expect(rentReminderTemplate(fields, "gentle", 0)).not.toBe(rentReminderTemplate(fields, "gentle", 1));
    expect(rentReminderTemplate(fields, "gentle", 2)).toBe(rentReminderTemplate(fields, "gentle", 0));
  });
});

describe("hand-off", () => {
  const link = buildUpiPaymentLink({ upiId: "kulkarni@okhdfc", payeeName: "Kulkarni Rentals", amount: 186000, note: "Rent — Flat 4C" });

  it("builds a UPI intent with the balance as a whole-rupee amount (D-19, D-27)", () => {
    expect(link).toBe("upi://pay?pa=kulkarni%40okhdfc&pn=Kulkarni%20Rentals&am=186000&tn=Rent%20%E2%80%94%20Flat%204C&cu=INR");
  });

  it("appends the payment link only when ticked", () => {
    expect(outgoingText("  Hi Suresh  ", null)).toBe("Hi Suresh");
    expect(outgoingText("Hi Suresh", link)).toBe(`Hi Suresh\n\nPay by UPI: ${link}`);
  });

  it("pre-fills WhatsApp for the tenant's +91 number", () => {
    expect(whatsappUrl("+919876543210", "Hi Suresh & co")).toBe("https://wa.me/919876543210?text=Hi%20Suresh%20%26%20co");
  });

  it("builds mailto with %20, never +", () => {
    expect(emailUrl("s@example.com", "Rent for October 2026", "a b")).toBe(
      "mailto:s@example.com?subject=Rent%20for%20October%202026&body=a%20b",
    );
  });
});
