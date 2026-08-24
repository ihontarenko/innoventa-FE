import {
  ArrowLeftRight,
  BellRing,
  Boxes,
  CalendarClock,
  ClipboardCheck,
  Calculator,
  CircleDot,
  ClipboardList,
  Cpu,
  FileText,
  Gauge,
  FolderTree,
  Layers,
  ListTree,
  MapPin,
  Package,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Tag,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react"

/**
 * A served menu entry, drawn with the interface's own icon set.
 *
 * ⚠️ **Keyed by the item's `key`, never by the glyph the backend sends.** The backend picks a Unicode
 * character (`☷`, `◔`, `⌖`) because its old interface drew glyphs; the key is what actually identifies
 * the item and is stable across a redesign of either side. Mapping the glyph would tie this table to a
 * decoration somebody may change without thinking about it.
 *
 * ⚠️ **An unknown key is not an error.** A subject area can contribute an item this table has never
 * heard of — that is the whole point of a served menu — so the fallback is a real icon, and the glyph
 * the backend sent is what the caller shows beside it if it wants to.
 */
const ICONS_BY_KEY: Record<string, LucideIcon> = {
  assets: Package,
  attention: BellRing,
  categories: FolderTree,
  "component-types": Cpu,
  entry: FileText,
  fields: SlidersHorizontal,
  files: Layers,
  "form-library": ClipboardList,
  forms: ClipboardList,
  inspections: ClipboardCheck,
  inventory: Boxes,
  labels: Tag,
  locations: MapPin,
  maintenance: CalendarClock,
  lookup: Search,
  pages: FileText,
  "parametric-search": Search,
  "parts-catalog": Table2,
  people: Users,
  projects: ListTree,
  results: CircleDot,
  search: Search,
  tools: Wrench,
  "value-synonyms": ArrowLeftRight,
  "workspace-settings": Settings,
  purposes: ClipboardList,
  pricing: Calculator,
  watch: Gauge,
}

export function spaceMenuIcon(itemKey: string): LucideIcon {
  return ICONS_BY_KEY[itemKey] ?? Sparkles
}
