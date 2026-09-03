import { createContext, useContext, type ComponentProps, type ReactNode } from "react"
import { EntityCard, EntityCardGrid } from "@jmouse/ui"
import { useCardDensityStore } from "@/stores/cardDensityStore"

/**
 * The hue of the group a card is sitting in, so the card can wear it as an edge.
 *
 * ⚠️ **Through a context, not a property, because the group is what knows it.** A card threading a
 * colour down from its screen would be four call sites remembering to; the group already draws the
 * heading the colour belongs to, and every card in it is a child of that.
 *
 * ⚠️ `undefined` draws no edge rather than a grey one — the same rule {@link GroupDot} keeps: no
 * colour is an answer, grey is a group whose colour happens to be grey.
 */
const GroupHueContext = createContext<number | undefined>(undefined)

/**
 * One thing in a grid of things — a component type, a form, a project, a tool.
 *
 * ⚠️ **The card itself now lives in `@jmouse/ui` (`EntityCard`), and this is the adapter.** Three
 * products draw the same object and only one of them had a card for it; what stays here is Innoventa's
 * vocabulary — `icon`, `panelCount`, `door` — mapped onto the library's, so the four screens below did
 * not have to be rewritten to move the component out.
 *
 * ⚠️ **The density is read here, not passed in.** Every screen that draws these cards obeys one
 * preference (`cardDensityStore`), and a screen that had to thread it through would be a screen that
 * can forget to. What each density does with a card's parts is documented on `EntityCardProperties`.
 */
export function PageCard({
  icon,
  panelCount,
  name,
  isDraft = false,
  badge,
  description,
  chips,
  actions,
  door,
  onOpen,
  onDelete,
  confirmMessage,
  navigation,
}: {
  /** One letter or one emoji. Falls back to the name's initial at the call site, never to a placeholder. */
  icon: ReactNode
  /** The second thing worth knowing — "14 fields", "3 entries". */
  panelCount?: string
  name: string
  isDraft?: boolean
  badge?: ReactNode
  description?: string | null
  chips?: ReactNode
  actions?: ReactNode
  /**
   * A {@link LevelDoor} to the same thing seen at another level.
   *
   * ⚠️ **A door is not one of this screen's verbs** — it leaves the level — so it is drawn quieter than
   * they are and at the far side of the band from them, which is what stops leaving looking like doing.
   */
  door?: ReactNode
  /** Makes the card's title the way in. The actions below stay their own targets. */
  onOpen?: () => void
  onDelete?: () => void
  confirmMessage?: string
  /** `useListKeyboard`'s row properties, where this card is a row somebody navigates with `j`/`k`. */
  navigation?: ComponentProps<typeof EntityCard>["navigation"]
}) {
  const density = useCardDensityStore((state) => state.density)
  const hue = useContext(GroupHueContext)

  return (
    <EntityCard
      // Saturation and lightness are the palette’s, not this call’s — one pair of them reads on a cream
      // page and on an obsidian one, and a caller free to change them is free to make a group invisible.
      accentColour={hue === undefined ? undefined : `hsl(${hue} 62% 52%)`}
      density={density}
      glyph={icon}
      measure={panelCount}
      name={name}
      isDraft={isDraft}
      badge={badge}
      description={description}
      chips={chips}
      actions={actions}
      footer={door}
      onOpen={onOpen}
      onRemove={onDelete}
      confirmLabel={confirmMessage}
      navigation={navigation}
    />
  )
}

/**
 * A named run of cards.
 *
 * ⚠️ **The count belongs to the heading**, for the same reason a table's group tally does: the heading
 * says what the group is, the number says whether to look inside it.
 */
export function CardGroup({
  title,
  icon,
  count,
  hue,
  children,
}: {
  title: string
  icon?: string | null
  count: number
  /** From `groupHues`, fed the groups in the order they are drawn. */
  hue?: number
  children: ReactNode
}) {
  const density = useCardDensityStore((state) => state.density)

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        {icon && <span aria-hidden="true">{icon}</span>}
        <span className="text-xs font-semibold tracking-[0.04em] uppercase">{title}</span>
        <span className="text-[11px] text-muted-foreground">{count}</span>
      </div>
      <GroupHueContext.Provider value={hue}>
        <EntityCardGrid density={density}>{children}</EntityCardGrid>
      </GroupHueContext.Provider>
    </section>
  )
}
