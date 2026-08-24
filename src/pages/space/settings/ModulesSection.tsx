import { Badge, Row, RowGroup, RowList, RowMeta, RowTitle, Skeleton, Switch } from "@jmouse/ui"
import { useSetSpaceModule, useSpaceModules } from "@/hooks/useSpaceSettings"
import { useSpaceNavigation } from "@/hooks/useSpaces"
import { hiddenItemKeysIn, spaceScope, useNavigationPreferencesStore } from "@/stores/navigationPreferencesStore"
import type { SpaceModule } from "@/api/entitlements"
import { Section, type SpaceSettingsContext } from "./SpaceSettingsSection"

/**
 * What this workspace has, and who sees it — one screen carrying both answers per item.
 *
 * ⚠️ **Two switches per row, and the screen has to say which is which.** *Everyone here* is the
 * workspace's decision and closes an endpoint; *You* is one reader's own sidebar and closes nothing. The
 * two used to be separate tabs with one vocabulary and opposite scopes, and nothing anywhere said so —
 * which is how somebody hid an item for themselves believing they had switched it off for the team.
 *
 * ⚠️ **Three fates, and only one of them is a pair of controls.** An item the workspace decides is a
 * row. A module the menu never names is infrastructure, and a module the plan or an administrator
 * refuses is not this workspace's to have; both are said underneath, in sentences, and neither imitates
 * a switch.
 *
 * ⚠️ **Every reader sees the same screen.** Somebody who may not decide gets the left switch disabled
 * rather than absent — being told what a workspace is set to is not the same power as setting it. The
 * right one is theirs whatever their standing.
 */
export function ModulesSection({ space, isAdmin }: SpaceSettingsContext) {
  const { data: modules = [], isLoading: modulesLoading } = useSpaceModules(space.id)
  const { data: navigation, isLoading: navigationLoading } = useSpaceNavigation(space.id)

  const preferences = useNavigationPreferencesStore((state) => state.preferences)
  const toggleItem = useNavigationPreferencesStore((state) => state.toggleItem)

  const setModule = useSetSpaceModule()

  // ⚠️ Both, because a row carries an answer from each. Painting the workspace's decision while the
  // served menu is still in flight would show every personal switch as "nothing to hide" and then flip
  // them a moment later, which reads as the screen correcting itself.
  if (modulesLoading || navigationLoading) {
    return (
      <Section title="Sections" hint={subjectAreaHint(space.subjectAreaLabel)}>
        <Skeleton className="h-64 w-full" />
      </Section>
    )
  }

  const scope = spaceScope(space.id)
  const hidden = hiddenItemKeysIn(preferences, scope)

  /**
   * ⚠️ **Which items the workspace actually serves.** A module switched on whose item the menu never
   * names has nothing for a personal switch to hide, and offering one would be a control over an item
   * that is not in anybody's sidebar.
   */
  const servedItemKeys = new Set((navigation?.sections ?? []).flatMap((section) => section.items.map((item) => item.key)))

  const switchable = modules.filter((module) => module.switchable && isAvailable(module))
  const infrastructure = modules.filter((module) => !module.switchable && isAvailable(module))
  const denied = modules.filter((module) => !isAvailable(module))

  const shownToMe = switchable.filter((module) => module.enabled && !hidden.includes(module.key)).length

  return (
    <Section title="Sections" hint={subjectAreaHint(space.subjectAreaLabel)}>
      <RowGroup
        label="This workspace decides · and you"
        tally={`${shownToMe} of ${switchable.length} in your sidebar`}
      >
        {/* The legend, once, above the column — not a heading per row. */}
        <div className="flex items-center gap-2 px-2.5 pb-0.5 text-[11px] text-muted-foreground">
          <span className="ml-auto w-24 text-center">Everyone here</span>
          <span className="w-16 text-center">You</span>
        </div>

        <RowList variant="carded">
          {switchable.map((module) => {
            const served = servedItemKeys.has(module.key)

            return (
              <Row
                key={module.key}
                variant="carded"
                trailing={
                  <>
                    <span className="flex w-24 justify-center">
                      <Switch
                        checked={module.enabled}
                        disabled={!isAdmin || setModule.isPending}
                        onCheckedChange={(enabled) =>
                          setModule.mutate({ spaceId: space.id, moduleKey: module.key, enabled, forced: module.forced })
                        }
                      />
                    </span>

                    <span className="flex w-16 justify-center">
                      {/* ⚠️ Absent, not disabled, where the workspace has switched the item off: there is
                          nothing in anybody's sidebar for a personal preference to be about, and a
                          greyed switch there would invite the reading that hiding is what turned it
                          off. */}
                      {module.enabled && served ? (
                        <Switch checked={!hidden.includes(module.key)} onCheckedChange={() => toggleItem(scope, module.key)} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </span>
                  </>
                }
              >
                <RowTitle>{module.name}</RowTitle>
                {module.readsThrough.length > 0 && (
                  <RowMeta>
                    Reads through {module.readsThrough.join(", ")} — switching it off takes the item out of the menu and
                    refuses nothing.
                  </RowMeta>
                )}
              </Row>
            )
          })}

          {switchable.length === 0 && (
            <p className="rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground">
              Nothing here is this workspace's to switch.
            </p>
          )}
        </RowList>
      </RowGroup>

      {infrastructure.length > 0 && (
        <RowGroup label="Always on" tally="other screens run on these">
          <div className="flex flex-wrap gap-1">
            {infrastructure.map((module) => (
              <Badge key={module.key} variant="secondary">
                {module.name}
              </Badge>
            ))}
          </div>
        </RowGroup>
      )}

      {denied.length > 0 && (
        <RowGroup label="Not available here" tally="the plan, or somebody governing this installation">
          <RowList>
            {denied.map((module) => (
              <Row key={module.key} tone="muted">
                <RowTitle>{module.name}</RowTitle>
                <RowMeta>{module.entitlement?.words ?? module.entitlement?.reason ?? "not included"}</RowMeta>
              </Row>
            ))}
          </RowList>
        </RowGroup>
      )}
    </Section>
  )
}

/** Granted, or free — either way there is nothing standing between this workspace and the module. */
function isAvailable(module: SpaceModule): boolean {
  return module.entitlement === null || module.entitlement.granted || module.entitlement.verdict === "FREE"
}

/**
 * The ceiling, said once about the whole screen.
 *
 * It is the only place the first axis belongs here: a module another kind of workspace counts is absent
 * from this list rather than greyed out on it, so there is no row for it to be said on.
 */
function subjectAreaHint(subjectAreaLabel: string): string {
  return `What a workspace that counts ${subjectAreaLabel.toLowerCase()} has, and who sees it`
}
