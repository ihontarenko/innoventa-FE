import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Skeleton, cn } from "@jmouse/ui"
import { type StockSummary, type StockValue, type UnconvertedValue } from "@/api/stock"
import { useStockSummary } from "@/hooks/useStock"
import { relativeTime } from "@/lib/dates"

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
 * ⚠️ **One approximate figure in front, the exact per-currency ones behind the disclosure.** A price
 * field is a quantity — a number and a unit — so a workspace pricing some types in hryvnia and some in
 * dollars genuinely has two totals, and adding them without rates would produce a number that is
 * confidently meaningless. With rates it produces an estimate, which is what somebody asked for and is
 * marked `≈`. Neither replaces the other: the list is the truth and the figure is the answer.
 *
 * ⚠️ **The rates' age sits next to the figure.** A converted total on three-month-old rates is as
 * misleading as no total at all, and this strip is the only place anybody would notice.
 *
 * ⚠️ **Money that could not be converted is NAMED, never folded in.** Treating an unlabelled price as
 * the base currency, or a currency with no rate as worth nothing, both give a figure that is wrong by an
 * unknown amount and looks exactly like a right one.
 *
 * ⚠️ **It does not follow the screen's filter, and staying still is how it says so.** The figure answers
 * *what do I hold*, which is a property of the workspace rather than of whatever is in the search box; a
 * total that moved with the filter would be read as the whole and be wrong. One type is asked by opening
 * the breakdown, which is the same figures per type.
 */
