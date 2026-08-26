/**
 * Who is on the other end of an address.
 *
 * ⚠️ **A control says where it goes, not what it is.** *Where to buy* over a truncated
 * `www.digikey.com/…/976369` is two pieces of chrome saying nothing between them; *Buy on digikey.com*
 * is the whole sentence, and it is the host that carries it — nobody recognises the path.
 *
 * ⚠️ **`www.` is dropped and nothing else is.** A subdomain that is not `www` is part of who this is —
 * `mm.digikey.com` and `digikey.com` are the same company, but `app.ultralibrarian.com` and
 * `ultralibrarian.com` need not be, and this is not the place to decide which.
 *
 * Answers `null` for anything that is not an absolute web address, so a caller can fall back to a
 * plain label rather than printing "null" at somebody.
 */
export function hostOf(address: string | null | undefined): string | null {
  if (!address) {
    return null
  }

  try {
    const { hostname, protocol } = new URL(address)

    if (protocol !== "http:" && protocol !== "https:") {
      return null
    }

    return hostname.replace(/^www\./i, "") || null
  } catch {
    return null
  }
}
