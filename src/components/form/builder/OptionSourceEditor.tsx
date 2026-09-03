import { Input, NativeSelect, Textarea } from "@jmouse/ui"
import {
  OPTION_SOURCE_KEYS,
  STATIC_OPTION_SOURCE,
  parameterKey,
  sourceParametersOf,
  type OptionParameter,
} from "@/api/optionSources"
import { useOptionPreview, useOptionSourceDescriptors } from "@/hooks/useOptionSources"

import type { useFieldDraft } from "./useFieldDraft"

/**
 * Where a field's choices come from, and the parameters of whichever provider draws them.
 *
 * ⚠️ **Built from what the server says, and from nothing else.** `/option-sources` returns each
 * provider with its parameters already typed, so this is a renderer over that answer rather than a
 * hand-written panel per provider. A provider added on the server appears here with working controls
 * and no frontend change at all — which is the whole reason the descriptor carries kinds.
 *
 * ⚠️ **An unknown kind falls back to a text box.** The server may add one before this file knows it, and
 * that must cost a plainer control rather than a parameter nobody can set.
 */
export function OptionSourceEditor({ editor }: { editor: ReturnType<typeof useFieldDraft> }) {
  const { draft, setConfig } = editor
  const { data: descriptors = [], isLoading } = useOptionSourceDescriptors()

  const source = draft.configs[OPTION_SOURCE_KEYS.SOURCE] || STATIC_OPTION_SOURCE
  const descriptor = descriptors.find((candidate) => candidate.code === source)
  const parameters = sourceParametersOf(draft.configs)

  // ⚠️ **The server offers `static` as a provider of its own**, so the fallback below is a fallback and
  // not a fixture — listing both put two options with the same value in the select, the browser picked
  // the first, and the panel then previewed the *server's* one and reported "0 choices" under seven
  // rows that were plainly there.
  const hasStaticDescriptor = descriptors.some((candidate) => candidate.code === STATIC_OPTION_SOURCE)

  // Previewed only for a real provider with everything required filled in — asking a source to resolve
  // half a configuration produces an error that says nothing useful, and asking the static one to
  // resolve anything is asking a question about rows this panel is sitting on top of.
  const isReady =
    !!descriptor &&
    source !== STATIC_OPTION_SOURCE &&
    descriptor.parameters.every((parameter) => !parameter.required || parameters[parameter.name])
  const { data: preview, isError: previewFailed } = useOptionPreview(source, parameters, isReady)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium">Where the choices come from</label>
        <NativeSelect
          value={source}
          onChange={(event) => {
            const next = event.target.value

            // ⚠️ Switching provider drops the old one's parameters. They are named per provider, so
            // leaving them behind would keep configuring a source nobody selected — and the raw editor
            // would show keys nothing reads.
            for (const name of Object.keys(parameters)) {
              setConfig(parameterKey(name), "")
            }

            setConfig(OPTION_SOURCE_KEYS.SOURCE, next === STATIC_OPTION_SOURCE ? "" : next)
          }}
        >
          {!hasStaticDescriptor && <option value={STATIC_OPTION_SOURCE}>Typed in here (static)</option>}
          {descriptors.map((candidate) => (
            <option key={candidate.code} value={candidate.code}>
              {candidate.label}
            </option>
          ))}
        </NativeSelect>

        {isLoading && <span className="text-xs text-muted-foreground">Loading the providers…</span>}
        {descriptor && <span className="text-xs text-muted-foreground">{descriptor.description}</span>}
      </div>

      {descriptor?.parameters.map((parameter) => (
        <ParameterControl
          key={parameter.name}
          parameter={parameter}
          value={parameters[parameter.name] ?? ""}
          onChange={(value) => setConfig(parameterKey(parameter.name), value)}
        />
      ))}

      {isReady && (
        <div className="rounded-md bg-muted/40 p-2 text-xs">
          {previewFailed ? (
            <span className="text-destructive">This configuration did not resolve. Check the parameters above.</span>
          ) : preview ? (
            <>
              <span className="text-muted-foreground">
                {preview.total} choice{preview.total === 1 ? "" : "s"}
                {preview.items.length > 0 ? " — for example:" : "."}
              </span>
              {preview.items.length > 0 && (
                <span className="mt-1 flex flex-wrap gap-1">
                  {preview.items.slice(0, 6).map((item) => (
                    <span key={item.value} className="rounded-full bg-background px-2 py-0.5">
                      {item.label}
                    </span>
                  ))}
                </span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">Checking what this offers…</span>
          )}
        </div>
      )}
    </div>
  )
}

/** One parameter, drawn as whatever kind the server said it is. */
function ParameterControl({
  parameter,
  value,
  onChange,
}: {
  parameter: OptionParameter
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium">
        {parameter.label}
        {parameter.required && (
          <span className="text-destructive" title="Required">
            ✱
          </span>
        )}
      </label>

      {/* ⚠️ **Two controls, and it used to be five.** Pick a form, then one of its fields, then a mode —
          each of those was a control the editor drew because a provider could not express the question
          any other way. They are all one expression now, so what is left is the expression box and the
          plain input every unknown kind degrades to. */}
      {parameter.kind === "EXPRESSION" ? (
        <Textarea
          rows={2}
          className="font-mono text-xs"
          placeholder="A jMouse expression"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          className="font-mono text-xs"
          placeholder={parameter.kind.toLowerCase()}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {parameter.hint && <span className="text-xs text-muted-foreground">{parameter.hint}</span>}
    </div>
  )
}
