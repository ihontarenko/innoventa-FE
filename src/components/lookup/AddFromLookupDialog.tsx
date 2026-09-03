import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Row,
  RowGroup,
  RowList,
  RowMeta,
  RowTitle,
  Skeleton,
} from "@jmouse/ui"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { SYNONYM_GROUP_MANUFACTURER } from "@/api/valueSynonyms"
import type { LookupOffer } from "@/api/lookup"
import { useForm } from "@/hooks/useForms"
import { useWorkspaceForms } from "@/hooks/useWorkspaceForms"
import { useCreateValueSynonym, useValueSynonyms } from "@/hooks/useValueSynonyms"
import { PRICING_CONFIG_KEYS } from "@/lib/formConfigs"
import {
  OFFER_MAPPINGS,
  coerceForField,
  isCurrencyLost,
  synonymsForMapping,
  type CoercionStatus,
} from "@/lib/lookupMapping"
import type { FieldDetail } from "@/types"

/**
 * ⚠️ **The component types, which are `CATALOG` forms — this said `INVENTORY` until the purposes
 * swapped roles.** A distributor's answer describes a *part*: its manufacturer, its package, its
 * datasheet. Those are the catalogue's fields and the `catalogue.*` mapping this dialog reads is
 * declared on catalogue forms — so after the swap it offered the one position schema, whose mapping is
 * empty, and the dialog reported having nothing to map onto.
 */
const COMPONENT_TYPE_PURPOSE = "CATALOG"

const STATUS_MARK: Record<CoercionStatus, { label: string; tone: "plain" | "good" | "warn" } | null> = {
  text: null,
  direct: null,
  coerced: { label: "matched to an option", tone: "good" },
  unmatched: { label: "no matching option", tone: "warn" },
}

/**
 * Turning a distributor's answer into a row of one of *this workspace's* component types.
 *
 * ⚠️ **This is the one place the two levels legitimately meet, and the direction matters.** The lookup is
 * the high level — it is about electronics, and it knows nothing about any particular form. The type is
 * the low level. What joins them is the type's own `catalogue.*` configuration, so the lookup never guesses
 * which of a form's twenty fields means "manufacturer": either the form says, or the mapping is empty and
 * this dialog says so.
 *
 * ⚠️ **An unmatched choice value is shown and not written.** A distributor's spelling put into a dropdown
 * as a brand-new option splits every filter and count over that field in two, silently and for good — so
 * the row offers to record the synonym instead, which fixes it for every future lookup as well.
 */
