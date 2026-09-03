import { useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { ExternalLink } from "lucide-react"
import { Badge, Button, type FilterItem, RowGroup } from "@jmouse/ui"
import { ListScreen } from "@/components/layout/ListScreen"
import { CreateFieldDialog } from "@/components/form/CreateFieldDialog"
import { ChildPickerDialog } from "@/components/form/builder/ChildPickerDialog"
import { FieldCard } from "@/components/form/builder/FieldCard"
import { FieldEditor } from "@/components/form/builder/FieldEditor"
import { USAGE_TYPES } from "@/lib/fieldTypes"
import { useDeleteField, useEntityIdsByTag, useFields, useTagStats } from "@/hooks/useFieldCatalogue"
import { useIsWideLayout } from "@/hooks/useMediaQuery"
import { spaceSectionPath } from "@/lib/navigationContext"
import { FIELD_TYPES, fieldTypeOf } from "@/lib/fieldTypes"
import type { ElementType, FieldSummary } from "@/types"

/**
 * How a field is *used*, as against what it *is*.
 *
 * ⚠️ **Two axes, and they are not the same question.** `elementType` is what a value looks like — text, a
 * number, a choice; `usageType` is where the field may stand — on a form, inside a group, nowhere at all.
 * A catalogue that filtered on one of them would leave the other unanswerable.
 */
// ⚠️ The list lives in `lib/fieldTypes.ts`. It used to be spelled out here too, and in the create
// dialog — three copies, of which the dialog's had already lost PHANTOM.
const USAGE_KEYS: Set<string> = new Set(USAGE_TYPES.map((usage) => usage.value))

const TAG_PREFIX = "tag:"

/**
 * Every reusable field definition in the installation.
 *
 * ⚠️ **A field belongs to no form.** The same "Manufacturer" is on six forms and is one row — which is
 * the whole reason this screen exists apart from the builder, and why the count beside a type here is a
 * count of *definitions*, never of the times one is used.
 *
 * ⚠️ **A row opens where it stands** (Ivan, 2026-08-25), instead of throwing a sheet over the list. The
 * catalogue is scanned for one field among two hundred, and a sheet covered the very column somebody had
 * just been reading down — so every edit ended with the list having to be found again. It is the same
 * editor the builder expands, in the same variant.
 *
 * ⚠️ **Below `lg` a row does not expand — it navigates.** Two cards side by side need a screen, and a
 * phone has the field's own page instead, which is a better destination anyway: it survives a reload and
 * can be sent to somebody.
 */
export function FieldsPage() {
  const { spaceSlug } = useParams()
  const navigate = useNavigate()
  const isWide = useIsWideLayout()
  const { data: fields = [], isLoading } = useFields()
  const { data: tagStats = [] } = useTagStats("FIELD")

  const [search, setSearch] = useState("")
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isPickingChild, setPickingChild] = useState(false)

  const deleteField = useDeleteField()

  const activeTagId = activeKey?.startsWith(TAG_PREFIX) ? activeKey.slice(TAG_PREFIX.length) : undefined
  const { data: taggedIds } = useEntityIdsByTag(activeTagId)

  const activeUsage = activeKey && !activeTagId && USAGE_KEYS.has(activeKey) ? activeKey : null
  const activeElement = activeKey && !activeTagId && !USAGE_KEYS.has(activeKey) ? activeKey : null

  const items: FilterItem[] = [
    ...USAGE_TYPES.map((usage, index) => ({
      key: usage.value,
      icon: usage.glyph,
      label: usage.label,
      count: fields.filter((field) => field.usageType === usage.value).length,
      dividerLabel: index === 0 ? "Usage" : undefined,
    })),
    ...FIELD_TYPES.filter((descriptor) => descriptor.group !== "Structure").map((descriptor, index, array) => ({
      key: descriptor.id,
      icon: descriptor.glyph,
      label: descriptor.label,
      count: fields.filter((field) => field.elementType === descriptor.id).length,
      // A divider whenever the group changes — the catalogue's own grouping, not a second one.
      dividerLabel: index === 0 || array[index - 1].group !== descriptor.group ? descriptor.group : undefined,
    })),
    ...tagStats.map((tag, index) => ({
      key: `${TAG_PREFIX}${tag.id}`,
      icon: tag.icon ?? "🏷",
      label: tag.name,
      count: tag.count,
      dividerLabel: index === 0 ? "Tags" : undefined,
    })),
  ]

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return fields
      .filter((field) => !activeUsage || field.usageType === activeUsage)
      .filter((field) => !activeElement || field.elementType === activeElement)
      .filter((field) => !activeTagId || taggedIds?.includes(field.id))
      .filter(
        (field) =>
          needle === "" || field.label.toLowerCase().includes(needle) || field.name.toLowerCase().includes(needle),
      )
  }, [fields, activeUsage, activeElement, activeTagId, taggedIds, search])

  function fieldPath(fieldId: string) {
    return spaceSectionPath(spaceSlug ?? "", `fields/${fieldId}`)
  }

  function onToggle(field: FieldSummary) {
    if (!isWide) {
      navigate(fieldPath(field.id))
      return
    }

    setExpandedId((previous) => (previous === field.id ? null : field.id))
  }

  function onRemove(field: FieldSummary) {
    deleteField.mutate(field.id, {
      onSuccess: () => toast.success(`${field.label} deleted.`),
      onError: (error) => {
        const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

        // ⚠️ The backend's own sentence. "Could not delete" hides the one useful fact — that a form
        // still carries it — and sends somebody looking at permissions.
        toast.error(detail ?? "Could not delete this field.")
      },
    })

    setRemovingId(null)
  }

  return (
    <>
      <ListScreen
        title="Fields"
        description={`${fields.length} reusable definitions — a field belongs to no one form`}
        search={{ value: search, onChange: setSearch, placeholder: "Search fields…" }}
        action={{ label: "New field", onClick: () => setCreating(true) }}
        rail={{
          title: "Filter",
          items: items,
          activeKey: activeKey,
          onSelect: setActiveKey,
          allLabel: "All fields",
          allIcon: "▣",
          allCount: fields.length,
          searchable: true,
          searchPlaceholder: "Filter the filters…",
        }}
        loading={isLoading}
        isEmpty={visible.length === 0}
        empty={{
          title: fields.length === 0 ? "No fields yet" : "Nothing matches",
          text:
            fields.length === 0
              ? "A field is a reusable definition — a name, a shape and a unit — that forms attach rather than copy."
              : "No field in this installation answers to that.",
          actions:
            fields.length === 0 ? [{ label: "New field", primary: true, onClick: () => setCreating(true) }] : [],
        }}
      >
        <div className="p-4">
          <RowGroup tally={`${visible.length} of ${fields.length}`}>
            <div className="flex flex-col gap-1.5">
              {visible.map((field) => (
                <FieldCard
                  key={field.id}
                  field={field}
                  isExpanded={expandedId === field.id}
                  onToggle={() => onToggle(field)}
                  badges={<CatalogueBadges field={field} />}
                  actions={
                    <>
                      <Button asChild variant="ghost" size="icon" className="size-6" aria-label="Open as a page">
                        <Link to={fieldPath(field.id)} onClick={(event) => event.stopPropagation()}>
                          <ExternalLink className="size-3" />
                        </Link>
                      </Button>

                      {removingId === field.id ? (
                        <Button variant="destructive" size="sm" onClick={() => onRemove(field)}>
                          Really delete
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => setRemovingId(field.id)}
                        >
                          Delete
                        </Button>
                      )}
                    </>
                  }
                >
                  {/* ⚠️ No `form`, so no *Condition* card — a condition names sibling fields, and a
                      catalogued field has none. Everything else a field owns is editable here. */}
                  <FieldEditor
                    fieldId={field.id}
                    variant="inline"
                    onPickChild={() => setPickingChild(true)}
                    onClose={() => setExpandedId(null)}
                    actions={
                      <Button asChild variant="ghost" size="sm">
                        <Link to={fieldPath(field.id)}>
                          <ExternalLink className="size-3.5" />
                          Open as a page
                        </Link>
                      </Button>
                    }
                  />
                </FieldCard>
              ))}
            </div>
          </RowGroup>
        </div>
      </ListScreen>

      {creating && <CreateFieldDialog onClose={() => setCreating(false)} />}

      <ChildPickerDialog fieldId={expandedId} open={isPickingChild} onClose={() => setPickingChild(false)} />
    </>
  )
}

/** What a field is, read without opening it — the type, its unit, and how it may be used. */
function CatalogueBadges({ field }: { field: FieldSummary }) {
  const descriptor = fieldTypeOf(field.elementType as ElementType)
  const usage = USAGE_TYPES.find((candidate) => candidate.value === field.usageType)

  return (
    <>
      {field.unit && <Badge variant="secondary">{field.unit}</Badge>}
      <Badge variant="secondary">{descriptor.label}</Badge>
      {usage && usage.value !== "STANDALONE" && (
        <Badge variant="outline" title={usage.hint}>
          {usage.glyph} {usage.label}
        </Badge>
      )}
    </>
  )
}
