import { useState } from "react"
import { EmbedHost } from "@/components/public/EmbedHost"

/**
 * Innoventa's own forms, embedded in Innoventa's own landing page.
 *
 * ⚠️ **This is the product demonstrating itself, and it is the most honest thing on the page.** Every
 * claim above is a sentence; this is three real forms, built in the form builder, served through the
 * public share route, resizing themselves inside an iframe. If the embed breaks, the landing page shows
 * it before a customer does.
 *
 * ⚠️ **Only a tab that has been opened is mounted, and it stays mounted afterwards.** The old page
 * mounted all three at once — three full application bundles fetched into hidden frames before anybody
 * had clicked anything, on the page that most needs to paint fast. Mounting and unmounting on each
 * switch would be the opposite mistake: a reload, and a half-typed message lost with it.
 */
const FORMS = [
  { key: "feedback", icon: "💬", label: "Feedback", token: "feedback-form", title: "Product feedback form" },
  { key: "contact", icon: "✉️", label: "Contact us", token: "contact-form", title: "Contact us form" },
  { key: "bug-report", icon: "🐛", label: "Bug report", token: "bug-report-form", title: "Bug report form" },
] as const

export function Connect() {
  const [active, setActive] = useState<string>(FORMS[0].key)
  const [opened, setOpened] = useState<string[]>([FORMS[0].key])

  function open(key: string) {
    setActive(key)
    setOpened((existing) => (existing.includes(key) ? existing : [...existing, key]))
  }

  return (
    <section id="connect" className="border-b">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-20">
        <div className="flex flex-col gap-3">
          <p className="text-xs tracking-[0.08em] text-muted-foreground uppercase">Get in touch</p>
          <h2 className="font-display text-3xl font-semibold tracking-[-0.03em]">
            These three are Innoventa forms
          </h2>
          <p className="text-muted-foreground">
            Built in the form builder, published as embeds, answered into the same inventory as everything
            else. Nothing below is special-cased for this page.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="How to reach us">
          {FORMS.map((form) => (
            <button
              key={form.key}
              role="tab"
              aria-selected={form.key === active}
              onClick={() => open(form.key)}
              className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                form.key === active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              <span aria-hidden="true" className="mr-1.5">
                {form.icon}
              </span>
              {form.label}
            </button>
          ))}
        </div>

        <div className="relative overflow-hidden rounded-lg border">
          {FORMS.filter((form) => opened.includes(form.key)).map((form) => (
            <div
              key={form.key}
              // ⚠️ `hidden` would unmount the layout and the frame would report height 0 on the way
              // back. Kept in the flow but invisible, so its ResizeObserver keeps working.
              className={form.key === active ? "block" : "pointer-events-none invisible absolute inset-0"}
            >
              <EmbedHost src={`/_/form/${form.token}/embed`} title={form.title} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
