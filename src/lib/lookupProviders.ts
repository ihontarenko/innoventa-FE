/**
 * Which distributors this installation can ask.
 *
 * ⚠️ **One list, because there were three.** The Lookup screen, the project screen and now the entry
 * dialog all offer the same providers; a fourth copy is how one of them comes to be missing a provider
 * somebody has paid for.
 *
 * ⚠️ **A provider with no API key configured fails at the first search**, not at startup, and the message
 * comes back from the backend. Hiding one that is not configured would need the browser to know the
 * installation's secrets, which is exactly what it must not.
 */
export const LOOKUP_PROVIDERS: Array<{ id: string; label: string }> = [
  { id: "mouser", label: "Mouser" },
  { id: "digikey", label: "DigiKey" },
]
