import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown } from "lucide-react"
import { Skeleton, cn } from "@jmouse/ui"
import { stockApi, type StockSummary, type StockValue } from "@/api/stock"
import { useSpaceStore } from "@/stores/spaceStore"

/**
 * What the shelf is worth, above the shelf — in one line.
 *
 * ⚠️ **One line, not a row of tiles** (Ivan, 2026-08-25: *«потрібно переробити віджет, компактніше
 * зроби»*). It is a summary of the screen below it, and a summary that takes four rems of height before
 * the first row of the thing being summarised has stopped being a summary. Figures inline, labels muted
 * beside them, and the breakdown behind a disclosure.
 *
 * ⚠️ **Counted by the database, over every row — never by the browser over a page.** The list below this
 * is paged twenty-five at a time; a total added up from what happens to be loaded would be a quarter of
 * the truth, and it would look exactly like the truth.
 *
 * ⚠️ **One figure per currency, and they are never added together.** A price field is a quantity — a
 * number and a unit — so a workspace pricing some types in hryvnia and some in dollars has two totals,
 * and folding them into one produces a number that is confidently meaningless.
 *
 * ⚠️ **It does not follow the screen's filter, and staying still is how it says so.** The figure answers
 * *what do I hold*, which is a property of the workspace rather than of whatever is in the search box; a
 * total that moved with the filter would be read as the whole and be wrong. One type is asked by opening
 * the breakdown, which is the same figures per type.
 */
export function StockSummaryStrip({
  purposeCode,
  noun,
  selectedFormId,
}: {
  purposeCode: string
  /** What one row is called here — a component, a part. */
  noun: string
  /** The type the screen is narrowed to, if any. Its row in the breakdown is marked. */
  selectedFormId?: string | null
}) {
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId)
  const [isOpen, setOpen] = useState(false)

  const { data, isLoading } = useQuery<StockSummary>({
    queryKey: ["stock-summary", purposeCode, activeSpaceId],
    queryFn: () => stockApi.summary(purposeCode).then((response) => response.data),
    enabled: Boolean(activeSpaceId),
    staleTime: 30_000,
  })

  if (isLoading) {
    return <Skeleton className="h-8 w-full" />
  }

  // ⚠️ Nothing recorded is not an error and not worth a strip of zeroes — the empty state below the list
  // already says it, and saying it twice is how a screen starts to nag.
  if (!data || data.rows === 0) {
    return null
  }

  const worth = data.value.length > 0 ? data.value.map(formatAmount).join(" · ") : "—"

  return (
    <section className="flex flex-col overflow-hidden rounded-md border bg-card/50 text-xs">
      <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
        <span className="flex items-baseline gap-1.5">
          <span className="font-display text-sm font-semibold text-primary">{worth}</span>
          <span className="text-muted-foreground">worth</span>
        </span>

        <span aria-hidden="true" className="text-muted-foreground/40">
          ·
        </span>

        <span className="flex items-baseline gap-1.5">
          <span className="font-medium">{new Intl.NumberFormat().format(data.rows)}</span>
          <span className="text-muted-foreground">
            {noun}
            {data.rows === 1 ? "" : "s"}
          </span>
        </span>

        <span aria-hidden="true" className="text-muted-foreground/40">
          ·
        </span>

        <span className="flex items-baseline gap-1.5">
          <span className="font-medium">{new Intl.NumberFormat().format(data.units)}</span>
          <span className="text-muted-foreground">on hand</span>
        </span>

        {/* ⚠️ The reason a total is a dash, said once and quietly. "0" alone would send somebody to look
            at their rows, when what is missing is one line of the type's own configuration. */}
        {data.value.length === 0 && (
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={whyNothingIsWorth(data)}>
            {whyNothingIsWorth(data)}
          </span>
        )}

        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setOpen((previous) => !previous)}
          className="ml-auto flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        >
          by type
          <ChevronDown className={cn("size-3 transition-transform", isOpen && "rotate-180")} />
        </button>
      </div>

      {isOpen && (
        <div className="flex flex-col border-t">
          {data.byType.map((type) => (
            <div
              key={type.formId}
              className={cn(
                "flex items-center gap-2 px-3 py-1 text-[11px]",
                type.formId === selectedFormId && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              <span aria-hidden="true" className="w-4 shrink-0 text-center">
                {type.icon ?? "▣"}
              </span>
              <span className="min-w-0 flex-1 truncate">{type.formName}</span>
              <span className="shrink-0 text-muted-foreground">
                {new Intl.NumberFormat().format(type.rows)} · {new Intl.NumberFormat().format(type.units)} on hand
              </span>
              <span className="w-32 shrink-0 truncate text-right font-mono">
                {type.value.length > 0 ? type.value.map(formatAmount).join(" · ") : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * Why the total is a dash — a different sentence in each case, and only one of them is nobody's fault.
 *
 * ⚠️ **"0" would be a lie of omission.** A workspace whose types name no price field, one whose types
 * name no quantity field, and one where nobody has filled either in are three situations; two of them are
 * a configuration somebody can fix in a minute, and a bare zero sends them to look at their rows instead.
 */
function whyNothingIsWorth(summary: StockSummary): string {
  if (summary.pricedRows === 0) {
    return "no row carries a price — a type names that field on its Pricing pane"
  }

  if (summary.countedRows === 0) {
    return `${summary.pricedRows} priced, but nothing says how many — that is the Stock pane's quantity field`
  }

  return "priced and counted rows do not overlap yet"
}

/**
 * ⚠️ **Formatted as a plain number with the currency beside it, never through `style: "currency"`.** The
 * unit here is whatever somebody typed into a quantity field — `UAH`, `грн`, `pcs` if they configured
 * the wrong field — and `Intl` throws on anything that is not a currency code.
 */
function formatAmount(value: StockValue): string {
  const amount = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value.amount)

  return value.currency ? `${amount} ${value.currency}` : amount
}
