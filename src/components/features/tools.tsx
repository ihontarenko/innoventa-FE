import { useState } from "react"
import { Input, cn } from "@jmouse/ui"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { READING_DEBOUNCE_MILLISECONDS, useValueReadings } from "@/hooks/useParametric"
import { formatSI } from "@/lib/siFormat"
import { UnreadableValueNotice, ValueReadings } from "./ValueReadings"
import {
  WidgetEmpty,
  WidgetField,
  WidgetInputs,
  WidgetNumber,
  WidgetResult,
  WidgetSelect,
  WidgetText,
} from "./WidgetKit"
import { CAPACITANCE_UNIT_FACTORS, INDUCTANCE_UNIT_FACTORS, parsePositive } from "./shared"
import type { WidgetInputsProperties, WidgetProperties } from "./contract"

/**
 * The standalone tools that survived the cull.
 *
 * ⚠️ **Everything here does something an expression cannot.** The one-formula calculators went because
 * a jME field computes any of them without a release (Ivan, 2026-08-19); an LC tank is four coupled
 * results from one pair of inputs, a wire chart is a table, and a code converter is a *view of the
 * interpreter*. None of those is a formula somebody would type into a field.
 */

// ── LC resonance ─────────────────────────────────────────────────────────────

const SPEED_OF_LIGHT = 3e8

export function LcResonantWidget({ values }: WidgetProperties) {
  const inductanceRaw = parsePositive(values.inductance)
  const capacitanceRaw = parsePositive(values.capacitance)

  const inductanceFactor = INDUCTANCE_UNIT_FACTORS[values.inductance_unit ?? "mH"] ?? 1e-3
  const capacitanceFactor = CAPACITANCE_UNIT_FACTORS[values.capacitance_unit ?? "nF"] ?? 1e-9

  const inductance = inductanceRaw !== null ? inductanceRaw * inductanceFactor : null
  const capacitance = capacitanceRaw !== null ? capacitanceRaw * capacitanceFactor : null

  if (inductance === null || capacitance === null) {
    return <WidgetEmpty>Give an L and a C to get a resonant frequency.</WidgetEmpty>
  }

  const omega = 1 / Math.sqrt(inductance * capacitance)
  const frequency = omega / (2 * Math.PI)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <WidgetResult formula="f₀ = 1 / 2π√LC" value={formatSI(frequency, "Hz")} />
        <WidgetResult formula="ω₀ = 1 / √LC" value={formatSI(omega, "rad/s")} />
      </div>

      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Readout
          label="Reactance at resonance"
          value={formatSI(omega * inductance, "Ω")}
          note="Xʟ = X꜀ = ω₀L"
        />
        <Readout
          label="Wavelength"
          value={formatSI(SPEED_OF_LIGHT / frequency, "m")}
          // ⚠️ "in air" is not a footnote — in a cable it is shorter by the velocity factor, and
          // somebody cutting a stub to this number would cut it long.
          note="λ = c / f₀, in air"
        />
        <Readout label="Period" value={formatSI(1 / frequency, "s")} note="T = 1 / f₀" />
        <Readout
          label="Characteristic impedance"
          value={formatSI(Math.sqrt(inductance / capacitance), "Ω")}
          note="√(L/C)"
        />
      </dl>
    </div>
  )
}

function Readout({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border p-2.5">
      <dt className="text-[10px] tracking-[0.05em] text-muted-foreground uppercase">{label}</dt>
      <dd className="font-mono text-sm font-medium">{value}</dd>
      <dd className="font-mono text-[10px] text-muted-foreground">{note}</dd>
    </div>
  )
}

