import { Fragment, ReactNode, useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

export interface Column<T> {
  key: string;
  label: string;
  /** Tooltip explaining the stat. */
  title?: string;
  render?: (row: T) => ReactNode;
  /** Value used for sorting; defaults to row[key]. */
  sortValue?: (row: T) => number | string | null | undefined;
  numeric?: boolean;
  /** Sort ascending first (e.g. ERA, where lower is better). */
  lowerIsBetter?: boolean;
  sortable?: boolean;
  className?: string;
}

interface StatTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  initialSort?: { key: string; desc: boolean };
  onRowClick?: (row: T) => void;
  expandedKey?: string | number | null;
  renderExpanded?: (row: T) => ReactNode;
  emptyMessage?: string;
  showRank?: boolean;
}

type SortState = { key: string; desc: boolean } | null;

const isMissing = (v: unknown) => v === null || v === undefined || (typeof v === "number" && Number.isNaN(v));

export function sortRows<T>(rows: T[], col: Column<T> | undefined, desc: boolean): T[] {
  if (!col) return rows;
  const value = col.sortValue ?? ((r: T) => (r as Record<string, unknown>)[col.key]);
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    // Blanks (e.g. ERA with no outs) stay last in both directions.
    if (isMissing(va) || isMissing(vb)) return Number(isMissing(va)) - Number(isMissing(vb));
    const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
    return desc ? -cmp : cmp;
  });
}

/** A sortable stats table. Click a header to sort; click again to flip. */
export default function StatTable<T>({
  columns,
  rows,
  rowKey,
  initialSort,
  onRowClick,
  expandedKey,
  renderExpanded,
  emptyMessage = "No data.",
  showRank = true,
}: StatTableProps<T>) {
  const [sort, setSort] = useState<SortState>(initialSort ?? null);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    return sortRows(rows, col, sort?.desc ?? false);
  }, [rows, columns, sort]);

  const onHeader = (col: Column<T>) => {
    if (col.sortable === false) return;
    setSort((prev) =>
      prev?.key === col.key ? { key: col.key, desc: !prev.desc } : { key: col.key, desc: !col.lowerIsBetter && !!col.numeric }
    );
  };

  const colSpan = columns.length + (showRank ? 1 : 0);

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {showRank && <th className="w-10 num">#</th>}
            {columns.map((col) => {
              const active = sort?.key === col.key;
              const sortable = col.sortable !== false;
              return (
                <th
                  key={col.key}
                  title={col.title}
                  className={`${col.numeric ? "num" : ""} ${col.className ?? ""}`}
                  aria-sort={active ? (sort?.desc ? "descending" : "ascending") : undefined}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => onHeader(col)}
                      className={`inline-flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 ${
                        active ? "text-blue-700 dark:text-blue-400" : ""
                      }`}
                    >
                      {col.label}
                      {active && (sort?.desc ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />)}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="text-center muted py-10">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row, i) => {
              const key = rowKey(row);
              const expanded = expandedKey === key;
              return (
                <Fragment key={key}>
                  <tr
                    className={`${onRowClick ? "clickable" : ""} ${expanded ? "bg-blue-50 dark:bg-slate-700/60" : ""}`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    aria-expanded={renderExpanded ? expanded : undefined}
                  >
                    {showRank && <td className="num muted">{i + 1}</td>}
                    {columns.map((col) => (
                      <td key={col.key} className={`${col.numeric ? "num" : ""} ${col.className ?? ""}`}>
                        {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                  {expanded && renderExpanded && (
                    <tr>
                      <td colSpan={colSpan} className="p-0 bg-slate-50 dark:bg-slate-900/40 whitespace-normal">
                        {renderExpanded(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
