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
  totalMaterialCount: number
  coveredMaterialCount: number
  shortageMaterialCount: number
  unsourcedMaterialCount: number
  createdAt: string
  updatedAt: string
}

/**
 * One line of a bill of materials.
 *
 * ⚠️ **Three separate facts, and conflating any two of them is the classic mistake here.** *What* the
 * line is (`catalogEntryId` — a catalogue part), *which stock fills it* (`stockEntryId` — a drawer), and
 * *how much of that stock this project has claimed* (`reservedQuantity`). A line can name a part with no
 * stock behind it, or sit on stock nobody has catalogued.
 */
export interface ProjectMaterial {
  id: string
  referenceDesignator: string | null
  componentDescription: string
  quantityRequired: number

  stockEntryId: string | null
  stockEntryNameCached: string | null
  stockQuantityCached: number | null
  /** ⚠️ On hand **minus other projects' reservations** — what this project may actually build on. */
  availableQuantity: number | null
  /** ⚠️ `null` when unsourced, `0` when sourced and nothing claimed. Those are different answers. */
  reservedQuantity: number | null

  catalogEntryId: string | null
  catalogPartNumberCached: string | null

  coverageStatus: MaterialCoverageStatus
  notes: string | null
  sortOrder: number
  excluded: boolean
}

/**
 * How many complete units are assemblable, and what caps it.
 *
 * ⚠️ **`blockingMaterialIds` is every line sitting at the ceiling, not just the first.** Fixing one of
 * three tied lines raises the number by nothing, and a screen naming only one sends somebody to order a
 * part that changes nothing.
 */
export interface ProjectBuildability {
  buildableQuantity: number
  limitingMaterialId: string | null
  limitingMaterialLabel: string | null
  blockingMaterialIds: string[]
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

  create: (payload: { name: string; description?: string; spaceId?: string; status?: ProjectStatus }) =>
    http.post<ProjectDetail>("/projects", payload),

  update: (
    projectId: string,
    payload: Partial<{ name: string; description: string; spaceId: string; status: ProjectStatus }>,
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

  /** Which drawer fills this line. */
  linkStockEntry: (projectId: string, materialId: string, stockEntryId: string) =>
    http.post<ProjectMaterial>(`/projects/${projectId}/materials/${materialId}/stock-entry`, { stockEntryId }),

  unlinkStockEntry: (projectId: string, materialId: string) =>
    http.delete<ProjectMaterial>(`/projects/${projectId}/materials/${materialId}/stock-entry`),

  /** What this line *is*, independent of which stock fills it. */
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
