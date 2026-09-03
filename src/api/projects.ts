import { http } from "./http"
import type { Page } from "./forms"
/**
 * How well a project material is covered by what is actually held.
 *
 * ⚠️ Defined HERE rather than beside the live blocks that also report it: coverage is a fact about a
 * project, and the block is one of several things that read it.
 */
export type MaterialCoverageStatus = "COVERED" | "SHORTAGE" | "UNSOURCED" | "EXCLUDED"

export type ProjectStatus = "DESIGN" | "PROTOTYPE" | "PRODUCTION" | "COMPLETE" | "ARCHIVED" | "REPAIR"

export interface ProjectSummary {
  id: string
  name: string
  description: string | null
  status: ProjectStatus
  spaceId: string | null
  spaceName: string | null
  /** How many finished units this run is for — every line's `need` is read through it. */
  buildQuantity: number
  totalMaterialCount: number
  coveredMaterialCount: number
  shortageMaterialCount: number
  unsourcedMaterialCount: number
  createdAt: string
  updatedAt: string
}

/** One place a part sits, and how many of it are there. */
export interface PartPosition {
  entryId: string
  quantity: number | null
  locationId: string | null
  locationPath: string | null
}

/**
 * One line of a bill of materials.
 *
 * ⚠️ **A line names a PART, never a drawer.** It used to carry both — a catalogue part and one
 * inventory row said to fill it — and the second was the mistake: a part sits in as many places as it
 * likes, so pinning the line to one made coverage answer about a box. `positions` is every place the
 * part is, and `free` is all of them summed minus what other projects have claimed.
 *
 * ⚠️ **`need` is not `quantityRequired`.** The design says four per board; `need` is that times the
 * project's `buildQuantity`, which is the number the verdict is actually reached on.
 *
 * ⚠️ **`shortage` is the PART's deficit, not this line's.** Two lines naming one component are judged
 * together, so both print the same figure — which is right, because ordering for one of them alone
 * fixes neither. Where a part appears once, the two are the same number.
 */
export interface ProjectMaterial {
  id: string
  referenceDesignator: string | null
  componentDescription: string
  /** Per finished unit, as the design states it. */
  quantityRequired: number

  /** ⚠️ **Absent, not null**, on a line that names no part — `non_null` serialisation omits it. */
  catalogEntryId?: string | null
  catalogPartNumberCached?: string | null

  coverageStatus: MaterialCoverageStatus
  /** `quantityRequired` × the project's `buildQuantity`. */
  need: number
  /** Everything held of the part, minus other projects' claims. */
  free: number
  /** How much of the part this project has itself claimed. */
  reserved: number
  /** How many of the part the whole bill of materials is missing; `0` when nothing is. */
  shortage: number
  positions: PartPosition[]

  notes: string | null
  sortOrder: number
  excluded: boolean
}

/**
 * How many complete units are assemblable, and what caps it.
 *
 * ⚠️ **`limitingMaterialIds` is every line sitting at the ceiling, not just the first.** Fixing one of
 * three tied lines raises the number by nothing, and a screen naming only one sends somebody to order a
 * part that changes nothing. `alsoLimitingCount` is how many beyond the first.
 */
export interface ProjectBuildability {
  buildableQuantity: number
  limitingMaterialLabel: string | null
  limitingMaterialIds: string[]
  alsoLimitingCount: number
}

/**
 * One bill-of-materials line that wants the thing being asked about.
 *
 * ⚠️ **Finished projects come back marked, never hidden.** "Nobody wants this any more" and "the only
 * project that wanted it shipped last month" are different answers, and the second is the one somebody
 * needs before emptying a drawer.
 *
 * ⚠️ **`quantityPerUnit` and `buildQuantity` arrive separately rather than multiplied.** "Four each,
 * twenty boards" is what a person reads; a bare eighty hides which half to argue with.
 */
export interface ProjectUsage {
  projectId: string
  projectName: string
  stage: ProjectStatus
  live: boolean
  materialId: string
  reference: string | null
  description: string
  quantityPerUnit: number
  /** ⚠️ **Absent, not null**, on a line that names no part — `non_null` serialisation omits it. */
  catalogEntryId?: string | null
  buildQuantity: number
}

/** The projects that would notice if a place changed — grouped, because the question is about people's work. */
export interface ProjectDependant {
  projectId: string
  projectName: string
  stage: ProjectStatus
  live: boolean
  lineCount: number
  lines: ProjectUsage[]
}

/** What happened when a project's covered lines were taken off the shelf. */
export interface IssueResult {
  issuedLineCount: number
  skippedLineCount: number
  lines: {
    materialId: string
    referenceDesignator: string | null
    label: string
    catalogEntryId: string | null
    quantity: number
    positionEntryIds: string[]
  }[]
}

