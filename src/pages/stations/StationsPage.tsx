import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Alert, AlertDescription, Skeleton } from "@jmouse/ui"
import { StationShelf, openStation, type PwaStation } from "@jmouse/pwa"
import { PageHeader } from "@/components/PageHeader"
import { stationsApi, type OfferedStation } from "@/api/stations"
import { stations } from "@/stations"

/**
 * The shelf — where somebody picks which station to put on their home screen.
 *
 * <h2>⚠️ Two lists meet here, and neither is a copy of the other</h2>
 *
 * <p>The backend answers <em>which</em> stations this account is offered and where each works; this
 * interface holds <em>what</em> each one is, because its build had to write a manifest for it long
 * before anybody asked. They are joined by key, and a key present on one side only is dropped rather
 * than half-drawn: a station the server offers that this build does not carry has no address to open
 * and no manifest to install, and one built here that the server does not offer is not this account's
 * to see.
 *
 * <h2>⚠️ It is not laid out around an install button</h2>
 *
 * <p>On iOS there cannot be one — Safari installs only through Share → Add to Home Screen, and no
 * other iOS browser installs at all. Every tile therefore leads with Open, which always works, and the
 * offer to install is whatever the browser can actually manage beside it.
 */
export function StationsPage() {
  const offered = useQuery({
    queryKey: ["stations", "offered"],
    queryFn: () => stationsApi.offered().then((response) => response.data),
  })

  const answers = useMemo(
    () => new Map((offered.data?.stations ?? []).map((station) => [station.key, station])),
    [offered.data],
  )

  /**
   * ⚠️ **Both directions of the join are dropped silently, and that is right.** A key on one side only
   * is not an error anybody reading this screen can act on — it is a deployment where the two halves
   * are of different ages, which the system-settings footer is the place to notice.
   *
   * ⚠️ **Drawn in the SERVER's order, not this file's.** A craft may have put one station first — see
   * the `preferred` flag — and that ordering was decided against a list the permission gate had already
   * filtered. Iterating this interface's own list instead would silently throw the order away and leave
   * a "Suggested" badge on a tile in the middle.
   */
  const drawable: PwaStation[] = useMemo(
    () =>
      (offered.data?.stations ?? [])
        .map((answer) => stations.find((station) => station.key === answer.key))
        .filter((station): station is PwaStation => station !== undefined),
    [offered.data],
  )

  const preferredKey = offered.data?.stations.find((station) => station.preferred)?.key

  const refusals = useMemo(() => {
    const closed: Record<string, string> = {}

    for (const station of drawable) {
      const answer = answers.get(station.key) as OfferedStation

      if (answer.standing !== "PERMITTED") {
        // The refusing axis's own words, never a sentence composed here: "your plan does not include
        // this" and "ask an administrator" are two different next moves.
        closed[station.key] = answer.words ?? "This is not available to you here."
      }
    }

    return closed
  }, [drawable, answers])

  return (
    <>
      <PageHeader
        title="Stations"
        description="Install the part of Innoventa you actually work in, on the device you work on"
      />

      {offered.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : offered.isError ? (
        // ⚠️ An error and an empty installation look identical in `query.data`, so they are drawn
        // differently on purpose: the shelf's own empty state would tell somebody there is nothing for
        // them when in fact nobody asked.
        <Alert variant="destructive">
          <AlertDescription>
            The stations could not be loaded, so this is not a list of what you have — it is a list of
            nothing, because the question failed.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-4">
          <StationShelf
            stations={drawable}
            // The server has already decided, against modules this browser cannot see. Re-deciding
            // here would be a second opinion, and the day the two differ this is the one that is wrong.
            holds={() => true}
            refusals={refusals}
            preferredKey={preferredKey}
            onOpen={openStation}
            emptyMessage="There are no stations for you yet. They appear as the workspaces you belong to turn the matching parts of Innoventa on."
          />

          {/*
            ⚠️ Three awkward truths, said once and plainly rather than hidden in tooltips. Two are
            platform facts nobody can code around; the third is a deliberate trade.
          */}
          <div className="text-muted-foreground space-y-1 text-[11.5px] leading-relaxed">
            <p>
              On iPhone and iPad, open this page in Safari and use Share → Add to Home Screen. No other
              browser there can install anything.
            </p>
            <p>
              A station's home-screen icon keeps Innoventa's own colours. The mark in your browser tab
              follows the theme you picked; an installed icon is a file, drawn once when the interface
              was built.
            </p>
            <p>Stations share one update — updating any of them updates all of them.</p>
          </div>
        </div>
      )}
    </>
  )
}
