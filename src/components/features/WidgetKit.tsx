import type { ReactNode } from "react"
import { Input, Textarea, cn } from "@jmouse/ui"
import { PlainSelect } from "@/components/access/PolicyEditingKit"

/**
 * The controls a feature's *configuration* panel is built from.
 *
 * ⚠️ **This file is what `widgetInputs.module.css` became**, and it is the one CSS module the port was
 * ever going to need. Nine classes turned out to be four components and a rule: a widget's inputs are a
 * wrapping row of labelled controls, and nothing else. Sixteen features writing their own inline styles
 * — which is what the old panels actually did — is how two calculators come to sit at different heights
 * on one screen.
 */

export function WidgetInputs({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-4">{children}</div>
}

/** One labelled control. ⚠️ The label is uppercase and quiet: it names a slot, it is not a question. */
export function WidgetField({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[10px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  )
}

/** A row inside one field — a number and its unit, a minimum and a maximum. */
export function WidgetRow({ children }: { children: ReactNode }) {
  return <span className="flex items-center gap-1.5">{children}</span>
}

export function WidgetNumber({
  value,
  onChange,
  placeholder,
  wide = false,
  step,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  wide?: boolean
  step?: string
}) {
  return (
    <Input
      type="number"
      step={step ?? "any"}
      className={cn("h-8 font-mono text-sm", wide ? "w-48" : "w-28")}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function WidgetText({
  value,
  onChange,
  placeholder,
  wide = false,
  mono = false,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  wide?: boolean
  mono?: boolean
}) {
  return (
    <Input
      className={cn("h-8 text-sm", wide ? "w-48" : "w-28", mono && "font-mono")}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function WidgetTextarea({
  value,
  onChange,
  rows = 4,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
}) {
  return (
    <Textarea
      rows={rows}
      className="min-w-64 flex-1 text-sm"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function WidgetSelect({
  value,
  onChange,
  children,
  wide = false,
}: {
  value: string
  onChange: (value: string) => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <PlainSelect value={value} onChange={onChange} className={cn("h-8 text-sm", wide ? "w-48" : "w-28")}>
      {children}
    </PlainSelect>
  )
}

/**
 * The answer a calculator exists to give.
 *
 * ⚠️ **One block, and it is the biggest thing on the widget.** A calculator that renders its result in
 * the same weight as its inputs makes the reader hunt for the number they came for — and every one of
 * these is opened for exactly one number.
 */
export function WidgetResult({ formula, value }: { formula: ReactNode; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border bg-muted/40 p-3">
      <span className="font-mono text-[11px] text-muted-foreground">{formula}</span>
      <span className="font-mono text-xl font-medium">{value}</span>
    </div>
  )
}

/** ⚠️ Said, not left blank. A widget with no inputs mapped looks broken; this says it is waiting. */
export function WidgetEmpty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">{children}</p>
}
