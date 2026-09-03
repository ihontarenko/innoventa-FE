import { COMMON_RATIOS } from "@jmouse/ui"
import { Input, Switch } from "@jmouse/ui"
import { SegmentedControl } from "@/components/SegmentedControl"
import { ToggleChip } from "@/components/ToggleChip"
import { IMAGE_CONFIG_KEYS } from "@/lib/fieldConfigs"
import { EditorField, EditorSection } from "../EditorSection"
import type { useFieldDraft } from "../useFieldDraft"

/**
 * What this field asks of a picture on its way in.
 *
 * ⚠️ **The keys were always there; the controls were not.** `image.crop`, `image.max_width`,
 * `image.format` and the rest have been read by `imageProcessing` for as long as the new interface has
 * existed, and could be set only by typing them into *Advanced*'s raw key/value map — which the old
 * interface did not require, since it carried a *Crop on upload* control and a help modal listing the
 * lot. A configuration nobody can find is a configuration nobody uses, and that is what this card is
 * for.
 *
 * ⚠️ **Every control here writes a key, and clearing one removes it.** There is no third state where a
 * field carries `image.format=` — an empty value would read as *no format*, which is exactly what the
 * absent key already means, and two spellings of one answer is how a reader ends up unsure which wins.
 */
export function PictureSection({ editor }: { editor: ReturnType<typeof useFieldDraft> }) {
  const { draft, setConfig } = editor

  const configured = (key: string) => draft.configs[key] ?? ""

  const width = configured(IMAGE_CONFIG_KEYS.MAX_WIDTH)
  const height = configured(IMAGE_CONFIG_KEYS.MAX_HEIGHT)
  const format = configured(IMAGE_CONFIG_KEYS.FORMAT) || "keep"
  const crop = cropDemandOf(configured(IMAGE_CONFIG_KEYS.CROP))

  // ⚠️ The same rule `cropSpecificationFor` applies, said out loud. Two dimensions are this field
  // declaring a slot of an exact shape, so the shapes below stop being the person's to choose — and a
  // card that let them be chosen anyway would be offering something the cropper then ignores.
  const shapeIsFixed = width !== "" && height !== ""

  const offered = offeredLabels(configured(IMAGE_CONFIG_KEYS.RATIOS))
  const reshapes = configured(IMAGE_CONFIG_KEYS.RESHAPE) !== "false"

  const configuredCount = Object.keys(draft.configs).filter((key) => key.startsWith("image.")).length

  return (
    <EditorSection
      title="Picture"
      icon="🖼"
      badge={configuredCount || "default"}
      hint="Only ever applies to a value that turns out to be an image — a PDF is uploaded untouched."
      defaultOpen={false}
    >
      <EditorField
        label="Framing"
        hint="Offered is the default: one dismissible dialog, and the original goes up untouched when it is declined."
      >
        <SegmentedControl
          ariaLabel="Framing"
          value={crop}
          segments={[
            { value: "offered", label: "Offered" },
            { value: "required", label: "Required" },
            { value: "off", label: "Off" },
          ]}
          onChange={(next) => setConfig(IMAGE_CONFIG_KEYS.CROP, next === "offered" ? "" : next)}
        />
      </EditorField>

      {crop !== "off" && (
        <>
          <EditorField
            label="Shapes offered"
            hint={
              shapeIsFixed
                ? "⚠️ Both sizes below are set, so this field's shape is fixed and none of these are offered."
                : "Nothing chosen offers all of them. The frame starts on the first one that is chosen."
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {COMMON_RATIOS.map((ratio) => (
                <ToggleChip
                  key={ratio.label}
                  active={!shapeIsFixed && offered.includes(ratio.label.toLowerCase())}
                  disabled={shapeIsFixed}
                  onClick={() =>
                    setConfig(IMAGE_CONFIG_KEYS.RATIOS, toggled(offered, ratio.label.toLowerCase()))
                  }
                >
                  {ratio.label}
                </ToggleChip>
              ))}
            </div>
          </EditorField>

          <EditorField
            label="Free reshape"
            hint="Corner grips that take the frame to a shape nobody listed."
          >
            <Switch
              checked={!shapeIsFixed && reshapes}
              disabled={shapeIsFixed}
              onCheckedChange={(next) =>
                setConfig(IMAGE_CONFIG_KEYS.RESHAPE, next ? "" : "false")
              }
            />
          </EditorField>
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <EditorField label="Largest width" hint="Pixels. Blank keeps the region's own size.">
          <Input
            type="number"
            min={1}
            className="h-8 text-sm"
            placeholder="—"
            value={width}
            onChange={(event) => setConfig(IMAGE_CONFIG_KEYS.MAX_WIDTH, event.target.value)}
          />
        </EditorField>

        <EditorField label="Largest height" hint="Setting both fixes the shape — see above.">
          <Input
            type="number"
            min={1}
            className="h-8 text-sm"
            placeholder="—"
            value={height}
            onChange={(event) => setConfig(IMAGE_CONFIG_KEYS.MAX_HEIGHT, event.target.value)}
          />
        </EditorField>
      </div>

      <EditorField
        label="Saved as"
        hint="⚠️ Keeping the picture's own is the honest default: re-encoding is a change the person accepting a crop did not ask for and cannot see."
      >
        <SegmentedControl
          ariaLabel="Saved as"
          value={format}
          segments={[
            { value: "keep", label: "As uploaded" },
            { value: "png", label: "PNG" },
            { value: "jpeg", label: "JPEG" },
            { value: "webp", label: "WebP" },
          ]}
          onChange={(next) => setConfig(IMAGE_CONFIG_KEYS.FORMAT, next === "keep" ? "" : next)}
        />
      </EditorField>

      {/* ⚠️ Absent for PNG rather than disabled, because PNG is lossless and there is nothing for the
          number to mean — and some browsers answer a quality on a PNG by quietly encoding a JPEG under
          a `.png` name. "As uploaded" keeps it: the picture may well arrive as a JPEG. */}
      {format !== "png" && (
        <EditorField label="Quality" hint="0 to 1. Blank is 0.92, and it is ignored for a PNG.">
          <Input
            type="number"
            min={0}
            max={1}
            step={0.01}
            className="h-8 w-24 text-sm"
            placeholder="0.92"
            value={configured(IMAGE_CONFIG_KEYS.QUALITY)}
            onChange={(event) => setConfig(IMAGE_CONFIG_KEYS.QUALITY, event.target.value)}
          />
        </EditorField>
      )}
    </EditorSection>
  )
}

/** ⚠️ `true` and `false` are the spellings this key had before it had three states. */
function cropDemandOf(configured: string): "required" | "offered" | "off" {
  if (configured === "true" || configured === "required") {
    return "required"
  }

  if (configured === "false" || configured === "off") {
    return "off"
  }

  return "offered"
}

function offeredLabels(configured: string): string[] {
  return configured
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * ⚠️ **Turning the last one off writes nothing, not `none`.** An empty list is somebody who has just
 * cleared their choices, and the answer to that is the default — all of them — rather than the far
 * stronger *offer no shapes at all*, which nobody reached by unticking a box.
 */
function toggled(offered: string[], label: string): string {
  const next = offered.includes(label)
    ? offered.filter((entry) => entry !== label)
    : [...offered, label]

  return next.join(", ")
}
