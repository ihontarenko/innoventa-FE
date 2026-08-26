import { Link } from "react-router-dom"
import { ExternalLink, Link2Off, MapPin, Search, ShoppingCart } from "lucide-react"
import { Badge, Button, cn } from "@jmouse/ui"
import { FieldValue } from "@/components/form/FieldValue"
import { EntryGap, EntryLine, EntryPanel } from "@/components/entry/EntryPanel"
import type { StockCapability, SupplyCapability } from "@/components/entry/entryCapabilities"
import { TOMBSTONE_LABEL } from "@/api/optionSources"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"
import { hostOf } from "@/lib/webAddress"
import type { FieldDetail, FormEntry } from "@/types"

/** ⚠️ A stored value is a string, always. A field holding "250 pcs" is not a number and must not read as one. */
function numberOf(entry: FormEntry, field: FieldDetail | null): number | null {
  if (!field) {
    return null
  }

  const parsed = Number.parseFloat(entry.fieldValues[field.name] ?? "")

  return Number.isFinite(parsed) ? parsed : null
}

function valueOf(entry: FormEntry, field: FieldDetail | null): string {
  return field ? (entry.fieldValues[field.name] ?? "") : ""
}

/**
 * How many there are, and whether that is enough.
 *
 * ⚠️ **No bar, and that is the point.** There were two real numbers here — how many there are and the
 * minimum — and no maximum anywhere: a shelf has no declared capacity. A bar drawn against
 * `threshold × 6` was a *percentage of nothing*, and a reader asking what full meant was asking the
 * right question. What the two numbers actually support is a **distance**, so that is what is said:
 * how far above the minimum, or how far short of it.
 *
 * ⚠️ **And no judgement at all where no minimum is configured.** *In stock* against nothing to compare
 * to is the same invented reference in words.
 */
export function EntryStockPanel({ entry, stock }: { entry: FormEntry; stock: StockCapability }) {
  const quantity = numberOf(entry, stock.quantity)
  const threshold = numberOf(entry, stock.threshold)
  const location = valueOf(entry, stock.location)
  const isLow = quantity !== null && threshold !== null && quantity < threshold

  if (quantity === null) {
    return (
      <EntryPanel title="Stock">
        <EntryGap>No quantity recorded yet — this type counts stock, so the number is a field to fill in.</EntryGap>
      </EntryPanel>
    )
  }

  const unit = stock.quantity.unit ? ` ${stock.quantity.unit}` : ""
  const distance = threshold === null ? null : quantity - threshold

  return (
    <EntryPanel title="Stock">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-2xl leading-none font-semibold tabular-nums">{quantity}</span>
        {stock.quantity.unit && <span className="text-xs text-muted-foreground">{stock.quantity.unit}</span>}
        <span className="flex-1" />
        {isLow ? (
          <Badge variant="destructive">Low</Badge>
        ) : (
          threshold !== null && <Badge variant="secondary">In stock</Badge>
        )}
      </div>

      {/* ⚠️ The one sentence the two numbers really support. "165 above the minimum" is a fact; a bar at
          58% would have been an answer to a question nobody asked. */}
      {distance !== null && (
        <p className={cn("text-xs", isLow ? "text-destructive" : "text-muted-foreground")}>
          {distance >= 0 ? (
            <>
              <span className="font-medium tabular-nums">{distance}</span>
              {unit} above the minimum of <span className="tabular-nums">{threshold}</span>
            </>
          ) : (
            <>
              <span className="font-medium tabular-nums">{Math.abs(distance)}</span>
              {unit} short of the minimum of <span className="tabular-nums">{threshold}</span>
            </>
          )}
        </p>
      )}

      {location && stock.location && (
        <>
          <hr className="border-border" />
          <EntryLine label={stock.location.label}>
            <StoredLocation entry={entry} field={stock.location} />
          </EntryLine>
        </>
      )}
    </EntryPanel>
  )
}

/**
 * Where it is kept — as a place if the field is one, as text if it is still a sentence.
 *
 * ⚠️ **The stored value of a sourced field is an IDENTITY, not a name.** A field pointed at the Locations
 * catalogue holds a location id; printing it raw shows somebody a 36-character string where a shelf
 * should be. The name comes back on the row as `optionLabels`, resolved server-side, because the browser
 * has no way to work it out.
 *
 * ⚠️ **Both shapes are drawn, and that is not indecision.** A workspace whose `storage_location` predates
 * the catalogue still holds "Drawer A-3, bin 12" as free text, and the record has to read correctly there
 * too — the panel says what it has rather than what it wishes it had.
 */
function StoredLocation({ entry, field }: { entry: FormEntry; field: FieldDetail }) {
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)
  const stored = entry.fieldValues[field.name] ?? ""
  const resolved = entry.optionLabels?.[field.name]?.[stored]

  /* Free text, or a source whose value has lost what it pointed at — either way there is nowhere to go. */
  if (!resolved || resolved === TOMBSTONE_LABEL || !spaceSlug) {
    return <span className={resolved === TOMBSTONE_LABEL ? "text-destructive" : undefined}>{resolved ?? stored}</span>
  }

  return (
    <Link
      to={`${spaceSectionPath(spaceSlug, "locations")}?location=${encodeURIComponent(stored)}`}
      className="inline-flex items-center gap-1 text-primary hover:underline"
    >
      <MapPin className="size-3 shrink-0" />
      {resolved}
    </Link>
  )
}

