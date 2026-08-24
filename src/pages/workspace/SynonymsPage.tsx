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
  Input,
  Row,
  RowGroup,
  RowList,
  RowMeta,
  RowTitle,
  Skeleton,
} from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { EditorField } from "@/components/form/builder/EditorSection"
import { SYNONYM_GROUP_MANUFACTURER, type ValueSynonym } from "@/api/valueSynonyms"
import {
  useCreateValueSynonym,
  useDeleteValueSynonym,
  useUpdateValueSynonym,
  useValueSynonyms,
} from "@/hooks/useValueSynonyms"

interface Draft {
  id: string | null
  group: string
  alias: string
  canonical: string
}

const BLANK: Draft = { id: null, group: SYNONYM_GROUP_MANUFACTURER, alias: "", canonical: "" }

/**
 * Two spellings that mean one value.
 *
 * ⚠️ **This exists so a looked-up value lands on an option that already exists.** A distributor answers
 * "Texas Instruments" and the dropdown offers "TI" — without a mapping the applied value becomes a
 * second name for one manufacturer, and every filter, count and search over that field is quietly split
 * in two from then on.
 *
 * ⚠️ **A seeded mapping is read-only and says so on the row.** It belongs to the installation rather
 * than to this workspace; offering an edit that would be refused is worse than not offering it.
 *
 * ⚠️ **Matching is symmetric and case-insensitive** — either spelling resolves to the canonical one. The
 * arrow on the row is about which one is *stored*, not about which direction the match runs.
 */
export function SynonymsPage() {
  const { data: synonyms = [], isLoading } = useValueSynonyms()

  const createSynonym = useCreateValueSynonym()
  const updateSynonym = useUpdateValueSynonym()
  const deleteSynonym = useDeleteValueSynonym()

  const [draft, setDraft] = useState<Draft | null>(null)
  const [search, setSearch] = useState("")
  const [removingId, setRemovingId] = useState<string | null>(null)

  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase()
    const byGroup = new Map<string, ValueSynonym[]>()

    for (const synonym of synonyms) {
      const matches =
        needle === "" ||
        synonym.aliasValue.toLowerCase().includes(needle) ||
        synonym.canonicalValue.toLowerCase().includes(needle) ||
        synonym.synonymGroup.toLowerCase().includes(needle)

      if (!matches) {
        continue
      }

      const bucket = byGroup.get(synonym.synonymGroup) ?? []

      bucket.push(synonym)
      byGroup.set(synonym.synonymGroup, bucket)
    }

    return [...byGroup.entries()].sort(([left], [right]) => left.localeCompare(right))
  }, [synonyms, search])

  function save() {
    if (!draft) {
      return
    }

    const payload = {
      synonymGroup: draft.group.trim(),
      aliasValue: draft.alias.trim(),
      canonicalValue: draft.canonical.trim(),
    }

    const onError = (error: unknown) => {
      const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

      toast.error(detail ?? "That mapping was not saved.")
    }

    if (draft.id) {
      updateSynonym.mutate(
        { synonymId: draft.id, ...payload },
        { onSuccess: () => setDraft(null), onError },
      )

      return
    }

    createSynonym.mutate(payload, { onSuccess: () => setDraft(null), onError })
  }

  const isComplete = !!draft && !!draft.group.trim() && !!draft.alias.trim() && !!draft.canonical.trim()

  return (
    <>
      <PageHeader
        title="Value synonyms"
        description="Teach the system that two spellings mean one value, so a looked-up name lands on the option you already have"
        actions={
          <>
            <Input
              className="h-8 w-56 text-sm"
              value={search}
              placeholder="Search mappings…"
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button size="sm" onClick={() => setDraft({ ...BLANK })}>
              New synonym
            </Button>
          </>
        }
      />

      <div className="flex min-w-0 flex-col gap-5">
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
            <span aria-hidden="true" className="text-2xl">
              ⇄
            </span>
            <span className="text-sm font-medium">{synonyms.length === 0 ? "No mappings yet" : "Nothing matches"}</span>
            <span className="max-w-md text-xs text-muted-foreground">
              Add one like <span className="font-mono">Texas Instruments → TI</span> so a distributor's spelling applies
              cleanly to the option your field already offers.
            </span>
          </div>
        ) : (
          groups.map(([group, rows]) => (
            <RowGroup key={group} label={group} tally={`${rows.length}`}>
              <RowList>
                {rows.map((synonym) => (
                  <Row
                    key={synonym.id}
                    // ⚠️ Not dimmed. Nearly every mapping in a fresh installation is seeded, and dimming
                    // the ordinary case dims the whole screen — the badge is what marks it read-only.
                    trailing={
                      synonym.global ? (
                        <Badge variant="outline" title="Seeded for the whole installation — not editable here.">
                          seeded
                        </Badge>
                      ) : removingId === synonym.id ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            deleteSynonym.mutate(synonym.id, {
                              onSuccess: () => toast.success("Mapping removed."),
                              onError: () => toast.error("That mapping was not removed."),
                            })
                            setRemovingId(null)
                          }}
                        >
                          Really delete
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 transition-opacity group-hover/row:opacity-100"
                            onClick={() =>
                              setDraft({
                                id: synonym.id,
                                group: synonym.synonymGroup,
                                alias: synonym.aliasValue,
                                canonical: synonym.canonicalValue,
                              })
                            }
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-destructive/10"
                            onClick={() => setRemovingId(synonym.id)}
                          >
                            Delete
                          </Button>
                        </>
                      )
                    }
                  >
                    {/* ⚠️ One line, not three. `Row` stacks its children, which is right for a name over
                        a description and wrong for a mapping — the arrow only reads as an arrow when the
                        two values it joins are beside it. */}
                    <span className="flex min-w-0 flex-wrap items-baseline gap-2">
                      <RowTitle className="font-mono">{synonym.aliasValue}</RowTitle>
                      <RowMeta>→</RowMeta>
                      <RowTitle className="font-mono">{synonym.canonicalValue}</RowTitle>
                    </span>
                  </Row>
                ))}
              </RowList>
            </RowGroup>
          ))
        )}
      </div>

      {draft && (
        <Dialog open onOpenChange={(next) => !next && setDraft(null)}>
          <DialogContent className="flex flex-col gap-3 sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{draft.id ? "Edit synonym" : "New synonym"}</DialogTitle>
              <DialogDescription>
                Matching is case-insensitive and runs both ways — either spelling resolves to the canonical one.
              </DialogDescription>
            </DialogHeader>

            <EditorField label="Group" hint="What kind of value this is about — manufacturers, packages, and so on.">
              <Input
                className="h-8 font-mono text-sm"
                value={draft.group}
                placeholder={SYNONYM_GROUP_MANUFACTURER}
                onChange={(event) => setDraft({ ...draft, group: event.target.value })}
              />
            </EditorField>

            <EditorField label="Alias" hint="What a provider sends.">
              <Input
                autoFocus
                className="h-8 text-sm"
                value={draft.alias}
                placeholder="Texas Instruments"
                onChange={(event) => setDraft({ ...draft, alias: event.target.value })}
              />
            </EditorField>

            <EditorField label="Canonical" hint="The value your option actually carries.">
              <Input
                className="h-8 text-sm"
                value={draft.canonical}
                placeholder="TI"
                onChange={(event) => setDraft({ ...draft, canonical: event.target.value })}
              />
            </EditorField>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button disabled={!isComplete || createSynonym.isPending || updateSynonym.isPending} onClick={save}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
