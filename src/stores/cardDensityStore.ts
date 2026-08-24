import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { EntityCardDensity } from "@jmouse/ui"

interface CardDensityState {
  density: EntityCardDensity
  setDensity: (density: EntityCardDensity) => void
}

/**
 * How much room the cards get, on every screen that draws them.
 *
 * ⚠️ **One preference across the product, not one per screen.** Somebody who wants the rails wants them
 * on the types, the library and the projects alike — a per-screen memory would mean picking the same
 * thing four times and finding it undone on the fifth screen nobody had visited yet.
 *
 * ⚠️ **Web storage only, deliberately.** The navigation preferences are written through to the account
 * because hiding a menu item is a decision somebody makes once and expects to find everywhere; how
 * roomy a grid is, is a decision about *this* screen at *this* window width, and following it onto a
 * laptop half the size would be the wrong kind of loyalty.
 */
export const useCardDensityStore = create<CardDensityState>()(
  persist(
    (set) => ({
      density: "comfortable",
      setDensity: (density) => set({ density }),
    }),
    { name: "innoventa.card-density", version: 1 },
  ),
)
