import { cn } from "@jmouse/ui"
import type { BandColor } from "./resistorBands"

/**
 * The pictures: an axial resistor, a chip resistor, a capacitor.
 *
 * ⚠️ **Every colour here is a literal, and that is the one place in this interface where that is right.**
 * A resistor's bands are brown, red, orange *in the world*; a chip's body is black. Theming them would
 * not restyle the component, it would draw a different one — so these do not follow the palette and must
 * not be "fixed" to.
 *
 * ⚠️ **SVG rather than divs.** The old drawings were stacks of `<div>`s with hard-coded widths, which is
 * why they needed a wrapper doing `transform: scale()` to be shown at any other size. An SVG scales by
 * being given a width.
 */

const AXIAL_WIDTH = 188
const AXIAL_HEIGHT = 28

/**
 * ⚠️ **Four or five bands, and the fifth is a third digit rather than another tolerance.** A five-band
 * part is a precision part; drawing it as four would round away the digit that makes it one.
 */
export function AxialResistor({
  bands,
  width = AXIAL_WIDTH,
  className,
}: {
  bands: BandColor[]
  width?: number
  className?: string
}) {
  const isFive = bands.length >= 5
  const digits = isFive ? bands.slice(0, 4) : bands.slice(0, 3)
  const tolerance = isFive ? bands[4] : bands[3]

  // The body runs 34…154; digit bands sit inside it, the tolerance band near the right lead.
  const bodyStart = 34
  const bodyEnd = 154
  const step = 16
  const firstBandAt = bodyStart + 14

  return (
    <svg
      viewBox={`0 0 ${AXIAL_WIDTH} ${AXIAL_HEIGHT}`}
      width={width}
      height={(width / AXIAL_WIDTH) * AXIAL_HEIGHT}
      className={cn("shrink-0", className)}
      role="img"
      aria-label={`Resistor: ${bands.map((band) => band.name).join(", ")}`}
    >
      {/* leads */}
      <rect x="0" y="12" width={bodyStart} height="4" rx="2" fill="#9E9E9E" />
      <rect x={bodyEnd} y="12" width={AXIAL_WIDTH - bodyEnd} height="4" rx="2" fill="#9E9E9E" />

      {/* body */}
      <rect x={bodyStart} y="2" width={bodyEnd - bodyStart} height="24" rx="7" fill="#D7CCC8" />
      <rect x={bodyStart} y="2" width={bodyEnd - bodyStart} height="8" rx="7" fill="#FFFFFF" opacity="0.25" />

      {digits.map((band, index) => (
        <rect
          key={index}
          x={firstBandAt + index * step}
          y="2"
          width="9"
          height="24"
          fill={band.hex}
        />
      ))}

      {/* ⚠️ Set apart from the digits by a gap — that gap is how a person tells which end to read from. */}
      <rect x={bodyEnd - 20} y="2" width="9" height="24" fill={tolerance.hex} />
    </svg>
  )
}

export type SmdFormat = "3-digit" | "4-digit" | "eia-96"

const SMD_COLOURS: Record<SmdFormat, { body: string; text: string; pad: string; sheen: string }> = {
  "3-digit": { body: "#252525", text: "#FFFFFF", pad: "#B8B8B8", sheen: "#E0E0E0" },
  "4-digit": { body: "#374F32", text: "#C8DEC4", pad: "#B8B8B8", sheen: "#E0E0E0" },
  "eia-96": { body: "#0D0D0D", text: "#F0D020", pad: "#909090", sheen: "#C0C0C0" },
}

/**
 * ⚠️ **A `null` code is drawn dimmed with a dash, never hidden.** "This value has no three-digit
 * marking" is a fact worth seeing beside the two that do — a missing chip reads as a rendering fault.
 */
