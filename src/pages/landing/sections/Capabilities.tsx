/**
 * What it does, in lines somebody actually reads.
 *
 * ⚠️ **Eight cards of forty-word paragraphs became seven of one sentence each.** The old copy read like
 * a feature matrix transcribed into prose — one card spent sixty words listing sixteen calculators by
 * name. A landing page is not documentation: it has to make somebody want to open the manual, not
 * replace it.
 *
 * ⚠️ **The electronics tools are named, and framed as what an electronics workspace ALSO gets.** They
 * exist and they are good; letting them define the product is the mistake the whole page is here to
 * avoid, and hiding them would be the opposite mistake.
 */
const CAPABILITIES = [
  {
    icon: "🗂",
    title: "Fields that fit the thing",
    body: "21 element types — text, number with units, select, rating, colour, tags, file, composite value — and rules that show a field only when another answers a certain way.",
  },
  {
    icon: "📦",
    title: "One inventory, however much of it",
    body: "Everything a workspace holds in one table you choose the columns of, with low-stock thresholds that mark themselves.",
  },
  {
    icon: "🔍",
    title: "Search that understands the units",
    body: "Ask for resistors between 4k7 and 47k and get them. Written values are interpreted by the backend, so the answer is the same everywhere it is asked.",
  },
  {
    icon: "📋",
    title: "Any form, published or embedded",
    body: "Turn a form into a public page or an auto-resizing iframe on somebody else's site. Respondents need no account.",
  },
  {
    icon: "🤝",
    title: "Workspaces with real permissions",
    body: "Roles, personal grants and an editable policy — not four fixed levels. Each workspace keeps its own records, files and subject area.",
  },
  {
    icon: "🧩",
    title: "Widgets beside the record",
    body: "16 widgets and tools draw what an answer means — a stock light, a score gauge, and in an electronics workspace resistor colour bands and a component code converter.",
  },
  {
    icon: "🎨",
    title: "29 themes, and it means it",
    body: "Every screen, every widget and every shared page follows the palette — including the ones somebody embeds in their own site.",
  },
] as const

export function Capabilities() {
  return (
    <section id="capabilities" className="border-b">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-20">
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="text-xs tracking-[0.08em] text-muted-foreground uppercase">What it does</p>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em]">
            More than a spreadsheet, less than an ERP
          </h2>
          <p className="text-muted-foreground">
            The parts you would otherwise build yourself, and stop maintaining a year later.
          </p>
        </div>

        <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((capability) => (
            <div key={capability.title} className="flex flex-col gap-2">
              <span aria-hidden="true" className="text-xl">
                {capability.icon}
              </span>
              <h3 className="font-medium">{capability.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{capability.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
