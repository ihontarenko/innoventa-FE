import { useState } from "react"
import { SegmentedControl } from "@/components/SegmentedControl"
import { useValueReadings } from "@/hooks/useParametric"
import { formatSI } from "@/lib/siFormat"
import { AxialResistor, CapacitorVisual, SmdResistor } from "./ComponentVisuals"
import { WidgetEmpty, WidgetField, WidgetInputs, WidgetSelect, WidgetText } from "./WidgetKit"
import { decode4Band, parseTolerance } from "./resistorBands"
import { parsePipeDisplay, spellingTextFor, writtenValueFrom } from "./shared"
import type { WidgetInputsProperties, WidgetProperties } from "./contract"

/**
 * The two widgets that draw a *stored value* as the part it is.
 *
 * ⚠️ **Neither of them reads the text. That is the whole point.** Under ADR-0009 there is one interpreter
 * of written values — `GET /api/parametric/readings` — and it is not in the browser. These widgets send
 * the field's text off, take back the readings, and draw. A widget with its own parser is precisely how
 * one comes to disagree with the search over what `4k7` is worth, and both look right.
 *
 * ⚠️ **What they *do* compute is arithmetic on a number they already have** — a tolerance band's edges,
 * a digit's colour. Those need no interpretation, and a round trip for them would be absurd.
 */

// ── Resistor colour code ─────────────────────────────────────────────────────

const BAND_ROLES = ["1st digit", "2nd digit", "Multiplier", "Tolerance"]

function formatMultiplier(multiplier: number | null): string {
  if (multiplier === null) {
    return "?"
  }

  return multiplier >= 1 ? `×${multiplier.toLocaleString()}` : `×${multiplier}`
}

export function ResistorColorCodeWidget({ values }: WidgetProperties) {
  const written = writtenValueFrom(values.resistance, values.unit)
  const { data: readings, isPending } = useValueReadings(written, written !== "")

  // ⚠️ The first reading, always. The resistance field holds a *value*; second-guessing it as a marking
  // is what the readings list is for on a screen that asks the question.
  const reading = readings?.[0]
  const ohms = reading?.value.baseValue ?? null
  const tolerance = parseTolerance(values.tolerance)
  const bands = ohms === null ? null : decode4Band(ohms)

  // ⚠️ A reading in flight is not a missing mapping, and must not be reported as one.
  if (written !== "" && isPending) {
    return <WidgetEmpty>Reading the resistance…</WidgetEmpty>
  }

  if (ohms === null || bands === null) {
    return <WidgetEmpty>No resistance to decode. Map the resistance field on the component type.</WidgetEmpty>
  }

  const all = [bands.band1, bands.band2, bands.band3, tolerance.color]
  const bandValues = [
    String(bands.digit1),
    String(bands.digit2),
    formatMultiplier(bands.band3.multiplier),
    tolerance.color.tolerance ?? `±${tolerance.percentage}%`,
  ]

  const fraction = tolerance.percentage / 100

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-4">
        <span className="flex flex-col items-center gap-1">
          <AxialResistor bands={all} />
          <span className="text-[10px] text-muted-foreground">Through-hole / axial</span>
        </span>

        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] tracking-[0.05em] text-muted-foreground uppercase">Resistance</span>
          <span className="font-mono text-xl font-medium">
            {reading?.value.normalizedDisplay ?? formatSI(ohms, "Ω")}
          </span>
          <span className="text-xs text-muted-foreground">
            {tolerance.color.tolerance ?? `±${tolerance.percentage}%`} ({tolerance.color.name})
          </span>
          {/* ⚠️ The band edges are this widget's own arithmetic, so this widget renders them. */}
          <span className="font-mono text-xs text-muted-foreground">
            {formatSI(Math.round(ohms * (1 - fraction)), "Ω")} – {formatSI(Math.round(ohms * (1 + fraction)), "Ω")}
          </span>
        </div>

        <dl className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-x-2 gap-y-1 text-xs">
          {all.map((band, index) => (
            <div key={index} className="contents">
              <span
                aria-hidden="true"
                className="size-3 rounded-sm border"
                style={{ background: band.hex }}
              />
              <dt className="text-muted-foreground">{BAND_ROLES[index]}</dt>
              <dd>{band.name}</dd>
              <dd className="font-mono text-muted-foreground">{bandValues[index]}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] tracking-[0.05em] text-muted-foreground uppercase">SMD / chip</span>
        <div className="flex flex-wrap gap-3">
          <SmdResistor code={spellingTextFor(reading, "SMD_THREE_DIGIT")} format="3-digit" label="3-digit" width={110} />
          <SmdResistor code={spellingTextFor(reading, "SMD_FOUR_DIGIT")} format="4-digit" label="4-digit" width={110} />
          <SmdResistor code={spellingTextFor(reading, "EIA_96")} format="eia-96" label="EIA-96" width={110} />
        </div>
      </div>
    </div>
  )
}

