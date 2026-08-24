import type { ReactNode } from "react"
import { Badge, cn } from "@jmouse/ui"
import { useCopyFeedback } from "@/hooks/useCopyFeedback"

/**
 * ⚠️ **Where a part comes from is a fact with four possible answers, not a sentence.** It was a free
 * string once — sometimes a package, sometimes a path, sometimes *"the product's own pattern"* — and a
 * reader could not tell from the card whether changing a thing touched one interface or three. These
 * four are the whole answer, and every specimen carries exactly one.
 */
export type SpecimenOrigin = "library" | "product" | "vendor" | "composed"

export const ORIGINS: Record<SpecimenOrigin, { label: string; what: string; className: string }> = {
  library: {
    label: "library",
    what: "@jmouse/ui. Shared — changing it changes Innoventa, Tessera and Kiwi at once.",
    className: "border-primary/40 bg-primary/10 text-primary",
  },
  product: {
    label: "product",
    what: "A file in this interface and nowhere else. Ours alone to change.",
    className: "border-border bg-muted text-muted-foreground",
  },
  vendor: {
    label: "vendor",
    what: "A third-party package this product calls directly.",
    className: "border-warning/40 bg-warning/10 text-warning",
  },
  composed: {
    label: "composed",
    what: "Nothing to import — a shape written out of the parts above. The path is one place it is done.",
    className: "border-dashed border-border text-muted-foreground",
  },
}

/**
 * One thing in the kit, with **the name we call it**.
 *
 * ⚠️ **The name is the whole point of this page.** A conversation about an interface is a conversation
 * about parts, and two people without shared names for them end up describing pixels — "the grey pill
 * thing on the right". So every specimen carries a short slug, it is the first thing on the card, and it
 * copies on a click.
 *
 * ⚠️ **`name` is ours; `origin` and `from` are where it actually comes from.** All three, because they
 * answer different questions: the first is what to say, the second is who owns it, the third is what to
 * type. A card missing any of them either cannot be quoted, cannot be changed safely, or cannot be found.
 */
export interface Specimen {
  /** What we call it — short, lowercase, `family/variant`. This is what a request should name. */
  name: string
  /** Who owns it. The one fact that says whether a change here is local or shared. */
  origin: SpecimenOrigin
  /** What to type: the module for `library`/`vendor`, the file for `product`/`composed`. */
  from: string
  /** The named export, where the module alone does not identify it. */
  symbol?: string
  /** One sentence: what it is *for*, never what it looks like. */
  what: string
  /** ⚠️ A function rather than an element, so a specimen holding state gets its own. */
  render: () => ReactNode
  /** Anything worth knowing before reaching for it — a trap, a rule, a "not for". */
  note?: ReactNode
}

export interface KitSection {
  key: string
  label: string
  /** One line under the heading — what the whole family is about. */
  about: string
  specimens: Specimen[]
}

export function OriginBadge({ origin, className }: { origin: SpecimenOrigin; className?: string }) {
  return (
    <Badge variant="outline" title={ORIGINS[origin].what} className={cn("text-[10px]", ORIGINS[origin].className, className)}>
      {ORIGINS[origin].label}
    </Badge>
  )
}

export function SpecimenCard({ specimen }: { specimen: Specimen }) {
  const { copied, copy } = useCopyFeedback()

  return (
    <article className="flex flex-col gap-3 rounded-md border p-4">
      <header className="flex flex-wrap items-baseline gap-2">
        <button
          type="button"
          title="Copy this name"
          onClick={() => void copy(specimen.name)}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs hover:bg-accent"
        >
          {copied ? "✓ copied" : specimen.name}
        </button>

        {/* ⚠️ Origin before path, and it is the badge rather than the mono text: which of the four a part
            is decides whether a change is one interface or three, and that has to survive a glance. */}
        <OriginBadge origin={specimen.origin} className="self-center" />
        <span className="font-mono text-[11px] text-muted-foreground">
          {specimen.from}
          {specimen.symbol && <span className="text-foreground/70"> · {specimen.symbol}</span>}
        </span>

        <span className="w-full text-xs text-muted-foreground sm:w-auto sm:flex-1">{specimen.what}</span>
      </header>

      {/* ⚠️ The example sits on the page's own ground, not in a checkerboard or a white well. A specimen
          shown against a surface the product never uses is a specimen that lies about contrast — which is
          the one thing a kit exists to be trusted about across 29 themes. */}
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed p-3">{specimen.render()}</div>

      {specimen.note && <p className="text-[11px] text-muted-foreground">{specimen.note}</p>}
    </article>
  )
}
