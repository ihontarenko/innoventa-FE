import { EntityCardDensityToggle } from "@jmouse/ui"
import { useCardDensityStore } from "@/stores/cardDensityStore"

/**
 * The density switch, wired to the one preference the product keeps.
 *
 * ⚠️ **A component rather than four copies of two lines.** Every screen that draws {@link PageCard}
 * offers this control, and the store it reads is the reason the choice holds across all of them — a
 * screen wiring the toggle to its own state would silently opt out of that.
 */
export function CardDensityToggle() {
  const density = useCardDensityStore((state) => state.density)
  const setDensity = useCardDensityStore((state) => state.setDensity)

  return <EntityCardDensityToggle density={density} onChange={setDensity} />
}
