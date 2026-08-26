import { createContext, useContext, type ReactNode } from "react"

/**
 * Where a page's header should render, when it is not simply where the page is.
 *
 * ⚠️ **This exists because `PageHeader` cannot be moved.** It cancels the content box's `p-4` with
 * `-mx-4 -mt-4` so its border reaches the true edges of the window, which makes it usable only as that
 * box's first child — INVT-0105 is the time it was not, and the symptom was a horizontal scrollbar. A
 * screen with a rail beside it puts the page one grid cell to the right, and those negative margins
 * then cancel the wrong box: the header lands a rem left of its own column and is clipped on the right.
 *
 * ⚠️ **So the header is relocated, not restyled.** A layout that wants one full-width above its rail
 * offers a slot; `PageHeader` portals into it and keeps every one of its own rules. Ten administrative
 * screens render one, five put a search field or a button in it, and **not one of them knows this
 * exists** — which is the entire point. Stripping their headers to imitate a screen that has none would
 * have deleted working controls.
 *
 * No slot in scope means no portal, and every screen outside a rail behaves exactly as it always did.
 */
const PageHeaderSlotContext = createContext<HTMLElement | null>(null)

export function PageHeaderSlotProvider({ node, children }: { node: HTMLElement | null; children: ReactNode }) {
  return <PageHeaderSlotContext.Provider value={node}>{children}</PageHeaderSlotContext.Provider>
}

export function usePageHeaderSlot(): HTMLElement | null {
  return useContext(PageHeaderSlotContext)
}
