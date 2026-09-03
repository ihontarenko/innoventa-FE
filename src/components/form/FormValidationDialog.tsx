import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ShieldCheck } from "lucide-react"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  NativeSelect,
} from "@jmouse/ui"
import {
  ValidationBuilder,
  ValidationTransportProvider,
  emptyDraft,
  useValidationTransport,
  type StoredDocument,
  type ValidationDraft,
} from "@jmouse/validation"
import { formsApi } from "@/api/forms"
import {
  readBoundForms,
  readValidationDocument,
  rewriteValidationDocument,
  validationTransport,
  writeValidationDocument,
} from "@/lib/validationTransport"
import type { FormDetail } from "@/types"

/** The `form_configs` row naming the document a form is judged by. ⚠️ It holds the document's **id**. */
const DOCUMENT_KEY = "validation.document"

/**
 * A form's validation rules, edited in a window. 🛡️
 *
 * ## ⚠️ Validation is a document about the FORM now, not a string per field
 *
 * Ivan, 2026-08-27: *«у нас валідація це не про одну строку, тепер це як документ до форми»*. So it is
 * a button and a window rather than a panel inside the field editor — a field's box could never hold a
 * rule that compares two fields, and a rule that compares two fields is most of why this exists.
 *
 * ## ⚠️ The two tabs are the library's, and so is everything about the language
 *
 * `ValidationBuilder` brings no chrome — no dialog, no title, no save button — precisely so that this
 * screen owns them. And no `.jmv` is written in the browser: rows go to the server and come back as
 * text, text goes to the server and comes back as rows. A second writer of the language would get
 * quoting wrong first.
 *
 * ## ⚠️ A document is SHARED, and this window edits it wherever it is bound
 *
 * `form_configs.validation.document` holds a document's id, and **several forms may hold the same id**
 * — that is the point of it. `innoventa/common-fields` is bound to every inventory form, so what a
 * quantity or a datasheet link has to look like is one answer written in one place.
 *
 * So saving here **rewrites the document**, for every form pointing at it, not just this one. A form
 * that needs different rules gets a different document: create one, and bind it on that form.
 */
