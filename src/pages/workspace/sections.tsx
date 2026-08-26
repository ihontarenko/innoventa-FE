import type { ComponentType } from "react"
import { AssetsPage } from "./AssetsPage"
import { AttentionPage } from "./AttentionPage"
import { ComponentTypesPage } from "./ComponentTypesPage"
import { FieldsPage } from "./FieldsPage"
import { FilesPage } from "./FilesPage"
import { LabelsPage } from "./LabelsPage"
import { FormLibraryPage } from "./FormLibraryPage"
import { InspectionsPage } from "./InspectionsPage"
import { InventoryPage } from "./InventoryPage"

/**
 * ⚠️ Module-level so its identity is stable — it reaches a query key, and an array literal rebuilt on
 * every render is a new key on every render.
 */
const CATALOG_COMPANIONS = ["CAD"]
import { LocationsPage } from "./LocationsPage"
import { PagesPage } from "./PagesPage"
import { PeoplePage } from "./PeoplePage"
import { ProjectsPage } from "./ProjectsPage"
import { LookupPage } from "./LookupPage"
import { MaintenancePage } from "./MaintenancePage"
import { ResultsPage } from "./ResultsPage"
import { ParametricSearchPage } from "./ParametricSearchPage"
import { SearchPage } from "./SearchPage"
import { SynonymsPage } from "./SynonymsPage"
import { ToolsPage } from "./ToolsPage"
import { WatchPage } from "./WatchPage"

/**
 * Which workspace sections have a real screen, and which ticket owns the rest.
 *
 * ⚠️ **A registry rather than a list of routes.** A workspace's sections are contributed by its subject
 * area and arrive from the server, so the browser cannot know their names — one catch-all route asks
 * this map whether the section it landed on is built, and falls back to the placeholder when it is not.
 * Writing them out as routes would be a second, drifting copy of the served menu, and the first
 * workspace with a section this list had never heard of would show a menu entry leading to a 404.
 *
 * ⚠️ **A section absent from `SCREENS` is not an error.** It is a screen that has not moved yet, and the
 * placeholder names the ticket that will move it — which is the whole reason the ticket column exists.
 */
export const SCREENS: Record<string, ComponentType> = {
  assets: AssetsPage,
  attention: AttentionPage,
  "component-types": ComponentTypesPage,
  fields: FieldsPage,
  forms: FormLibraryPage,
  inventory: InventoryPage,
  locations: LocationsPage,
  // ⚠️ This product's own store, read with the ordinary session. It was a window onto another product
  // for a while; it is not any more, and only the anonymous public manual still comes from there.
  pages: PagesPage,
  // ⚠️ Not the members screen. A holder is an entry on a `HOLDER` form — an employee, a crew, a rental
  // client — and none of them need an account. `/admin/access` is where people with accounts live.
  people: PeoplePage,
  projects: ProjectsPage,
  lookup: LookupPage,
  results: ResultsPage,
  "parametric-search": ParametricSearchPage,
  search: SearchPage,
  "value-synonyms": SynonymsPage,
  synonyms: SynonymsPage,
  tools: ToolsPage,
  // ⚠️ Servicing across the whole workspace — the question the derivation could always answer and
  // nothing ever asked. Not a second attention board: it carries "fine" too, which is the one thing an
  // attention board must never be asked to show.
  maintenance: MaintenancePage,
  // ⚠️ Renders no fields and knows no checklist — a row opens the entry the form engine owns.
  inspections: InspectionsPage,
  // ⚠️ The configuration of the watch, one class of things at a time. The panels are the settings
  // sheet's own, mounted where somebody looking for them would look.
  watch: WatchPage,
  files: FilesPage,
  labels: LabelsPage,
  // ⚠️ The same component, a different purpose — and deliberately not the same screen. Stock counts what
  // is on the shelf; the catalogue records what a part *is*, whether or not one is in a drawer.
  //
  // ⚠️ **Two catalogues, one entry.** Parts, and the drawings those parts are placed as — told apart by
  // the type rail this screen already had, rather than by a second item in the menu. A menu that grows
  // an entry for every kind of thing stops being a menu, and the two are looked up together anyway: the
  // question "which footprint does this take" starts on the part.
  catalog: () => (
    <InventoryPage
      purposeCode="CATALOG"
      companionPurposeCodes={CATALOG_COMPANIONS}
      title="Catalogs"
      noun="part"
    />
  ),
}

/** Which domain ticket owns which section — the same split the epic's table describes. */
export const TICKET_BY_SECTION: Record<string, string> = {
  forms: "INVT-0053",
  results: "INVT-0053",
  fields: "INVT-0053",
  inventory: "INVT-0053",
  catalog: "INVT-0053",
  "component-types": "INVT-0053",
  lookup: "INVT-0053",
  "value-synonyms": "INVT-0053",
  "parametric-search": "INVT-0053",
  // ⚠️ The generic folder tree, shared by Pages and Files — it arrives with them, not with forms.
  categories: "INVT-0054",
  entry: "INVT-0053",
  projects: "INVT-0054",
  assets: "INVT-0054",
  files: "INVT-0054",
  locations: "INVT-0054",
  search: "INVT-0054",
  labels: "INVT-0085",
  tools: "INVT-0057",
}
