import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { ArrowRight, Download, RefreshCw } from "lucide-react"
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  cn,
} from "@jmouse/ui"
import { composeFileFieldValue, parseFileFieldValue } from "@/api/files"
import { lookupApi, type LookupOffer, type LookupResult } from "@/api/lookup"
import { OfferCard } from "@/components/lookup/OfferCard"
import { SYNONYM_GROUP_MANUFACTURER, type ValueSynonym } from "@/api/valueSynonyms"
import { useImportFile } from "@/hooks/useFiles"
import { useValueSynonyms } from "@/hooks/useValueSynonyms"
import {
  ATTACHMENT_MAPPINGS,
  OFFER_MAPPINGS,
  coerceForField,
  isAttachableField,
  synonymsForMapping,
} from "@/lib/lookupMapping"
import { LOOKUP_PROVIDERS } from "@/lib/lookupProviders"
import type { FieldDetail, FormDetail, FormEntry } from "@/types"

/**
 * One thing a chosen offer would change about the row.
 *
 * ⚠️ **A line whose `source` is set is a FILE that does not exist yet.** Its `next` is the name the
 * download is expected to have, shown so somebody can recognise it; the value actually written is
 * composed from what the server answers once Apply is pressed, and never before.
 */
interface LookupLine {
  key: string
  label: string
  current: string
  next: string
  /** The address to fetch, for a line that keeps a copy rather than a string. */
  source?: string
  /** ⚠️ A value that would become a NEW option on a choice field — offered, never written. */
  isRefused: boolean
  isSame: boolean
}

/**
 * Asking a distributor about a row you already hold.
 *
 * ⚠️ **A DIFF, not a set of toggles.** The old interface offered one "sync" button per mapped field, so
 * applying a lookup meant pressing five things and finding out afterwards what each had done. Here the
 * offer is shown against what the row already says — *this is what you have, this is what they say* —
 * and only the lines that actually differ are ticked. Nothing is written until Apply.
 *
 * ⚠️ **A datasheet and a picture are lines on that same diff, not buttons beside it.** They are the one
 * kind of line that costs a download, so they are ticked and applied with everything else rather than
 * fetched the moment somebody looks at them — and a line that would replace a file the row ALREADY
 * holds arrives unticked, because losing an attachment somebody chose by hand is not something a
 * lookup may do quietly.
 *
 * ⚠️ **The form decides which field means what**, through its own `catalogue.*` configuration. A type that
 * names none of them cannot be filled from a lookup at all, and this dialog says so rather than guessing
 * which of twenty fields is the manufacturer.
 *
 * ⚠️ **A value that would become a NEW option in a dropdown is refused, not written.** A distributor's
 * spelling added to a choice field splits every filter and count over it, silently and for good — the
 * line is shown, marked, and left unticked, and the Synonyms screen is where that is fixed once for
 * every future lookup.
 *
 * ⚠️ **The question carries the entry, not a search box.** `GET /entries/{id}/lookup/{provider}` builds
 * the query from what the row already holds, so this asks about *this part* rather than about whatever
 * somebody would have typed.
 */
