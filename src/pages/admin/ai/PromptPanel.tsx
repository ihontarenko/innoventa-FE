import { useEffect, useState } from "react"
import { Badge, Button, Input, Skeleton, Textarea, cn } from "@jmouse/ui"
import { Callout } from "@/components/Callout"
import {
  useAddAiPreferenceValue,
  useAiPreferences,
  useChangeAiPreferenceValue,
  useDiscardAiPreferenceValue,
  usePutAiPreferenceValueInForce,
  useRestoreAiPreferenceValue,
} from "@/hooks/useAiAdministration"
import type { AiPreference, AiPreferenceValue } from "@/api/ai"
import { NotAdministering } from "./NotAdministering"

/**
 * What the assistant is told before every conversation.
 *
 * **The prompt is content, and content does not belong in a deploy.** It is rewritten by whoever is
 * watching how the assistant actually answers — a different person, on a different day, from whoever
 * ships a release — so every wording is a row and an edit takes effect on the next question.
 *
 * **Several wordings, one in force** — deliberately the shape the provider tab already has, because it
 * is the same situation: keeping the long prompt while trying the short one, and switching back with a
 * press rather than a paste.
 *
 * ⚠️ **This decides what the model is asked to do — never what it may do.** Every call is checked
 * against the asking person's permissions whatever the prompt says, and the catalogue the model is
 * offered is already cut to what they hold. A prompt that granted anything would be a wish.
 */
export function PromptPanel({ mayAdminister }: { mayAdminister: boolean }) {
  const preferences = useAiPreferences()

  if (!mayAdminister) {
    return (
      <NotAdministering>
        Whoever changes this decides what the model is told to do with every permission every caller holds, so it is its
        own permission.
      </NotAdministering>
    )
  }

  if (preferences.isLoading) {
    return <Skeleton className="h-40 w-full" />
  }

  const declared = preferences.data ?? []

  if (declared.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
        <span aria-hidden="true" className="text-2xl">
          ◍
        </span>
        <span className="text-sm font-medium">Nothing is declared</span>
        <span className="max-w-md text-xs text-muted-foreground">
          Settings appear here as the backend declares them, beside whatever they are settings for. Nothing has declared
          one yet.
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {declared.map((setting) => (
        <SettingEditor key={setting.name} setting={setting} />
      ))}
    </div>
  )
}

/** One declared setting — its wordings, which one is in force, and everything done to them. */
function SettingEditor({ setting }: { setting: AiPreference }) {
  const inForce = setting.values.find((stored) => stored.inForce)

  const [opened, setOpened] = useState<string | null>(inForce?.id ?? null)
  const [adding, setAdding] = useState(false)

  const add = useAddAiPreferenceValue()

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-col">
          <h3 className="text-sm font-medium">{setting.title}</h3>
          <code className="font-mono text-[11px] text-muted-foreground">{setting.name}</code>
        </div>
        <Button variant="ghost" size="sm" className="ml-auto" disabled={adding} onClick={() => setAdding(true)}>
          Add a wording
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{setting.description}</p>

      {adding && (
        <NewWording
          busy={add.isPending}
          failed={add.isError}
          onCancel={() => setAdding(false)}
          onSave={(draft) =>
            add.mutate(
              { name: setting.name, ...draft },
              {
                onSuccess: (created) => {
                  setAdding(false)
                  setOpened(created.id)
                },
              },
            )
          }
        />
      )}

      <div className="flex flex-col gap-1.5">
        {setting.values.map((stored) => (
          <Wording
            key={stored.id}
            stored={stored}
            multiline={setting.multiline}
            opened={opened === stored.id}
            onToggle={() => setOpened(opened === stored.id ? null : stored.id)}
          />
        ))}
      </div>
    </section>
  )
}

/**
 * One stored wording, shut or open.
 *
 * Shut it is a row: its name, whether it is the one in force, and whether it still says what the build
 * ships. Open it is the text — which is a page of prose, and three of those on one screen is a screen
 * nobody can find anything on.
 */
