import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button, Input, Switch } from "@jmouse/ui"
import { Callout } from "@/components/Callout"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { useSubjectAreas, useUpdateSpace } from "@/hooks/useSpaceSettings"
import { Section, type SpaceSettingsContext } from "./SpaceSettingsSection"

/**
 * Said before a subject-area change is accepted, because a menu that silently loses items reads as a
 * bug. Both halves matter: what changes, and what does not.
 */
const SUBJECT_AREA_CHANGE_WARNING =
  "Changing what this workspace counts re-shapes its menu — some sections will appear or disappear, and the " +
  "endpoints behind them follow. Nothing is created, deleted or re-seeded, and any module you switched off by hand " +
  "stays exactly as you left it."

/** What this workspace is, and what it counts — the answer everything else on this screen follows. */
export function IdentitySection({ space, isAdmin }: SpaceSettingsContext) {
  const { data: subjectAreas = [] } = useSubjectAreas()
  const updateSpace = useUpdateSpace()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [discoverable, setDiscoverable] = useState(false)
  const [subjectAreaCode, setSubjectArea] = useState("")
  const [confirming, setConfirming] = useState(false)

  // The form mirrors the workspace, and re-mirrors it whenever a different one is opened.
  useEffect(() => {
    setName(space.name)
    setDescription(space.description ?? "")
    setDiscoverable(space.discoverable)
    setSubjectArea(space.subjectAreaCode)
    setConfirming(false)
  }, [space])

  const subjectAreaChanged = subjectAreaCode !== space.subjectAreaCode

  function save() {
    // ⚠️ The re-shaping is confirmed in place rather than in a browser dialog: a `confirm()` is the one
    // control on a themed screen that cannot be read in the dark, and this is the only change here that
    // takes items out of somebody's menu.
    if (subjectAreaChanged && !confirming) {
      setConfirming(true)
      return
    }

    updateSpace.mutate(
      {
        spaceId: space.id,
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        discoverable,
        subjectAreaCode: subjectAreaChanged ? subjectAreaCode : undefined,
      },
      {
        onSuccess: () => {
          toast.success("Workspace updated.")
          setConfirming(false)
        },
        onError: (error) => {
          const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

          toast.error(detail ?? "Failed to update this workspace.")
        },
      },
    )
  }

  return (
    <Section title="Identity" hint="What this workspace is, and what it counts">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">Name</span>
        <Input className="h-8 text-sm" value={name} disabled={!isAdmin} onChange={(event) => setName(event.target.value)} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">Description</span>
        <Input
          className="h-8 text-sm"
          value={description}
          placeholder="Optional"
          disabled={!isAdmin}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">What does this workspace count?</span>
        <PlainSelect value={subjectAreaCode} disabled={!isAdmin} onChange={setSubjectArea}>
          {subjectAreas.map((area) => (
            <option key={area.code} value={area.code}>
              {area.label}
            </option>
          ))}
        </PlainSelect>
      </label>

      {subjectAreaChanged && (
        <Callout tone="warning">
          <span>{SUBJECT_AREA_CHANGE_WARNING}</span>
        </Callout>
      )}

      <div className="flex items-center gap-2">
        <Switch checked={discoverable} disabled={!isAdmin} onCheckedChange={setDiscoverable} />
        <span className="text-xs">Allow any authenticated user to find and join this workspace</span>
      </div>

      {isAdmin && (
        <div>
          <Button size="sm" disabled={updateSpace.isPending} onClick={save}>
            {confirming ? "Re-shape the menu and save" : "Save changes"}
          </Button>
        </div>
      )}
    </Section>
  )
}
