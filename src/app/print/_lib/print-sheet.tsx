// Shared frame for every print view (P-01, P-02, P-03): white sheet, A4 pages, print dialog on
// load. No navigation, no buttons — the rules in spec/screens/P-01.md apply to all print views.
// Pure: takes props only, imports nothing from src/server.
import type { ReactNode } from "react";

import "./print.css";
import { PrintOnLoad } from "./print-on-load";

export interface PrintSheetProps {
  children: ReactNode;
  /** Trigger window.print() once the page has loaded. Default true; dev previews turn it off. */
  autoPrint?: boolean;
}

export function PrintSheet({ children, autoPrint = true }: PrintSheetProps) {
  return (
    <div className="print-sheet text-body">
      <PrintOnLoad enabled={autoPrint} />
      {children}
    </div>
  );
}

/** One A4 page of content. Several in a row print on separate sheets (P-03). */
export function PrintPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`print-page ${className}`}>{children}</section>;
}
