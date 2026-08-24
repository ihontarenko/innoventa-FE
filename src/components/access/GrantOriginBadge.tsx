import { cn } from "@jmouse/ui"
import type { GrantOriginView } from "@/api/access"

/**
 * Where one rule is kept, said out loud on **every** rule rather than only on the surprising ones.
 *
 * ⚠️ **A grant lives in exactly one place now, and it is the row.** This badge was built for a world
 * with two homes, where the engine read a policy file *beside* the tables and could not tell one from
 * the other. That world is gone: the shipped `.jmp` files are the seed at first start and a projection
 * afterwards.
 *
 * It is kept, with its words rewritten, because *where do I go to change this line* is still the
 * question. Saying "row" seventy times is not noise — it is the answer, and the screen that stops
 * giving it is the screen where somebody has to guess again.
 */

/**
 * What the editable policy document is called by the engine — `PolicyComposition.EDITED`.
 *
 * ⚠️ **Translated here rather than renamed there.** A `policy "…"` header wins over the name the parser
 * is handed, and the editor writes that header out on every save, so the name is inside the source text
 * of every revision ever stored. Renaming the constant would rename nothing already saved.
 */
const EDITABLE_DOCUMENT = "control-room"

type OriginKind = "row" | "policy" | "shipped"

const WORDS: Record<OriginKind, { label: string; title: string }> = {
  row: {
    label: "row",
    title:
      "A row in the database — which is where every rule the engine reads lives. Editable here on the " +
      "document destinations, under Users → Permissions, or by giving somebody a role in a workspace. " +
      "All three write the same table.",
  },
  policy: {
    label: "policy",
    title:
      "The editable policy document. Saving it applies the difference as row changes, and the revision " +
      "is kept as history of what was submitted. Versioned, revertible, and in force without a deploy.",
  },
  shipped: {
    label: "shipped",
    title:
      "Came with the application, and was written into the tables once at first start. The file cannot " +
      "be edited from any screen; the rows it seeded can.",
  },
}

const TONE: Record<OriginKind, string> = {
  row: "bg-secondary text-secondary-foreground",
  policy: "bg-primary/15 text-primary",
  shipped: "bg-muted text-muted-foreground",
}

function originKind(origin: GrantOriginView | undefined): OriginKind {
  if (!origin || !origin.declared) {
    return "row"
  }

  return origin.document === EDITABLE_DOCUMENT ? "policy" : "shipped"
}

/**
 * @param origin absent for a rule the engine reported without one, which is a row — the same reading
 *               `GrantOriginView` itself gives it
 */
export function GrantOriginBadge({ origin }: { origin?: GrantOriginView }) {
  const kind = originKind(origin)

  // ⚠️ A shipped rule names its FILE, because there can be several and "which one" is the useful half.
  // The other two are each one place, so the kind is the whole answer.
  const name = kind === "shipped" ? (origin?.document ?? "file") : WORDS[kind].label
  const line = kind !== "row" && origin && origin.line > 0 ? `:${origin.line}` : ""

  return (
    <span
      title={WORDS[kind].title}
      className={cn("rounded px-1.5 py-0.5 font-mono text-[10px] leading-none", TONE[kind])}
    >
      {name}
      {line}
    </span>
  )
}