export function AddFromLookupDialog({
  offer,
  onMapped,
  onClose,
}: {
  offer: LookupOffer
  /** Handed the form and the values it should open prefilled with. */
  onMapped: (formId: string, values: Record<string, string>) => void
  onClose: () => void
}) {
  const { data: types = [], isLoading: typesLoading } = useWorkspaceForms(COMPONENT_TYPE_PURPOSE)
  const [selectedFormId, setSelectedFormId] = useState("")

  const { data: form, isLoading: formLoading } = useForm(selectedFormId || undefined)
  const { data: synonyms = [] } = useValueSynonyms()
  const createSynonym = useCreateValueSynonym()

  const manufacturerSynonyms = synonyms.filter((one) => one.synonymGroup === SYNONYM_GROUP_MANUFACTURER)

  const mapped = useMemo(() => {
    if (!form) {
      return []
    }

    const configs = form.config ?? {}
    const byName = new Map(form.fields.map((field) => [field.name, field]))

    return OFFER_MAPPINGS.flatMap((mapping) => {
      const fieldName = configs[mapping.configKey]?.trim()

      if (!fieldName) {
        return []
      }

      // ⚠️ The field is resolved BEFORE the value is read, not after. A price carries its currency only
      // where the field it is going into can hold one, so the mapping has to be told what it is writing to.
      const field = byName.get(fieldName) as FieldDetail | undefined
      const raw = mapping.read(offer, field)

      if (!raw) {
        return []
      }

      const coerced = coerceForField(raw, field, synonymsForMapping(mapping.configKey, manufacturerSynonyms))

      return [{ mapping, fieldName, field, raw, ...coerced }]
    })
  }, [form, offer, manufacturerSynonyms])

  // ⚠️ An unmatched value is left out of what gets written. It is shown so somebody can fix it, not so
  // it can be quietly stored as an option nobody chose.
  const values = Object.fromEntries(
    mapped.filter((entry) => entry.status !== "unmatched").map((entry) => [entry.fieldName, entry.value]),
  )

  const unmatched = mapped.filter((entry) => entry.status === "unmatched")

  const currencyIsLost = mapped.some(
    (entry) => entry.mapping.configKey === PRICING_CONFIG_KEYS.PRICE_FIELD && isCurrencyLost(offer, entry.field),
  )

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">{offer.partNumber ?? "This part"}</DialogTitle>
          <DialogDescription>
            Which component type is it? What the distributor said is written into the fields that type
            names for it — nothing else is guessed at.
          </DialogDescription>
        </DialogHeader>

        {typesLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : types.length === 0 ? (
          <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            This workspace shows no component types yet, so there is nothing to record a part against.
          </p>
        ) : (
          <PlainSelect value={selectedFormId} onChange={setSelectedFormId}>
            <option value="">— pick a type —</option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.icon ? `${type.icon} ` : ""}
                {type.name}
              </option>
            ))}
          </PlainSelect>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {formLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !form ? null : mapped.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
              <span className="font-medium">{form.name}</span> does not say which of its fields mean a part
              number, a manufacturer or a price — so there is nothing to fill in from a lookup. Its schema
              settings are where that is decided.
            </p>
          ) : (
            <RowGroup label="What gets filled in" tally={`${Object.keys(values).length} of ${mapped.length}`}>
              <RowList>
                {mapped.map((entry) => {
                  const mark = STATUS_MARK[entry.status]

                  return (
                    <Row
                      key={entry.fieldName}
                      tone={entry.status === "unmatched" ? "danger" : undefined}
                      trailing={
                        mark ? (
                          <Badge variant={mark.tone === "warn" ? "destructive" : "secondary"}>{mark.label}</Badge>
                        ) : undefined
                      }
                    >
                      <RowMeta>
                        {entry.mapping.label} → <span className="font-mono">{entry.fieldName}</span>
                      </RowMeta>
                      <RowTitle>{entry.value}</RowTitle>
                    </Row>
                  )
                })}
              </RowList>
            </RowGroup>
          )}

          {/* ⚠️ Said here because this is the last moment anybody can prevent it. The price is written
              either way; what is lost is the currency, and only the person choosing the type can change
              a plain number field into one that holds a unit. */}
          {currencyIsLost && (
            <p className="mt-3 rounded-md border border-dashed p-2.5 text-[11px] text-muted-foreground">
              ⚠️ The distributor quoted this in <span className="font-mono">{offer.currency}</span>, and
              the price field of this type is a plain number — so the amount is recorded and the currency
              is not. It will not join the workspace's total until that field holds a value and a unit
              together, which is its Catalogue pane's to change.
            </p>
          )}

          {unmatched.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 rounded-md border border-dashed p-2.5">
              <p className="text-[11px] text-muted-foreground">
                ⚠️ These are left out. Putting a distributor's spelling into a dropdown creates a second
                option meaning the same thing — record it as a synonym instead and every future lookup
                lands correctly.
              </p>

              {unmatched.map((entry) => (
                <div key={entry.fieldName} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{entry.raw}</span>
                  <span className="text-xs text-muted-foreground">→</span>

                  <PlainSelect
                    value=""
                    className="h-7 w-40 text-xs"
                    onChange={(canonical) => {
                      if (!canonical) {
                        return
                      }

                      createSynonym.mutate(
                        {
                          synonymGroup: SYNONYM_GROUP_MANUFACTURER,
                          aliasValue: entry.raw,
                          canonicalValue: canonical,
                        },
                        {
                          onSuccess: () => toast.success(`${entry.raw} → ${canonical} recorded.`),
                          onError: () => toast.error("That synonym was not recorded."),
                        },
                      )
                    }}
                  >
                    <option value="">pick the option it means…</option>
                    {(entry.field?.options ?? []).map((option) => (
                      <option key={option.optionValue} value={option.optionValue}>
                        {option.optionLabel}
                      </option>
                    ))}
                  </PlainSelect>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {/* ⚠️ Opens the entry rather than creating it. Everything above is a *proposal*, and a lookup
              never has the quantity, the shelf or the price actually paid — the person does. */}
          <Button
            disabled={!form || mapped.length === 0}
            onClick={() => onMapped(form!.id, values)}
          >
            Fill a new one in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
