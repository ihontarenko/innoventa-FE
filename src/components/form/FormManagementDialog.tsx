import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Switch,
  Textarea,
} from "@jmouse/ui"
import { LinkRow } from "@/components/LinkRow"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { EditorField, EditorSection } from "@/components/form/builder/EditorSection"
import { PresentationSection } from "@/components/form/PresentationSection"
import { useCopyFeedback } from "@/hooks/useCopyFeedback"
import {
  useCategories,
  useDeleteSubmissionPolicy,
  usePatchForm,
  usePurposes,
  useSaveSubmissionPolicy,
  useShareForm,
  useSubmissionPolicy,
  useUnshareForm,
} from "@/hooks/useWorkspaceForms"
import { publicRouteFor } from "@/api/sharing"
import type { FormSummary, IdentityStrategy } from "@/types"

/**
 * Everything about a form that is not its schema.
 *
 * ⚠️ **Three questions rather than five tabs.** The old manage modal carried *meta*, *config*,
 * *sharing*, *widgets* and *policy*; the first two now live in the builder's own settings sheet, beside
 * the thing they describe. What is left is genuinely about the form's place in the world — where it is
 * filed, who may reach it, and what happens when the same person answers twice — and none of that is
 * worth a tab bar.
 *
 * ⚠️ **Widgets are deliberately absent.** They are the Tools-page features, and what survives of them is
 * an open question with Ivan rather than a port.
 *
 * ⚠️ **A dialog rather than a drawer** (Ivan, 2026-08-21). Everything on it is a control somebody is
 * about to change — a placement, a share link, a submission limit — and none of it is read *against* the
 * library behind it. A modal centres the form being managed and gives the sections room; and, being a
 * dialog, it no longer evaporates on a stray click on the scrim with half a policy typed into it.
 */
export function FormManagementDialog({ form, onClose }: { form: FormSummary; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85svh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle className="pr-6 text-sm">
            {form.icon && <span className="mr-1.5">{form.icon}</span>}
            {form.name}
          </DialogTitle>
          <DialogDescription className="text-xs">Where it is filed, who may reach it, and its limits.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <PlacementSection form={form} />
          <SharingSection form={form} />
          <SubmissionPolicySection formId={form.id} />
          {/* ⚠️ Only the `form`-scoped groups — see `PresentationSection`. Stock and pricing belong to a
              subject area and must not appear on a library screen. */}
          <PresentationSection formId={form.id} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Where the form is filed.
 *
 * ⚠️ **A purpose carries behaviour; a category is only a heading.** Moving a form to `INVENTORY` makes it
 * a component type — which is why the two are edited together and why changing the purpose empties the
 * category: the categories under one purpose mean nothing under another.
 */
function PlacementSection({ form }: { form: FormSummary }) {
  const { data: purposes = [] } = usePurposes()

  const [purposeId, setPurposeId] = useState(form.purpose?.id ?? "")
  const [categoryId, setCategoryId] = useState(form.category?.id ?? "")

  const { data: categories = [] } = useCategories(purposeId || undefined)
  const patchForm = usePatchForm()

  const isDirty = purposeId !== (form.purpose?.id ?? "") || categoryId !== (form.category?.id ?? "")

  function save() {
    patchForm.mutate(
      { formId: form.id, purposeId: purposeId || undefined, categoryId: categoryId || undefined },
      {
        onSuccess: () => toast.success("Placement saved."),
        onError: (error) => {
          const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

          toast.error(detail ?? "Could not save the placement.")
        },
      },
    )
  }

  return (
    <EditorSection title="Placement" hint={form.purpose?.label}>
      <EditorField label="Purpose" hint="What answering this form means. Some purposes carry behaviour.">
        <PlainSelect
          value={purposeId}
          onChange={(next) => {
            setPurposeId(next)
            // ⚠️ Emptied rather than kept: a category belongs to one purpose, so carrying it across
            // would file the form under a heading that does not exist where it now lives.
            setCategoryId("")
          }}
        >
          <option value="">— none —</option>
          {purposes.map((purpose) => (
            <option key={purpose.id} value={purpose.id}>
              {purpose.icon ? `${purpose.icon} ` : ""}
              {purpose.label}
            </option>
          ))}
        </PlainSelect>
      </EditorField>

      <EditorField label="Category" hint="A heading in the library, and nothing more.">
        <PlainSelect value={categoryId} onChange={setCategoryId} disabled={!purposeId}>
          <option value="">— uncategorised —</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.icon ? `${category.icon} ` : ""}
              {category.name}
            </option>
          ))}
        </PlainSelect>
      </EditorField>

      <Button size="sm" className="self-start" disabled={!isDirty || patchForm.isPending} onClick={save}>
        Save placement
      </Button>
    </EditorSection>
  )
}