export function SmdResistor({
  code,
  format,
  label,
  width = 140,
}: {
  code: string | null
  format: SmdFormat
  label?: string
  width?: number
}) {
  const colours = SMD_COLOURS[format]
  const shown = code ?? "–"
  const isDim = code === null
  const fontSize = shown.length <= 3 ? 20 : shown.length === 4 ? 17 : 14

  return (
    <span className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 140 70" width={width} height={(width / 140) * 70} role="img" aria-label={label ?? format}>
        <rect x="0" y="4" width="22" height="62" rx="3" fill={colours.pad} />
        <rect x="0" y="4" width="6" height="62" rx="3" fill={colours.sheen} opacity="0.55" />

        <rect x="17" y="4" width="106" height="62" rx="6" fill={colours.body} opacity={isDim ? 0.4 : 1} />
        <rect x="17" y="4" width="106" height="12" rx="6" fill="rgba(255,255,255,0.05)" />

        <rect x="118" y="4" width="22" height="62" rx="3" fill={colours.pad} />
        <rect x="134" y="4" width="6" height="62" rx="3" fill={colours.sheen} opacity="0.55" />

        <text
          x="70"
          y="36"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={isDim ? "#666" : colours.text}
          fontSize={isDim ? 13 : fontSize}
          fontFamily="monospace"
          fontWeight="700"
          letterSpacing="1.5"
        >
          {shown}
        </text>
      </svg>

      {label && <span className="text-[10px] text-muted-foreground">{label}</span>}
    </span>
  )
}

/**
 * A capacitor, drawn as whichever part it actually is.
 *
 * ⚠️ **The package follows the value, because that is what the world does.** Hundreds of microfarads is
 * an electrolytic can with a polarity stripe; a hundred nanofarads is a ceramic chip. Drawing one shape
 * for both would make the picture decorative — and the whole reason to draw a part is that its shape
 * carries information the number does not.
 */
export function CapacitorVisual({
  code,
  isElectrolytic,
  voltageRating,
  width = 140,
}: {
  code: string | null
  isElectrolytic: boolean
  voltageRating?: string | null
  width?: number
}) {
  const shown = code ?? "–"

  if (isElectrolytic) {
    return (
      <svg viewBox="0 0 140 90" width={width} height={(width / 140) * 90} role="img" aria-label="Electrolytic capacitor">
        <rect x="18" y="78" width="4" height="12" fill="#9E9E9E" />
        <rect x="118" y="78" width="4" height="12" fill="#9E9E9E" />

        <rect x="10" y="8" width="120" height="72" rx="10" fill="#1A237E" />
        <rect x="10" y="8" width="26" height="72" rx="10" fill="#E8EAF6" opacity="0.9" />
        {/* ⚠️ The polarity stripe is on the negative side and is the point of the drawing. */}
        <text x="23" y="48" textAnchor="middle" dominantBaseline="middle" fill="#1A237E" fontSize="22" fontWeight="700">
          −
        </text>
        <rect x="10" y="8" width="120" height="14" rx="10" fill="#FFFFFF" opacity="0.12" />

        <text
          x="85"
          y="38"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#FFFFFF"
          fontSize="18"
          fontFamily="monospace"
          fontWeight="700"
        >
          {shown}
        </text>
        {voltageRating && (
          <text
            x="85"
            y="60"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#C5CAE9"
            fontSize="13"
            fontFamily="monospace"
          >
            {voltageRating}
          </text>
        )}
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 140 70" width={width} height={(width / 140) * 70} role="img" aria-label="Ceramic capacitor">
      <rect x="0" y="4" width="22" height="62" rx="3" fill="#B8B8B8" />
      <rect x="118" y="4" width="22" height="62" rx="3" fill="#B8B8B8" />
      <rect x="17" y="4" width="106" height="62" rx="6" fill="#8D6E63" />
      <rect x="17" y="4" width="106" height="12" rx="6" fill="#FFFFFF" opacity="0.12" />
      <text
        x="70"
        y="36"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#FFF8E1"
        fontSize={shown.length <= 3 ? 20 : 16}
        fontFamily="monospace"
        fontWeight="700"
        letterSpacing="1.5"
      >
        {shown}
      </text>
    </svg>
  )
}