/**
 * What it costs, and one control that goes and buys it.
 *
 * ⚠️ **The buy address is a BUTTON naming the distributor, not a line of URL.** `www.digikey.com/…/976369`
 * truncated into a table row is unreadable and unclickable-looking at once; *Buy on digikey.com* says
 * both what pressing it does and who it deals with. Every configured address on a record gets the same
 * treatment for the same reason — see `hostOf`.
 *
 * ⚠️ **And it lives HERE rather than under Links.** One address, one home: it used to read once beside
 * the price and again in the links tab, which is exactly the duplication that made the tab look like a
 * copy of the panel.
 */
export function EntrySupplyPanel({
  entry,
  supply,
  onLookUp,
}: {
  entry: FormEntry
  supply: SupplyCapability
  onLookUp?: () => void
}) {
  const buyAddress = valueOf(entry, supply.buyUrl)
  const buyHost = hostOf(buyAddress)

  const lines = [supply.price, supply.vendor, supply.sku, supply.leadTime]
    .filter((field): field is FieldDetail => !!field)
    .filter((field) => !!entry.fieldValues[field.name])

  if (lines.length === 0 && !buyAddress) {
    return (
      <EntryPanel title="Supply">
        <EntryGap
          action={
            onLookUp && (
              <Button variant="outline" size="xs" className="shrink-0" onClick={onLookUp}>
                <Search className="size-3" />
                Look up
              </Button>
            )
          }
        >
          No price or supplier yet.
        </EntryGap>
      </EntryPanel>
    )
  }

  return (
    <EntryPanel title="Supply">
      {lines.map((field) => (
        <EntryLine key={field.id} label={field.label}>
          <FieldValue
            value={entry.fieldValues[field.name] ?? ""}
            elementType={field.elementType}
            unit={field.unit}
            options={field.options}
          />
        </EntryLine>
      ))}

      {buyAddress && (
        <Button asChild size="sm" className="mt-1 w-full">
          <a href={buyAddress} target="_blank" rel="noreferrer">
            <ShoppingCart className="size-3.5" />
            {buyHost ? `Buy on ${buyHost}` : (supply.buyUrl?.label ?? "Where to buy")}
          </a>
        </Button>
      )}
    </EntryPanel>
  )
}

/**
 * The datasheet a record does not have yet.
 *
 * ⚠️ **Only the GAP lives here.** A datasheet that exists is read in its own tab — as the document when
 * this installation holds the file, as a link when somebody else does. Repeating it in the column beside
 * the tab would be the third copy of one fact on one screen.
 */
export function EntryDatasheetGapPanel({ onLookUp }: { onLookUp?: () => void }) {
  return (
    <EntryPanel title="Datasheet">
      <EntryGap
        action={
          onLookUp && (
            <Button variant="outline" size="xs" className="shrink-0" onClick={onLookUp}>
              <Search className="size-3" />
              Look up
            </Button>
          )
        }
      >
        No datasheet yet — this type can hold one.
      </EntryGap>
    </EntryPanel>
  )
}

/**
 * Where this record points, once Supply and the picture tab have taken theirs.
 *
 * ⚠️ **Each address is a control naming its host**, for the same reason the buy button is. A list of
 * shortened URLs is a list nobody reads; a list of *Open on onsemi.com* is a list of destinations.
 */
export function EntryLinksList({ entry, fields }: { entry: FormEntry; fields: FieldDetail[] }) {
  const filled = fields.filter((field) => !!entry.fieldValues[field.name])
  const empty = fields.filter((field) => !entry.fieldValues[field.name])

  if (fields.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      {filled.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-6 py-8 text-center">
          <Link2Off className="size-5 text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground">
            None of this type's {fields.length} address field{fields.length === 1 ? " has" : "s have"} been
            filled in.
          </span>
        </div>
      ) : (
        filled.map((field) => {
          const address = entry.fieldValues[field.name] ?? ""
          const host = hostOf(address)

          return (
            <div key={field.id} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[10px] tracking-[0.06em] text-muted-foreground uppercase">
                  {field.label}
                </span>
                <span className="min-w-0 truncate text-xs text-muted-foreground">{address}</span>
              </div>

              <Button asChild variant="outline" size="sm" className="shrink-0">
                <a href={address} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />
                  {host ? `Open on ${host}` : "Open"}
                </a>
              </Button>
            </div>
          )
        })
      )}

      {filled.length > 0 && empty.length > 0 && (
        <p className="px-1 text-[11px] text-muted-foreground">
          {empty.map((field) => field.label).join(", ")} — not filled in.
        </p>
      )}
    </div>
  )
}
