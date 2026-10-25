"use client";
// A2 · Toast. Bottom-centre, 4 seconds, one line, optional Undo. Never used for errors that
// need a decision. D-11: the payment-recorded Undo toast stays for 10 seconds (the one
// exception); E1-03 "Copied." is 2 seconds. Screens pass `duration` for those.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "./icons";

export interface ToastOptions {
  /** One line. */
  message: string;
  /** Optional Undo; the label is "Undo" unless the screen says otherwise. */
  undo?: { onUndo: () => void; label?: string };
  /** Milliseconds; 4000 by default. */
  duration?: number;
}

interface ToastRecord extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
  dismiss: () => void;
}

/** Nullable so components like CopyButton can toast when a provider exists and stay silent otherwise. */
export const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastRecord | null>(null);
  const counter = useRef(0);
  const timer = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      if (timer.current) window.clearTimeout(timer.current);
      counter.current += 1;
      setToast({ ...options, id: counter.current });
      timer.current = window.setTimeout(() => setToast(null), options.duration ?? 4000);
    },
    [],
  );

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        {toast && (
          <ToastView
            key={toast.id}
            message={toast.message}
            undo={
              toast.undo
                ? {
                    label: toast.undo.label,
                    onUndo: () => {
                      toast.undo?.onUndo();
                      dismiss();
                    },
                  }
                : undefined
            }
            className="pointer-events-auto"
          />
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>.");
  return context;
}

export interface ToastViewProps {
  message: string;
  undo?: { onUndo: () => void; label?: string };
  className?: string;
}

/** The toast itself, exported so screens and the gallery can render it statically. */
export function ToastView({ message, undo, className = "" }: ToastViewProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex h-12 max-w-full items-center gap-3 rounded-md bg-ink px-4 text-(length:--text-body) text-surface shadow-2 ${className}`}
    >
      <Icon name="check" className="shrink-0 text-success" />
      <span className="truncate">{message}</span>
      {undo && (
        <button
          type="button"
          onClick={undo.onUndo}
          className="ml-1 shrink-0 rounded-sm px-2 py-1 font-medium text-primary-soft underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft"
        >
          {undo.label ?? "Undo"}
        </button>
      )}
    </div>
  );
}