export interface ProjectDetail extends ProjectSummary {
  buildability: ProjectBuildability
  materials: ProjectMaterial[]
}

export interface ImportRowError {
  row: number
  column: string | null
  message: string
}

/** ⚠️ Partial success is the normal outcome: some rows land, some do not, and both are reported. */
export interface ImportResult<T> {
  items: T[]
  errors: ImportRowError[]
  skipped: number
  total: number
}

export const projectsApi = {
  list: (spaceId?: string, page = 0, size = 25) =>
    http.get<Page<ProjectSummary>>("/projects", {
      params: { ...(spaceId ? { spaceId } : {}), page, size, sort: "createdAt,desc" },
    }),

  get: (projectId: string) => http.get<ProjectDetail>(`/projects/${projectId}`),

  create: (payload: {
    name: string
    description?: string
    spaceId?: string
    status?: ProjectStatus
    buildQuantity?: number
  }) => http.post<ProjectDetail>("/projects", payload),

  update: (
    projectId: string,
    payload: Partial<{
      name: string
      description: string
      status: ProjectStatus
      buildQuantity: number
    }>,
  ) => http.put<ProjectDetail>(`/projects/${projectId}`, payload),

  delete: (projectId: string) => http.delete<void>(`/projects/${projectId}`),

  addMaterial: (
    projectId: string,
    payload: {
      referenceDesignator?: string
      componentDescription: string
      quantityRequired: number
      notes?: string
      sortOrder?: number
    },
  ) => http.post<ProjectMaterial>(`/projects/${projectId}/materials`, payload),

  updateMaterial: (
    projectId: string,
    materialId: string,
    payload: Partial<{
      referenceDesignator: string
      componentDescription: string
      quantityRequired: number
      notes: string
      sortOrder: number
    }>,
  ) => http.put<ProjectMaterial>(`/projects/${projectId}/materials/${materialId}`, payload),

  deleteMaterial: (projectId: string, materialId: string) =>
    http.delete<void>(`/projects/${projectId}/materials/${materialId}`),

  /** Take every fully covered line off the shelf, in one transaction. */
  issueCoveredLines: (projectId: string) =>
    http.post<IssueResult>(`/projects/${projectId}/issue`),

  /**
   * How much of each part every project in this workspace has claimed.
   *
   * ⚠️ **Filed under projects even though the caller is a stock screen**, because the rows are
   * projects' and so is the permission: somebody who cannot open the project list must not learn there
   * are projects from a stock table instead. A reader without it simply gets no reserved column.
   */
  reservations: (partIds: string[]) =>
    http.get<Record<string, number>>("/projects/reservations", { params: { partId: partIds } }),

  /**
   * Which projects want this — asked of a part, or of a box through the part it holds.
   *
   * ⚠️ **Neither named means an empty list, not everything.** "Show me every line in the workspace" is
   * the backlog screen's question and is asked there.
   */
  usage: (of: { catalogEntryId?: string; positionEntryId?: string }) =>
    http.get<ProjectUsage[]>("/projects/usage", { params: of }),

  /** Which projects would notice if a place changed — what to know before moving a cabinet. */
  dependants: (locationId: string, deep = true) =>
    http.get<ProjectDependant[]>("/projects/dependants", { params: { locationId, deep } }),

  /** Which part this line is. Where that part sits is stock's business, not the line's. */
  linkCatalogEntry: (projectId: string, materialId: string, catalogEntryId: string) =>
    http.post<ProjectMaterial>(`/projects/${projectId}/materials/${materialId}/catalog-entry`, { catalogEntryId }),

  unlinkCatalogEntry: (projectId: string, materialId: string) =>
    http.delete<ProjectMaterial>(`/projects/${projectId}/materials/${materialId}/catalog-entry`),

  importBom: (projectId: string, provider: string, file: File) => {
    const body = new FormData()

    body.append("file", file)

    return http.post<ImportResult<ProjectMaterial>>(`/projects/${projectId}/import/${provider}`, body)
  },

  /** ⚠️ An excluded line still exists — it is counted out of coverage, not deleted. */
  toggleExcluded: (projectId: string, materialId: string) =>
    http.patch<ProjectMaterial>(`/projects/${projectId}/materials/${materialId}/exclude`),

  reserveStock: (projectId: string, materialId: string, quantity: number) =>
    http.put<ProjectMaterial>(`/projects/${projectId}/materials/${materialId}/reservation`, { quantity }),

  releaseStock: (projectId: string, materialId: string) =>
    http.delete<ProjectMaterial>(`/projects/${projectId}/materials/${materialId}/reservation`),
}
