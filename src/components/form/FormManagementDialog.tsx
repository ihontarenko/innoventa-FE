import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Eye, ExternalLink } from "lucide-react"
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@jmouse/ui"
import { FormManagement, type ManagementDepth } from "@/components/form/management/FormManagement"
import { FormPreviewDialog } from "@/components/form/FormPreviewDialog"
import { spaceSectionPath } from "@/lib/navigationContext"
import type { ManagedForm } from "@/components/form/management/types"

/**
 * Everything about a form that is not its schema, over whatever screen asked for it.
 *
 * ⚠️ **A dialog rather than a drawer** (Ivan, 2026-08-21). Everything on it is a control somebody is
 * about to change — a name, a placement, a share link, a submission limit — and none of it is read
 * *against* the library behind it. A modal centres the form being managed and gives the panes room;
 * and, being a dialog, it no longer evaporates on a stray click on the scrim with half a policy typed.
 *
 * ⚠️ **And it has an address of its own** (Ivan, 2026-08-25): `…/forms/{id}/manage`. A modal is right for
 * a change somebody came to make and is leaving again; a page is right for one they want to keep open,
 * send to somebody, or come back to. The two render the same `FormManagement`, so neither can drift.
 *
 * ⚠️ **`depth` is what the caller is standing in, never a preference** — see `ManagementDepth`.
 */
export function FormManagementDialog({
  form,
  depth = "base",
  onClose,
}: {
  form: ManagedForm
  depth?: ManagementDepth
  onClose: () => void
}) {
  const { spaceSlug } = useParams()
  const [isPreviewOpen, setPreviewOpen] = useState(false)

  return (
    <>
      <Dialog open onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="flex h-[82svh] flex-col gap-0 p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 border-b px-4 py-3 pr-10">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-sm">
              {form.icon && <span aria-hidden="true">{form.icon}</span>}
              {form.name}

              <span className="ml-auto flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(true)}>
                  <Eye className="size-3.5" />
                  Preview
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link to={spaceSectionPath(spaceSlug ?? "", `forms/${form.id}/manage`)}>
                    <ExternalLink className="size-3.5" />
                    Page
                  </Link>
                </Button>
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              What it is called, where it is filed, who may reach it, and how an entry of it is summarised.
            </DialogDescription>
          </DialogHeader>

          <FormManagement form={form} depth={depth} />
        </DialogContent>
      </Dialog>

      {/* ⚠️ A sibling of the dialog above, not a child of its content. Radix stacks two open layers
          correctly — the newest takes the focus — but a modal mounted *inside* another's content is
          trapped by it, and its own controls stop taking the keyboard. */}
      {isPreviewOpen && <FormPreviewDialog formId={form.id} onClose={() => setPreviewOpen(false)} />}
    </>
  )
}
