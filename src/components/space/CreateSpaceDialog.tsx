import { useEffect, useState } from "react"
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
  Label,
  Textarea,
  cn,
} from "@jmouse/ui"
import { spacesApi } from "@/api/spaces"
import { BOUNDED_DIALOG, DialogBody } from "@/components/BoundedDialog"
import { useCreateSpace } from "@/hooks/useSpaces"
import { useSubjectAreas } from "@/hooks/useSpaceSettings"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { problemDetailOf } from "@/lib/apiErrors"
import { spaceSectionPath } from "@/lib/navigationContext"

/**
 * A new workspace, and the one question that decides what it will be.
 *
 * ⚠️ **The subject area is the content of this dialog, not a field in it.** What a workspace counts
 * decides its menu, its modules and half its screens — two workspaces with different areas are two
 * different products. So it is asked as a choice with each option explained, never as a select of codes
 * tucked under "advanced".
 *
 * ⚠️ **And it is NOT irreversible, which is worth getting right in the copy.** `UpdateSpaceRequest`
 * accepts `subjectAreaCode`; changing it re-shapes which modules are on by default and re-seeds nothing,
 * and every deliberate module override survives. Telling people "you cannot change this later" would be
 * a lie the product would then have to keep.
 */
export function CreateSpaceDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const createSpace = useCreateSpace()
  const { data: areas = [] } = useSubjectAreas()

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [description, setDescription] = useState("")
  const [areaCode, setAreaCode] = useState<string>("")
  const [failure, setFailure] = useState("")

  // ⚠️ Derived until somebody edits it, then left alone — the same rule the field editor keeps. A slug
  // that kept re-deriving would silently discard a deliberate choice on the next keystroke of the name.
  const effectiveSlug = slugTouched ? slug : slugify(name)

  const availability = useSlugAvailability(effectiveSlug)

  useEffect(() => {
    if (areas.length > 0 && !areaCode) {
      setAreaCode(areas[0].code)
    }
  }, [areas, areaCode])

  const isValidSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(effectiveSlug)
  const canSubmit = name.trim().length > 0 && isValidSlug && availability !== "taken" && !createSpace.isPending

  function submit() {
    setFailure("")

    createSpace.mutate(
      {
        name: name.trim(),
        slug: effectiveSlug,
        description: description.trim() || undefined,
        subjectAreaCode: areaCode || undefined,
      },
      {
        onSuccess: (space) => {
          toast.success(`${space.name} is ready.`)
          onClose()
          navigate(spaceSectionPath(space.slug))
        },
        onError: (error) => setFailure(problemDetailOf(error).detail ?? problemDetailOf(error).title),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className={cn(BOUNDED_DIALOG, "sm:max-w-lg")}>
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base">New workspace</DialogTitle>
          <DialogDescription className="text-xs">
            A workspace holds its own records, forms, files and people.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="space-name">Name</Label>
            <Input
              id="space-name"
              autoFocus
              value={name}
              placeholder="Lab inventory"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="space-slug" className="flex items-baseline gap-1.5">
              Address
              <span className="font-mono text-xs font-normal text-muted-foreground">/space/{effectiveSlug || "…"}</span>
            </Label>
            <Input
              id="space-slug"
              value={effectiveSlug}
              placeholder="lab-inventory"
              onChange={(event) => {
                setSlugTouched(true)
                setSlug(event.target.value)
              }}
            />
            <SlugNote slug={effectiveSlug} isValid={isValidSlug} availability={availability} />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">What will it count?</legend>
            <p className="text-xs text-muted-foreground">
              This decides the menu and which modules are on. It can be changed later — that re-shapes the
              defaults and leaves your records and any module you switched by hand exactly as they are.
            </p>

            <div className="flex flex-col gap-1.5">
              {areas.map((area) => (
                <button
                  key={area.code}
                  type="button"
                  onClick={() => setAreaCode(area.code)}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-md border px-3 py-2 text-left transition-colors",
                    areaCode === area.code ? "border-primary bg-accent" : "hover:bg-accent/50",
                  )}
                >
                  <span className="text-sm font-medium">{area.label}</span>
                  {area.description && (
                    <span className="text-xs text-muted-foreground">{area.description}</span>
                  )}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor="space-description" className="flex items-baseline gap-1.5">
              Description
              <span className="text-xs font-normal text-muted-foreground">Optional</span>
            </Label>
            <Textarea
              id="space-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {failure && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-sm text-destructive">
              {failure}
            </p>
          )}
        </DialogBody>

        <DialogFooter className="shrink-0">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={submit}>
            {createSpace.isPending ? "Making…" : "Make workspace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type Availability = "idle" | "checking" | "free" | "taken"

/**
 * ⚠️ **Taken comes back as a 409, not as `{ available: false }`.** The 200 body only ever says `true`, so
 * reading it without catching the rejection concludes "free" for every slug that is actually taken —
 * which is the single answer this check exists to give.
 */
function useSlugAvailability(slug: string): Availability {
  const debounced = useDebouncedValue(slug, 400)
  const [availability, setAvailability] = useState<Availability>("idle")

  useEffect(() => {
    if (!debounced || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(debounced)) {
      setAvailability("idle")

      return
    }

    let abandoned = false

    setAvailability("checking")

    spacesApi
      .checkSlug(debounced)
      .then(() => !abandoned && setAvailability("free"))
      .catch(() => !abandoned && setAvailability("taken"))

    return () => {
      abandoned = true
    }
  }, [debounced])

  return availability
}

function SlugNote({
  slug,
  isValid,
  availability,
}: {
  slug: string
  isValid: boolean
  availability: Availability
}) {
  if (slug && !isValid) {
    return (
      <span className="text-xs text-destructive">
        Lowercase letters, digits and single hyphens — it is the address, not a title.
      </span>
    )
  }

  if (availability === "taken") {
    return <span className="text-xs text-destructive">That address is already in use.</span>
  }

  if (availability === "free") {
    return <span className="text-xs text-success">Free.</span>
  }

  return <span className="text-xs text-muted-foreground">Derived from the name, and yours to change.</span>
}

/** ⚠️ Everything the backend's own pattern refuses, removed here — so it is refused before a round trip. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
