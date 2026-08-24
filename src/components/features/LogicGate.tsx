import { cn } from "@jmouse/ui"
import { ToggleChip } from "@/components/ToggleChip"
import { WidgetField, WidgetInputs, WidgetSelect } from "./WidgetKit"
import type { WidgetInputsProperties, WidgetProperties } from "./contract"

type GateType = "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR" | "XNOR"

const GATES: GateType[] = ["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR"]

function output(gate: GateType, a: number, b: number): number {
  switch (gate) {
    case "AND":
      return a & b
    case "OR":
      return a | b
    case "NOT":
      return a ? 0 : 1
    case "NAND":
      return a & b ? 0 : 1
    case "NOR":
      return a | b ? 0 : 1
    case "XOR":
      return a ^ b
    case "XNOR":
      return (a ^ b) ? 0 : 1
  }
}

/** ⚠️ Two rows for `NOT`, four for the rest — a one-input gate has no B column to enumerate. */
function truthTable(gate: GateType): Array<{ a: number; b: number; q: number }> {
  if (gate === "NOT") {
    return [0, 1].map((a) => ({ a, b: 0, q: output(gate, a, 0) }))
  }

  return [
    { a: 0, b: 0 },
    { a: 0, b: 1 },
    { a: 1, b: 0 },
    { a: 1, b: 1 },
  ].map(({ a, b }) => ({ a, b, q: output(gate, a, b) }))
}

/**
 * A logic gate, drawn and tabulated.
 *
 * ⚠️ **This survived the calculator cull because an expression cannot draw a truth table.** Ohm's law is
 * one formula and belongs in a jME field; the value here is the *shape* of the gate and the four rows
 * beside it, with the current one marked — which is a picture, not an arithmetic result.
 *
 * ⚠️ **The wire colours are theme tokens.** Unlike a resistor's bands, a schematic symbol has no colour
 * in the world; live and idle are a *reading* of the diagram, so they follow the palette.
 */
