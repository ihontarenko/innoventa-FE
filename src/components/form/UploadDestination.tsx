import { createContext, useContext, type ReactNode } from "react"

/**
 * Which file root the uploads inside this form belong in.
 *
 * ⚠️ **A context rather than a prop, because the control that needs it is three layers down.** A file
 * field is rendered by the control registry, which renders whatever a field's type asks for and has no
 * business knowing what a *form* is for. Threading a destination through it would put one feature's
 * vocabulary into the one component that must stay ignorant of every feature.
 *
 * ⚠️ **Absent is a legitimate answer and means the cabinet.** A public form fill belongs to no feature and
 * no workspace, and it has to keep uploading exactly as it did.
 */
const UploadDestinationContext = createContext<string | undefined>(undefined)

/**
 * The root name for a form of this purpose, or nothing when it belongs to no feature.
 *
 * ⚠️ **By PURPOSE, never by form id.** A workspace has as many inventory forms as it likes and may one
 * day have a second CAD catalogue; keyed on an id, the second one would quietly file somewhere else.
 */
export function uploadRootFor(purposeCode?: string | null): string | undefined {
  switch (purposeCode) {
    case "INVENTORY":
      return "inventory"
    case "CAD":
    case "CAD_FILE":
      return "cad"
    default:
      return undefined
  }
}

export function UploadDestinationProvider({
  rootName,
  children,
}: {
  rootName?: string
  children: ReactNode
}) {
  return (
    <UploadDestinationContext.Provider value={rootName}>{children}</UploadDestinationContext.Provider>
  )
}

/** The root name uploads here should use, or nothing for the account's own cabinet. */
export function useUploadDestination() {
  return useContext(UploadDestinationContext)
}