export function ResistorColorCodeInputs({ values, onChange }: WidgetInputsProperties) {
  return (
    <WidgetInputs>
      <WidgetField label="Resistance" hint="Written however you like — 4700, 4k7, 4.7k.">
        <WidgetText mono value={values.resistance ?? ""} onChange={(next) => onChange("resistance", next)} />
      </WidgetField>

      <WidgetField label="Unit" hint="Only used when the value is a bare number.">
        <WidgetSelect value={values.unit ?? "Ω"} onChange={(next) => onChange("unit", next)}>
          {["Ω", "kΩ", "MΩ", "mΩ"].map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </WidgetSelect>
      </WidgetField>

      <WidgetField label="Tolerance">
        <WidgetSelect value={values.tolerance ?? "5%"} onChange={(next) => onChange("tolerance", next)}>
          {["0.05%", "0.1%", "0.25%", "0.5%", "1%", "2%", "5%", "10%"].map((one) => (
            <option key={one} value={one}>
              ±{one}
            </option>
          ))}
        </WidgetSelect>
      </WidgetField>
    </WidgetInputs>
  )
}

// ── Capacitor ────────────────────────────────────────────────────────────────

type CapacitorKind = "electrolytic" | "ceramic"

/**
 * ⚠️ **The reading is asked for only in ceramic mode.** An electrolytic can prints the capacitance as
 * written and needs no interpretation; asking anyway would be a request per render for a string already
 * in hand.
 */
export function CapacitorVisualWidget({ values }: WidgetProperties) {
  const [kind, setKind] = useState<CapacitorKind>("electrolytic")

  const capacitance = parsePipeDisplay(values.capacitance)
  const voltageRating = parsePipeDisplay(values.voltage_rating)

  // One input, which already carries its own unit — there is no separate unit field to join on.
  const written = writtenValueFrom(values.capacitance)
  const { data: readings } = useValueReadings(written, written !== "" && kind === "ceramic")

  if (capacitance === "—") {
    return <WidgetEmpty>No capacitance is mapped to this widget yet.</WidgetEmpty>
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <SegmentedControl
        ariaLabel="Package"
        value={kind}
        onChange={setKind}
        segments={[
          { value: "electrolytic", label: "Electrolytic" },
          { value: "ceramic", label: "Ceramic disc" },
        ]}
      />

      <CapacitorVisual
        isElectrolytic={kind === "electrolytic"}
        code={kind === "electrolytic" ? capacitance : spellingTextFor(readings?.[0], "CAPACITOR_PICOFARAD")}
        voltageRating={voltageRating === "—" ? null : voltageRating}
      />

      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 text-xs">
        <dt className="text-muted-foreground">Capacitance</dt>
        <dd className="font-mono">{capacitance}</dd>
        {voltageRating !== "—" && (
          <>
            <dt className="text-muted-foreground">Rated</dt>
            <dd className="font-mono">{voltageRating}</dd>
          </>
        )}
      </dl>
    </div>
  )
}

export function CapacitorVisualInputs({ values, onChange }: WidgetInputsProperties) {
  return (
    <WidgetInputs>
      <WidgetField label="Capacitance" hint="With its unit — 100µF, 100n, 0.1uF.">
        <WidgetText mono value={values.capacitance ?? ""} onChange={(next) => onChange("capacitance", next)} />
      </WidgetField>

      <WidgetField label="Voltage rating">
        <WidgetText mono value={values.voltage_rating ?? ""} onChange={(next) => onChange("voltage_rating", next)} />
      </WidgetField>
    </WidgetInputs>
  )
}
