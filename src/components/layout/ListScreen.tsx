import type { ReactNode } from "react"
import { Button, FilterPanel, Input, PageState, cn, type FilterItem } from "@jmouse/ui"
import { Pagination } from "@/components/Pagination"
import { ToggleChip } from "@/components/ToggleChip"
import { LoadFailureNotice } from "@/components/LoadFailureNotice"
import type { LoadFailure } from "@/lib/loadFailure"

/**
 * The shape every list screen in this product has, written once.
 *
 * <h2>⚠️ This is the prototype's layout, not an invention</h2>
 *
 * <p>`.scratch/innoventa-inventory-prototype/` is the reference, and its shell is three columns that
 * run the **full height of the window**: a navigation sidebar, the content, and the detail panel —
 * `grid-template-columns: sidebar | minmax(0,1fr) | auto; height: 100vh`. The rail sits inside the
 * content as a sticky 208px column of plain rows, and the table fills what is left with a scroll of
 * its own.
 *
 * <p>What this product had instead: a padded page that grew downwards, a rail that was a short card
 * ending wherever its items ended, a table inside a rounded box inside that padding, and a panel
 * stitched on as a third grid cell with a gap in front of its own divider. Ivan drew an arrow at it:
 * *«лефтбар — обрізана полоска, розтягни донизу… таблиця має вітитись в контент блок, без закруглень,
 * зайвих відступів і облізаних блоків»*.
 *
 * <h2>⚠️ It cancels the frame's padding on purpose</h2>
 *
 * <p>`ApplicationLayout` wraps a page in `p-4` and scrolls it. A full-height screen cannot live inside
 * that: its rail would stop 1rem short of the bottom, and its panel could never touch the right edge.
 * So this takes the whole frame with a negative margin and owns every edge itself — which is exactly
 * what makes the three columns reach top and bottom.
 *
 * <h2>⚠️ Only the rows scroll</h2>
 *
 * <p>The header, the toolbar and the pagination are pinned; the table is the one thing with
 * `overflow-auto`. A page that scrolled as a whole would take its own header off the top, which is the
 * defect the frame's comment already describes one level up.
 *
 * <h2>⚠️ The order of the states is the order they must be checked in</h2>
 *
 * <p>Failure, then loading, then empty, then content. A paused query is `pending` with no error
 * attached — check loading first and a refusal renders as a skeleton that never resolves; check empty
 * first and a screen that failed to load says *there is nothing here*, which is a lie somebody acts on.
 */
export interface ListScreenChip {
  label: ReactNode
  active: boolean
  onClick: () => void
  /** A figure shown after the label — the count this chip would narrow to. */
  count?: number
  disabled?: boolean
  title?: string
}

export interface ListScreenProperties {
  title: ReactNode
  /** The line under the title. Convention: `<what is selected> — <n> recorded`. */
  description?: ReactNode

  /** Absent draws no search box — a screen with nothing to search should not offer one. */
  search?: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    /** Focused by `/`; the caller owns the ref so its own shortcut can reach it. */
    inputRef?: React.RefObject<HTMLInputElement | null>
  }

  chips?: ListScreenChip[]

  /** The one thing this screen is for. Rendered last in the header, as the only filled button. */
  action?: { label: string; onClick: () => void; disabled?: boolean }

  /** Anything else in the header, between the chips and the action. */
  extraActions?: ReactNode

  /**
   * The rail. Absent leaves the content the whole width — a screen with nothing to narrow by should
   * not carry an empty column.
   */
  rail?: {
    title: string
    items: FilterItem[]
    activeKey: string | null
    onSelect: (key: string | null) => void
    allLabel?: string
    allIcon?: string
    allCount?: number
    searchable?: boolean
    searchPlaceholder?: string
    footer?: ReactNode
  }

  /**
   * The peek panel, as the third full-height column.
   *
   * ⚠️ `open` is passed separately rather than inferred from the node: on a narrow screen the panel is
   * a sheet in a portal and must claim no column at all.
   */
  detail?: { open: boolean; node: ReactNode }

  /**
   * A strip between the toolbar and the rows — a summary, a selection bar.
   *
   * ⚠️ Pinned with the toolbar rather than scrolling with the rows. A summary that scrolled away is a
   * figure somebody has to scroll back up to read, which is the opposite of a summary.
   */
  toolbar?: ReactNode

  /** Between the header and the columns — a filter builder somebody is composing. */
  banner?: ReactNode

  failure?: LoadFailure | null
  onRetry?: () => void
  loading?: boolean
  /** ⚠️ Match the page's own density, so the skeleton is the size of what replaces it. */
  loadingRows?: number

  /** Shown when there are no rows and nothing failed. */
  empty?: { title: string; text?: string; actions?: { label: string; onClick: () => void; primary?: boolean }[] }
  /** Whether there is anything to draw. The caller decides — it knows what a row is. */
  isEmpty?: boolean

  pagination?: {
    page: number
    totalPages: number
    totalElements: number
    size: number
    onChange: (page: number) => void
  }

  /** A hint line pinned under the rows — the prototype's `.table-foot`. */
  footnote?: ReactNode

  children?: ReactNode
}

