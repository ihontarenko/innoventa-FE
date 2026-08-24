/**
 * Three steps, and each one is a sentence rather than a paragraph.
 *
 * ⚠️ **The old step 3 was fifty words describing four separate features.** A numbered list is read for
 * its shape — *is this three steps or thirty?* — and prose inside it defeats the only thing the format
 * is good at.
 */
const STEPS = [
  {
    number: "01",
    title: "Say what you count",
    body: "Pick the workspace's subject area and declare the fields worth recording. Supplier, location, quantity, reorder point, datasheet — whatever the thing actually has.",
  },
  {
    number: "02",
    title: "Fill it",
    body: "Add records through your own forms, by hand or from a distributor lookup. The inventory and the search are already there.",
  },
  {
    number: "03",
    title: "Let other people at it",
    body: "Invite the team, embed an intake form on an internal page, or share one record by link. No code, and no second copy of the data.",
  },
] as const

export function HowItWorks() {
  return (
    <section className="border-b bg-muted/30">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-20">
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="text-xs tracking-[0.08em] text-muted-foreground uppercase">How it works</p>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em]">Three steps, not a project</h2>
        </div>

        <ol className="grid gap-8 sm:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.number} className="flex flex-col gap-2 border-t pt-4">
              <span className="font-mono text-xs text-primary">{step.number}</span>
              <h3 className="font-medium">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
