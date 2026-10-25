// A2 · tooltip. Icon buttons must carry a visible tooltip and an accessible label, and
// disabled buttons show a tooltip explaining why (A2 Buttons, E5). Pure CSS: visible on
// hover and on keyboard focus within the wrapper, so it needs no portal or JS.
import { useId, type ReactNode } from "react";

export interface TooltipProps {
  /** One short line. */
  label: string;
  children: ReactNode;
  /** Where the bubble sits; above by default. */
  side?: "top" | "bottom";
  /**
   * Id of the bubble. Pass the same id as `aria-describedby` on the wrapped control so
   * screen readers read the tooltip with it. Generated when omitted.
   */
  id?: string;
  className?: string;
}

export function Tooltip({ label, children, side = "top", id: idProp, className = "" }: TooltipProps) {
  const generated = useId();
  const id = idProp ?? generated;
  const position = side === "top" ? "bottom-full mb-2" : "top-full mt-2";
  return (
    <span className={`group/tip relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-sm bg-ink px-2 py-1 text-small text-surface opacity-0 shadow-2 transition-opacity group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${position}`}
      >
        {label}
      </span>
    </span>
  );
}
