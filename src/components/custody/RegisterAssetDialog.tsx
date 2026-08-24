import { useRef, useState } from "react"
import { toast } from "sonner"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@jmouse/ui"
import { PlainSelect } from "@/components/access/PolicyEditingKit"
import { EditorField } from "@/components/form/builder/EditorSection"
import { DynamicForm } from "@/components/form/DynamicForm"
import { useAssetForms, useRegisterAsset } from "@/hooks/useCustody"
import { useForm } from "@/hooks/useForms"
import { useStorageLocations } from "@/hooks/useStorageLocations"
import type { StorageLocation } from "@/api/storageLocations"

/**
 * Registering a thing.
 *
 * ⚠️ **Two facts at once, and both are required: *what* it is, and *where it starts out*.** A thing with
 * no starting place has never been anywhere, and its history — which is the whole point of custody —
 * begins with a hole nobody can fill afterwards.
 *
 * ⚠️ **The identity is a form entry, filled in here rather than picked.** An asset is a *particular*
 * thing, so it needs its own row: this meter, with this serial. Picking an existing entry would be right
 * for something already recorded, and that is a second path this dialog deliberately does not offer yet.
 */
export function RegisterAssetDialog({ onClose }: { onClose: () => void }) {
  const { data: assetForms = [] } = useAssetForms()
  const { data: locations = [] } = useStorageLocations()

  const [formId, setFormId] = useState("")
  const [locationId, setLocationId] = useState("")
  const [note, setNote] = useState("")

  const { data: form } = useForm(formId || undefined)
  const registerAsset = useRegisterAsset()

  // The form draws no button of its own; the footer below submits through this, so validation, the
  // condition cascade and the phantom stripping all still run.
  const formRef = useRef<HTMLFormElement | null>(null)

  const flatLocations = flatten(locations)

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Register a thing</DialogTitle>
          <DialogDescription>
            A particular object tracked by who has it — this meter, that programmer — rather than by how
            many there are.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <EditorField label="What it is">
            <PlainSelect value={formId} onChange={setFormId}>
              <option value="">— pick a kind —</option>
              {assetForms.map((one) => (
                <option key={one.id} value={one.id}>
                  {one.icon ? `${one.icon} ` : ""}
                  {one.name}
                </option>
              ))}
            </PlainSelect>
          </EditorField>

          <EditorField label="Where it starts">
            <PlainSelect value={locationId} onChange={setLocationId}>
              <option value="">— pick a place —</option>
              {flatLocations.map(({ location, depth }) => (
                <option key={location.id} value={location.id}>
                  {"— ".repeat(depth)}
                  {location.name}
                </option>
              ))}
            </PlainSelect>
          </EditorField>
        </div>

        {assetForms.length === 0 && (
          <p className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
            No form in this workspace is marked as describing an asset, so there is nothing to register
            one against yet.
          </p>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {form ? (
            <DynamicForm
              form={form}
              initialValues={{}}
              isSubmitting={registerAsset.isPending}
              formRef={formRef}
              hideSubmitButton
              onSubmit={async (fieldValues) => {
                await registerAsset.mutateAsync(
                  { formId: form.id, fieldValues, locationId, note: note.trim() || undefined },
                  {
                    onSuccess: () => {
                      toast.success("Registered.")
                      onClose()
                    },
                    onError: (error) => {
                      const detail = (error as { response?: { data?: { detail?: string } } }).response?.data
                        ?.detail

                      toast.error(detail ?? "That was not registered.")
                    },
                  },
                )
              }}
            />
          ) : (
            <p className="px-1 py-3 text-xs text-muted-foreground">
              Pick a kind above and its own fields appear here — the serial, the asset tag, whatever that
              kind records.
            </p>
          )}
        </div>

        <EditorField label="Note" hint="Optional. The first line of its history.">
          <Textarea rows={2} className="text-sm" value={note} onChange={(event) => setNote(event.target.value)} />
        </EditorField>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>

          {/* ⚠️ **One footer, and the primary action is in it.** This used to render only a
              disabled hint and let `DynamicForm` draw its own submit inside the scrolling body — which
              put the real button seven hundred pixels below the fold and, the moment the form became
              valid, left a footer containing nothing but Cancel. The old note was right that a second
              button must not bypass the form's validation, and wrong about the conclusion:
              `requestSubmit` runs the form's own submit path, which is what `formRef` exists for and
              what `EntryFormDialog` already does. */}
          <Button
            disabled={!form || !locationId || registerAsset.isPending}
            onClick={() => formRef.current?.requestSubmit()}
          >
            {!form ? "Pick a kind" : !locationId ? "Pick a place" : "Register it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function flatten(nodes: StorageLocation[], depth = 0): Array<{ location: StorageLocation; depth: number }> {
  return nodes.flatMap((location) => [
    { location, depth },
    ...flatten(location.children ?? [], depth + 1),
  ])
}
