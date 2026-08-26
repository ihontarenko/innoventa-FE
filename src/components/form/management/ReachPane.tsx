import { useState } from "react"
import { toast } from "sonner"
import { Button, Switch, Textarea } from "@jmouse/ui"
import { LinkRow } from "@/components/LinkRow"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { useCopyFeedback } from "@/hooks/useCopyFeedback"
import { useShareForm, useUnshareForm } from "@/hooks/useWorkspaceForms"
import { publicRouteFor } from "@/api/sharing"
import type { FormAudience, FormStatus } from "@/types"
import { Pane, PaneField, PaneGrid, PaneSwitchRow } from "./Pane"
import type { ManagedForm } from "./types"
import type { useFormIdentity } from "./useFormIdentity"

/**
 * Who can reach this form — the three answers that used to be two screens apart.
 *
 * ⚠️ **Status, audience and the public link are ONE question.** They lived in the builder's settings
 * sheet (*Reach*) and in the library's manage dialog (*Sharing*) respectively, so "who may open this?"
 * could only be answered by opening both and holding the two halves in your head. A form that is
 * `INACTIVE` is unreachable however generous its audience, and a share link outranks the audience
 * entirely — facts that are obvious side by side and invisible apart.
 *
 * ⚠️ **The link switch writes immediately; status and audience wait for Save.** Minting a share token
 * is a server-side act with a visible consequence, not a draft — and the two selects go through the
 * same `PUT /forms/{id}` as the identity pane, which is why they share its draft.
 */
const STATUSES: Array<{ value: FormStatus; hint: string }> = [
  { value: "ACTIVE", hint: "Open, listed, and answerable." },
  { value: "INACTIVE", hint: "Kept, but nobody may answer it — including through a share link." },
  { value: "DELETED", hint: "⚠️ Gone from every list. The rows it holds are not deleted with it." },
]

const AUDIENCES: Array<{ value: FormAudience; label: string; hint: string }> = [
  { value: "MEMBERS", label: "Workspace", hint: "People in the workspaces this form is placed in." },
  { value: "EVERYONE", label: "Everyone", hint: "Everybody in the installation sees it and may attach it." },
  { value: "STAFF", label: "Internal", hint: "Only holders of form:read:internal. A share link still works." },
]

export function ReachPane({
  form,
  identity,
  onShared,
}: {
  form: ManagedForm
  identity: ReturnType<typeof useFormIdentity>
  onShared: (token: string | null) => void
}) {
  const { draft, update, isDirty, isSaving, save } = identity

  const [token, setToken] = useState(form.shareToken)
  const { copied, copy } = useCopyFeedback()

  const shareForm = useShareForm()
  const unshareForm = useUnshareForm()

  const isPending = shareForm.isPending || unshareForm.isPending
  const url = token ? `${window.location.origin}${publicRouteFor("FORM", token)}` : null

  function apply(next: string | null) {
    setToken(next)
    // The rail's badge is drawn above, and would otherwise still say "private".
    onShared(next)
  }

  function toggle(next: boolean) {
    if (next) {
      shareForm.mutate(form.id, {
        onSuccess: (result) => apply(result.shareToken),
        onError: () => toast.error("Could not share this form."),
      })

      return
    }

    unshareForm.mutate(form.id, {
      onSuccess: () => apply(null),
      onError: () => toast.error("Could not stop sharing this form."),
    })
  }

  const embed = url
    ? `<iframe\n  src="${url}/embed"\n  title="${form.name}"\n  style="width:100%;height:560px;border:none;display:block;"\n></iframe>`
    : null

  return (
    <Pane title="Reach" hint="Whether it is open, who it is for, and whether it has a public link.">
      <PaneGrid>
        <PaneField label="Status" hint={STATUSES.find((entry) => entry.value === draft.status)?.hint}>
          <PlainSelect value={draft.status} onChange={(next) => update({ status: next as FormStatus })}>
            {STATUSES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.value.toLowerCase()}
              </option>
            ))}
          </PlainSelect>
        </PaneField>

        <PaneField label="Audience" hint={AUDIENCES.find((entry) => entry.value === draft.audience)?.hint}>
          <PlainSelect value={draft.audience} onChange={(next) => update({ audience: next as FormAudience })}>
            {AUDIENCES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </PlainSelect>
        </PaneField>
      </PaneGrid>

      <Button size="sm" className="self-start" disabled={!isDirty || isSaving} onClick={save}>
        {isSaving ? "Saving…" : "Save status and audience"}
      </Button>

      <PaneSwitchRow
        control={<Switch checked={!!token} disabled={isPending} onCheckedChange={toggle} />}
        title="Anybody with the link may fill this in"
        hint="No account, and no workspace membership. Revoking the link breaks every copy of it at once."
      />

      {url && (
        <>
          <LinkRow label="Public link" url={url} copied={copied} onCopy={() => copy(url)} />

          <PaneField label="Embed" hint="Paste into a page that should carry the form itself.">
            <Textarea readOnly rows={5} className="font-mono text-[11px]" value={embed ?? ""} />
          </PaneField>
        </>
      )}
    </Pane>
  )
}
