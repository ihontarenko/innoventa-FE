import type { ComponentType, ReactNode } from "react"
import type { SpaceDetail } from "@/api/spaces"

/**
 * What every settings section is given, and nothing more.
 *
 * The workspace and the caller's standing in it. Anything else a section needs it fetches for itself, so
 * adding one costs a file rather than a wider prop bag every other section then carries.
 */
export interface SpaceSettingsContext {
  space: SpaceDetail
  isOwner: boolean
  isAdmin: boolean
}

/**
 * One section of the workspace settings screen, declared rather than hard-coded into the page.
 *
 * ⚠️ The page used to render the forms section inline, so a workspace whose `forms` module was off still
 * got a form picker — the module leak, one screen further along. Declaring the module a section belongs
 * to and letting the page render whatever the registry holds means a section can never appear for a
 * module the workspace does not have, and a new area contributes a file.
 */
export interface SpaceSettingsSection {
  key: string
  label: string
  /** The tab's glyph, in the same vocabulary the account's settings tabs use. */
  glyph: string
  /**
   * The module this section belongs to. Absent means it belongs to the workspace itself — identity,
   * sections, members, the way out — and it is always there, including in a workspace with every module
   * off. That workspace is exactly the one whose settings have to stay usable.
   */
  module?: string
  /**
   * Whether this caller may see it at all, where standing rather than a module decides.
   *
   * ⚠️ **Reach for this only where the section has nothing to *read*.** A section somebody cannot edit
   * should render disabled rather than disappear — being told what a workspace is set to is not the same
   * power as setting it, and hiding the answer is how a member comes to believe a menu item is missing by
   * mistake.
   */
  visible?: (context: SpaceSettingsContext) => boolean
  Component: ComponentType<SpaceSettingsContext>
}

/** The frame every section draws itself in, so the screen reads as one thing rather than five. */
export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex max-w-3xl flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

/**
 * A run of rows inside a section, under a heading of its own.
 *
 * For a list whose rows do not all behave alike. Modules where there is something to switch and modules
 * where there is not are two different things, and a reader who has to work that out row by row from the
 * presence of a switch is being asked to do the sorting the screen should have done.
 */
export function Group({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">{label}</span>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
