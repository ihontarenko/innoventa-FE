import { createContext, useContext, type ReactNode } from "react"
import { PRICING_CONFIG_KEYS, readFormConfigs } from "@/lib/formConfigs"
import type { FieldDetail, FormDetail } from "@/types"

/**
 * Where the uploads inside this form belong — the root, and the shelves inside it.
 *
 * ⚠️ **A context rather than a prop, because the control that needs it is three layers down.** A file
 * field is rendered by the control registry, which renders whatever a field's type asks for and has no
 * business knowing what a *form* is for. Threading a destination through it would put one feature's
 * vocabulary into the one component that must stay ignorant of every feature.
 *
 * ⚠️ **Absent is a legitimate answer and means the cabinet.** A public form fill belongs to no feature and
 * no workspace, and it has to keep uploading exactly as it did.
 */
export interface UploadDestination {
  /** One of the roots the backend allow-lists — `inventory`, `cad`. */
  rootName: string
  /**
   * Which type the file is about — `Resistor`.
   *
   * ⚠️ **The workspace's own word, which is why it could never be an allow-list.** The backend sanitises
   * and caps it; see `FileDirectories.shelfName`.
   */
  type?: string
  /** The field the form says holds its datasheet, from `catalogue.datasheet_file_field`. */
  datasheetField?: string | null
  /** The field the form says holds its picture, from `display.image_field`. */
  imageField?: string | null
}

const UploadDestinationContext = createContext<UploadDestination | undefined>(undefined)

/**
 * The root name for a form of this purpose, or nothing when it belongs to no feature.
 *
 * ⚠️ **By PURPOSE, never by form id.** A workspace has as many inventory forms as it likes and may one
 * day have a second CAD catalogue; keyed on an id, the second one would quietly file somewhere else.
 */
export function uploadRootFor(purposeCode?: string | null): string | undefined {
  switch (purposeCode) {
    /* ⚠️ **Both, and `CATALOG` was silently lost.** A part and the box it sits in are one feature, so
       a datasheet filed on either belongs under the same root. Before the two purposes swapped roles
       the forty-four typed forms were `INVENTORY` and matched here; afterwards they were `CATALOG`,
       fell through to `undefined`, and every file uploaded on a part went to the uploader's own folder
       instead of the feature's — which is exactly what INVT-0232 was about. */
    case "INVENTORY":
    case "CATALOG":
      return "inventory"
    case "CAD":
    case "CAD_FILE":
      return "cad"
    default:
      return undefined
  }
}

/**
 * The whole destination a form's uploads should use.
 *
 * ⚠️ **The type comes from the form, and the two special fields come from its CONFIGURATION.** Which
 * field is the datasheet and which is the picture are already declared — `catalogue.datasheet_file_field`
 * and `display.image_field` — and reading them is what keeps this from sniffing field names for the word
 * "datasheet", which would be right until somebody named one in Ukrainian.
 */
export function uploadDestinationFor(form: FormDetail): UploadDestination | undefined {
  const rootName = uploadRootFor(form.purpose?.code)

  if (!rootName) {
    return undefined
  }

  const configs = readFormConfigs(form.config)

  return {
    rootName,
    /* ⚠️ The codename first — "RESISTOR" is what the rail, the table and the badge already call it, and a
       folder named something else would be a third name for one thing. */
    type: form.codename ?? form.name,
    datasheetField: form.config?.[PRICING_CONFIG_KEYS.DATASHEET_FILE_FIELD]?.trim() || null,
    imageField: configs.imageField,
  }
}

/**
 * Which shelf inside the type's folder one field's uploads go on.
 *
 * ⚠️ **Three buckets and no more.** `Inventory/Resistor/Datasheets` is a folder somebody can read;
 * a folder per field would be a tree nobody can, and one flat `Inventory` was the complaint that started
 * this. Anything the form has not declared is simply a file.
 */
export function shelfFor(field: FieldDetail, destination?: UploadDestination): string | undefined {
  if (!destination) {
    return undefined
  }

  if (destination.datasheetField && field.name === destination.datasheetField) {
    return "Datasheets"
  }

  if (destination.imageField && field.name === destination.imageField) {
    return "Images"
  }

  return field.elementType === "IMAGE" ? "Images" : "Files"
}

export function UploadDestinationProvider({
  destination,
  children,
}: {
  destination?: UploadDestination
  children: ReactNode
}) {
  return (
    <UploadDestinationContext.Provider value={destination}>{children}</UploadDestinationContext.Provider>
  )
}

/** Where uploads here should go, or nothing for the account's own cabinet. */
export function useUploadDestination() {
  return useContext(UploadDestinationContext)
}
