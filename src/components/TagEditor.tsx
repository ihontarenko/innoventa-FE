import { useState } from "react"
import { Plus, X } from "lucide-react"
import { Badge, Button, Input, cn } from "@jmouse/ui"
import { useEntityTags, useSetEntityTags, useTags } from "@/hooks/useFieldCatalogue"

/**
 * The tags one thing carries — a field, a form, a file.
 *
 * ⚠️ **One component for every kind of thing**, because a tag is the same idea everywhere: a free
 * vocabulary over things that already have a type. A per-screen copy would be three places for the
 * replace-the-whole-set rule below to be got wrong.
 *
 * ⚠️ **Writing is a REPLACE, and it is done on every change.** `PUT /tags/entities/{id}` deletes every
 * assignment and writes the list back — so this component always sends the whole set, and there is no
 * draft and no Save button: a tag is one reversible fact, and a Save people forget leaves a thing
 * looking tagged and stored untagged.
 *
 * ⚠️ **Tags are addressed by NAME and minted on demand.** The backend upserts a name it has not seen,
 * which is why typing a new one is the same gesture as picking an old one — and why `entityKind` is
 * required: a `FIELD` tag and a `FORM` tag of the same name are two different rows.
 */
export function TagEditor({
  entityId,
  entityKind,
  className,
}: {
  entityId: string
  /** `FIELD`, `FORM`, `FILE` — the vocabulary this thing's tags belong to. */
  entityKind: string
  className?: string
}) {
  const { data: carried, isLoading } = useEntityTags(entityId)
  const { data: vocabulary = [] } = useTags(entityKind)
  const setTags = useSetEntityTags()

  const [draft, setDraft] = useState("")

  const names = (carried?.tags ?? []).map((tag) => tag.name)

  function write(next: string[]) {
    setTags.mutate({ entityId, entityKind, tagNames: next })
  }

  function add(name: string) {
    const trimmed = name.trim()

    // ⚠️ Case-insensitively, because the backend upserts on the name: adding "Analog" beside "analog"
    // would make two rows that read as one on every screen that lists them.
    if (!trimmed || names.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("")
      return
    }

    write([...names, trimmed])
    setDraft("")
  }

  // What could still be added — the vocabulary this kind already has, minus what is already on.
  const offered = vocabulary
    .filter((tag) => !names.some((existing) => existing.toLowerCase() === tag.name.toLowerCase()))
    .filter((tag) => tag.name.toLowerCase().includes(draft.trim().toLowerCase()))
    .slice(0, 8)

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        {isLoading && <span className="text-[11px] text-muted-foreground">…</span>}

        {names.map((name) => {
          const known = vocabulary.find((tag) => tag.name === name)

          return (
            <Badge key={name} variant="secondary" className="gap-1 pr-1">
              {known?.icon && <span aria-hidden="true">{known.icon}</span>}
              {name}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                className="rounded-full opacity-60 hover:opacity-100"
                disabled={setTags.isPending}
                onClick={() => write(names.filter((candidate) => candidate !== name))}
              >
                <X className="size-3" />
              </button>
            </Badge>
          )
        })}

        {!isLoading && names.length === 0 && (
          <span className="text-[11px] text-muted-foreground">No tags yet.</span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          className="h-8 max-w-56 text-xs"
          placeholder="Add a tag…"
          value={draft}
          disabled={setTags.isPending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              add(draft)
            }
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Add this tag"
          disabled={!draft.trim() || setTags.isPending}
          onClick={() => add(draft)}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {/* ⚠️ The existing vocabulary, offered rather than hidden behind a dropdown. Tags are only worth
          anything when the same word is reused, and a blank box invites a second spelling of one. */}
      {offered.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {offered.map((tag) => (
            <button
              key={tag.id}
              type="button"
              disabled={setTags.isPending}
              onClick={() => add(tag.name)}
              className="rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-solid hover:bg-accent hover:text-foreground"
            >
              {tag.icon ? `${tag.icon} ` : ""}
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
