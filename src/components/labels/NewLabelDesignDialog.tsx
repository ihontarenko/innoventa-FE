import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@jmouse/ui"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { useCreateLabelTemplate } from "@/hooks/useLabels"
import { MINIMUM_LABEL_SIDE_MM } from "@/lib/labels/labelDesign"
import { spaceSectionPath } from "@/lib/navigationContext"
import type { SpaceForm } from "@/api/spaces"
import type { LabelSubjectKind } from "@/types"

/** The sizes a thermal roll actually comes in — a starting point, not a limit. */
const COMMON_SIZES: Array<{ label: string; widthMm: number; heightMm: number }> = [
  { label: "58 × 40", widthMm: 58, heightMm: 40 },
  { label: "40 × 30", widthMm: 40, heightMm: 30 },
  { label: "30 × 20", widthMm: 30, heightMm: 20 },
  { label: "12 × 40", widthMm: 12, heightMm: 40 },
]

/**
 * A new design, and the first thing it asks.
 *
 * ⚠️ **A design starts with a FORM, and that is the first question on purpose.** A label is that form's
 * fields laid out — pick "Components" and the studio's palette is `{{ manufacturer }}`, `{{ package }}`,
 * `{{ inventory_number }}`. A design naming no form could only offer the four placeholders every record
 * has, which is the version of this feature nobody could see the point of.
 *
 * ⚠️ **The subject kind is DERIVED, never asked twice.** An asset form describes a thing under custody,
 * so a design about one may also use its state, holder, place and due date — that follows from the
 * form's purpose and asking again would be a second place for the two to disagree.
 */
export function NewLabelDesignDialog({ forms, onClose }: { forms: SpaceForm[]; onClose: () => void }) {
  const { spaceSlug } = useParams<{ spaceSlug: string }>()
  const navigate = useNavigate()
  const createTemplate = useCreateLabelTemplate()

  const [formId, setFormId] = useState(forms[0]?.id ?? "")
  const [name, setName] = useState("")
  const [widthMm, setWidth] = useState(58)
  const [heightMm, setHeight] = useState(40)

  const chosenForm = forms.find((form) => form.id === formId)
  const subjectKind: LabelSubjectKind = chosenForm?.purpose?.code === "ASSET" ? "ASSET" : "ENTRY"

  const isUsable =
    !!formId &&
    name.trim().length > 0 &&
    widthMm >= MINIMUM_LABEL_SIDE_MM &&
    heightMm >= MINIMUM_LABEL_SIDE_MM

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">New label design</DialogTitle>
          <DialogDescription className="text-xs">
            A label is a form's fields laid out — so the form comes first.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="label-form">Which form</Label>
            <PlainSelect value={formId} onChange={setFormId}>
              {forms.length === 0 && <option value="">This workspace shows no forms yet</option>}
              {forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.icon ? `${form.icon} ` : ""}
                  {form.name}
                </option>
              ))}
            </PlainSelect>
            <span className="text-xs text-muted-foreground">
              Its fields become the placeholders the studio offers.
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="label-name">Name</Label>
            <Input
              id="label-name"
              autoFocus
              value={name}
              placeholder="Shelf label"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Size</Label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SIZES.map((size) => (
                <button
                  key={size.label}
                  type="button"
                  onClick={() => {
                    setWidth(size.widthMm)
                    setHeight(size.heightMm)
                  }}
                  className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${
                    widthMm === size.widthMm && heightMm === size.heightMm
                      ? "border-primary bg-accent"
                      : "hover:bg-accent/50"
                  }`}
                >
                  {size.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={MINIMUM_LABEL_SIDE_MM}
                className="w-24"
                value={widthMm}
                onChange={(event) => setWidth(Number(event.target.value))}
              />
              <span className="text-sm text-muted-foreground">×</span>
              <Input
                type="number"
                min={MINIMUM_LABEL_SIDE_MM}
                className="w-24"
                value={heightMm}
                onChange={(event) => setHeight(Number(event.target.value))}
              />
              <span className="text-sm text-muted-foreground">mm</span>
            </div>

            {/* ⚠️ The server's own floor, said here — so a size the save would refuse is refused before
                somebody has typed a name. */}
            <span className="text-xs text-muted-foreground">
              At least {MINIMUM_LABEL_SIDE_MM} mm each way. A QR needs 8 mm to survive a phone camera.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!isUsable || createTemplate.isPending}
            onClick={() =>
              createTemplate.mutate(
                { name: name.trim(), subjectKind, formId, widthMm, heightMm },
                {
                  // ⚠️ Straight into the studio: a design created and left on a list is a design nobody
                  // has looked at, and the server composes a starter so there is something to see.
                  onSuccess: (template) => {
                    onClose()
                    navigate(spaceSectionPath(spaceSlug!, `labels/${template.id}`))
                  },
                  onError: () => toast.error("That design was not created."),
                },
              )
            }
          >
            {createTemplate.isPending ? "Creating…" : "Create and open"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
