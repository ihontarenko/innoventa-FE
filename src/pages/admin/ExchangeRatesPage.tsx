import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { RefreshCw, RotateCcw } from "lucide-react"
import { Badge, Button, Input, Row, RowGroup, RowList, Skeleton, cn } from "@jmouse/ui"
import { AccessDenied } from "@/components/AccessDenied"
import { PageHeader } from "@/components/PageHeader"
import { exchangeRatesApi, type ExchangeRateView, type ExchangeRatesResponse } from "@/api/exchangeRates"
import { relativeTime } from "@/lib/dates"
import { useAuthStore } from "@/stores/authStore"
import { platformItem, requiredPermissionsOf } from "@/navigation"

/** The declaration this screen is reached by — asked, never re-typed. See `AccessRequirement`. */
const EXCHANGE_RATES = platformItem("exchange-rates")

/**
 * What a currency is worth, and how old that answer is.
 *
 * ⚠️ **The pivot is stated at the top, and it is not the same question as the base currency.** With a
 * base of USD every number on this page is still quoted against the hryvnia, because that is what the
 * National Bank of Ukraine publishes — a page of rates that does not say what they are rates *to* is a
 * page of unlabelled numbers, and a reader who assumes they are rates to the base currency will read
 * every one of them backwards.
 *
 * ⚠️ **`MANUAL` is marked in the row, not in a tooltip.** A manual rate is deliberately immune to every
 * future sync, so a row that has silently stopped tracking the feed is exactly the thing somebody spends
 * an afternoon on. It is a badge, and Sync reports how many it left alone.
 *
 * ⚠️ **An empty table is not an error.** A fresh installation has simply never synced, and that looks
 * identical to a failed load in `query.data` — so the empty state says which it is and offers the
 * button, rather than rendering as a screen that did not work.
 */
export function ExchangeRatesPage() {
  const mayOpen = useAuthStore((state) => state.holds)
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState("")

  const { data, isLoading } = useQuery<ExchangeRatesResponse>({
    queryKey: ["exchange-rates"],
    queryFn: () => exchangeRatesApi.list().then((response) => response.data),
  })

  // ⚠️ Every mutation invalidates the stock summary too. The whole point of a rate is the figure above
  // the inventory, and a screen that changed the rate while that figure kept its old value would be two
  // screens disagreeing about one number.
  function settled() {
    queryClient.invalidateQueries({ queryKey: ["exchange-rates"] })
    queryClient.invalidateQueries({ queryKey: ["stock-summary"] })
  }

  const sync = useMutation({
    mutationFn: () => exchangeRatesApi.sync().then((response) => response.data),
    onSuccess: (outcome) => {
      settled()
      toast.success(
        `${outcome.written} rate${outcome.written === 1 ? "" : "s"} written from ${outcome.provider}` +
          (outcome.leftAsManual > 0 ? ` · ${outcome.leftAsManual} left alone as manual` : ""),
      )
    },
    onError: (error) => toast.error(detailOf(error) ?? "The rates could not be synced."),
  })

  const pin = useMutation({
    mutationFn: ({ currency, rate }: { currency: string; rate: number }) =>
      exchangeRatesApi.setManual(currency, rate).then((response) => response.data),
    onSuccess: (rate) => {
      settled()
      setEditing(null)
      toast.success(`${rate.currency} is pinned by hand and will not follow the feed until reset.`)
    },
    onError: (error) => toast.error(detailOf(error) ?? "That rate was not saved."),
  })

  const reset = useMutation({
    mutationFn: (currency: string) => exchangeRatesApi.resetToProvider(currency).then((response) => response.data),
    onSuccess: (rate) => {
      settled()
      toast.success(`${rate.currency} follows ${rate.source === "PROVIDER" ? "the feed" : "nothing"} again.`)
    },
    onError: (error) => toast.error(detailOf(error) ?? "That rate was not reset."),
  })

  if (!mayOpen(EXCHANGE_RATES)) {
    return (
      <AccessDenied
        title="Exchange rates"
        why="Exchange rates decide what every price in the installation is totalled in, so they are read over the installation rather than in a workspace — and they are the same job as choosing the base currency."
        permissions={requiredPermissionsOf(EXCHANGE_RATES)}
      />
    )
  }

  const isBusy = sync.isPending || pin.isPending || reset.isPending

  return (
    <>
      <PageHeader title="Exchange rates" description="What a currency is worth, and how old that answer is" />

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !data ? null : (
        <div className="flex max-w-4xl flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border bg-card/50 px-3 py-2 text-xs">
            <span className="flex items-baseline gap-1.5">
              <span className="text-muted-foreground">quoted against</span>
              <span className="font-mono font-semibold text-primary">{data.pivot}</span>
            </span>

            {/* ⚠️ Both, always. They are different questions and they are usually different answers. */}
            <span className="flex items-baseline gap-1.5">
              <span className="text-muted-foreground">this installation totals in</span>
              <span className="font-mono font-semibold">{data.baseCurrency}</span>
            </span>

            <span className="flex items-baseline gap-1.5">
              <span className="text-muted-foreground">from</span>
              <span className="font-mono">{data.provider}</span>
            </span>

            <span className="text-muted-foreground" title={data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : undefined}>
              {data.lastUpdated ? `synced ${relativeTime(data.lastUpdated)}` : "never synced"}
            </span>

            <Button size="sm" className="ml-auto h-7" disabled={isBusy} onClick={() => sync.mutate()}>
              <RefreshCw className={cn("size-3.5", sync.isPending && "animate-spin")} />
              Sync now
            </Button>
          </div>

          {data.pivot !== data.baseCurrency && (
            <p className="rounded-md border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
              ⚠️ These are rates to <span className="font-mono">{data.pivot}</span>, not to{" "}
              <span className="font-mono">{data.baseCurrency}</span> — that is what{" "}
              <span className="font-mono">{data.provider}</span> publishes. A total in{" "}
              <span className="font-mono">{data.baseCurrency}</span> is converted through{" "}
              <span className="font-mono">{data.pivot}</span>, which is exact enough and is worth knowing
              before comparing a figure here with one from a bank.
            </p>
          )}

          {data.rates.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
              No rate has been synced yet, so every price outside{" "}
              <span className="font-mono">{data.baseCurrency}</span> sits outside the inventory total.
              Sync now is what starts it.
            </p>
          ) : (
            <RowGroup label={`Rates to ${data.pivot}`} tally={`${data.rates.length}`}>
              <RowList>
                {data.rates.map((rate) => (
                  <RateRow
                    key={rate.currency}
                    rate={rate}
                    busy={isBusy}
                    editing={editing === rate.currency}
                    draft={draft}
                    onDraft={setDraft}
                    onStartEdit={() => {
                      setEditing(rate.currency)
                      setDraft(String(rate.rateToPivot))
                    }}
                    onCancelEdit={() => setEditing(null)}
                    onPin={(value) => pin.mutate({ currency: rate.currency, rate: value })}
                    onReset={() => reset.mutate(rate.currency)}
                  />
                ))}
              </RowList>
            </RowGroup>
          )}
        </div>
      )}
    </>
  )
}