export function ListScreen({
  title,
  description,
  search,
  chips = [],
  action,
  extraActions,
  rail,
  detail,
  toolbar,
  banner,
  failure,
  onRetry,
  loading,
  loadingRows = 12,
  empty,
  isEmpty,
  pagination,
  footnote,
  children,
}: ListScreenProperties) {
  const hasHeaderControls = Boolean(search || chips.length > 0 || action || extraActions)

  return (
    /* ⚠️ `-m-4` and `h-[calc(100%+2rem)]` take back the frame's padding — see the note above. Without
       it the rail stops short of the bottom and the panel cannot reach the right edge. */
    <div className="-m-4 flex h-[calc(100%+2rem)] min-h-0 flex-1">
      <main className="flex min-w-0 flex-1 flex-col">
        {/* ⚠️ Pinned, and spanning the rail as well as the rows — the prototype's `.page-head` sits
            inside `.main`, above the `.split`. A header that started to the right of the rail would
            make the rail's own heading the first thing on the page, above the page's title. */}
        <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] leading-tight font-semibold">{title}</h1>
            {description && (
              <p className="text-muted-foreground mt-0.5 truncate text-[12px]">{description}</p>
            )}
          </div>

          {hasHeaderControls && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {search && (
                /* ⚠️ **A `RefObject`, never the wider `Ref` union.** `@jmouse/ui` resolves
                   `@types/react` out of its own `node_modules`, so the callback-ref branch of `Ref` is
                   two unrelated nominal types with one name and will not assign. */
                <Input
                  ref={search.inputRef}
                  size="sm"
                  className="w-64"
                  value={search.value}
                  placeholder={search.placeholder}
                  onChange={(event) => search.onChange(event.target.value)}
                />
              )}

              {chips.map((chip, index) => (
                <ToggleChip
                  key={index}
                  active={chip.active}
                  disabled={chip.disabled}
                  title={chip.title}
                  onClick={chip.onClick}
                >
                  {chip.label}
                  {chip.count !== undefined && chip.count > 0 && (
                    <span className="ml-1.5 tabular-nums opacity-70">{chip.count}</span>
                  )}
                </ToggleChip>
              ))}

              {extraActions}

              {action && (
                <Button size="sm" disabled={action.disabled} onClick={action.onClick}>
                  {action.label}
                </Button>
              )}
            </div>
          )}
        </header>

        {banner}

        {/* The prototype's `.split`: the rail and the rows, both running to the bottom. */}
        <div className="flex min-h-0 flex-1">
          {rail && (
            /* ⚠️ **Its own column, full height, with its own scroll and its own right edge.** It was a
               card whose height was however many items it happened to have — the "cut-off strip" Ivan
               drew an arrow at. Hidden below `lg`, where the rows are the whole screen. */
            <aside className="bg-muted/20 hidden w-52 shrink-0 flex-col overflow-y-auto border-r lg:flex">
              <FilterPanel
                title={rail.title}
                items={rail.items}
                activeKey={rail.activeKey}
                onSelect={rail.onSelect}
                allLabel={rail.allLabel}
                allIcon={rail.allIcon}
                allCount={rail.allCount}
                searchable={rail.searchable ?? rail.items.length > 8}
                searchPlaceholder={rail.searchPlaceholder}
                footer={rail.footer}
                bleed={false}
                className="flex-1 p-2"
              />
            </aside>
          )}

          <section className="flex min-w-0 flex-1 flex-col">
            {/* ⚠️ Pinned above the rows — the prototype's `.summary` / `.bulk`. A figure that scrolled
                away with the rows is one somebody has to scroll back up to read. */}
            {toolbar && <div className="shrink-0 border-b">{toolbar}</div>}

            {/* ⚠️ **The one scroller, and no rounded box inside it.** The rows fill the content block
                edge to edge; a bordered card here is a frame inside a frame — the "облізлий блок". */}
            <div
              className={cn(
                "min-h-0 flex-1",
                failure || loading || isEmpty ? "overflow-y-auto" : "overflow-auto",
              )}
            >
              {failure ? (
                <div className="p-4">
                  <LoadFailureNotice failure={failure} onRetry={onRetry} />
                </div>
              ) : loading ? (
                <div className="p-4">
                  <PageState kind="loading" rows={loadingRows} />
                </div>
              ) : isEmpty ? (
                <PageState
                  kind="empty"
                  title={empty?.title ?? "Nothing here yet"}
                  text={empty?.text}
                  actions={empty?.actions?.map((one) => ({ ...one })) ?? []}
                />
              ) : (
                children
              )}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="shrink-0 border-t">
                <Pagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  totalElements={pagination.totalElements}
                  size={pagination.size}
                  onChange={pagination.onChange}
                />
              </div>
            )}

            {footnote && (
              <div className="text-muted-foreground shrink-0 border-t px-4 py-1.5 text-[11.5px]">
                {footnote}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ⚠️ The third column, flush — its own `border-l` is the divider, so nothing may sit in front
          of it. On a narrow screen it is a sheet in a portal and claims no column. */}
      {detail?.node}
    </div>
  )
}
