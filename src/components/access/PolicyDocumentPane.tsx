import type { PolicyDocumentView } from "@/api/policy"
import type { PolicyWorkbench } from "@/hooks/usePolicyWorkbench"
import { EmptyAnswer } from "./WhoPanel"
import { PolicyCapabilitiesPane } from "./PolicyCapabilitiesPane"
import { PolicyEntitlementsPane } from "./PolicyEntitlementsPane"
import { PolicyPlansPane } from "./PolicyPlansPane"
import { PolicyRolesPane } from "./PolicyRolesPane"
import { PolicySubjectsPane } from "./PolicySubjectsPane"

/** The five blocks of the document a form can edit, one per destination. */
export type DocumentBlock = "subjects" | "roles" | "capabilities" | "plans" | "entitlements"

/**
 * One block of the document, chosen by the destination in the address.
 *
 * ⚠️ **It edits the document, and never the text.** Every control below changes a `PolicyDocumentView`;
 * the `.jmp` on *Edit as .jmp* is that document written out **by the server**. A form that emitted text
 * would be a second renderer of the grammar, and the first thing a second renderer gets wrong is
 * quoting — a dropdown writing `@SPACE:my-space` unquoted produces a file that reads as something else
 * entirely.
 *
 * ⚠️ **A dispatcher and nothing else.** Each block is its own file because each is its own argument
 * about how one kind of line should be read: a role is a catalogue with a filter, a plan is a header
 * over a table of amounts, an entitlement is five fields and two dates. One file holding all five is one
 * file nobody can open to change one of them.
 */
export function PolicyDocumentPane({ block, workbench }: { block: DocumentBlock; workbench: PolicyWorkbench }) {
  const document = workbench.document

  if (!document) {
    return (
      <EmptyAnswer
        glyph="✎"
        title="This text does not parse yet"
        message="The form edits a document, and there is not one here. Fix it under Edit as .jmp — the problems above say where."
      />
    )
  }

  const readOnly = !workbench.mayWrite

  function replace(next: Partial<PolicyDocumentView>) {
    workbench.editDocument({ ...document!, ...next })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ⚠️ Above the block rather than inside one. It is about the document as a whole, and a warning
          that saving will drop something has to be readable from wherever somebody is about to save. */}
      {document.beyondTheForm.length > 0 && (
        <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
          <strong>This policy holds {describe(document.beyondTheForm)} the form cannot show.</strong> They are still in
          the text and still in force — but saving from the form rewrites the document, and they will not survive it.
          Edit under <strong>Edit as .jmp</strong> to keep them.
        </p>
      )}

      {block === "subjects" && (
        <PolicySubjectsPane
          subjects={document.subjects}
          vocabulary={workbench.vocabulary}
          readOnly={readOnly}
          onChange={(subjects) => replace({ subjects })}
        />
      )}

      {block === "roles" && (
        <PolicyRolesPane
          roles={document.roles}
          vocabulary={workbench.vocabulary}
          readOnly={readOnly}
          onChange={(roles) => replace({ roles })}
        />
      )}

      {/* The capability half of the same document, and it is here rather than on a screen of its own for
          the reason the whole editor exists: a policy split across two editors is a policy nobody can
          diff. What the plans screen reads is written here. */}
      {block === "capabilities" && (
        <PolicyCapabilitiesPane
          capabilities={document.capabilities}
          readOnly={readOnly}
          onChange={(capabilities) => replace({ capabilities })}
        />
      )}

      {block === "plans" && (
        <PolicyPlansPane
          plans={document.plans}
          vocabulary={workbench.vocabulary}
          readOnly={readOnly}
          onChange={(plans) => replace({ plans })}
        />
      )}

      {block === "entitlements" && (
        <PolicyEntitlementsPane
          entitlements={document.entitlements}
          vocabulary={workbench.vocabulary}
          readOnly={readOnly}
          onChange={(entitlements) => replace({ entitlements })}
        />
      )}
    </div>
  )
}

/** "an include and comments", rather than a list nobody reads as a sentence. */
function describe(beyondTheForm: string[]): string {
  const words: Record<string, string> = {
    include: "an include",
    vocabulary: "a scopes or permissions block",
    comments: "comments",
  }

  return beyondTheForm.map((item) => words[item] ?? item).join(" and ")
}
