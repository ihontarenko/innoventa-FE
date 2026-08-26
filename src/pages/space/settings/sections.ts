import { DangerZoneSection } from "./DangerZoneSection"
import { FormsSection } from "./FormsSection"
import { IdentitySection } from "./IdentitySection"
import { MembersSection } from "./MembersSection"
import { WordsSection } from "./WordsSection"
import { ModulesSection } from "./ModulesSection"
import type { SpaceSettingsSection } from "./SpaceSettingsSection"

/**
 * Every section the workspace settings screen can show, in the order its tabs appear.
 *
 * ⚠️ **The page renders this list; it does not contain one.** That is the whole difference: a section
 * bound to a module appears only where the workspace has that module and it is on, checked against the
 * same module surface the sidebar reads — so a section can never stand in front of endpoints that refuse.
 * And an area that needs a settings screen of its own contributes a file and a line here, rather than an
 * `if (subjectArea === …)` inside a platform page.
 *
 * Sections with no `module` belong to the workspace itself and are always there. Identity, Sections,
 * Members and the way out have to survive a workspace with every module off — that workspace is precisely
 * the one whose settings must stay usable.
 */
export const SPACE_SETTINGS_SECTIONS: SpaceSettingsSection[] = [
  { key: "identity", label: "Identity", glyph: "◉", Component: IdentitySection },

  // ⚠️ No `visible` gate: a member could not otherwise see which sections the workspace had, or why one
  // was missing. The controls disable for anyone who cannot use them — the state and the reason are
  // readable by everyone.
  { key: "sections", label: "Sections", glyph: "☰", Component: ModulesSection },

  { key: "members", label: "Members", glyph: "◍", Component: MembersSection },

  // ⚠️ No `visible` gate and no module: every screen in the workspace READS these words, so a member
  // who cannot change them still needs to see which ones are in force — the controls disable instead.
  { key: "words", label: "Words", glyph: "⌶", Component: WordsSection },

  // Editing which forms a workspace shows has nothing to read — the list is the control — so this one
  // genuinely does disappear for somebody who cannot change it.
  {
    key: "forms",
    label: "Forms",
    glyph: "☷",
    module: "forms",
    visible: (context) => context.isAdmin,
    Component: FormsSection,
  },

  { key: "danger-zone", label: "Danger zone", glyph: "⊗", Component: DangerZoneSection },
]
