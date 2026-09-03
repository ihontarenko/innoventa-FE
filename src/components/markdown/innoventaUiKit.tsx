import {
  Button as ShadcnButton,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input as ShadcnInput,
  NativeSelect,
  Textarea as ShadcnTextarea,
} from "@jmouse/ui"
import type { MarkdownUiKit } from "@jmouse/markdown"

/**
 * The seven widgets `@jmouse/markdown` asks its host for, bound to Innoventa's own.
 *
 * <p>The library draws documents, not chrome: every modal it ships — the block palette, the link
 * dialog — is built out of these, so it inherits this application's buttons and modal behaviour rather
 * than shipping a second design system that slowly drifts from the first. Binding it is the whole cost
 * of adopting the editor, and it is this file.
 *
 * ⚠️ **The modal carries `innoventa-markdown`.** Every other library surface inherits the token bridge
 * from the editor it sits inside; a dialog does not, because shadcn portals its content to
 * `document.body` and leaves the subtree entirely. Without the class here, `dialogs.module.css` looks
 * up `--paper` and `--line` in a scope that has never heard of them — see `TesseraMarkdown.tsx`.
 *
 * ⚠️ **Plain `select` rather than shadcn's `Select`.** The library's contract is a value, a change
 * handler and a list of options; shadcn's is a Radix popover with a portal, a trigger and item
 * children. Wrapping the second in the first means a popover inside a dialog inside a portal, which is
 * exactly the stack that broke this application's menus under font-scale zoom and had to be replaced
 * with browser anchoring. A native select in a modal is the boring answer and the correct one — it is
 * three fields deep in a dialog nobody spends time in.
 */
export const INNOVENTA_MARKDOWN_UI: MarkdownUiKit = {
  Modal: ({ title, width, onClose, footer, tabBar, children }) => (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="innoventa-markdown" style={width ? { maxWidth: width } : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {tabBar}
        <div className="space-y-3">{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  ),

  Button: ({ variant, disabled, onClick, children, className }) => (
    <ShadcnButton
      size="sm"
      variant={variant === "ghost" ? "ghost" : "default"}
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {children}
    </ShadcnButton>
  ),

  Input: ({ value, onChange, placeholder, type, autoFocus, spellCheck, ariaLabel, className }) => (
    <ShadcnInput
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      type={type ?? "text"}
      autoFocus={autoFocus}
      spellCheck={spellCheck}
      aria-label={ariaLabel}
      className={className}
    />
  ),

  Select: ({ value, onChange, options }) => (
    <NativeSelect
      className="w-full"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </NativeSelect>
  ),

  Textarea: ({ value, onChange, rows, placeholder, spellCheck }) => (
    <ShadcnTextarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={rows}
      placeholder={placeholder}
      spellCheck={spellCheck}
    />
  ),

  // The library asks for a value and a list; a segmented row of buttons is that, and it avoids
  // Radix Tabs' own state machine fighting the caller's.
  Tabs: ({ value, onChange, tabs }) => (
    <div className="flex gap-1 border-b pb-2">
      {tabs.map((tab) => (
        <ShadcnButton
          key={tab.value}
          size="sm"
          variant={tab.value === value ? "secondary" : "ghost"}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </ShadcnButton>
      ))}
    </div>
  ),

  Field: ({ label, hint, children }) => (
    <label className="block space-y-1">
      <span className="flex items-baseline gap-2">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </label>
  ),
}
