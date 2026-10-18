// A2 · Component library barrel. Screens import from "@/components/ui".
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from "./button";
export { Spinner, type SpinnerProps } from "./spinner";
export { Tooltip, type TooltipProps } from "./tooltip";
export { Icon, type IconName, type IconProps } from "./icons";

export { FieldShell, type FieldShellProps } from "./field";
export { TextField, type TextFieldProps } from "./text-field";
export { MoneyField, type MoneyFieldProps } from "./money-field";
export { PhoneField, normalisePhone, type PhoneFieldProps } from "./phone-field";
export { DateField, type DateFieldProps } from "./date-field";
export { Dropdown, type DropdownOption, type DropdownProps } from "./dropdown";
export { SegmentedChoice, type SegmentedChoiceProps, type SegmentedOption } from "./segmented-choice";
export { TextArea, type TextAreaProps } from "./text-area";
export { PhotoUploader, UPLOAD_ACCEPT, type PhotoUploaderProps, type UploaderPhoto } from "./photo-uploader";

export { StatCard, type StatCardProps } from "./stat-card";
export { StatusChip, type ChipTone, type StatusChipProps } from "./status-chip";
export { DataTable, RowActions, type Column, type DataTableProps, type SortState } from "./data-table";
export { DetailPanel, type DetailPanelProps } from "./detail-panel";
export { Timeline, type TimelineEvent, type TimelineProps } from "./timeline";
export { EmptyState, type EmptyStateProps } from "./empty-state";
export { ToastProvider, ToastView, useToast, type ToastOptions, type ToastViewProps } from "./toast";
export { ConfirmDialog, type ConfirmDialogProps } from "./confirm-dialog";

export { formatRupees, formatRupeesShort, formatDate, formatDateTime, groupIndian, parseRupees } from "./format";
