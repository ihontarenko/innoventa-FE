import type { ReactNode } from "react"
import { cn } from "@jmouse/ui"

/**
 * The dense table every list screen in this product draws.
 *
 * <h2>⚠️ Columns are declared, not marked up</h2>
 *
 * <p>Four screens hand-wrote the same `<thead>` — the same uppercase tracking, the same `px-2.5 py-1.5`,
 * the same muted `text-[10px]` — and three of them had already drifted: one used `py-1`, one had lost the
 * tracking, one right-aligned its numbers and one did not. None of those is a bug anybody files, and all
 * of them together are what makes a product feel assembled rather than designed.
 *
 * <p>So a screen says what its columns *are* and this decides what a table *looks like*. The next screen
 * is consistent because it could not be otherwise, rather than because somebody copied carefully.
 *
 * <h2>⚠️ Numbers are right-aligned and tabular, and that is not a preference</h2>
 *
 * <p>A column of quantities that is left-aligned cannot be scanned for magnitude, and proportional
 * figures make 111 wider than 999. `align: "right"` carries `tabular-nums` with it for exactly that
 * reason — the two always travel together, so they are one decision here instead of two per column.
 */
export interface DataColumn<Row> {
  /** Stable across renders; React's key and nothing else. */
  key: string
  header: ReactNode
  cell: (row: Row) => ReactNode
  /** ⚠️ `right` also makes the column tabular — see the note above. */
  align?: "left" | "right" | "center"
  /** Extra classes on the cell — a width cap, a mono face. */
  className?: string
  /** Extra classes on the header cell alone, where it must differ. */
  headerClassName?: string
}

export function DataTable<Row>({
  rows,
  columns,
  rowKey,
  onRowClick,
  rowProperties,
  rowClassName,
  className,
}: {
  rows: Row[]
  columns: DataColumn<Row>[]
  rowKey: (row: Row) => string
  /** ⚠️ Absent leaves the rows unclickable AND uncursored — a pointer over dead rows is a promise. */
  onRowClick?: (row: Row) => void
  /**
   * Spread onto each row — this is where `useListKeyboard`'s `rowProperties` goes.
   *
   * ⚠️ **It owns the click when it supplies one**, because the keyboard layer's own `onClick` is what
   * makes a row active; calling `onRowClick` instead would leave `j`/`k` starting from wherever they
   * last were rather than from the row somebody just pressed. Pass both and this calls the keyboard's
   * first, then yours — the order Inventory established and the only one where clicking and pressing
   * `Space` land in the same place.
   */
  rowProperties?: (row: Row) => Partial<React.ComponentProps<"tr">>
  rowClassName?: (row: Row) => string | undefined
  className?: string
}) {
  return (
    /* ⚠️ **No frame of its own.** The scroll and the edges belong to `ListScreen`'s content block; a
       border and a radius here would be a box inside a box, which is exactly what Ivan called
       "облізлі блоки". */
    <table className={cn("w-full text-sm", className)}>
      {/* ⚠️ **Sticky, because the scroller is now the content block rather than the page.** A hundred
          rows scrolled under a header that went with them is a table whose columns you have to
          remember. `bg-background` is required — a transparent sticky header lets rows read through
          it. */}
      <thead className="sticky top-0 z-10">
        <tr className="bg-background text-muted-foreground border-b text-[10px] uppercase tracking-[0.06em]">
          {columns.map((column) => (
            <th
              key={column.key}
              className={cn(
                "px-2.5 py-1.5 font-medium",
                alignmentOf(column.align).header,
                column.headerClassName,
              )}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const keyboard = rowProperties?.(row)

          return (
            <tr
              key={rowKey(row)}
              {...keyboard}
              onClick={(event) => {
                keyboard?.onClick?.(event)
                onRowClick?.(row)
              }}
              className={cn(
                "border-b last:border-b-0",
                (onRowClick || keyboard) && "hover:bg-accent/40 cursor-pointer",
                // ⚠️ A ring rather than a fill — a row can already carry a colour that means something
                // (below minimum, overdue), and a background would hide the very thing it shows.
                keyboard &&
                  "focus-visible:outline-none data-[active]:ring-ring data-[active]:ring-2 data-[active]:ring-inset",
                rowClassName?.(row),
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn("px-2.5 py-1.5", alignmentOf(column.align).cell, column.className)}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function alignmentOf(align: DataColumn<unknown>["align"]) {
  switch (align) {
    case "right":
      return { header: "text-right", cell: "text-right tabular-nums" }
    case "center":
      return { header: "text-center", cell: "text-center" }
    default:
      return { header: "text-left", cell: "text-left" }
  }
}
