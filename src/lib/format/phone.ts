// Phone display. Stored phones are `+91` and ten digits (A2 Phone field); shown as
// "+91 98765 43210". Anything else is returned as typed.
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^\+91(\d{5})(\d{5})$/.exec(value.replace(/[\s-]/g, ""));
  return match ? `+91 ${match[1]} ${match[2]}` : value;
}