function Wording({
  stored,
  multiline,
  opened,
  onToggle,
}: {
  stored: AiPreferenceValue
  multiline: boolean
  opened: boolean
  onToggle: () => void
}) {
  const change = useChangeAiPreferenceValue()
  const putInForce = usePutAiPreferenceValueInForce()
  const restore = useRestoreAiPreferenceValue()
  const discard = useDiscardAiPreferenceValue()

  const [label, setLabel] = useState(stored.label)
  const [draft, setDraft] = useState(stored.value)

  // ⚠️ Keyed on the stored text rather than on every render: a background refetch answering the same
  // string does not run this, so it cannot take somebody's half-typed paragraph away. What it does catch
  // is the value actually changing under the screen — a save, or a restore.
  useEffect(() => {
    setDraft(stored.value)
  }, [stored.value])

  useEffect(() => {
    setLabel(stored.label)
  }, [stored.label])

  const busy = change.isPending || putInForce.isPending || restore.isPending || discard.isPending
  const changed = draft !== stored.value || label !== stored.label

  return (
    <article className={cn("rounded-md border", stored.inForce && "border-primary/50 bg-primary/5")}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button type="button" className="flex items-center gap-1.5 text-sm" onClick={onToggle}>
          <span aria-hidden="true" className="text-muted-foreground">
            {opened ? "▾" : "▸"}
          </span>
          {stored.label}
        </button>

        <Badge variant={stored.inForce ? "default" : "outline"}>{stored.inForce ? "In force" : "Idle"}</Badge>

        {/* Said only about a wording that came from the build — one somebody wrote here has no shipped
            text to have drifted from, and "edited" would be meaningless on it. */}
        {stored.shippedKey && !stored.asShipped && <Badge variant="secondary">Edited</Badge>}

        {!stored.inForce && (
          <Button variant="ghost" size="sm" className="ml-auto" disabled={busy} onClick={() => putInForce.mutate(stored.id)}>
            Put in force
          </Button>
        )}
      </div>

      {opened && (
        <div className="flex flex-col gap-2 border-t px-3 py-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Name</span>
            <Input
              className="h-8 w-72 text-sm"
              value={label}
              disabled={busy}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>

          {multiline ? (
            <Textarea
              className="min-h-48 font-mono text-xs"
              value={draft}
              disabled={busy}
              spellCheck={false}
              onChange={(event) => setDraft(event.target.value)}
            />
          ) : (
            <Input className="h-8 text-sm" value={draft} disabled={busy} onChange={(event) => setDraft(event.target.value)} />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {stored.inForce ? "This is what the assistant is told." : "Stored, and not being used."}
              {changed && " · unsaved"}
            </span>

            <div className="ml-auto flex gap-2">
              {/* Only where there is a shipped text to go back to, and only where the row has actually
                  drifted from it — otherwise the press would do nothing visible and read as a broken
                  button. */}
              {stored.shippedKey && !stored.asShipped && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => restore.mutate(stored.id)}>
                  Back to shipped
                </Button>
              )}

              {/* ⚠️ The one in force cannot be deleted — the server refuses it too, so the assistant is
                  never left with nothing to be told. */}
              {!stored.inForce && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10"
                  disabled={busy}
                  onClick={() => discard.mutate(stored.id)}
                >
                  Delete
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                disabled={busy || !changed}
                onClick={() => {
                  setDraft(stored.value)
                  setLabel(stored.label)
                }}
              >
                Undo
              </Button>

              <Button size="sm" disabled={busy || !changed} onClick={() => change.mutate({ id: stored.id, label, value: draft })}>
                Save
              </Button>
            </div>
          </div>

          {(change.isError || putInForce.isError || restore.isError || discard.isError) && (
            <Callout tone="danger">
              <span>That did not go through, so the assistant is still being told exactly what it was before.</span>
            </Callout>
          )}
        </div>
      )}
    </article>
  )
}

/** A wording somebody writes here rather than one the build shipped. */
function NewWording({
  busy,
  failed,
  onCancel,
  onSave,
}: {
  busy: boolean
  failed: boolean
  onCancel: () => void
  onSave: (draft: { label: string; value: string }) => void
}) {
  const [label, setLabel] = useState("")
  const [value, setValue] = useState("")

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">Name</span>
        <Input
          className="h-8 w-72 text-sm"
          value={label}
          placeholder="Ours, Terse, For support…"
          disabled={busy}
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>

      <Textarea
        className="min-h-40 font-mono text-xs"
        value={value}
        placeholder="What the assistant should be told."
        disabled={busy}
        spellCheck={false}
        onChange={(event) => setValue(event.target.value)}
      />

      {failed && (
        <Callout tone="danger">
          <span>That was not added. A wording needs a name no other one is using.</span>
        </Callout>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-muted-foreground">Added idle — putting it in force is a second press.</span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={busy || label.trim().length === 0 || value.trim().length === 0}
            onClick={() => onSave({ label, value })}
          >
            Add it
          </Button>
        </div>
      </div>
    </div>
  )
}