export function EntryLookupDialog({
  entry,
  form,
  isSaving,
  onApply,
  onClose,
}: {
  entry: FormEntry
  form: FormDetail
  isSaving?: boolean
  /** The whole merged value map, for the caller's own update call. */
  onApply: (values: Record<string, string>) => void
  onClose: () => void
}) {
  const [provider, setProvider] = useState(LOOKUP_PROVIDERS[0]?.id ?? "")
  const [chosen, setChosen] = useState<LookupOffer | null>(null)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())

  const { data: synonyms = [] } = useValueSynonyms()
  const manufacturerSynonyms = synonyms.filter((one) => one.synonymGroup === SYNONYM_GROUP_MANUFACTURER)

  const importFile = useImportFile()

  const {
    data: result,
    isFetching,
    error,
    refetch,
  } = useQuery<LookupResult>({
    queryKey: ["entry-lookup", entry.id, provider],
    queryFn: () => lookupApi.searchByEntry(entry.id, provider).then((response) => response.data),
    enabled: Boolean(provider),
    // ⚠️ Somebody else's API and a live price: a cached answer from ten minutes ago is the one thing
    // this dialog must not show.
    staleTime: 0,
    retry: false,
  })

  const byName = useMemo(() => new Map(form.fields.map((field) => [field.name, field])), [form.fields])

  /** What the chosen offer would change, line by line, against what the row says now. */
  const lines = useMemo(
    () => (chosen ? buildLines(chosen, form, byName, entry, manufacturerSynonyms) : []),
    [chosen, form, byName, entry, manufacturerSynonyms],
  )

  const changeable = lines.filter((line) => !line.isRefused && !line.isSame)
  const applied = changeable.filter((line) => !skipped.has(line.key))

  const mappedAtAll = Object.keys(form.config ?? {}).some(
    (key) =>
      OFFER_MAPPINGS.some((mapping) => mapping.configKey === key) ||
      ATTACHMENT_MAPPINGS.some((mapping) => mapping.configKey === key),
  )

  /**
   * ⚠️ **Choosing an offer decides the ticks once**, rather than a rule the checkbox re-derives on every
   * render — a tick somebody cleared has to stay cleared, and a default that is recomputed would put it
   * straight back.
   */
  function chooseOffer(offer: LookupOffer) {
    const fresh = buildLines(offer, form, byName, entry, manufacturerSynonyms)

    setChosen(offer)
    setSkipped(new Set(fresh.filter((line) => line.source && line.current).map((line) => line.key)))
  }

  async function apply() {
    const values = { ...(entry.fieldValues ?? {}) }
    const unfetched: string[] = []
    let whyNot = ""

    for (const line of applied) {
      if (!line.source) {
        values[line.key] = line.next
        continue
      }

      try {
        const stored = await importFile.mutateAsync({ url: line.source })

        // ⚠️ A field value addresses its file by the public token, so a download that came back without
        // one cannot be attached at all. Writing the internal id instead looks fine and answers 404 for
        // ever after, which is strictly worse than saying nothing was attached.
        if (!stored.viewToken) {
          unfetched.push(line.label)
          whyNot ||= "It was downloaded, but it has no public link, so nothing can point at it."
          continue
        }

        values[line.key] = composeFileFieldValue(stored.viewToken, stored.name)
      } catch (failure) {
        // ⚠️ One address the provider gave that this installation cannot reach does not cancel the other
        // nine lines somebody ticked. It is named, and the rest are still written.
        //
        // ⚠️ And it is named in the BACKEND's words: a distributor's "datasheet" is regularly a login
        // page rather than a PDF, and *URL returned an HTML page instead of a file* says which of the
        // two happened where "the download failed" sends somebody to check their network.
        unfetched.push(line.label)
        whyNot ||= (failure as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? ""
      }
    }

    const written = applied.length - unfetched.length

    if (written > 0) {
      onApply(values)
    }

    if (unfetched.length > 0) {
      toast.error(`${unfetched.join(" and ")} could not be fetched.`, { description: whyNot || undefined })
    }

    if (written > 0) {
      toast.success(`${written} value${written === 1 ? "" : "s"} taken from ${provider}.`)
    }
  }

  const isBusy = Boolean(isSaving) || importFile.isPending

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex h-[80svh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-4 py-3 pr-10">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-sm">
            Look this up
            <span className="font-mono text-xs text-muted-foreground">{form.name}</span>

            <span className="ml-auto flex items-center gap-1">
              {LOOKUP_PROVIDERS.map((candidate) => (
                <Button
                  key={candidate.id}
                  variant={candidate.id === provider ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setProvider(candidate.id)
                    setChosen(null)
                  }}
                >
                  {candidate.label}
                </Button>
              ))}
              <Button variant="ghost" size="icon" className="size-8" aria-label="Ask again" onClick={() => refetch()}>
                <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
              </Button>
            </span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            The query is built from this row, and nothing is written until you apply it.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {!mappedAtAll && (
            <p className="mb-3 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              ⚠️ <strong>{form.name}</strong> names none of the <span className="font-mono">catalogue.*</span> fields, so
              an answer cannot be landed anywhere. Its Component types → Manage → Catalogue pane is where that is said.
            </p>
          )}

          {/* ⚠️ The backend's own sentence. "Lookup failed" hides which of *no API key*, *rate limited*
              and *no such part* it was, and only the first two are anybody's to fix. */}
          {error && (
            <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {(error as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
                "The provider could not be asked."}
            </p>
          )}

          {isFetching && !result && <Skeleton className="h-40 w-full" />}

          {result && !chosen && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                {result.offers.length} answer{result.offers.length === 1 ? "" : "s"} for{" "}
                <span className="font-mono">{result.query}</span>
              </p>

              {result.offers.map((offer, index) => (
                <OfferCard
                  key={`${offer.partNumber}-${index}`}
                  offer={offer}
                  onOpen={() => chooseOffer(offer)}
                  onAdd={() => chooseOffer(offer)}
                />
              ))}

              {result.offers.length === 0 && (
                <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  {provider} knows nothing about this one.
                </p>
              )}
            </div>
          )}

          {chosen && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setChosen(null)}>
                  ← other answers
                </Button>
                <span className="truncate font-mono text-xs">{chosen.partNumber}</span>
                {chosen.manufacturer && <Badge variant="outline">{chosen.manufacturer}</Badge>}
              </div>

              {lines.length === 0 ? (
                <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  Nothing in this answer maps to a field of {form.name}.
                </p>
              ) : (
                <div className="flex flex-col divide-y rounded-md border">
                  {lines.map((line) => (
                    <div key={line.key} className="flex items-center gap-3 px-3 py-2 text-xs">
                      <input
                        type="checkbox"
                        className="size-3.5 shrink-0 accent-primary"
                        aria-label={`Take ${line.label}`}
                        checked={!line.isRefused && !line.isSame && !skipped.has(line.key)}
                        disabled={line.isRefused || line.isSame}
                        onChange={(event) =>
                          setSkipped((previous) => {
                            const updated = new Set(previous)

                            if (event.target.checked) {
                              updated.delete(line.key)
                            } else {
                              updated.add(line.key)
                            }

                            return updated
                          })
                        }
                      />

                      <span className="flex w-32 shrink-0 items-center gap-1 truncate font-medium">
                        {line.source && <Download className="size-3 shrink-0 opacity-60" />}
                        <span className="truncate">{line.label}</span>
                      </span>

                      <span className="min-w-0 flex-1 truncate text-muted-foreground" title={line.current}>
                        {readableCurrent(line.current) || <span className="italic">empty</span>}
                      </span>

                      <ArrowRight className="size-3 shrink-0 opacity-40" />

                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate",
                          line.isSame && "text-muted-foreground",
                          line.isRefused && "text-warning-foreground line-through",
                        )}
                        title={line.source ?? line.next}
                      >
                        {line.next}
                      </span>

                      {line.source && (
                        <Badge variant="outline" title={`Downloaded from ${line.source} and kept here`}>
                          a copy
                        </Badge>
                      )}
                      {line.isSame && <Badge variant="outline">same</Badge>}
                      {line.isRefused && (
                        <Badge variant="outline" title="This would become a new option on a choice field">
                          not an option
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 items-center border-t px-4 py-2.5">
          <span className="mr-auto text-xs text-muted-foreground">
            {chosen ? `${applied.length} of ${changeable.length} change${changeable.length === 1 ? "" : "s"}` : ""}
          </span>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button size="sm" disabled={!chosen || applied.length === 0 || isBusy} onClick={apply}>
            {importFile.isPending ? "Downloading…" : isSaving ? "Saving…" : "Apply to this row"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The chosen offer read against the row, as one list.
 *
 * ⚠️ **A field named by BOTH a value mapping and an attachment mapping is a copy, not a string.** A form
 * whose picture field is also its `catalogue.image_url_field` would otherwise be offered the same field
 * twice on one screen, and whichever line was ticked second would win — so the attachment wins and the
 * URL line is dropped, because the field is a file field and a URL written into one is text where a
 * picture should be.
 */
function buildLines(
  offer: LookupOffer,
  form: FormDetail,
  byName: Map<string, FieldDetail>,
  entry: FormEntry,
  manufacturerSynonyms: ValueSynonym[],
): LookupLine[] {
  const configs = form.config ?? {}

  const attachments = ATTACHMENT_MAPPINGS.flatMap((mapping) => {
    const fieldName = configs[mapping.configKey]?.trim()
    const address = mapping.read(offer)
    const field = fieldName ? byName.get(fieldName) : undefined

    if (!fieldName || !address || !isAttachableField(field)) {
      return []
    }

    return [
      {
        key: fieldName,
        label: field?.label ?? mapping.label,
        current: entry.fieldValues?.[fieldName] ?? "",
        next: filenameOf(address),
        source: address,
        isRefused: false,
        isSame: false,
      },
    ]
  })

  const attached = new Set(attachments.map((line) => line.key))

  const values = OFFER_MAPPINGS.flatMap((mapping) => {
    const fieldName = configs[mapping.configKey]?.trim()

    if (!fieldName || attached.has(fieldName)) {
      return []
    }

    // ⚠️ The field is resolved BEFORE the value is read — a price carries its currency only where the
    // field can hold one, so the mapping has to know what it is writing to.
    const field = byName.get(fieldName)
    const raw = mapping.read(offer, field)

    if (!raw) {
      return []
    }

    // ⚠️ Through the shared decision, never the whole synonym list. This dialog used to hand manufacturer
    // synonyms to every field, so a manufacturer spelling could land on a Category or Package dropdown
    // and quietly rewrite it — the same offer applied here and in the add dialog stored different values.
    const coerced = coerceForField(raw, field, synonymsForMapping(mapping.configKey, manufacturerSynonyms))
    const current = entry.fieldValues?.[fieldName] ?? ""

    return [
      {
        key: fieldName,
        label: field?.label ?? mapping.label,
        current,
        next: coerced.value,
        isRefused: coerced.status === "unmatched",
        isSame: current.trim() === coerced.value.trim(),
      },
    ]
  })

  return [...values, ...attachments]
}

/** What a file field already holds, said as a filename rather than as `token:filename`. */
function readableCurrent(value: string): string {
  return parseFileFieldValue(value)?.filename ?? value
}

/** The name a download is expected to arrive under. ⚠️ For the diff only — the server names the file. */
function filenameOf(address: string): string {
  try {
    const last = new URL(address).pathname.split("/").filter(Boolean).pop()

    return last ? decodeURIComponent(last) : "the file"
  } catch {
    return "the file"
  }
}
