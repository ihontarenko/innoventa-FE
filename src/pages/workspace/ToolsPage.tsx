import { useMemo, useState } from "react"
import {
  Badge,
  Button,
  type FilterItem,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@jmouse/ui"
import { CardGroup, PageCard } from "@/components/PageCard"
import { ListScreen } from "@/components/layout/ListScreen"
import { CardDensityToggle } from "@/components/CardDensityToggle"
import { groupHues } from "@/lib/groupHues"
import { aggregatorFeatures, toolFeatures } from "@/components/features/registry"
import { useFeatureCatalog } from "@/hooks/useFeatures"
import type { FeatureEntry } from "@/components/features/contract"
import type { FeatureCatalogItem } from "@/api/features"
import { ReferenceShelf, useReferenceShelf } from "@/components/tools/ReferenceShelf"

const CATEGORY_LABELS: Record<string, string> = {
  VISUALIZER: "Visualiser",
  CALCULATOR: "Calculator",
  VALIDATOR: "Validator",
  CONVERTER: "Converter",
  LOOKUP: "Lookup",
}

const CATEGORY_GLYPHS: Record<string, string> = {
  VISUALIZER: "🎨",
  CALCULATOR: "🧮",
  VALIDATOR: "✓",
  CONVERTER: "↔",
  LOOKUP: "🔍",
}

/**
 * The instruments that stand on their own.
 *
 * ⚠️ **Drawn from the browser's registry, matched to the catalogue by slug — never the other way round.**
 * A catalogue row whose feature is not implemented here renders nothing, which is what made removing nine
 * of them safe; a feature implemented here with no row falls back to its own `meta` and works anyway.
 * Neither side is authoritative alone, and that is deliberate: the code decides what *exists*, the
 * catalogue decides what a workspace is *told about*.
 *
 * ⚠️ **Form-bound widgets are absent, and that is the whole distinction `kind` carries.** A stock
 * indicator with no stock row to indicate is not a tool with empty inputs — it is a category error.
 */
export function ToolsPage() {
  const { data: toolCatalogue = [] } = useFeatureCatalog("TOOL")
  const { data: aggregatorCatalogue = [] } = useFeatureCatalog("AGGREGATOR")

  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const [onShelf, setOnShelf] = useState(false)

  // ⚠️ Kiwi's, and allowed to be absent. An installation with no reference branch — or one whose branch
  // was never granted — gets a 404 here and simply has no second tab. Drawing an empty one that explains
  // itself is worse than a screen that does not claim to have a shelf.
  const shelf = useReferenceShelf()

  const items = useMemo(() => {
    const described = (entry: FeatureEntry, catalogue: FeatureCatalogItem[]) => ({
      entry,
      row: catalogue.find((one) => one.slug === entry.slug) ?? null,
    })

    return [
      ...toolFeatures().map((entry) => described(entry, toolCatalogue)),
      ...aggregatorFeatures().map((entry) => described(entry, aggregatorCatalogue)),
    ]
  }, [toolCatalogue, aggregatorCatalogue])

  const categoryOf = (item: (typeof items)[number]) => item.row?.category ?? item.entry.meta?.category ?? null

  const categories = [...new Set(items.map(categoryOf).filter((one): one is string => one !== null))].sort()

  const filterItems: FilterItem[] = categories.map((category) => ({
    key: category,
    icon: CATEGORY_GLYPHS[category] ?? "⚡",
    label: CATEGORY_LABELS[category] ?? category,
    count: items.filter((item) => categoryOf(item) === category).length,
  }))

  const visible = activeCategory ? items.filter((item) => categoryOf(item) === activeCategory) : items

  const groups = categories
    .map((category) => ({ category, items: visible.filter((item) => categoryOf(item) === category) }))
    .filter((group) => group.items.length > 0)

  const hueOfGroup = groupHues(groups.map((group) => group.category))

  const open = items.find((item) => item.entry.slug === openSlug) ?? null

  return (
    <>
      <ListScreen
        title="Tools"
        description={`${items.length} instruments — each doing something an expression cannot`}
        /* ⚠️ Two chips only when there IS a shelf, and they are NOT the same kind of thing wearing one
            coat: the left are code in this repository, the right are documents in Kiwi. They sit
            together because somebody looking for a calculator looks in one place, and apart because
            only one of them can be changed by editing this product. */
        chips={
          shelf.data
            ? [
                {
                  label: "Instruments",
                  count: items.length,
                  active: !onShelf,
                  onClick: () => setOnShelf(false),
                },
                { label: shelf.data.name, active: onShelf, onClick: () => setOnShelf(true) },
              ]
            : []
        }
        extraActions={<CardDensityToggle />}
        /* ⚠️ No rail on the shelf: its documents are not filed by the instruments' kinds, and a rail
            whose facets narrow nothing on screen is a control that lies about what it does. */
        rail={
          onShelf
            ? undefined
            : {
                title: "Kind",
                items: filterItems,
                activeKey: activeCategory,
                onSelect: setActiveCategory,
                allLabel: "Everything",
                allIcon: "🧰",
                allCount: items.length,
              }
        }
        isEmpty={!onShelf && items.length === 0}
        empty={{
          title: "No tools",
          text: "Nothing is registered. A tool is code rather than configuration, so this is a deployment question rather than a workspace one.",
        }}
      >
        {onShelf && shelf.data ? (
          <div className="p-4">
            <ReferenceShelf shelf={shelf.data} />
          </div>
        ) : (
          <div className="flex flex-col gap-5 p-4">
            {groups.map((group) => (
              <CardGroup
                key={group.category}
                title={CATEGORY_LABELS[group.category] ?? group.category}
                icon={CATEGORY_GLYPHS[group.category]}
                count={group.items.length}
                hue={hueOfGroup.get(group.category)}
              >
                {group.items.map((item) => {
                  const name = item.row?.name ?? item.entry.meta?.name ?? item.entry.slug
                  const description = item.row?.description ?? item.entry.meta?.description ?? null
                  const slots = item.row?.inputSlots.length ?? 0

                  return (
                    <PageCard
                      key={item.entry.slug}
                      icon={CATEGORY_GLYPHS[categoryOf(item) ?? ""] ?? "⚡"}
                      panelCount={slots > 0 ? `${slots} inputs` : undefined}
                      name={name}
                      description={description}
                      chips={
                        <>
                          {item.entry.kind === "aggregator" && (
                            <Badge variant="outline">reads every entry</Badge>
                          )}
                          {/* ⚠️ Worth saying: a tool with no catalogue row still works, and somebody
                              wondering why it is missing from an admin list deserves the reason. */}
                          {!item.row && <Badge variant="outline">not catalogued</Badge>}
                        </>
                      }
                      onOpen={() => setOpenSlug(item.entry.slug)}
                      actions={
                        <Button variant="outline" size="sm" onClick={() => setOpenSlug(item.entry.slug)}>
                          Open
                        </Button>
                      }
                    />
                  )
                })}
              </CardGroup>
            ))}
          </div>
        )}
      </ListScreen>

      {open && !onShelf && (
        <ToolSheet
          entry={open.entry}
          name={open.row?.name ?? open.entry.meta?.name ?? open.entry.slug}
          description={open.row?.description ?? open.entry.meta?.description ?? null}
          onClose={() => setOpenSlug(null)}
        />
      )}
    </>
  )
}

/**
 * One tool, opened.
 *
 * ⚠️ **Its state lives here and dies with the sheet.** A tool is a bench instrument, not a document —
 * nothing it computes is worth keeping, and persisting it would make reopening one show yesterday's
 * numbers as if they were an answer to today's question.
 */
function ToolSheet({
  entry,
  name,
  description,
  onClose,
}: {
  entry: FeatureEntry
  name: string
  description: string | null
  onClose: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>(entry.defaultValues)

  const Widget = entry.widget
  const Inputs = entry.inputs

  return (
    <Sheet open onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-sm">{name}</SheetTitle>
          {description && <SheetDescription className="text-xs">{description}</SheetDescription>}
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <Inputs values={values} onChange={(key, value) => setValues((previous) => ({ ...previous, [key]: value }))} />

          <div className="border-t pt-4">
            {/* ⚠️ No field mappings: a tool is bound to no form, so the array is empty rather than
                undefined — every widget reads it, and a tool is simply one with nothing mapped. */}
            <Widget values={values} fieldMappings={[]} />
          </div>
        </div>

        <div className="flex items-center gap-2 border-t p-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => setValues(entry.defaultValues)}>
            Reset
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
