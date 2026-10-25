// L-01: "a single inline error above the form". E1-07 style: inline, above the form, never a popup.
export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="mb-4 rounded-sm bg-danger/12 px-3 py-2 text-small text-danger">
      {message}
    </p>
  );
}

export function FormNotice({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="status" className="mb-4 rounded-sm bg-primary-soft px-3 py-2 text-small text-ink">
      {message}
    </p>
  );
}
