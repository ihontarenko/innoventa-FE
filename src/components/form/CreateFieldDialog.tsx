import { useState } from "react"
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
  Switch,
  cn,
} from "@jmouse/ui"
import { BOUNDED_DIALOG, DialogBody } from "@/components/BoundedDialog"
import { GlyphInput } from "@/components/GlyphInput"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { useCreateField } from "@/hooks/useFieldCatalogue"
import { toSnakeCase } from "@/components/form/builder/useFieldDraft"
import { FIELD_TYPES, HAS_UNIT, USAGE_TYPES } from "@/lib/fieldTypes"
import type { ElementType } from "@/types"


/**
 * A new field definition.
 *
 * ⚠️ **The name is derived from the label and stays editable.** The label is what a person reads and the
 * name is what a form and an expression refer to — deriving it saves the ordinary case, and locking it
 * would make the one field somebody needs to call `mfr_part_no` impossible.
 *
 * ⚠️ **A composite has no element type and no unit**, and they are absent rather than disabled: a group
 * holds child fields, it holds no value of its own, so a shape for it would be a question about
 * something that does not exist.
 */
export function CreateFieldDialog({ onClose }: { onClose: () => void }) {
  const createField = useCreateField()

  const [label, setLabel] = useState("")
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("")
  const [elementType, setElementType] = useState<ElementType>("TEXT")
  const [unit, setUnit] = useState("")
  const [usageType, setUsageType] = useState<string>("STANDALONE")
  const [required, setRequired] = useState(false)

  const isComposite = usageType === "VIRTUAL"
  const takesUnit = !isComposite && HAS_UNIT.has(elementType)

  function changeLabel(next: string) {
    // ⚠️ Follows the label only while it has not been typed into by hand — comparing against the
    // *previous* label's derivation is what tells those two states apart.
    if (!name || name === toSnakeCase(label)) {
      setName(toSnakeCase(next))
    }

    setLabel(next)
  }

  function create() {
    createField.mutate(
      {
        name: name.trim(),
        label: label.trim(),
        icon: icon.trim() || undefined,
        usageType,
        elementType: isComposite ? "NONE" : elementType,
        unit: takesUnit ? unit.trim() || undefined : undefined,
        required,
        sortOrder: 0,
      },
      {
        onSuccess: () => {
          toast.success(`${label.trim()} created.`)
          onClose()
        },
        onError: (error) => {
          const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

          toast.error(detail ?? "Could not create the field.")
        },
      },
    )
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={cn(BOUNDED_DIALOG, "gap-3 sm:max-w-lg")}>
        <DialogHeader className="shrink-0">
          <DialogTitle>{label.trim() || "New field"}</DialogTitle>
          <DialogDescription>
            A definition, not a question on a form — it is attached to forms afterwards, and the same one may be on six.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-3">
          <div className="flex gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium">Glyph</span>
              <GlyphInput value={icon} onChange={setIcon} placeholder="⚡" />
            </label>

            <label className="flex flex-1 flex-col gap-1">
              <span className="text-xs font-medium">Label</span>
              <Input
                autoFocus
                className="h-8 text-sm"
                value={label}
                placeholder="Manufacturer"
                onChange={(event) => changeLabel(event.target.value)}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium">Name</span>
            <Input
              className="h-8 font-mono text-sm"
              value={name}
              placeholder="manufacturer"
              onChange={(event) => setName(event.target.value)}
            />
            <span className="text-[11px] text-muted-foreground">
              What a form and an expression refer to. It follows the label until you change it yourself.
            </span>
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">Where it may stand</span>
            <div className="flex flex-wrap gap-1.5">
              {USAGE_TYPES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  title={option.hint}
                  onClick={() => setUsageType(option.value)}
                  className={cn(
                    "flex min-w-32 flex-col gap-0.5 rounded-md border px-2.5 py-1.5 text-left",
                    usageType === option.value ? "border-primary bg-accent" : "hover:bg-accent/50",
                  )}
                >
                  <span className="text-xs font-medium">
                    {option.glyph} {option.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{option.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* ⚠️ Absent for a composite rather than disabled — a group holds child fields and no value of
              its own, so a shape and a unit would be questions about something that does not exist. */}
          {!isComposite && (
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs font-medium">Shape</span>
                <PlainSelect value={elementType} onChange={(next) => setElementType(next as ElementType)}>
                  {FIELD_TYPES.filter((descriptor) => descriptor.group !== "Structure").map((descriptor) => (
                    <option key={descriptor.id} value={descriptor.id}>
                      {descriptor.glyph} {descriptor.label}
                    </option>
                  ))}
                </PlainSelect>
              </label>

              {takesUnit && (
                <label className="flex w-32 flex-col gap-1">
                  <span className="text-xs font-medium">Unit</span>
                  <Input
                    className="h-8 text-sm"
                    value={unit}
                    placeholder="Ω"
                    onChange={(event) => setUnit(event.target.value)}
                  />
                </label>
              )}
            </div>
          )}

          <label className="flex items-center gap-2">
            <Switch checked={required} onCheckedChange={setRequired} />
            <span className="text-xs">
              Required by default
              <span className="text-muted-foreground">
                {" "}
                — a form may still take it back with a condition
              </span>
            </span>
          </label>
        </DialogBody>

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={createField.isPending || !label.trim() || !name.trim()} onClick={create}>
            Create field
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
