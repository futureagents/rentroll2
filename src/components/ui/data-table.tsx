"use client";
// A2 · Data table. Sticky header, sortable columns marked with an arrow, row hover fill,
// 48px rows. Row click opens the detail panel; buttons inside the row sit in <RowActions>,
// which stops the click from propagating. Under 640px (A4) rows become stacked cards with
// the columns flagged `key` only.
import { useState, type MouseEvent, type ReactNode } from "react";
import { EmptyState, type EmptyStateProps } from "./empty-state";
import { Icon } from "./icons";

export interface Column<Row> {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  /** Sort key; a column is sortable only when this is set. */
  sortValue?: (row: Row) => string | number;
  align?: "left" | "right";
  /** Shown on the stacked mobile card (A4 "key fields only"). */
  key?: boolean;
  /** Column holds <RowActions>; it is never sortable and pins right. */
  actions?: boolean;
  width?: string;
}

export interface SortState {
  columnId: string;
  direction: "asc" | "desc";
}

export interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Caption for screen readers. */
  caption: string;
  onRowClick?: (row: Row) => void;
  selectedKey?: string | null;
  /** Controlled sort; leave undefined for internal sorting. */
  sort?: SortState | null;
  onSortChange?: (sort: SortState) => void;
  /** E3 page-load skeleton. */
  loading?: boolean;
  /** E2 wording and action when there are no rows. */
  empty?: EmptyStateProps;
  /** Primary line of the mobile card, e.g. unit name. */
  mobileTitle?: (row: Row) => ReactNode;
  className?: string;
}

export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  caption,
  onRowClick,
  selectedKey,
  sort: sortProp,
  onSortChange,
  loading,
  empty,
  mobileTitle,
  className = "",
}: DataTableProps<Row>) {
  const [internalSort, setInternalSort] = useState<SortState | null>(null);
  const sort = sortProp === undefined ? internalSort : sortProp;

  const toggleSort = (column: Column<Row>) => {
    if (!column.sortValue) return;
    const next: SortState =
      sort?.columnId === column.id
        ? { columnId: column.id, direction: sort.direction === "asc" ? "desc" : "asc" }
        : { columnId: column.id, direction: "asc" };
    setInternalSort(next);
    onSortChange?.(next);
  };

  const sortedRows = (() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.id === sort.columnId);
    if (!column?.sortValue) return rows;
    const get = column.sortValue;
    const sign = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });
  })();

  const clickable = Boolean(onRowClick);
  const keyColumns = columns.filter((c) => c.key && !c.actions);
  const actionColumn = columns.find((c) => c.actions);

  if (!loading && rows.length === 0 && empty) {
    return <EmptyState {...empty} className={className} />;
  }

  const rowClass = (selected: boolean) =>
    (clickable ? "cursor-pointer " : "") +
    (selected ? "bg-primary-soft " : "hover:bg-canvas ") +
    "transition-colors";

  const rowProps = (row: Row) =>
    clickable
      ? {
          tabIndex: 0,
          onClick: () => onRowClick?.(row),
          onKeyDown: (event: React.KeyboardEvent) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onRowClick?.(row);
            }
          },
        }
      : {};

  return (
    <div className={className}>
      {/* Desktop and tablet: the table. */}
      <div className="hidden max-h-[70vh] overflow-auto rounded-md border border-line bg-surface shadow-1 sm:block">
        <table className="w-full border-collapse text-body" aria-busy={loading || undefined}>
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-line">
              {columns.map((column) => {
                const sortable = Boolean(column.sortValue) && !column.actions;
                const active = sort?.columnId === column.id;
                const ariaSort = active ? (sort?.direction === "asc" ? "ascending" : "descending") : undefined;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={sortable ? (ariaSort ?? "none") : undefined}
                    style={column.width ? { width: column.width } : undefined}
                    className={`h-12 px-4 text-label uppercase text-muted ${column.align === "right" ? "text-right" : "text-left"}`}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className={`inline-flex items-center gap-1 rounded-sm hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? "text-ink" : ""} ${column.align === "right" ? "flex-row-reverse" : ""}`}
                      >
                        {column.header}
                        <Icon
                          name={active && sort?.direction === "desc" ? "arrow-down" : "arrow-up"}
                          size={12}
                          className={active ? "" : "opacity-40"}
                        />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? [0, 1, 2, 3].map((i) => (
                  <tr key={i} className="h-12 border-b border-line last:border-b-0">
                    {columns.map((column) => (
                      <td key={column.id} className="px-4">
                        <span className="block h-3 w-2/3 animate-pulse rounded-sm bg-line" />
                      </td>
                    ))}
                  </tr>
                ))
              : sortedRows.map((row) => {
                  const key = rowKey(row);
                  const selected = key === selectedKey;
                  return (
                    <tr
                      key={key}
                      aria-selected={selected || undefined}
                      className={`h-12 border-b border-line last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${rowClass(selected)}`}
                      {...rowProps(row)}
                    >
                      {columns.map((column) => (
                        <td
                          key={column.id}
                          className={`px-4 ${column.align === "right" ? "text-right tabular-nums" : "text-left"} ${column.actions ? "whitespace-nowrap" : ""}`}
                        >
                          {column.cell(row)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {/* Under 640px: stacked cards, key fields only (A4). */}
      <ul className="flex flex-col gap-2 sm:hidden" aria-label={caption} aria-busy={loading || undefined}>
        {loading
          ? [0, 1, 2].map((i) => (
              <li key={i} className="flex flex-col gap-2 rounded-md border border-line bg-surface p-4 shadow-1">
                <span className="h-4 w-1/2 animate-pulse rounded-sm bg-line" />
                <span className="h-3 w-3/4 animate-pulse rounded-sm bg-line" />
              </li>
            ))
          : sortedRows.map((row) => {
              const key = rowKey(row);
              const selected = key === selectedKey;
              return (
                <li
                  key={key}
                  data-selected={selected || undefined}
                  className={`flex flex-col gap-2 rounded-md border border-line bg-surface p-4 shadow-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${rowClass(selected)}`}
                  {...rowProps(row)}
                >
                  {mobileTitle && <div className="text-h2 text-ink">{mobileTitle(row)}</div>}
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {keyColumns.map((column) => (
                      <div key={column.id} className="contents">
                        <dt className="text-label uppercase text-muted">{column.header}</dt>
                        <dd className={column.align === "right" ? "text-right tabular-nums" : ""}>
                          {column.cell(row)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {actionColumn && <div className="flex justify-end">{actionColumn.cell(row)}</div>}
                </li>
              );
            })}
      </ul>
    </div>
  );
}

/** Wrap row-level buttons so their clicks never open the row. */
export function RowActions({ children, className = "" }: { children: ReactNode; className?: string }) {
  const stop = (event: MouseEvent | React.KeyboardEvent) => event.stopPropagation();
  return (
    <div
      role="presentation"
      onClick={stop}
      onKeyDown={stop}
      className={`inline-flex items-center justify-end gap-1 ${className}`}
    >
      {children}
    </div>
  );
}
