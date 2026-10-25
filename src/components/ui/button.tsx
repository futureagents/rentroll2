"use client";
// A2 · Buttons. Five variants (primary, secondary, quiet, danger, icon), three heights
// (32 compact in table rows, 40 default, 48 on tenant screens), disabled with a tooltip
// explaining why, and an inline spinner for network calls (never a full-page block).
// Disabled buttons use aria-disabled and stay in the tab order (E5), so keyboard users
// reach them and see the reason; the native disabled attribute would hide both.
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "./icons";
import { Spinner } from "./spinner";
import { Tooltip } from "./tooltip";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger" | "icon";
export type ButtonSize = 32 | 40 | 48;

type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled" | "children">;

/** A disabled button must say why (A2: "Disabled buttons show a tooltip explaining why"). */
type DisabledProps =
  | { disabled: true; disabledReason: string }
  | { disabled?: false; disabledReason?: undefined };

type VariantProps =
  | {
      variant?: Exclude<ButtonVariant, "icon">;
      children: ReactNode;
      /** Optional leading glyph. */
      icon?: IconName;
      label?: undefined;
    }
  | {
      /** Icon-only: 32×32 by default, must carry an accessible label shown as a tooltip. */
      variant: "icon";
      icon: IconName;
      label: string;
      children?: undefined;
    };

export type ButtonProps = NativeButtonProps &
  DisabledProps &
  VariantProps & {
    /** Height in px. 40 default, 32 compact (tables), 48 tenant touch targets. Icon: 32. */
    size?: ButtonSize;
    /** Network call in flight: shows a spinner and makes the button non-interactive. */
    loading?: boolean;
    /** Full-width block; useful on tenant screens. */
    block?: boolean;
  };

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-surface border border-primary hover:bg-ink hover:border-ink",
  secondary:
    "bg-surface text-primary border border-primary hover:bg-primary-soft",
  quiet: "bg-transparent text-body border border-transparent hover:bg-canvas",
  danger: "bg-surface text-danger border border-danger hover:bg-danger/12",
  icon: "bg-transparent text-body border border-transparent hover:bg-canvas",
};

const HEIGHT_CLASSES: Record<ButtonSize, string> = {
  32: "h-8 px-3 text-small gap-1",
  40: "h-10 px-4 text-(length:--text-body) gap-2",
  48: "h-12 px-6 text-(length:--text-body) gap-2",
};

const ICON_SIZE_CLASSES: Record<ButtonSize, string> = {
  32: "h-8 w-8",
  40: "h-10 w-10",
  48: "h-12 w-12",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
  const {
    variant = "primary",
    size: sizeProp,
    loading = false,
    block = false,
    disabled,
    disabledReason,
    icon,
    label,
    children,
    className = "",
    onClick,
    type = "button",
    ...native
  } = props;
  const isIcon = variant === "icon";
  const size: ButtonSize = sizeProp ?? (isIcon ? 32 : 40);
  const inert = Boolean(disabled) || loading;
  const tooltipId = useId();
  const tooltip = disabled ? disabledReason : isIcon ? label : undefined;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (inert) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  const base =
    "inline-flex shrink-0 items-center justify-center rounded-sm font-medium whitespace-nowrap select-none " +
    "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
  const state = disabled
    ? "opacity-50 cursor-not-allowed"
    : loading
      ? "cursor-progress"
      : "cursor-pointer";
  const shape = isIcon ? ICON_SIZE_CLASSES[size] : HEIGHT_CLASSES[size];
  const width = block ? "w-full" : "";

  const button = (
    <button
      ref={ref}
      type={type}
      aria-disabled={inert || undefined}
      aria-busy={loading || undefined}
      aria-label={isIcon ? label : undefined}
      aria-describedby={tooltip ? tooltipId : undefined}
      onClick={handleClick}
      className={`${base} ${VARIANT_CLASSES[variant]} ${shape} ${state} ${width} ${className}`}
      {...native}
    >
      {loading ? (
        <Spinner size={size === 32 ? 14 : 16} />
      ) : icon ? (
        <Icon name={icon} size={size === 48 ? 20 : 16} />
      ) : null}
      {!isIcon && children}
    </button>
  );

  if (tooltip === undefined) return button;
  return (
    <Tooltip id={tooltipId} label={tooltip} className={block ? "w-full" : ""}>
      {button}
    </Tooltip>
  );
});
