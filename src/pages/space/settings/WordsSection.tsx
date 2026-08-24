import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button, Input, Skeleton } from "@jmouse/ui"
import { EditorField } from "@/components/form/builder/EditorSection"
import { useRenameTerms, useTerminology } from "@/hooks/useTerminology"
import { Group, Section, type SpaceSettingsContext } from "./SpaceSettingsSection"

/**
 * What this workspace calls its own nouns.
 *
 * ⚠️ **Not the language of the interface.** The product's copy is translated per language elsewhere; this
 * is the other axis — a construction yard and a laboratory both speak Ukrainian and disagree about what a
 * unit is called. Renaming here changes what *this* workspace's screens say and nobody else's.
 *
 * ⚠️ **Every field opens filled in with the default**, rather than blank with a placeholder. Somebody
 * renaming "thing" to «прилад» is editing a word they can see; a row of empty boxes asks them to invent
 * a vocabulary and guess what each key controls.
 *
 * ⚠️ **Blanking a field is how a word is reset.** The backend deletes the override rather than storing an
 * empty string, so the answer goes back to the subject area's — which is why there is no separate Reset
 * button to keep in step with this one.
 */
export function WordsSection({ isAdmin }: SpaceSettingsContext) {
  const { data, isLoading } = useTerminology()
  const rename = useRenameTerms()

  const [draft, setDraft] = useState<Record<string, string>>({})

  // Reseeded when the answer lands, and not while somebody is typing into it.
  useEffect(() => {
    if (data) {
      setDraft(Object.fromEntries(data.nouns.map((key) => [key, data.words[key] ?? ""])))
    }
  }, [data])

  if (isLoading || !data) {
    return <Skeleton className="h-64 max-w-3xl" />
  }

  const changed = data.nouns.some((key) => (draft[key] ?? "") !== (data.words[key] ?? ""))

  return (
    <Section
      title="Words"
      hint="What this workspace calls its own things. Every screen reads these; nobody else's workspace changes."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PAIRS.map((pair) => (
          <Group key={pair.one} label={pair.label} hint={pair.hint}>
            <div className="grid grid-cols-2 gap-2">
              <EditorField label="One">
                <Input
                  disabled={!isAdmin}
                  value={draft[pair.one] ?? ""}
                  placeholder={data.defaults[pair.one] ?? ""}
                  onChange={(event) => setDraft((previous) => ({ ...previous, [pair.one]: event.target.value }))}
                />
              </EditorField>
              <EditorField label="Many">
                <Input
                  disabled={!isAdmin}
                  value={draft[pair.many] ?? ""}
                  placeholder={data.defaults[pair.many] ?? ""}
                  onChange={(event) => setDraft((previous) => ({ ...previous, [pair.many]: event.target.value }))}
                />
              </EditorField>
            </div>
          </Group>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Leave one empty to go back to the default. Write them the way they appear mid-sentence —
        «прилад», not «Прилад» — because a screen that needed a capital adds one and one that did not
        cannot take it away.
      </p>

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!isAdmin || !changed || rename.isPending}
          onClick={() =>
            rename.mutate(draft, {
              onSuccess: () => toast.success("Saved."),
              onError: () => toast.error("Those words were not saved."),
            })
          }
        >
          {rename.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </Section>
  )
}

/**
 * ⚠️ **Singular and plural side by side, never one with an inferred -s.** English gets away with the
 * suffix; Ukrainian does not, and «прилад»/«прилади» is the pair somebody is actually thinking about.
 */
const PAIRS: Array<{ one: string; many: string; label: string; hint?: string }> = [
  { one: "thing.one", many: "thing.many", label: "A thing", hint: "what is handed out and expected back" },
  { one: "holder.one", many: "holder.many", label: "Somebody holding it", hint: "a person, a crew, a client" },
  { one: "place.one", many: "place.many", label: "Where it stands" },
  { one: "kind.one", many: "kind.many", label: "A class of them", hint: "what a form describes" },
  { one: "reading.one", many: "reading.many", label: "A number written down" },
  { one: "rule.one", many: "rule.many", label: "What makes one fall due" },
  { one: "check.one", many: "check.many", label: "A filled-in checklist" },
]
