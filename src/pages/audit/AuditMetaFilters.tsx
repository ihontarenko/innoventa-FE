import { useMemo, useState } from "react"
import { Button, Input } from "@jmouse/ui"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import type { AuditMetaCatalogView, AuditMetaComparison, AuditMetaFilter, AuditMetaKeyView } from "@/api/audit"

/**
 * Filtering on the module-specific detail beside an event — the form an entry belonged to, the size of a
 * file, the quantity on a project line.
 *
 * ⚠️ **Every key offered here comes from the catalogue**, which a scan builds, rather than from a query
 * over the event store. That is the difference between a filter panel that opens instantly and one that
 * runs `SELECT DISTINCT` over the largest table in the installation every time somebody clicks it. The
 * cost is a catalogue only as fresh as the last scan, which is why the button below says when that was
 * instead of hiding it.
 *
 * A key with few enough distinct values offers them as a choice; above the threshold it takes typed
 * input, and the two look different so nobody guesses at somebody else's spelling.
 */

/** Only the orderable comparisons are offered for a number or a date; the rest would be nonsense. */
const TEXT_COMPARISONS: AuditMetaComparison[] = ["EQUALS", "NOT_EQUALS", "CONTAINS"]
const ORDERED_COMPARISONS: AuditMetaComparison[] = ["EQUALS", "NOT_EQUALS", "GREATER_THAN", "LESS_THAN"]

const COMPARISON_LABELS: Record<AuditMetaComparison, string> = {
  EQUALS: "is",
  NOT_EQUALS: "is not",
  CONTAINS: "contains",
  GREATER_THAN: "greater than",
  LESS_THAN: "less than",
}

/**
 * The one place this question is asked, mirroring `MetaComparison.isOrdering()` on the server.
 *
 * An ordering comparison is the one that cannot take a value from a dropdown — "greater than one of
 * these four spellings" is not a question — and the one the backend answers arithmetically.
 */
function isOrdering(comparison: AuditMetaComparison): boolean {
  return comparison === "GREATER_THAN" || comparison === "LESS_THAN"
}

/** A number or a date is orderable; anything else is compared as text. */
function isOrderableType(metaKey: AuditMetaKeyView | undefined): boolean {
  return metaKey?.valueType === "NUMBER" || metaKey?.valueType === "TIMESTAMP"
}

export function AuditMetaFilters({
  catalogue,
  filters,
  onChange,
  onScan,
  isScanning,
}: {
  catalogue: AuditMetaCatalogView | undefined
  filters: AuditMetaFilter[]
  onChange: (filters: AuditMetaFilter[]) => void
  onScan: () => void
  isScanning: boolean
}) {
  const [limitNotice, setLimitNotice] = useState(false)

  const keys = useMemo(() => catalogue?.keys ?? [], [catalogue])

  // The server owns the ceiling and enforces it; this only bounds the frame before the catalogue has
  // loaded, when there is nothing to filter on anyway.
  const atLimit = catalogue !== undefined && filters.length >= catalogue.maximumFilters

  /** Keys that have never been written are offered last: a filter on one can only return nothing. */
  const offeredKeys = useMemo(
    () => [...keys].sort((left, right) => Number(right.eventCount > 0) - Number(left.eventCount > 0)),
    [keys],
  )

  function addFilter() {
    if (atLimit) {
      setLimitNotice(true)
      return
    }

    const first = offeredKeys[0]

    if (!first) {
      return
    }

    onChange([...filters, { key: first.key, comparison: "EQUALS", value: "" }])
  }

  function updateFilter(position: number, changes: Partial<AuditMetaFilter>) {
    onChange(filters.map((filter, index) => (index === position ? { ...filter, ...changes } : filter)))
  }

  function removeFilter(position: number) {
    setLimitNotice(false)
    onChange(filters.filter((_unused, index) => index !== position))
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold tracking-[0.04em] uppercase">Details</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          disabled={isScanning}
          title="Rebuild the catalogue of recorded details from what the log actually holds"
          onClick={onScan}
        >
          {isScanning ? "Scanning…" : "Scan"}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">{describeScan(catalogue)}</p>

      {filters.map((filter, position) => (
        <MetaFilterRow
          key={position}
          filter={filter}
          metaKey={keys.find((candidate) => candidate.key === filter.key)}
          offeredKeys={offeredKeys}
          onChange={(changes) => updateFilter(position, changes)}
          onRemove={() => removeFilter(position)}
        />
      ))}

      <Button variant="outline" size="sm" disabled={offeredKeys.length === 0} onClick={addFilter}>
        + Detail filter
      </Button>

      {/* The limit is explained rather than enforced silently. A disabled button teaches nobody anything,
          and "why can I not add a fourth" is a question with a real answer. */}
      {limitNotice && atLimit && <p className="text-[11px] text-warning">{catalogue?.limitExplanation}</p>}

      {offeredKeys.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          The catalogue is empty. Press <strong>Scan</strong> to build it from what has been recorded so far.
        </p>
      )}
    </div>
  )
}