export function StockSummaryStrip({
  noun,
  selectedFormId,
}: {
  /** What one row is called here — a component, a part. */
  noun: string
  /** The type the screen is narrowed to, if any. Its row in the breakdown is marked. */
  selectedFormId?: string | null
}) {
  const [isOpen, setOpen] = useState(false)

  // ⚠️ The same hook the type rail uses, so the two are one request rather than two answers that can
  // disagree about what the workspace holds.
  const { data, isLoading } = useStockSummary()

  if (isLoading) {
    return <Skeleton className="h-8 w-full" />
  }

  // ⚠️ Nothing recorded is not an error and not worth a strip of zeroes — the empty state below the list
  // already says it, and saying it twice is how a screen starts to nag.
  if (!data || data.rows === 0) {
    return null
  }

  const worth = headlineOf(data)
  const excluded = data.unconverted ?? []
  const leftOut = leftOutSummary(excluded)

  return (
    /* ⚠️ **No frame of its own.** It sits in the toolbar of `ListScreen`, which already draws the
       rule under it; a rounded card inside that rule is a box inside a box — the "облізлий блок" the
       whole layout rule exists to stop. Ivan, 2026-08-31: *«ціновий віджет прибрати закруглення, не
       вписується в диз»*. */
    <section className="flex flex-col text-xs">
      <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
        <span className="flex items-baseline gap-1.5">
          <span className="font-display text-sm font-semibold text-primary">{worth}</span>
          <span className="text-muted-foreground">worth</span>

          {/* Only beside a converted figure — the exact per-currency list is not an estimate and does
              not age, so dating it would say something untrue about it. */}
          {data.approximateValue && (
            <span className="text-[11px] text-muted-foreground" title={ratesTitle(data.ratesUpdatedAt)}>
              {data.ratesUpdatedAt ? `at rates from ${relativeTime(data.ratesUpdatedAt)}` : "at no rates yet"}
            </span>
          )}
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

        {/* ⚠️ Only when there is something to say. A permanent "0 low" would be a fifth number on a
            strip whose whole job is to be readable at a glance — and would make the one morning it
            says "3" look like the same furniture. */}
        {data.lowPositions > 0 && (
          <>
            <span aria-hidden="true" className="text-muted-foreground/40">
              ·
            </span>
            <span
              className="flex items-baseline gap-1.5 text-amber-600 dark:text-amber-400"
              title={
                data.emptyPositions > 0
                  ? `${data.emptyPositions} of them hold nothing at all`
                  : "Boxes holding less than the minimum written on them"
              }
            >
              <span className="font-medium">{new Intl.NumberFormat().format(data.lowPositions)}</span>
              <span className="opacity-80">below minimum</span>
            </span>
          </>
        )}

        {/* ⚠️ WHAT is missing, not why. The reason and the fix are one line each in the disclosure, and
            saying them here as well produced a strip that stated the same number four times and then
            contradicted itself — "27.3 worth" directly above "27.3 is outside the figure". */}
        {leftOut && (
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={leftOut}>
            {leftOut}
          </span>
        )}

        {/* The configuration cases, which are not about a currency at all: nothing priced, or nothing
            counted. They have no entry in the breakdown, so this is their only home. */}
        {!leftOut && data.value.length === 0 && (
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={whyNothingIsPriced(data)}>
            {whyNothingIsPriced(data)}
          </span>
        )}

        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setOpen((previous) => !previous)}
          className="text-muted-foreground hover:bg-accent/50 hover:text-foreground ml-auto flex shrink-0 items-center gap-1 px-1.5 py-0.5 text-[11px]"
        >
          by type
          <ChevronDown className={cn("size-3 transition-transform", isOpen && "rotate-180")} />
        </button>
      </div>

      {isOpen && (
        <div className="flex flex-col border-t">
          {/* ⚠️ Only where it says something the headline does not. The exact per-currency figures are
              worth showing beside an ESTIMATE; printed under a headline that already is that list they
              are the same line twice, and printed under a dash they are a nameless number presenting
              itself as a fact. So: only when a converted figure is on top, and only currencies. */}
          {data.approximateValue && namedValues(data.value).length > 0 && (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b bg-muted/30 px-3 py-1.5 text-[11px]">
              <span className="text-muted-foreground">exactly</span>
              {namedValues(data.value).map((value) => (
                <span key={value.currency} className="font-mono">
                  {formatAmount(value)}
                </span>
              ))}
            </div>
          )}

          {/* ⚠️ The only place the REASON is written. One line per thing left out, each ending in where
              it is fixed — the strip above says how much, this says why and by whom. */}
          {excluded.length > 0 && (
            <div className="flex flex-col gap-0.5 border-b bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
              {excluded.map((entry) => (
                <span key={`${entry.reason}-${entry.unit ?? "none"}`}>⚠️ {whyExcluded(entry)}</span>
              ))}
            </div>
          )}

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
              {/* ⚠️ The converted figure, because a breakdown is read to find WHERE the money is — and a
                  column of figures in three different currencies cannot be compared down a page. Same
                  rule as the headline: never a bare number. What the row actually holds is its `title`. */}
              <span
                className="w-32 shrink-0 truncate text-right font-mono"
                title={type.value.length > 0 ? type.value.map(formatAmount).join(" · ") : undefined}
              >
                {headlineOf(type)}
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
/**
 * The figure at the front — or a dash, which is a different claim from a number.
 *
 * ⚠️ **A number with no currency is NEVER shown as a worth.** This is the whole point of the feature and
 * it was got wrong the first time: the fallback rendered the exact per-currency list, and where that
 * list is the nameless bucket, `formatAmount` returns a bare `27.3`. The strip then read *"27.3 worth"*
 * directly above *"27.3 is outside the figure"* — claiming and disclaiming the same number two lines
 * apart. An unlabelled amount is not a smaller answer, it is not an answer.
 *
 * So there are exactly three outcomes, in order:
 *
 * | | |
 * |---|---|
 * | something converted | the estimate, marked `≈` |
 * | nothing converted, but everything held is in named currencies | the exact list — precise, unaddable, and honest |
 * | anything else | `—`, with what is missing said beside it |
 */
function headlineOf(holdings: { approximateValue?: StockValue; value: StockValue[] }): string {
  if (holdings.approximateValue) {
    return `≈ ${formatAmount(holdings.approximateValue)}`
  }

  const named = namedValues(holdings.value)

  // ⚠️ `every`, not `some`. A workspace holding 100 USD and 27.3 of nothing has no headline: printing the
  // dollars alone would be a total that quietly omits part of the shelf.
  if (named.length > 0 && named.length === holdings.value.length) {
    return named.map(formatAmount).join(" · ")
  }

  return "—"
}

/** ⚠️ Only the amounts that say what they are. The nameless bucket is reported, never displayed as money. */
function namedValues(value: StockValue[]): StockValue[] {
  return value.filter((entry) => Boolean(entry.currency))
}

/**
 * What is missing, in the fewest words that still name an amount.
 *
 * ⚠️ **The header says HOW MUCH; the disclosure says WHY.** They used to say both, in the same sentence,
 * one above the other. Splitting them is what makes the strip readable: somebody scanning sees that
 * 27.3 is not counted, and somebody who cares opens the breakdown and is told where to fix it.
 */
function leftOutSummary(excluded: UnconvertedValue[]): string {
  if (excluded.length === 0) {
    return ""
  }

  // ⚠️ Every one of them, joined — not a count. "3 figures left out" makes somebody open the breakdown
  // to learn a number they could have been shown; the line truncates instead, and carries the rest as
  // its own tooltip.
  return `left out: ${excluded.map(describeExcluded).join(" · ")}`
}

/** One excluded amount, said in a breath: `27.3 with no currency`, `12 “pcs”`, `40 USD, no rate`. */
function describeExcluded(entry: UnconvertedValue): string {
  const amount = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(entry.amount)

  if (entry.reason === "NO_CURRENCY") {
    return `${amount} with no currency`
  }

  if (entry.reason === "NOT_A_CURRENCY") {
    return `${amount} “${entry.unit}”`
  }

  return `${amount} ${entry.unit}, no rate`
}

/**
 * Why there is nothing to total at all — a configuration case, not a currency one.
 *
 * ⚠️ **"0" would be a lie of omission.** A workspace whose types name no price field, one whose types
 * name no quantity field, and one where nobody has filled either in are three situations; two of them
 * are a minute's configuration, and a bare zero sends somebody to look at their rows instead.
 */
function whyNothingIsPriced(summary: StockSummary): string {
  if (summary.pricedRows === 0) {
    return "no row carries a price — a type names that field on its Catalogue pane"
  }

  if (summary.countedRows === 0) {
    return `${summary.pricedRows} priced, but nothing says how many — that is the Stock pane's quantity field`
  }

  return "priced and counted rows do not overlap yet"
}

/**
 * Why one amount is outside the figure — and, more usefully, where the fix is.
 *
 * ⚠️ **Three reasons and three different screens.** Collapsing them into "could not be converted" would
 * be accurate and useless: the person reading it can fix all three, and only if they are told which.
 */
function whyExcluded(entry: UnconvertedValue): string {
  if (entry.reason === "NO_CURRENCY") {
    return "Prices with no currency — the type's price field is a plain number, which has nowhere to keep one. Its Catalogue pane is where that changes."
  }

  if (entry.reason === "NOT_A_CURRENCY") {
    return `“${entry.unit}” is not a currency this installation reads — either the wrong field is bound as the price, or the unit is a typo.`
  }

  return `${entry.unit} has no exchange rate yet — the Exchange rates screen is where that starts.`
}

/** ⚠️ The exact moment, because "5 days ago" is what a reader doubts when the figure looks wrong. */
function ratesTitle(ratesUpdatedAt: string | undefined): string {
  if (!ratesUpdatedAt) {
    return "No exchange rate has ever been synced, so this figure is only what was already in the base currency."
  }

  return `Exchange rates last synced ${new Date(ratesUpdatedAt).toLocaleString()}`
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