function RateRow({
  rate,
  busy,
  editing,
  draft,
  onDraft,
  onStartEdit,
  onCancelEdit,
  onPin,
  onReset,
}: {
  rate: ExchangeRateView
  busy: boolean
  editing: boolean
  draft: string
  onDraft: (value: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onPin: (rate: number) => void
  onReset: () => void
}) {
  const isManual = rate.source === "MANUAL"
  const parsed = Number(draft)
  // ⚠️ Refused here as well as on the server. Zero is a division by zero waiting to happen and a
  // negative rate flips every sign it touches; the server says so too, but a disabled button explains
  // it before somebody presses it.
  const isValid = Number.isFinite(parsed) && parsed > 0

  return (
    <Row
      className={cn("items-center", editing && "bg-accent/60")}
      leading={<span className="w-12 shrink-0 font-mono text-xs text-foreground">{rate.currency}</span>}
      trailing={
        <>
          {isManual && <Badge variant="secondary">manual</Badge>}

          {editing ? (
            <>
              <Input
                autoFocus
                className="h-7 w-32 font-mono text-xs"
                value={draft}
                onChange={(event) => onDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && isValid) {
                    onPin(parsed)
                  }

                  if (event.key === "Escape") {
                    onCancelEdit()
                  }
                }}
              />
              <Button size="sm" className="h-7" disabled={busy || !isValid} onClick={() => onPin(parsed)}>
                Pin
              </Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={onCancelEdit}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              {/* The value is the button, the same as on System settings — an Edit beside it spends a
                  control restating what clicking a value obviously does. */}
              <button
                type="button"
                title="Pin this rate by hand"
                onClick={onStartEdit}
                className="rounded border px-2 py-0.5 text-right font-mono text-xs hover:bg-accent"
              >
                {rate.rateToPivot}
              </button>

              {isManual && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  title={`Let ${rate.currency} follow the feed again`}
                  disabled={busy}
                  onClick={onReset}
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              )}
            </>
          )}
        </>
      }
    >
      <span className="flex min-w-0 items-baseline gap-2.5">
        <span className="shrink-0 text-[11px] text-muted-foreground">
          1 {rate.currency} = <span className="font-mono">{rate.rateToPivot}</span> {rate.pivot}
        </span>
        <span
          className="min-w-0 truncate text-[11px] text-muted-foreground"
          title={new Date(rate.updatedAt).toLocaleString()}
        >
          {isManual ? "pinned" : "synced"} {relativeTime(rate.updatedAt)}
          {isManual && " — and no sync will change it until it is reset"}
        </span>
      </span>
    </Row>
  )
}

/** The backend's own sentence, which says what happened where "it failed" sends somebody to their network. */
function detailOf(error: unknown): string | undefined {
  return (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail
}
