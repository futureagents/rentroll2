"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { Button, ConfirmDialog, DetailPanel, type DetailPanelProps } from "@/components/ui";

// A4: "Over 1024px — full sidebar, full tables, detail panel opens alongside rather than
// over content." Under 1024px the A2 Detail panel slides over the page (480px, or full
// screen under 640px). The landlord layout mounts <DetailPanelHost>; a screen renders
// <SidePanel> with the same props as DetailPanel and the host decides which form to use.
//
// The alongside column is 480px (A2 panel width). It takes no space while no panel is open.
//
// PROMOTE: this belongs in A2 Detail panel once the alongside form is accepted there; the
// A2 component would then take the host context itself and SidePanel would disappear.

/** A4 "over 1024px". Tailwind `lg` is the same boundary, so classes and script agree. */
export const PANEL_ALONGSIDE_QUERY = "(min-width: 1024px)";

type Host = {
  node: HTMLElement | null;
  /** Called by an inline panel on mount; the returned function unregisters it. */
  register: () => () => void;
};

const HostContext = createContext<Host | null>(null);

export function DetailPanelHost({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [panels, setPanels] = useState(0);
  const register = useCallback(() => {
    setPanels((count) => count + 1);
    return () => setPanels((count) => count - 1);
  }, []);

  return (
    <HostContext.Provider value={{ node, register }}>
      <div className="flex min-w-0 flex-1 items-start">
        <div className="flex min-w-0 flex-1 flex-col self-stretch">{children}</div>
        <aside
          ref={setNode}
          aria-label="Detail"
          hidden={panels === 0}
          className={[
            "sticky top-0 h-dvh w-[480px] shrink-0 border-l border-line bg-surface",
            panels > 0 ? "hidden lg:flex lg:flex-col" : "hidden",
          ].join(" ")}
        />
      </div>
    </HostContext.Provider>
  );
}

function subscribe(query: string, onChange: () => void) {
  const list = window.matchMedia(query);
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

/** True when the viewport matches; false on the server and during hydration. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    useCallback((onChange: () => void) => subscribe(query, onChange), [query]),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * Drop-in for A2 DetailPanel. Over 1024px it renders alongside the content in the host's
 * column; below that, or outside a host, it is the A2 panel over the page.
 */
export function SidePanel(props: DetailPanelProps) {
  const host = useContext(HostContext);
  const alongside = useMediaQuery(PANEL_ALONGSIDE_QUERY);

  if (!host?.node || !alongside) return <DetailPanel {...props} />;
  if (!props.open) return null;
  return createPortal(<InlinePanel {...props} register={host.register} />, host.node);
}

function InlinePanel({
  title,
  subtitle,
  children,
  footer,
  dirty,
  loading,
  onClose,
  register,
}: DetailPanelProps & { register: Host["register"] }) {
  const id = useId();
  const panelRef = useRef<HTMLElement>(null);
  const [askDiscard, setAskDiscard] = useState(false);

  useLayoutEffect(() => register(), [register]);

  // Move focus into the panel on open; return it to the trigger on close (E5).
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => trigger?.focus?.();
  }, []);

  const requestClose = useCallback(() => {
    if (dirty) setAskDiscard(true);
    else onClose();
  }, [dirty, onClose]);

  // Escape closes, as the A2 panel does; the discard dialog handles its own Escape.
  useEffect(() => {
    if (askDiscard) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      requestClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [askDiscard, requestClose]);

  return (
    <>
      <section
        ref={panelRef}
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        className="flex h-full min-h-0 flex-col focus:outline-none"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line p-6">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={`${id}-title`} className="text-h1 text-ink">
              {title}
            </h2>
            {subtitle ? <p className="text-small text-muted">{subtitle}</p> : null}
          </div>
          <Button variant="icon" icon="close" label="Close" onClick={requestClose} />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-6" aria-busy={loading || undefined}>
          {loading ? (
            <div className="flex flex-col gap-4" role="status">
              <span className="sr-only">Loading</span>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex flex-col gap-2">
                  <span className="h-3 w-20 animate-pulse rounded-sm bg-line" />
                  <span className="h-4 w-2/3 animate-pulse rounded-sm bg-line" />
                </div>
              ))}
            </div>
          ) : (
            children
          )}
        </div>
        {footer ? (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-line p-6">{footer}</footer>
        ) : null}
      </section>
      <ConfirmDialog
        open={askDiscard}
        title="Discard your changes?"
        consequence="The edits in this panel have not been saved."
        actionLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onCancel={() => setAskDiscard(false)}
        onConfirm={() => {
          setAskDiscard(false);
          onClose();
        }}
      />
    </>
  );
}
