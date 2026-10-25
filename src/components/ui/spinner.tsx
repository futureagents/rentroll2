// A2 · inline spinner. Shown inside a button while a network call runs (E3 row action:
// "spinner inside the button only; the rest of the screen stays usable").
export interface SpinnerProps {
  /** Pixel size; 16 by default. */
  size?: number;
  className?: string;
  /** Accessible text; defaults to "Loading". */
  label?: string;
}

export function Spinner({ size = 16, className = "", label = "Loading" }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className={`inline-flex ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden="true"
        className="animate-spin"
      >
        <circle cx="8" cy="8" r="6" className="opacity-25" />
        <path d="M14 8a6 6 0 0 0-6-6" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
