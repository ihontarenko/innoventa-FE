import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
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
} from "@jmouse/ui"
import { GlyphInput } from "@/components/GlyphInput"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { useCategories, useCreateForm, usePurposes } from "@/hooks/useWorkspaceForms"
import { spaceSectionPath } from "@/lib/navigationContext"
import { useSpaceStore } from "@/stores/spaceStore"

/**
 * A new form, with only what a form cannot exist without.
 *
 * ⚠️ **Four fields, and the schema is not one of them.** A form is created empty and its fields are
 * added in the builder — asking for them here would mean deciding the shape of a thing before it has a
 * name, and abandoning the dialog halfway would leave nothing rather than a form somebody could go back
 * to.
 *
 * ⚠️ **It is created INTO the active workspace.** A form made from a workspace screen and then not shown
 * by that workspace is the most confusing possible outcome, so the workspace travels with the request.
 *
 * ⚠️ **The purpose is what carries behaviour** — `INVENTORY` makes a form a component type — so a caller
 * that already knows which purpose it wants passes the **code** and the control is not offered. Choosing
 * it on a screen that is about one purpose is a chance to pick the wrong one.
 */
export function CreateFormDialog({
  title = "New form",
  purposeCode,
  onClose,
}: {
  title?: string
  /** Fixes the purpose and hides the control. Absent offers the whole list. */
  purposeCode?: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const spaceId = useSpaceStore((state) => state.activeSpaceId)
  const spaceSlug = useSpaceStore((state) => state.activeSpaceSlug)

  const { data: purposes = [] } = usePurposes()
  const createForm = useCreateForm()

  const fixedPurpose = useMemo(
    () => (purposeCode ? purposes.find((purpose) => purpose.code === purposeCode) : undefined),
    [purposes, purposeCode],
  )

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [icon, setIcon] = useState("")
  const [purposeId, setPurposeId] = useState("")
  const [categoryId, setCategoryId] = useState("")

  const chosenPurposeId = fixedPurpose?.id ?? purposeId
  const { data: categories = [] } = useCategories(chosenPurposeId || undefined)

  function create() {
    createForm.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
        purposeId: chosenPurposeId || undefined,
        categoryId: categoryId || undefined,
        spaceId: spaceId ?? undefined,
      },
      {
        onSuccess: (form) => {
          toast.success(`${form.name} created.`)
          onClose()

          // ⚠️ Straight into the builder. A form with no fields is not yet a form, and a dialog that
          // closed onto a list would leave somebody to find the thing they just made.
          if (spaceSlug) {
            navigate(spaceSectionPath(spaceSlug, `forms/${form.id}`))
          }
        },
        onError: (error) => {
          const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

          toast.error(detail ?? "Could not create the form.")
        },
      },
    )
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            It is created empty and opens in the builder — the fields are the next decision, not this one.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Glyph</span>
            {/* One character or one emoji. It is what the card leads with, and a word there would be the
                name written twice. Typed or picked — see `GlyphInput`. */}
            <GlyphInput value={icon} onChange={setIcon} />
          </label>

          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium">Name</span>
            <Input
              autoFocus
              className="h-8 text-sm"
              value={name}
              placeholder="Resistors"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Description</span>
          <Input
            className="h-8 text-sm"
            value={description}
            placeholder="What this collects, in one sentence"
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        {fixedPurpose ? (
          <p className="text-xs text-muted-foreground">
            Filed under <strong>{fixedPurpose.label}</strong> — that is what this screen is about.
          </p>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Purpose</span>
            <PlainSelect
              value={purposeId}
              onChange={(next) => {
                setPurposeId(next)
                // ⚠️ The category belongs to the purpose, so changing one drops the other rather than
                // carrying a category that now belongs somewhere else.
                setCategoryId("")
              }}
            >
              <option value="">No particular purpose</option>
              {purposes.map((purpose) => (
                <option key={purpose.id} value={purpose.id}>
                  {purpose.icon ? `${purpose.icon} ` : ""}
                  {purpose.label}
                </option>
              ))}
            </PlainSelect>
          </label>
        )}

        {categories.length > 0 && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Category</span>
            <PlainSelect value={categoryId} onChange={setCategoryId}>
              <option value="">Uncategorised</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon ? `${category.icon} ` : ""}
                  {category.name}
                </option>
              ))}
            </PlainSelect>
          </label>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={createForm.isPending || name.trim().length === 0} onClick={create}>
            Create and open
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