/**
 * The form's public link.
 *
 * ⚠️ **One switch here, everything else on `/admin/shares`.** A form's own screen answers *is this
 * public* and hands over the address; unfurl links, pretty paths and embed origins are the Sharing
 * Centre's, and a second editor for them here would be a second place to look and a second place to be
 * wrong.
 */
function SharingSection({ form }: { form: FormSummary }) {
  const [token, setToken] = useState(form.shareToken)
  const { copied, copy } = useCopyFeedback()

  const shareForm = useShareForm()
  const unshareForm = useUnshareForm()

  const isPending = shareForm.isPending || unshareForm.isPending
  const url = token ? `${window.location.origin}${publicRouteFor("FORM", token)}` : null

  function toggle(next: boolean) {
    if (next) {
      shareForm.mutate(form.id, {
        onSuccess: (result) => setToken(result.shareToken),
        onError: () => toast.error("Could not share this form."),
      })

      return
    }

    unshareForm.mutate(form.id, {
      onSuccess: () => setToken(null),
      onError: () => toast.error("Could not stop sharing this form."),
    })
  }

  const embed = url
    ? `<iframe\n  src="${url}/embed"\n  title="${form.name}"\n  style="width:100%;height:560px;border:none;display:block;"\n></iframe>`
    : null

  return (
    <EditorSection title="Sharing" badge={token ? "on" : undefined} hint={token ? undefined : "not shared"}>
      <label className="flex items-start gap-2">
        <Switch checked={!!token} disabled={isPending} onCheckedChange={toggle} />
        <span className="text-xs">
          Anybody with the link may fill this in
          <span className="block text-muted-foreground">
            No account, and no workspace membership. Revoking the link breaks every copy of it at once.
          </span>
        </span>
      </label>

      {url && (
        <>
          <LinkRow label="Public link" url={url} copied={copied} onCopy={() => copy(url)} />

          <EditorField label="Embed" hint="Paste into a page that should carry the form itself.">
            <Textarea readOnly rows={5} className="font-mono text-[11px]" value={embed ?? ""} />
          </EditorField>
        </>
      )}
    </EditorSection>
  )
}

/**
 * How a submitter is identified, and therefore what "already answered" can mean.
 *
 * ⚠️ **`ANONYMOUS` cannot count anybody.** With nothing identifying a submitter the caps below have no
 * identity to cap — they still throttle the form as a whole, which is a different and much blunter
 * thing, and the hint has to say so rather than leaving somebody to discover it.
 */
const STRATEGIES: Array<{ value: IdentityStrategy; label: string; what: string }> = [
  { value: "ANONYMOUS", label: "Nobody in particular", what: "No identity at all — the limits throttle the form." },
  { value: "USER", label: "The signed-in account", what: "Counted per account. Useless on a form nobody signs in to." },
  { value: "IP", label: "The address it came from", what: "Counted per client address — the usual choice for a public form." },
  { value: "EMAIL", label: "A field of the answer", what: "Counted per value of one field. Name the field below." },
]

