import { useParams } from "react-router-dom"
import { stations } from "@/stations"
import { StationChrome } from "@/pages/station/StationChrome"
import { ComponentsStation } from "@/pages/station/components/ComponentsStation"

/**
 * Which station this window is, and the screen that is it.
 *
 * ⚠️ **A dispatcher and nothing else.** Each station is its own screen with its own shape — the
 * frame they share is `StationChrome`, and putting anything a station does in here would be the first
 * step towards one screen with a switch in it, which is the desktop again.
 */
const SCREENS: Record<string, () => React.ReactElement> = {
  components: ComponentsStation,
}

export function StationPage() {
  const { stationKey } = useParams<{ stationKey: string }>()
  const station = stations.find((candidate) => candidate.key === stationKey)
  const Screen = stationKey ? SCREENS[stationKey] : undefined

  if (!station) {
    return (
      <StationChrome title="Unknown station">
        <p className="text-muted-foreground p-6 text-center text-[12.5px]">
          There is no station by that name.
        </p>
      </StationChrome>
    )
  }

  if (!Screen) {
    // A station this build carries a manifest for but no screen. Installable, and honest about it.
    return (
      <StationChrome title={station.name}>
        <p className="text-muted-foreground mx-auto max-w-xs p-6 text-center text-[12.5px] leading-relaxed">
          {station.description}
          <br />
          <br />
          This station is installable, and its screen is still being built.
        </p>
      </StationChrome>
    )
  }

  return <Screen />
}