export function LogicGateWidget({ values }: WidgetProperties) {
  const gate = (values.gate_type ?? "AND") as GateType
  const a = values.input_a === "1" ? 1 : 0
  const b = values.input_b === "1" ? 1 : 0
  const q = output(gate, a, b)
  const hasTwoInputs = gate !== "NOT"

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <GateSymbol gate={gate} a={a} b={b} q={q} />

        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] tracking-[0.05em] text-muted-foreground uppercase">Output</span>
          <span
            className={cn(
              "font-mono text-3xl font-medium",
              q ? "text-[var(--primary)]" : "text-muted-foreground",
            )}
          >
            {q}
          </span>
          <span className="text-[11px] text-muted-foreground">{q ? "HIGH" : "LOW"}</span>
        </div>
      </div>

      <table className="w-fit text-xs">
        <thead>
          <tr className="border-b text-[10px] tracking-[0.05em] text-muted-foreground uppercase">
            <th className="px-3 py-1 font-medium">A</th>
            {hasTwoInputs && <th className="px-3 py-1 font-medium">B</th>}
            <th className="px-3 py-1 font-medium">Q</th>
          </tr>
        </thead>

        <tbody>
          {truthTable(gate).map((row) => {
            // ⚠️ The current row is marked, and that is what makes the table a *reading* of the diagram
            // rather than a reference somebody has to line up by eye.
            const isCurrent = row.a === a && (!hasTwoInputs || row.b === b)

            return (
              <tr key={`${row.a}-${row.b}`} className={cn("border-b last:border-b-0", isCurrent && "bg-accent")}>
                <td className="px-3 py-1 text-center font-mono">{row.a}</td>
                {hasTwoInputs && <td className="px-3 py-1 text-center font-mono">{row.b}</td>}
                <td className="px-3 py-1 text-center font-mono font-medium">{row.q}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function GateSymbol({ gate, a, b, q }: { gate: GateType; a: number; b: number; q: number }) {
  const hasTwoInputs = gate !== "NOT"
  const isInverted = gate === "NAND" || gate === "NOR" || gate === "NOT" || gate === "XNOR"
  const isXor = gate === "XOR" || gate === "XNOR"
  const isOrFamily = gate === "OR" || gate === "NOR" || isXor
  const isAndFamily = gate === "AND" || gate === "NAND"
  const isNot = gate === "NOT"

  const live = "var(--primary)"
  const idle = "var(--muted-foreground)"
  const wire = "var(--foreground)"
  const body = "var(--muted)"

  const colourA = a ? live : idle
  const colourB = b ? live : idle
  const colourQ = q ? live : idle

  const bodyEnd = isOrFamily ? 88 : 100
  const outputFrom = isInverted ? 114 : bodyEnd

  return (
    <svg viewBox="0 0 170 110" width={170} height={110} role="img" aria-label={`${gate} gate`}>
      <line
        x1="5"
        y1={hasTwoInputs ? 35 : 55}
        x2={isOrFamily ? 33 : 35}
        y2={hasTwoInputs ? 35 : 55}
        stroke={colourA}
        strokeWidth={2}
        strokeLinecap="round"
      />
      {hasTwoInputs && (
        <line x1="5" y1="75" x2={isOrFamily ? 33 : 35} y2="75" stroke={colourB} strokeWidth={2} strokeLinecap="round" />
      )}

      {isXor && (
        <path d="M26,22 C36,22 39,38 39,55 C39,72 36,88 26,88" fill="none" stroke={wire} strokeWidth={2} />
      )}

      {isAndFamily && (
        <path d="M35,22 L35,88 L68,88 Q100,88 100,55 Q100,22 68,22 Z" fill={body} stroke={wire} strokeWidth={2} />
      )}
      {isOrFamily && (
        <path
          d="M30,22 Q58,22 88,55 Q58,88 30,88 Q46,72 46,55 Q46,38 30,22 Z"
          fill={body}
          stroke={wire}
          strokeWidth={2}
        />
      )}
      {isNot && <path d="M35,22 L35,88 L100,55 Z" fill={body} stroke={wire} strokeWidth={2} />}

      {isInverted && <circle cx="107" cy="55" r="7" fill={body} stroke={wire} strokeWidth={2} />}

      <line x1={bodyEnd} y1="55" x2={isInverted ? 100 : outputFrom} y2="55" stroke={colourQ} strokeWidth={2} />
      <line x1={outputFrom} y1="55" x2="165" y2="55" stroke={colourQ} strokeWidth={2} strokeLinecap="round" />

      <text x="3" y={hasTwoInputs ? 32 : 52} fontSize={9} fontWeight="700" fill={colourA} fontFamily="monospace">
        A
      </text>
      {hasTwoInputs && (
        <text x="3" y="72" fontSize={9} fontWeight="700" fill={colourB} fontFamily="monospace">
          B
        </text>
      )}
      <text x="162" y="52" fontSize={9} fontWeight="700" textAnchor="end" fill={colourQ} fontFamily="monospace">
        Q
      </text>

      <circle cx={isOrFamily ? 33 : 35} cy={hasTwoInputs ? 35 : 55} r={3} fill={colourA} />
      {hasTwoInputs && <circle cx={isOrFamily ? 33 : 35} cy="75" r={3} fill={colourB} />}
      <circle cx="155" cy="55" r={3} fill={colourQ} />
    </svg>
  )
}

export function LogicGateInputs({ values, onChange }: WidgetInputsProperties) {
  const gate = (values.gate_type ?? "AND") as GateType

  return (
    <WidgetInputs>
      <WidgetField label="Gate">
        <WidgetSelect value={gate} onChange={(next) => onChange("gate_type", next)}>
          {GATES.map((one) => (
            <option key={one} value={one}>
              {one}
            </option>
          ))}
        </WidgetSelect>
      </WidgetField>

      {/* ⚠️ Chips rather than a number field: an input is one bit, and the whole point of this tool is
          flipping it and watching the diagram answer. */}
      <WidgetField label="Input A">
        <ToggleChip active={values.input_a === "1"} onClick={() => onChange("input_a", values.input_a === "1" ? "0" : "1")}>
          {values.input_a === "1" ? "1 · HIGH" : "0 · LOW"}
        </ToggleChip>
      </WidgetField>

      {gate !== "NOT" && (
        <WidgetField label="Input B">
          <ToggleChip
            active={values.input_b === "1"}
            onClick={() => onChange("input_b", values.input_b === "1" ? "0" : "1")}
          >
            {values.input_b === "1" ? "1 · HIGH" : "0 · LOW"}
          </ToggleChip>
        </WidgetField>
      )}
    </WidgetInputs>
  )
}