function SubmissionPolicySection({ formId }: { formId: string }) {
  const { data: policy, isLoading } = useSubmissionPolicy(formId)

  const savePolicy = useSaveSubmissionPolicy()
  const deletePolicy = useDeleteSubmissionPolicy()

  const [strategy, setStrategy] = useState<IdentityStrategy>("ANONYMOUS")
  const [resubmissionAllowed, setResubmissionAllowed] = useState(true)
  const [maxPerIdentity, setMaxPerIdentity] = useState("")
  const [cooldownMinutes, setCooldownMinutes] = useState("")
  const [identityFieldName, setIdentityFieldName] = useState("")
  const [confirmingRemoval, setConfirmingRemoval] = useState(false)

  // Seeded from the answer once it arrives, and reseeded whenever it changes — including back to
  // nothing after a removal, which is what puts the controls back to the unrestricted defaults.
  useEffect(() => {
    setStrategy(policy?.identityStrategy ?? "ANONYMOUS")
    setResubmissionAllowed(policy?.resubmissionAllowed ?? true)
    setMaxPerIdentity(policy?.maxPerIdentity != null ? String(policy.maxPerIdentity) : "")
    setCooldownMinutes(policy?.cooldownMinutes != null ? String(policy.cooldownMinutes) : "")
    setIdentityFieldName(policy?.identityFieldName ?? "")
  }, [policy])

  if (isLoading) {
    return <EditorSection title="Submissions">{null}</EditorSection>
  }

  function save() {
    savePolicy.mutate(
      {
        formId,
        resubmissionAllowed,
        maxPerIdentity: maxPerIdentity ? Number.parseInt(maxPerIdentity, 10) : null,
        cooldownMinutes: cooldownMinutes ? Number.parseInt(cooldownMinutes, 10) : null,
        identityStrategy: strategy,
        identityFieldName: identityFieldName.trim() || null,
      },
      {
        onSuccess: () => toast.success("Submission policy saved."),
        onError: (error) => {
          const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

          toast.error(detail ?? "Could not save the policy.")
        },
      },
    )
  }

  return (
    <EditorSection
      title="Submissions"
      badge={policy ? "limited" : undefined}
      hint={policy ? undefined : "unrestricted"}
      defaultOpen={!!policy}
    >
      {!policy && (
        <p className="text-xs text-muted-foreground">
          This form accepts as many answers as anybody cares to send. Set something below to change that.
        </p>
      )}

      <EditorField label="Who counts as one submitter" hint={STRATEGIES.find((one) => one.value === strategy)?.what}>
        <PlainSelect value={strategy} onChange={(next) => setStrategy(next as IdentityStrategy)}>
          {STRATEGIES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </PlainSelect>
      </EditorField>

      {strategy === "EMAIL" && (
        <EditorField label="Which field" hint="The field's name, not its label — the identifier a form refers to.">
          <Input
            className="h-8 font-mono text-sm"
            value={identityFieldName}
            placeholder="email"
            onChange={(event) => setIdentityFieldName(event.target.value)}
          />
        </EditorField>
      )}

      <label className="flex items-start gap-2">
        <Switch checked={resubmissionAllowed} onCheckedChange={setResubmissionAllowed} />
        <span className="text-xs">
          The same submitter may answer again
          <span className="block text-muted-foreground">
            With this off it is once and only once, and the two limits below stop meaning anything.
          </span>
        </span>
      </label>

      <div className="flex gap-2">
        <EditorField label="At most" hint="Blank for no cap.">
          <Input
            type="number"
            min={1}
            className="h-8 w-28 text-sm"
            value={maxPerIdentity}
            placeholder="unlimited"
            disabled={!resubmissionAllowed}
            onChange={(event) => setMaxPerIdentity(event.target.value)}
          />
        </EditorField>

        <EditorField label="Not again within" hint="Minutes. Blank for no wait.">
          <Input
            type="number"
            min={1}
            className="h-8 w-28 text-sm"
            value={cooldownMinutes}
            placeholder="no wait"
            disabled={!resubmissionAllowed}
            onChange={(event) => setCooldownMinutes(event.target.value)}
          />
        </EditorField>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" disabled={savePolicy.isPending} onClick={save}>
          {policy ? "Save limits" : "Set limits"}
        </Button>

        {/* ⚠️ Removing the policy is what makes a form unrestricted again — a save with the limits
            blanked leaves a row that permits everything while reading as though somebody meant it. */}
        {policy &&
          (confirmingRemoval ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={deletePolicy.isPending}
              onClick={() =>
                deletePolicy.mutate(formId, {
                  onSuccess: () => {
                    toast.success("The form is unrestricted again.")
                    setConfirmingRemoval(false)
                  },
                  onError: () => toast.error("Could not remove the policy."),
                })
              }
            >
              Really remove
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setConfirmingRemoval(true)}
            >
              Remove limits
            </Button>
          ))}
      </div>
    </EditorSection>
  )
}