export function FormValidationDialog({
  form,
  open,
  onOpenChange,
}: {
  form: FormDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* A document is as tall as somebody wrote it, so the WINDOW is bounded and the rows scroll
          inside it. Left to grow, it pushed its own header and Save button past the top and bottom of
          the screen — and the page scrolled behind it, which reads as the dialog having no controls. */}
      {/* ⚠️ `sm:max-w-5xl`, not `max-w-5xl`. The library's own `sm:max-w-lg` is emitted after the base
          utilities, so a plain `max-w-*` here loses to it at every width that matters and the window
          renders narrow with no error anywhere. Every other dialog in this codebase says `sm:` for the
          same reason. */}
      {/* ⚠️ A fixed height rather than a maximum, and that is what lets the builder fill. `max-h` gives
          the window its content's height, so the editor inside — which asks for the height it is given
          — resolves to nothing and the two tabs jump in size as somebody switches between them. */}
      <DialogContent className="flex h-[88vh] flex-col gap-3 sm:max-w-5xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" />
            Validation — {form.name}
          </DialogTitle>
          <DialogDescription>
            What this form asks of a record beyond what its fields ask on their own.
          </DialogDescription>
        </DialogHeader>

        <ValidationTransportProvider value={validationTransport}>
          {open ? <Editor form={form} onDone={() => onOpenChange(false)} /> : null}
        </ValidationTransportProvider>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The window's contents.
 *
 * ⚠️ Mounted only while the dialog is open, so opening it always reads the document as it now stands.
 * A builder kept alive behind a closed window shows whatever it held when it was last looked at, which
 * is the state somebody saves over without noticing.
 */
function Editor({ form, onDone }: { form: FormDetail; onDone: () => void }) {
  const queryClient = useQueryClient()
  const transport = useValidationTransport()

  const [draft, setDraft] = useState<ValidationDraft | null>(null)
  const [document, setDocument] = useState<string>("")

  const configuration = useQuery({
    queryKey: ["form-config", form.id],
    queryFn: async () => (await formsApi.getConfig(form.id)).data,
  })

  const documentId = configuration.data?.[DOCUMENT_KEY] ?? null

  const stored = useQuery({
    queryKey: ["validation-document", documentId],
    queryFn: () => readValidationDocument(documentId as string),
    enabled: documentId !== null,
  })

  const documents = useQuery({
    queryKey: ["validation-documents"],
    queryFn: () => validationTransport.documents(),
  })

  /**
   * How many forms the bound document judges.
   *
   * ⚠️ **The number is the whole warning, and it used to be missing.** The bar said *"saving rewrites
   * this document — for every form bound to it"*, which is true of one form and of forty-four, and
   * reads as boilerplate in both cases. `innoventa/common-fields` judges forty-four: somebody
   * tightening one form's rules here is changing forty-three screens they cannot see, and the only
   * thing that makes them stop is the count.
   */
  const shared = useQuery({
    queryKey: ["validation-document-forms", documentId],
    queryFn: () => readBoundForms(documentId as string),
    enabled: documentId !== null,
  })

  const bind = useMutation({
    mutationFn: (id: string) => formsApi.setConfigValues(form.id, { [DOCUMENT_KEY]: id }),
    onSuccess: async () => {
      // ⚠️ The draft is cleared so the seeding effect runs again against the newly bound document.
      // Left alone it would keep showing the document that was open when the binding changed — and the
      // next save would write those rules over the one just chosen.
      setDraft(null)
      await queryClient.invalidateQueries({ queryKey: ["form-config", form.id] })
    },
  })

  // ⚠️ Seeded once the document is known, and only then. A form with no document starts from an empty
  // draft named after it; naming is the one thing the product decides and the library does not.
  useEffect(() => {
    if (draft !== null) {
      return
    }

    if (documentId === null && configuration.isSuccess) {
      setDraft(emptyDraft(nameFor(form)))

      return
    }

    if (stored.data?.source != null) {
      transport.parse(stored.data.source).then(setDraft).catch(() => setDraft(emptyDraft(nameFor(form))))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, configuration.isSuccess, stored.data?.source])

  const save = useMutation({
    mutationFn: async () => {
      // ⚠️ An existing document is rewritten by id, never re-created by name: the pointer in
      // `form_configs` holds the id, and writing a new document would leave the form on the old one.
      if (documentId !== null) {
        await rewriteValidationDocument(documentId, document)

        return
      }

      const written = await writeValidationDocument(nameFor(form), document)

      await formsApi.setConfigValues(form.id, { [DOCUMENT_KEY]: written.id })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["form-config", form.id] })
      await queryClient.invalidateQueries({ queryKey: ["validation-document"] })
      onDone()
    },
  })

  if (draft === null) {
    return <p className="text-muted-foreground py-8 text-sm">Reading this form's rules…</p>
  }

  return (
    <>
      <BindingBar
        documents={documents.data ?? []}
        boundTo={documentId}
        sharedWith={shared.data?.length ?? null}
        pending={bind.isPending}
        onBind={(id) => bind.mutate(id)}
      />

      {/* min-h-0 is what makes the fill real — a flex child defaults to its content's height, so
          without it the builder grows and the dialog's own footer is pushed off the bottom. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <ValidationBuilder fill value={draft} onChange={setDraft} onDocument={setDocument} />
      </div>

      <DialogFooter className="shrink-0">
        <Button variant="ghost" onClick={onDone}>
          Close
        </Button>
        <Button disabled={document === "" || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  )
}

/**
 * What a form's document is called.
 *
 * ⚠️ Derived from the codename rather than the label, because a name is an address: it is written into
 * the file, quoted by anything that loads one, and a label is edited whenever somebody rewords a
 * heading.
 */
function nameFor(form: FormDetail): string {
  return `innoventa/${(form.codename ?? form.id).toLowerCase()}`
}


/**
 * Which document judges this form. 🔗
 *
 * ## ⚠️ A form BINDS an existing document; it does not only make its own
 *
 * `form_configs.validation.document` holds an id and several forms may hold the same one — that is the
 * design, not a corner case. Without this control the only way to give a form rules was to save, which
 * writes a **new** document named after the form. Forty-four forms would then have forty-four copies of
 * the same rules, which is exactly what one shared document exists to prevent.
 *
 * ## ⚠️ Choosing rebinds immediately, and does not touch either document
 *
 * The pointer is the whole binding, so switching is one row. The document that was bound keeps existing
 * and keeps judging whatever else points at it — the two acts are deliberately separate, and joining
 * them is how somebody detaches forty-three forms while meaning to change one.
 */
function BindingBar({
  documents,
  boundTo,
  sharedWith,
  pending,
  onBind,
}: {
  documents: StoredDocument[]
  boundTo: string | null
  /** How many forms the bound document judges, or `null` while nobody has answered. */
  sharedWith: number | null
  pending: boolean
  onBind: (id: string) => void
}) {
  // ⚠️ Nothing to choose between is not a choice — an empty select reads as a broken control rather
  // than as an installation whose first document has not been written yet.
  if (documents.length === 0) {
    return null
  }

  // ⚠️ *This* form is one of them, so a document bound only here is not shared and gets no warning.
  const others = sharedWith === null ? 0 : sharedWith - 1

  return (
    // ⚠️ A strip on a rule, not a dashed box. The dashed border read as a drop zone — the one thing
    // this is not — and it is the same fact the documents screen states in the same shape, so the two
    // screens now say it the same way.
    <div className="border-border -mx-6 shrink-0 border-y px-6 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Label
          htmlFor="form-validation-document"
          className="text-muted-foreground shrink-0 text-[10px] font-medium tracking-[0.08em] uppercase"
        >
          Judged by
        </Label>

        <NativeSelect
          id="form-validation-document"
          value={boundTo ?? ""}
          disabled={pending}
          className="h-7 w-72 font-mono text-xs"
          onChange={(event) => onBind(event.target.value)}
        >
          {/* ⚠️ Present only until something is chosen. Offered afterwards it would read as "unbind",
              and it is not — clearing a form's rules is done on the documents screen, where the
              consequence for every other form bound to the same document is visible. */}
          {boundTo === null && <option value="">— a new document for this form —</option>}
          {documents.map((document) => (
            <option key={document.id} value={document.id}>
              {document.name}
            </option>
          ))}
        </NativeSelect>

        {boundTo === null && (
          <span className="text-muted-foreground text-xs">
            Saving writes a new document for this form. Pick an existing one to share its rules instead.
          </span>
        )}
      </div>

      {others > 0 && (
        <p className="text-destructive mt-1.5 flex items-center gap-2 text-xs">
          <AlertTriangle className="size-3.5 shrink-0" />
          Saving changes the rules for {others + 1} forms — this one and {others} you cannot see from
          here.
        </p>
      )}
    </div>
  )
}
