import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Badge,
  Button,
  type FilterItem,
  FilterPanel,
  Input,
  Row,
  RowGroup,
  RowList,
  RowMeta,
  RowTitle,
  Skeleton,
} from "@jmouse/ui"
import { PageHeader } from "@/components/PageHeader"
import { CreateFieldDialog } from "@/components/form/CreateFieldDialog"
import { FieldEditorSheet } from "@/components/form/FieldEditorSheet"
import { USAGE_TYPES } from "@/lib/fieldTypes"
import { useDeleteField, useEntityIdsByTag, useFields, useTagStats } from "@/hooks/useFieldCatalogue"
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
 * ⚠️ **Rows rather than cards**, unlike the component types: this list is scanned for one name among two
 * hundred, and the thing being compared down the column is the identifier a form will refer to.
 */
export function FieldsPage() {
  const { data: fields = [], isLoading } = useFields()
  const { data: tagStats = [] } = useTagStats("FIELD")

  const [search, setSearch] = useState("")
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

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

  return (
    <>
      <PageHeader
        title="Fields"
        description={`${fields.length} reusable definitions — a field belongs to no one form`}
        actions={
          <>
            <Input
              className="h-8 w-56 text-sm"
              value={search}
              placeholder="Search fields…"
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button size="sm" onClick={() => setCreating(true)}>
              New field
            </Button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <FilterPanel
          title="Filter"
          items={items}
          activeKey={activeKey}
          onSelect={setActiveKey}
          allLabel="All fields"
          allIcon="▣"
          allCount={fields.length}
          searchable
          searchPlaceholder="Filter the filters…"
        />

        <div className="flex min-w-0 flex-col gap-3">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed px-6 py-10 text-center">
              <span aria-hidden="true" className="text-2xl">
                ▣
              </span>
              <span className="text-sm font-medium">{fields.length === 0 ? "No fields yet" : "Nothing matches"}</span>
              <span className="max-w-md text-xs text-muted-foreground">
                {fields.length === 0
                  ? "A field is a reusable definition — a name, a shape and a unit — that forms attach rather than copy."
                  : "No field in this installation answers to that."}
              </span>
            </div>
          ) : (
            <RowGroup tally={`${visible.length} of ${fields.length}`}>
              <RowList>
                {visible.map((field) => (
                  <FieldRow
                    key={field.id}
                    field={field}
                    onOpen={() => setEditingId(field.id)}
                    removing={removingId === field.id}
                    onAskRemove={() => setRemovingId(field.id)}
                    onRemove={() => {
                      deleteField.mutate(field.id, {
                        onSuccess: () => toast.success(`${field.label} deleted.`),
                        onError: (error) => {
                          const detail = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail

                          // ⚠️ The backend's own sentence. "Could not delete" hides the one useful fact —
                          // that a form still carries it — and sends somebody looking at permissions.
                          toast.error(detail ?? "Could not delete this field.")
                        },
                      })
                      setRemovingId(null)
                    }}
                  />
                ))}
              </RowList>
            </RowGroup>
          )}
        </div>
      </div>

      {creating && <CreateFieldDialog onClose={() => setCreating(false)} />}

      {/* ⚠️ Keyed on the field so switching rows remounts the editor rather than reusing its draft —
          otherwise an unsaved change would follow the reader onto the next field. */}
      {editingId && <FieldEditorSheet key={editingId} fieldId={editingId} onClose={() => setEditingId(null)} />}
    </>
  )
}

function FieldRow({
  field,
  onOpen,
  removing,
  onAskRemove,
  onRemove,
}: {
  field: FieldSummary
  onOpen: () => void
  removing: boolean
  onAskRemove: () => void
  onRemove: () => void
}) {
  const descriptor = fieldTypeOf(field.elementType as ElementType)
  const usage = USAGE_TYPES.find((candidate) => candidate.value === field.usageType)

  return (
    <Row
      onOpen={onOpen}
      leading={
        <>
          <span aria-hidden="true" className="w-4 text-center" title={descriptor.label}>
            {field.icon ?? descriptor.glyph}
          </span>
        </>
      }
      trailing={
        <>
          {field.required && <Badge variant="outline">required</Badge>}
          {field.unit && <Badge variant="secondary">{field.unit}</Badge>}
          <Badge variant="secondary">{descriptor.label}</Badge>
          {usage && usage.value !== "STANDALONE" && (
            <Badge variant="outline" title={usage.hint}>
              {usage.glyph} {usage.label}
            </Badge>
          )}

          {removing ? (
            <Button variant="destructive" size="sm" onClick={onRemove}>
              Really delete
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-destructive/10"
              onClick={onAskRemove}
            >
              Delete
            </Button>
          )}
        </>
      }
    >
      <RowTitle>{field.label}</RowTitle>
      {/* ⚠️ The name, always — it is what a form refers to and what an expression is written against, and
          a catalogue that showed only labels would be unusable the moment two fields read alike. */}
      <RowMeta className="font-mono">{field.name}</RowMeta>
    </Row>
  )
}
