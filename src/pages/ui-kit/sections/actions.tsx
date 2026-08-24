import { useState } from "react"
import { Button, Switch } from "@jmouse/ui"
import { SegmentedControl } from "@/components/SegmentedControl"
import { ToggleChip } from "@/components/ToggleChip"
import type { KitSection } from "../Specimen"

/** Everything that is pressed. */

function SegmentedSpecimen({ variant }: { variant: "solid" | "tabs" }) {
  const [value, setValue] = useState("all")

  return (
    <SegmentedControl
      ariaLabel="Example"
      variant={variant}
      value={value}
      onChange={setValue}
      segments={[
        { value: "all", label: "All" },
        { value: "mine", label: "Mine" },
        { value: "done", label: "Done" },
      ]}
    />
  )
}

function ChipSpecimen() {
  const [chosen, setChosen] = useState<string[]>(["entry"])

  function toggle(value: string) {
    setChosen((current) => (current.includes(value) ? current.filter((each) => each !== value) : [...current, value]))
  }

  return (
    <div className="flex flex-wrap gap-1">
      {["entry", "form", "file", "page"].map((value) => (
        <ToggleChip key={value} active={chosen.includes(value)} onClick={() => toggle(value)}>
          {value}
        </ToggleChip>
      ))}
    </div>
  )
}

function SwitchSpecimen() {
  const [on, setOn] = useState(true)

  return (
    <div className="flex items-center gap-4">
      <label className="flex items-center gap-2 text-xs">
        <Switch checked={on} onCheckedChange={setOn} />
        {on ? "on" : "off"}
      </label>
      <label className="flex items-center gap-2 text-xs opacity-60">
        <Switch checked={false} disabled />
        disabled
      </label>
    </div>
  )
}

export const actionsSection: KitSection = {
  key: "actions",
  label: "Дії",
  about: "Everything that is pressed — and the rule that one screen has one primary.",
  specimens: [
    {
      name: "button",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Button",
      what: "The variants, in the order of how loud they are.",
      note: (
        <>
          ⚠️ <strong>One `default` per screen.</strong> Two filled buttons side by side is a screen that has not
          decided what it is for. `destructive` is never the first press — see `confirm-in-place`.
        </>
      ),
      render: () => (
        <div className="flex flex-wrap items-center gap-2">
          <Button>default</Button>
          <Button variant="secondary">secondary</Button>
          <Button variant="outline">outline</Button>
          <Button variant="ghost">ghost</Button>
          <Button variant="destructive">destructive</Button>
          <Button variant="link">link</Button>
          <Button disabled>disabled</Button>
        </div>
      ),
    },
    {
      name: "button/size",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Button",
      what: "Four heights. `sm` is what a row uses; `default` is what a form footer uses.",
      render: () => (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs">xs</Button>
          <Button size="sm">sm</Button>
          <Button size="default">default</Button>
          <Button size="lg">lg</Button>
          <Button size="icon-sm" aria-label="Example">
            ✕
          </Button>
          <Button size="icon" aria-label="Example">
            ✎
          </Button>
        </div>
      ),
    },
    {
      name: "confirm-in-place",
      origin: "composed",
      from: "src/components/access/PolicyEditingKit.tsx",
      symbol: "@jmouse/ui · Button ×2",
      what: "Two presses for anything irreversible — the second button says what will happen.",
      note: (
        <>
          ⚠️ <strong>Never `window.confirm`.</strong> A browser dialog is the one control on a themed screen that
          cannot be read in the dark, and it cannot say the record's name in bold.
        </>
      ),
      render: () => <ConfirmSpecimen />,
    },
    {
      name: "segmented",
      origin: "product",
      from: "src/components/SegmentedControl.tsx",
      symbol: "SegmentedControl",
      what: "A few mutually exclusive choices. `solid` filters; `tabs` sits under real tabs.",
      note: (
        <>
          ⚠️ <strong>Ours, and three copies of it exist.</strong> Tessera and Kiwi each carry the same file — so it
          reads as library and is not one, and a fix written here fixes one interface out of three. The candidate
          for `@jmouse/ui` that this kit exists to surface.
        </>
      ),
      render: () => (
        <div className="flex flex-wrap items-center gap-4">
          <SegmentedSpecimen variant="solid" />
          <SegmentedSpecimen variant="tabs" />
        </div>
      ),
    },
    {
      name: "chip",
      origin: "product",
      from: "src/components/ToggleChip.tsx",
      symbol: "ToggleChip",
      what: "One small thing that is either chosen or not. Chips wrap; eighty-nine of them are seven rows.",
      note: "Reach for it wherever a column of checkboxes would be a wall — permissions, filters, roles.",
      render: () => <ChipSpecimen />,
    },
    {
      name: "switch",
      origin: "library",
      from: "@jmouse/ui",
      symbol: "Switch",
      what: "One setting that is on or off, and takes effect immediately.",
      note: "⚠️ Not for a form field somebody saves later — a switch that needs a Save button reads as already applied.",
      render: () => <SwitchSpecimen />,
    },
  ],
}

function ConfirmSpecimen() {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="destructive" size="sm" onClick={() => setConfirming(false)}>
          Really delete “Resistors” — this cannot be undone
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setConfirming(true)}>
      Delete
    </Button>
  )
}
