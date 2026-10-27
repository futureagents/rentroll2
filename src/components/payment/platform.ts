"use client";
// S-02 · Which device the sheet is open on, because S02-BTN-PAY behaves differently on each
// (D-27: "opens that URL on the device it is tapped on … on desktop it is disabled as written";
// iOS handling of `upi://` is a QA note, not a spec change).
//
// - ios: `upi://` often does nothing at all on an iPhone — no error, no app. The sheet leads with
//   the QR and offers one button per app, so a failure is tied to one app, not to RentRoll.
// - android: the `upi://` intent opens the system's UPI app chooser.
// - desktop: no payment app to open. QR, copyable UPI ID, and S02-BTN-PAY disabled with its tooltip.
import { useSyncExternalStore } from "react";

export type PaymentPlatform = "ios" | "android" | "desktop";

export interface PlatformSignals {
  userAgent: string;
  /** `navigator.maxTouchPoints`. iPadOS reports a Mac user agent; touch points give it away. */
  maxTouchPoints: number;
}

export function detectPlatform({ userAgent, maxTouchPoints }: PlatformSignals): PaymentPlatform {
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  return "desktop";
}

const subscribeNever = () => () => undefined;
const fromNavigator = () =>
  detectPlatform({ userAgent: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints ?? 0 });
// The server cannot know the device. Desktop is the safe first paint: it offers the QR and
// nothing that pretends to open an app.
const onServer = (): PaymentPlatform => "desktop";

/** The current device's platform; `override` wins (the /dev/payment preview). */
export function usePaymentPlatform(override?: PaymentPlatform): PaymentPlatform {
  const detected = useSyncExternalStore(subscribeNever, fromNavigator, onServer);
  return override ?? detected;
}
