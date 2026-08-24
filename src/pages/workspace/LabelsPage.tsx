import { useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Badge, Button, Skeleton } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { NewLabelDesignDialog } from "@/components/labels/NewLabelDesignDialog"
import { ShareLabelDesignDialog } from "@/components/labels/ShareLabelDesignDialog"
import {
  useDeleteLabelTemplate,
  useDuplicateLabelTemplate,
  useLabelTemplates,
  useLabelsModule,
} from "@/hooks/useLabels"
import { useWorkspaceForms } from "@/hooks/useWorkspaceForms"
import { spaceSectionPath } from "@/lib/navigationContext"
import type { LabelTemplateSummary } from "@/types"

const SUBJECT_LABELS: Record<string, string> = {
  ENTRY: "Records",
  ASSET: "Equipment",
}

/**
 * The designs this account prints from.
 *
 * ⚠️ **A design belongs to a PERSON and reaches a workspace by being shared into it** — the same
 * arrangement pages have, and for the same reason: a label is something somebody iterates on, and
 * making every half-finished experiment part of a workspace's shared configuration is how nobody
 * experiments.
 *
 * ⚠️ **A shared design offers Duplicate where an owned one offers Open.** Somebody else's design is
 * theirs to change and this reader's to print from; duplicating makes a copy that is yours — which is
 * how a 12×40 arrives from somebody else's 58×40.
 */
export function LabelsPage() {
  const { spaceSlug } = useParams<{ spaceSlug: string }>()
  const printable = useLabelsModule()

  const { data: templates = [], isLoading } = useLabelTemplates()
  const { data: forms = [] } = useWorkspaceForms()

  const duplicateTemplate = useDuplicateLabelTemplate()
  const deleteTemplate = useDeleteLabelTemplate()

  const [isCreating, setCreating] = useState(false)
  const [sharing, setSharing] = useState<LabelTemplateSummary | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const formsById = useMemo(() => new Map(forms.map((form) => [form.id, form])), [forms])

  // ⚠️ Absent rather than refused. The section only appears where the module is on, so this is the
  // rare case of somebody arriving by address — and the honest answer names the switch.
  if (!printable) {
    return (
      <>
        <PageHeader title="Labels" />
        <div className="max-w-xl rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          This workspace does not print labels. It is a module, switched on in the workspace's settings.
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Labels"
        description="Designs you print from — yours, and those shared into this workspace"
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            New design
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : templates.length === 0 ? (
        <div className="flex max-w-xl flex-col items-start gap-3 rounded-md border border-dashed p-8">
          <h2 className="font-medium">No designs yet</h2>
          <p className="text-sm text-muted-foreground">
            Pick a form, choose a size, and the studio opens on something to edit.
          </p>
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            New design
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => {
            const form = formsById.get(template.formId)

            return (
              <div key={template.id} className="flex flex-col gap-3 rounded-lg border p-4">
                <div className="flex items-start gap-2">
                  <span className="flex-1 truncate font-medium">{template.name}</span>
                  {!template.mine && <Badge variant="secondary">Shared</Badge>}
                </div>

                <dl className="flex flex-col gap-1 text-xs">
                  <Fact label="Form" value={form ? `${form.icon ? `${form.icon} ` : ""}${form.name}` : "—"} />
                  <Fact label="Size" value={`${template.widthMm}×${template.heightMm} mm`} mono />
                  <Fact label="About" value={SUBJECT_LABELS[template.subjectKind] ?? template.subjectKind} />
                  <Fact label="Elements" value={String(template.elementCount)} />
                </dl>

                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                  {template.mine ? (
                    <>
                      <Button size="sm" variant="outline" asChild>
                        <Link to={spaceSectionPath(spaceSlug!, `labels/${template.id}`)}>Open</Link>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSharing(template)}>
                        Share
                      </Button>

                      {removingId === template.id ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            deleteTemplate.mutate(template.id, {
                              onError: () => toast.error("That design was not deleted."),
                            })
                            setRemovingId(null)
                          }}
                        >
                          Really delete
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto text-destructive hover:bg-destructive/10"
                          onClick={() => setRemovingId(template.id)}
                        >
                          Delete
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        duplicateTemplate.mutate(template.id, {
                          onSuccess: () => toast.success("Copied — the copy is yours to change."),
                          onError: () => toast.error("That was not duplicated."),
                        })
                      }
                    >
                      Duplicate
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isCreating && <NewLabelDesignDialog forms={forms} onClose={() => setCreating(false)} />}
      {sharing && <ShareLabelDesignDialog template={sharing} onClose={() => setSharing(null)} />}
    </>
  )
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="w-16 shrink-0 text-muted-foreground">{label}</dt>
      <dd className={`truncate ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  )
}