function MetaFilterRow({
  filter,
  metaKey,
  offeredKeys,
  onChange,
  onRemove,
}: {
  filter: AuditMetaFilter
  metaKey: AuditMetaKeyView | undefined
  offeredKeys: AuditMetaKeyView[]
  onChange: (changes: Partial<AuditMetaFilter>) => void
  onRemove: () => void
}) {
  const orderable = isOrderableType(metaKey)
  const offersChoice =
    metaKey !== undefined && !metaKey.freeText && metaKey.values.length > 0 && !isOrdering(filter.comparison)

  return (
    <div className="flex flex-col gap-1 rounded-md border p-2">
      <div className="flex items-center gap-1">
        <PlainSelect
          value={filter.key}
          className="font-mono text-xs"
          onChange={(key) => onChange({ key, value: "" })}
        >
          {offeredKeys.map((candidate) => (
            <option key={candidate.key} value={candidate.key}>
              {candidate.key}
              {candidate.eventCount === 0 ? " (never written)" : ""}
            </option>
          ))}
        </PlainSelect>
        <button
          type="button"
          aria-label="Remove this filter"
          className="rounded px-1.5 text-xs text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          ×
        </button>
      </div>

      <div className="flex items-center gap-1">
        <PlainSelect
          value={filter.comparison}
          className="w-32 shrink-0"
          onChange={(comparison) => onChange({ comparison: comparison as AuditMetaComparison })}
        >
          {(orderable ? ORDERED_COMPARISONS : TEXT_COMPARISONS).map((comparison) => (
            <option key={comparison} value={comparison}>
              {COMPARISON_LABELS[comparison]}
            </option>
          ))}
        </PlainSelect>

        {offersChoice ? (
          <PlainSelect value={filter.value} onChange={(value) => onChange({ value })}>
            <option value="">Any value…</option>
            {metaKey.values.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </PlainSelect>
        ) : (
          <Input
            className="h-8 text-sm"
            type={metaKey?.valueType === "NUMBER" ? "number" : "text"}
            value={filter.value}
            placeholder={placeholderFor(metaKey)}
            onChange={(event) => onChange({ value: event.target.value })}
          />
        )}
      </div>

      {metaKey && <MetaKeyNote metaKey={metaKey} />}
    </div>
  )
}

/**
 * What the catalogue knows about this key.
 *
 * ⚠️ The two lopsided sources are named out loud, because each one is a defect somebody can go and fix: a
 * key nothing has ever written is a recording path that never runs, and a key nothing declares is a
 * literal written past the registry.
 */
function MetaKeyNote({ metaKey }: { metaKey: AuditMetaKeyView }) {
  if (metaKey.eventCount === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Declared, never written — nothing records this yet, so any filter on it returns nothing.
      </p>
    )
  }

  return (
    <p className="text-[11px] text-muted-foreground">
      {metaKey.eventCount.toLocaleString()} events
      {metaKey.lastSeenAt && <> · last {new Date(metaKey.lastSeenAt).toLocaleDateString()}</>}
      {metaKey.source === "OBSERVED" && <span className="text-warning"> · undeclared</span>}
    </p>
  )
}

function placeholderFor(metaKey: AuditMetaKeyView | undefined) {
  if (metaKey?.valueType === "TIMESTAMP") {
    return "2026-07-31T00:00:00"
  }

  return metaKey?.freeText ? "Type a value…" : "Value"
}

function describeScan(catalogue: AuditMetaCatalogView | undefined) {
  if (!catalogue?.lastScannedAt) {
    return "Never scanned."
  }

  return `Catalogue built ${new Date(catalogue.lastScannedAt).toLocaleString()}`
}
