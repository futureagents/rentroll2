// Money formatting (D-19, CLAUDE.md §5). Amounts are integer whole rupees.
// This is the one place Indian digit grouping and amounts-in-words are implemented;
// screens, print views and exports import from "@/lib/format" and never hand-roll
// toLocaleString or Intl calls.

/**
 * Indian digit grouping of a digit string: "186000" → "1,86,000", "10000000" → "1,00,00,000".
 * Non-digits are dropped; leading zeros are trimmed.
 */
export function groupIndian(digits: string | number): string {
  const clean = String(digits).replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (clean === "") return "0";
  if (clean.length <= 3) return clean;
  const last3 = clean.slice(-3);
  const rest = clean.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
}

/** Whole rupees with the ₹ sign and Indian grouping: 186000 → "₹1,86,000". Tables use this. */
export function formatRupees(amount: number): string {
  const whole = Math.round(Math.abs(amount));
  const sign = amount < 0 ? "-" : "";
  return `${sign}₹${groupIndian(whole)}`;
}

/**
 * Abbreviated rupees for stat cards only (D-19): 210000 → "₹2.1L", 36000 → "₹36k",
 * 12000000 → "₹1.2Cr". Tables and print views never use this.
 */
export function formatRupeesShort(amount: number): string {
  const abs = Math.round(Math.abs(amount));
  const sign = amount < 0 ? "-" : "";
  if (abs >= CRORE) return `${sign}₹${trimZero((abs / CRORE).toFixed(1))}Cr`;
  if (abs >= LAKH) return `${sign}₹${trimZero((abs / LAKH).toFixed(1))}L`;
  if (abs >= 10_000) return `${sign}₹${Math.round(abs / 1000)}k`;
  return formatRupees(amount);
}

function trimZero(s: string): string {
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** Parses a money field's text into whole rupees, or null when it holds no digits. */
export function parseRupees(text: string): number | null {
  const digits = text.replace(/\D/g, "");
  return digits === "" ? null : Number(digits);
}

const LAKH = 1_00_000;
const CRORE = 1_00_00_000;

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  const ones = n % 10;
  return ones === 0 ? tens : `${tens}-${ONES[ones]}`;
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds > 0) parts.push(`${ONES[hundreds]} hundred`);
  if (rest > 0) parts.push(belowHundred(rest));
  return parts.join(" ");
}

/**
 * A non-negative integer in words using Indian numbering (D-19): thousand, lakh, crore.
 * 186000 → "one lakh eighty-six thousand" · 10000000 → "one crore" ·
 * 12345678901 → "one thousand two hundred thirty-four crore fifty-six lakh seventy-eight thousand nine hundred one".
 * Never the Western "one hundred eighty-six thousand".
 */
export function numberToWordsIndian(n: number): string {
  if (!Number.isFinite(n)) return "";
  const whole = Math.round(Math.abs(n));
  if (whole === 0) return "zero";
  const parts: string[] = [];
  const crore = Math.floor(whole / CRORE);
  if (crore > 0) parts.push(`${numberToWordsIndian(crore)} crore`);
  const lakh = Math.floor((whole % CRORE) / LAKH);
  if (lakh > 0) parts.push(`${belowHundred(lakh)} lakh`);
  const thousand = Math.floor((whole % LAKH) / 1000);
  if (thousand > 0) parts.push(`${belowHundred(thousand)} thousand`);
  const rest = whole % 1000;
  if (rest > 0) parts.push(belowThousand(rest));
  return parts.join(" ");
}

/**
 * The amount in words as it is printed on receipts and statements (P-01, P-02):
 * 186000 → "Rupees one lakh eighty-six thousand only".
 */
export function formatRupeesInWords(amount: number): string {
  return `Rupees ${numberToWordsIndian(amount)} only`;
}
