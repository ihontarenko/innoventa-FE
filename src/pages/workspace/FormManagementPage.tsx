import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, Eye, SlidersHorizontal } from "lucide-react"
import { Badge, Button, Skeleton } from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import { FormManagement } from "@/components/form/management/FormManagement"
import { FormPreviewDialog } from "@/components/form/FormPreviewDialog"
import { useForm } from "@/hooks/useForms"
import { describeQueryFailure } from "@/lib/loadFailure"
import { spaceSectionPath } from "@/lib/navigationContext"

/**
 * A form's management screen at an address of its own.
 *
 * ⚠️ **The same `FormManagement` the dialog renders**, and deliberately nothing more. A page that grew
 * one extra control would be a second place every rule about placement, sharing and limits has to be
 * right. What the page adds is what only an address can give: a link to send, a tab to keep open, and a
 * way back that is not a ✕.
 *
 * ⚠️ **It fetches a `FormDetail`, which is not a `FormSummary`** — see `ManagedForm` for why the
 * management screen takes the intersection rather than the summary.
 */
export function FormManagementPage() {
  const { spaceSlug, formId } = useParams()
  const query = useForm(formId)
  const failure = describeQueryFailure(query, "form")
  const [isPreviewOpen, setPreviewOpen] = useState(false)

  if (failure) {
    return <LoadFailureNotice failure={failure} onRetry={() => void query.refetch()} />
  }

  if (!query.data) {
    return (
      <>
        <PageHeader title="Manage" description={spaceSlug} />
        <Skeleton className="h-96 w-full" />
      </>
    )
  }

  const form = query.data

  return (
    <>
      <PageHeader
        title={`${form.icon ?? "▤"} ${form.name}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {form.codename && <span className="font-mono">{form.codename}</span>}
            {form.purpose && <Badge variant="secondary">{form.purpose.label}</Badge>}
            {form.category && <Badge variant="outline">{form.category.name}</Badge>}
            {form.shareToken && <Badge variant="secondary">shared</Badge>}
          </span>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(true)}>
              <Eye className="size-3.5" />
              Preview
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to={spaceSectionPath(spaceSlug ?? "", `forms/${form.id}`)}>
                <SlidersHorizontal className="size-3.5" />
                Schema
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to={spaceSectionPath(spaceSlug ?? "", "forms")}>
                <ArrowLeft className="size-3.5" />
                Library
              </Link>
            </Button>
          </>
        }
      />

      {/* ⚠️ `base` (the default), because this address sits under the forms section — the platform's
          own level. A component type's stock and catalogue mapping are edited from Component types, which is the
          level that owns them; see `ManagementDepth`. */}
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-hidden rounded-lg border">
        <FormManagement form={form} />
      </div>

      {isPreviewOpen && <FormPreviewDialog formId={form.id} onClose={() => setPreviewOpen(false)} />}
    </>
  )
}
