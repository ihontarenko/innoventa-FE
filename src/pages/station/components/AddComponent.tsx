import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@jmouse/ui"
import { entriesApi } from "@/api/forms"
import type { FieldDetail } from "@/types/forms"
import { RecogniseComponent } from "@/pages/station/components/RecogniseComponent"

export interface AddComponentProperties {
  open: boolean
  onOpenChange: (open: boolean) => void
  formId: string
  spaceId: string
  fields: FieldDetail[]
  titleFieldName?: string
  countFieldName?: string
  online: boolean
}

/**
 * Adding a component, from the station.
 *
 * <h2>⚠️ It asks for what the form REQUIRES, and nothing else</h2>
 *
 * <p>The first version asked for a name and a count, on the reasoning that a station should not be a
 * form screen on a phone. That reasoning is still right and the implementation was still wrong: a
 * component type decides what it cannot be created without, and `resistor` cannot be created without a
 * name, a quantity <em>and</em> a resistance. Sending two of three produced <em>"One or more fields did
 * not pass validation"</em> — a station that could not add anything at all.
 *
 * <p>So the rule is the form's rather than this file's: **every required field, no optional ones**.
 * Everything a component type merely *offers* is still filled on the desktop, where there is room.
 * A type that requires twelve fields will be unpleasant here, and that is the type's own statement
 * about itself rather than something to paper over.
 *
 * <h2>⚠️ Creating needs the network, and the button says so</h2>
 *
 * <p>Every other write here is queued. A creation cannot be: the identifier is the server's, and
 * everything the offline queue does afterwards — adjust this entry, photograph it — is addressed by
 * that identifier. Queuing one would mean minting an identifier locally and reconciling it later, which
 * is a different feature with its own conflicts. Refused plainly rather than accepted and lost.
 */
export function AddComponent({
  open,
  onOpenChange,
  formId,
  spaceId,
  fields,
  titleFieldName,
  countFieldName,
  online,
}: AddComponentProperties) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  /**
   * ⚠️ **`PHANTOM` is excluded, and it is not an optional tidy-up.** It is the form's own bookkeeping —
   * the hidden chooser a virtual field uses to decide which child to show — inferred on load and
   * stripped before submit. Rendering one would put a control on screen for something that is not a
   * question anybody can answer.
   */
  const asked = useMemo(
    () =>
      fields.filter(
        (field) => field.required && field.status === "ACTIVE" && field.usageType !== "PHANTOM",
      ),
    [fields],
  )

  const set = (name: string, value: string) => setValues((previous) => ({ ...previous, [name]: value }))

  const missing = asked.filter((field) => !(values[field.name] ?? "").trim())

  const save = async () => {
    setSaving(true)
    setProblem(null)

    try {
      await entriesApi.create(formId, values, spaceId)
      await queryClient.invalidateQueries({ queryKey: ["station", "components"] })

      setValues({})
      onOpenChange(false)
    } catch (failure) {
      // ⚠️ **This was a bare `try/finally` and the refusal went nowhere.** The backend answered, the
      // promise rejected, and the form sat there unchanged — which reads as a button that does nothing.
      // A station that silently discards a write is worse than one that cannot write at all: somebody
      // walks away believing the component is counted.
      setProblem(refusalWords(failure))
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <div
        className="bg-background sticky bottom-0 p-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {/* ⚠️ At the bottom, where a thumb is — not in the header with the title. */}
        <Button className="h-12 w-full text-[14px]" onClick={() => onOpenChange(true)}>
          <Plus />
          Add a component
        </Button>
      </div>
    )
  }

  return (
    <div
      className="border-border bg-background sticky bottom-0 flex flex-col gap-3 border-t p-3"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {/* ⚠️ Above the fields, because it FILLS one — a control below the thing it writes into reads as a
          separate action rather than as a way of answering the question. */}
      {titleFieldName && <RecogniseComponent onRecognised={(name) => set(titleFieldName, name)} />}

      {asked.map((field) => (
        <FieldControl
          key={field.id}
          field={field}
          value={values[field.name] ?? ""}
          onChange={(value) => set(field.name, value)}
          countFieldName={countFieldName}
        />
      ))}

      {asked.length === 0 && (
        <p className="text-muted-foreground text-[12.5px] leading-relaxed">
          This component type requires nothing, so there is nothing to fill in.
        </p>
      )}

      {problem && <p className="text-destructive text-[12.5px] leading-relaxed">{problem}</p>}

      {!online && (
        <p className="text-muted-foreground text-[12px] leading-relaxed">
          Adding needs a connection — a new component is given its identifier by the server, and
          everything queued afterwards is addressed by it. Adjusting what is already here still works
          offline.
        </p>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="h-11 flex-1"
          onClick={() => {
            setProblem(null)
            onOpenChange(false)
          }}
        >
          Cancel
        </Button>
        <Button
          className="h-11 flex-1"
          disabled={!online || saving || missing.length > 0}
          onClick={() => void save()}
        >
          Add
        </Button>
      </div>
    </div>
  )
}

/**
 * One required field, as the smallest control that can answer it honestly.
 *
 * ⚠️ **Not the form renderer, and deliberately not.** The desktop's renderer knows conditions, composite
 * children, validation expressions and option sources; reproducing a tenth of it here would be a second
 * renderer that agrees with the first until it does not. This asks for a value and lets the **backend**
 * judge it — which is why a refusal is shown in the backend's own words rather than pre-empted here.
 */
export function FieldControl({
  field,
  value,
  onChange,
  countFieldName,
}: {
  field: FieldDetail
  value: string
  onChange: (value: string) => void
  countFieldName?: string
}) {
  const label = field.label || field.name
  const isCount = field.name === countFieldName

  if ((field.elementType === "SELECT" || field.elementType === "RADIO") && field.options.length > 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-[12px]">{label}</Label>
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger className="h-11 text-[13px]">
            <SelectValue placeholder={`Choose ${label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option.id} value={option.optionValue}>
                {option.optionLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (field.elementType === "TEXTAREA") {
    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-[12px]">{label}</Label>
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          style={{ fontSize: 16 }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[12px]">
        {label}
        {field.unit ? ` (${field.unit})` : ""}
      </Label>
      <Input
        value={value}
        // ⚠️ `inputMode`, not `type="number"`. A number input on a phone brings a keypad and then quietly
        // refuses values the field may legitimately hold — `4k7` is a resistance, and this product knows
        // it even though a browser does not.
        inputMode={field.elementType === "NUMBER" ? "numeric" : "text"}
        onChange={(event) => onChange(event.target.value)}
        placeholder={isCount ? "How many" : undefined}
        className="h-11"
        style={{ fontSize: 16 }}
      />
    </div>
  )
}

/**
 * What the backend actually said, in words somebody standing at a shelf can act on.
 *
 * ⚠️ **`detail` is the sentence the domain wrote, and it beats anything this file could compose.** A
 * validation refusal names the field that is missing; putting "could not save" on top of it would throw
 * away the only useful part of the answer.
 */
function refusalWords(failure: unknown): string {
  const answer = (failure as { response?: { status?: number; data?: { detail?: string; title?: string } } }).response

  if (answer?.data?.detail) {
    return answer.data.detail
  }
  if (answer?.data?.title) {
    return answer.data.title
  }
  if (answer?.status) {
    return `The component was not added — the server refused it (${answer.status}).`
  }

  return "The component was not added — the request never reached the server."
}