export function LcResonantInputs({ values, onChange }: WidgetInputsProperties) {
  return (
    <WidgetInputs>
      <WidgetField label="Inductance">
        <span className="flex gap-1.5">
          <WidgetNumber value={values.inductance ?? ""} onChange={(next) => onChange("inductance", next)} />
          <WidgetSelect
            value={values.inductance_unit ?? "mH"}
            onChange={(next) => onChange("inductance_unit", next)}
          >
            {Object.keys(INDUCTANCE_UNIT_FACTORS).map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </WidgetSelect>
        </span>
      </WidgetField>

      <WidgetField label="Capacitance">
        <span className="flex gap-1.5">
          <WidgetNumber value={values.capacitance ?? ""} onChange={(next) => onChange("capacitance", next)} />
          <WidgetSelect
            value={values.capacitance_unit ?? "nF"}
            onChange={(next) => onChange("capacitance_unit", next)}
          >
            {Object.keys(CAPACITANCE_UNIT_FACTORS).map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </WidgetSelect>
        </span>
      </WidgetField>
    </WidgetInputs>
  )
}

// ── AWG wire guide ───────────────────────────────────────────────────────────

interface AwgRow {
  awg: string
  diameter: number
  area: number
  /** mΩ per metre, copper at 20 °C. */
  resistance: number
  chassisAmps: number
  /** ⚠️ `null` below AWG 32 — the NEC table simply does not go there, which is not the same as zero. */
  powerAmps: number | null
}

const AWG_TABLE: AwgRow[] = [
  { awg: "4/0", diameter: 11.684, area: 107.22, resistance: 0.161, chassisAmps: 260, powerAmps: 230 },
  { awg: "3/0", diameter: 10.405, area: 85.01, resistance: 0.203, chassisAmps: 225, powerAmps: 200 },
  { awg: "2/0", diameter: 9.266, area: 67.43, resistance: 0.256, chassisAmps: 195, powerAmps: 175 },
  { awg: "1/0", diameter: 8.251, area: 53.47, resistance: 0.322, chassisAmps: 170, powerAmps: 150 },
  { awg: "1", diameter: 7.348, area: 42.41, resistance: 0.407, chassisAmps: 150, powerAmps: 130 },
  { awg: "2", diameter: 6.544, area: 33.63, resistance: 0.513, chassisAmps: 130, powerAmps: 115 },
  { awg: "3", diameter: 5.827, area: 26.67, resistance: 0.647, chassisAmps: 110, powerAmps: 100 },
  { awg: "4", diameter: 5.189, area: 21.15, resistance: 0.815, chassisAmps: 90, powerAmps: 85 },
  { awg: "6", diameter: 4.115, area: 13.3, resistance: 1.296, chassisAmps: 60, powerAmps: 65 },
  { awg: "8", diameter: 3.264, area: 8.366, resistance: 2.061, chassisAmps: 40, powerAmps: 50 },
  { awg: "10", diameter: 2.588, area: 5.261, resistance: 3.277, chassisAmps: 25, powerAmps: 30 },
  { awg: "12", diameter: 2.053, area: 3.309, resistance: 5.211, chassisAmps: 17, powerAmps: 20 },
  { awg: "14", diameter: 1.628, area: 2.081, resistance: 8.286, chassisAmps: 11, powerAmps: 15 },
  { awg: "16", diameter: 1.291, area: 1.309, resistance: 13.17, chassisAmps: 7.5, powerAmps: 13 },
  { awg: "18", diameter: 1.024, area: 0.823, resistance: 20.95, chassisAmps: 5, powerAmps: 7 },
  { awg: "20", diameter: 0.812, area: 0.518, resistance: 33.31, chassisAmps: 3.5, powerAmps: 5 },
  { awg: "22", diameter: 0.644, area: 0.326, resistance: 52.96, chassisAmps: 2, powerAmps: 3 },
  { awg: "24", diameter: 0.511, area: 0.205, resistance: 84.22, chassisAmps: 1.2, powerAmps: 1.5 },
  { awg: "26", diameter: 0.405, area: 0.129, resistance: 133.9, chassisAmps: 0.75, powerAmps: 0.9 },
  { awg: "28", diameter: 0.321, area: 0.081, resistance: 212.9, chassisAmps: 0.5, powerAmps: 0.5 },
  { awg: "30", diameter: 0.255, area: 0.051, resistance: 338.6, chassisAmps: 0.3, powerAmps: 0.3 },
  { awg: "32", diameter: 0.202, area: 0.032, resistance: 538.3, chassisAmps: 0.18, powerAmps: null },
  { awg: "34", diameter: 0.16, area: 0.0201, resistance: 856.0, chassisAmps: 0.11, powerAmps: null },
  { awg: "36", diameter: 0.127, area: 0.0127, resistance: 1361, chassisAmps: 0.07, powerAmps: null },
  { awg: "38", diameter: 0.101, area: 0.00797, resistance: 2164, chassisAmps: 0.04, powerAmps: null },
  { awg: "40", diameter: 0.0799, area: 0.00501, resistance: 3441, chassisAmps: 0.025, powerAmps: null },
]

function formatResistance(milliOhmsPerMetre: number): string {
  return milliOhmsPerMetre >= 1000
    ? `${(milliOhmsPerMetre / 1000).toFixed(3)} Ω/m`
    : `${milliOhmsPerMetre.toFixed(3)} mΩ/m`
}

function formatArea(squareMillimetres: number): string {
  if (squareMillimetres < 0.001) {
    return `${(squareMillimetres * 1000).toFixed(4)} mm²`
  }

  const places = squareMillimetres < 0.1 ? 4 : squareMillimetres < 1 ? 3 : 2

  return `${squareMillimetres.toFixed(places)} mm²`
}

/**
 * ⚠️ **Two current ratings, and they are not alternatives.** *Chassis* is a single wire in free air;
 * *power* is the NEC figure for a wire in a bundle or conduit, which is several times lower. A tool
 * showing one number would let somebody size a loom off the free-air rating.
 *
 * ⚠️ **Searching by mm² *sorts* rather than filters.** Somebody who has a cross-section wants the two
 * gauges either side of it, not a list of nothing when their number falls between.
 */
export function AwgWireWidget({ values }: WidgetProperties) {
  const [byArea, setByArea] = useState("")

  const selected = AWG_TABLE.find((row) => row.awg === (values.awg ?? "22")) ?? AWG_TABLE[16]

  const target = Number.parseFloat(byArea)
  const rows =
    byArea.trim() !== "" && !Number.isNaN(target) && target > 0
      ? [...AWG_TABLE].sort((left, right) => Math.abs(left.area - target) - Math.abs(right.area - target))
      : AWG_TABLE

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <span className="font-mono text-lg font-medium">AWG {selected.awg}</span>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <Readout label="Diameter" value={`${selected.diameter.toFixed(3)} mm`} note="bare conductor" />
          <Readout label="Cross-section" value={formatArea(selected.area)} note="" />
          <Readout label="Resistance" value={formatResistance(selected.resistance)} note="copper at 20 °C" />
          <Readout label="Max current" value={`${selected.chassisAmps} A`} note="chassis, free air" />
          <Readout
            label="Max current"
            value={selected.powerAmps !== null ? `${selected.powerAmps} A` : "—"}
            note="NEC 60 °C, in conduit"
          />
        </dl>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[10px] tracking-[0.05em] text-muted-foreground uppercase">All gauges</span>
        <Input
          type="number"
          step="any"
          min={0}
          className="ml-auto h-8 w-36 font-mono text-sm"
          placeholder="Find by mm²"
          value={byArea}
          onChange={(event) => setByArea(event.target.value)}
        />
      </div>

      <div className="max-h-72 overflow-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr className="text-[10px] tracking-[0.05em] text-muted-foreground uppercase">
              <th className="px-2 py-1 text-left font-medium">AWG</th>
              <th className="px-2 py-1 text-right font-medium">Dia mm</th>
              <th className="px-2 py-1 text-right font-medium">Area</th>
              <th className="px-2 py-1 text-right font-medium">Resistance</th>
              <th className="px-2 py-1 text-right font-medium">Chassis A</th>
              <th className="px-2 py-1 text-right font-medium">Power A</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.awg}
                className={cn("border-b font-mono last:border-b-0", row.awg === selected.awg && "bg-accent")}
              >
                <td className="px-2 py-1 font-medium">{row.awg}</td>
                <td className="px-2 py-1 text-right">{row.diameter.toFixed(3)}</td>
                <td className="px-2 py-1 text-right">{formatArea(row.area)}</td>
                <td className="px-2 py-1 text-right">{formatResistance(row.resistance)}</td>
                <td className="px-2 py-1 text-right">{row.chassisAmps}</td>
                <td className="px-2 py-1 text-right">{row.powerAmps ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function AwgWireInputs({ values, onChange }: WidgetInputsProperties) {
  return (
    <WidgetInputs>
      <WidgetField label="Gauge">
        <WidgetSelect value={values.awg ?? "22"} onChange={(next) => onChange("awg", next)}>
          {AWG_TABLE.map((row) => (
            <option key={row.awg} value={row.awg}>
              AWG {row.awg}
            </option>
          ))}
        </WidgetSelect>
      </WidgetField>
    </WidgetInputs>
  )
}

// ── Component code converter ─────────────────────────────────────────────────

/**
 * What a marking means, in every form that value takes — **as a view of the one interpreter**.
 *
 * ⚠️ **It used to carry its own tables, and it gained by losing them.** The old widget had an
 * `interpretInput` built on a second set of SMD, EIA-96 and picofarad tables that nothing kept in step
 * with the Java ones on the write path. Those are gone (ADR-0009), and now every dimension the
 * normaliser knows arrives here — along with E-series membership and the standard values nearby, none of
 * which it could ever have said before.
 */
export function ComponentCodeConverterWidget({ values }: WidgetProperties) {
  const typed = (values.query ?? "").trim()
  const settled = useDebouncedValue(typed, READING_DEBOUNCE_MILLISECONDS)

  const { data: readings, isFetching } = useValueReadings(settled, settled.length > 0)

  if (typed === "") {
    return <WidgetEmpty>Type a code or a value above — `472`, `4k7`, `104`, `10nF`.</WidgetEmpty>
  }

  const isUnreadable = settled.length > 0 && readings !== undefined && readings.length === 0

  return (
    <div className="flex flex-col gap-2">
      {isFetching && <span className="text-xs text-muted-foreground">Reading…</span>}
      {isUnreadable && <UnreadableValueNotice value={settled} />}
      {readings && <ValueReadings readings={readings} />}
    </div>
  )
}

export function ComponentCodeConverterInputs({ values, onChange }: WidgetInputsProperties) {
  return (
    <WidgetInputs>
      <WidgetField label="Code or value" hint="Whatever is printed on the part, or what you want it to be.">
        <WidgetText wide mono value={values.query ?? ""} placeholder="472" onChange={(next) => onChange("query", next)} />
      </WidgetField>
    </WidgetInputs>
  )
}
