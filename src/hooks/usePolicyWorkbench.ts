import { useEffect, useState } from "react"
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { policyApi } from "@/api/policy"
import type {
  PolicyDocumentView,
  PolicyDryRunView,
  PolicyEditorStateView,
  PolicyExchangeView,
  PolicyInstanceKind,
  PolicyInstancePage,
  PolicyOverrideSeed,
  PolicyProblemView,
  PolicyReadingSource,
  PolicyReadingView,
  PolicyRevisionView,
  PolicyVocabularyView,
  ReadOnlyPolicySource,
} from "@/api/policy"

/**
 * The policy editor's server state.
 *
 * ⚠️ **Two of these are queries and everything else is a mutation, which is not a technicality:**
 * `validate`, `parse` and `write` all *compile text* on the server, so they are POSTs that change
 * nothing — caching them by text would fill the cache with every keystroke.
 */
const POLICY_KEYS = {
  editor: ["access", "policy", "editor"] as const,
  vocabulary: ["access", "policy", "vocabulary"] as const,
  reading: (source: PolicyReadingSource) => ["access", "policy", "reading", source] as const,
  instances: (kind: PolicyInstanceKind, query: string, page: number) =>
    ["access", "policy", "instances", kind, query, page] as const,
}

/**
 * One reading of the installation's authorization, as `.jmp`.
 *
 * Under the same `["access"]` prefix as everything else, so a save invalidates it too: the `effective`
 * reading is the composite the engine resolves from, and a policy edit changes it.
 */
export function usePolicyReading(source: PolicyReadingSource, enabled: boolean) {
  return useQuery<PolicyReadingView>({
    queryKey: POLICY_KEYS.reading(source),
    queryFn: () => policyApi.reading(source).then((response) => response.data),
    enabled,
  })
}

/**
 * One page of the workspaces, accounts or people a policy may name.
 *
 * `keepPreviousData` is what stops the list blanking between pages — a picker that empties on every
 * keystroke reads as broken even when it is fast.
 */
export function usePolicyInstances(kind: PolicyInstanceKind, query: string, page: number, enabled: boolean) {
  return useQuery<PolicyInstancePage>({
    queryKey: POLICY_KEYS.instances(kind, query, page),
    queryFn: () => policyApi.instances(kind, query, page).then((response) => response.data),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

/**
 * The whole editable policy, as one thing a screen can be laid out around.
 *
 * ⚠️ **A hook rather than a component's state**, because `/admin/access` is one navigation over twelve
 * destinations: five edit the document, four read it, three answer questions about its result. The
 * counts beside the first five live in the document and the toolbar above all of them is about the
 * document too — owning that inside one panel would mean the navigation asking a child for the numbers
 * it labels itself with, and the toolbar unmounting whenever somebody looked at the history.
 *
 * ⚠️ **One model in the middle, never two editors of a string.** `source` is the single piece of state.
 * The form does not edit it — the form edits the **document** and hands it back to the server to be
 * written out; typing in the code pane parses back into the document. Two spellings of one policy racing
 * each other is the failure this shape exists to prevent, and it is why every conversion is a round trip
 * rather than a local render.
 */
export interface PolicyWorkbench {
  readonly loading: boolean
  readonly mayWrite: boolean
  readonly version: number
  readonly dirty: boolean
  readonly source: string
  readonly document: PolicyDocumentView | null
  readonly vocabulary: PolicyVocabularyView | undefined
  readonly problems: PolicyProblemView[]
  readonly history: PolicyRevisionView[]
  readonly shipped: ReadOnlyPolicySource[]

  /** Typing in the code pane: the text is the truth, and the document follows it. */
  editSource: (next: string) => void
  /** Editing in the form: the document is the truth, and the text is what the server writes. */
  editDocument: (next: PolicyDocumentView) => void

  readonly dryRun: PolicyDryRunView | null
  readonly rehearsing: boolean
  readonly saving: boolean
  readonly reverting: boolean
  readonly note: string
  setNote: (note: string) => void
  rehearse: () => void
  closeDryRun: () => void
  confirmSave: () => void
  revertTo: (version: number) => void

  /**
   * A grant the control room asked to override, written out as the `deny` that overrides it.
   *
   * ⚠️ **Composed and shown, never applied.** It lands as an unsaved change like any other, so it still
   * goes through the dry run and still needs a Save — what makes an override comprehensible is that
   * somebody can *read* the line before it is in force.
   */
  override: (seed: PolicyOverrideSeed) => void
}

export function usePolicyWorkbench(): PolicyWorkbench {
  const queryClient = useQueryClient()

  const [source, setSource] = useState("")
  const [document, setDocument] = useState<PolicyDocumentView | null>(null)
  const [dirty, setDirty] = useState(false)
  const [dryRun, setDryRun] = useState<PolicyDryRunView | null>(null)
  const [note, setNote] = useState("")

  /**
   * What is wrong with the **whole** document, wherever the last edit came from.
   *
   * ⚠️ State rather than a mutation's `data`. Typing in the code pane goes through `parse`; editing in a
   * form goes through `write`, which checks the document too — and whose result would otherwise be
   * thrown away, leaving the problems band showing whatever the last *text* edit produced.
   */
  const [problems, setProblems] = useState<PolicyProblemView[]>([])

  /**
   * ⚠️ A denial asked for before there was a document to put it in.
   *
   * The *Who* view can be read while the policy is still parsing — the two are destinations of one
   * screen and only one of them waits. Dropping the request there would be a button that silently does
   * nothing, roughly once, on the slowest connection in the building.
   */
  const [pendingOverride, setPendingOverride] = useState<PolicyOverrideSeed | null>(null)

  const { data: state, isLoading } = useQuery<PolicyEditorStateView>({
    queryKey: POLICY_KEYS.editor,
    queryFn: () => policyApi.editor().then((response) => response.data),
  })

  const { data: vocabulary } = useQuery<PolicyVocabularyView>({
    queryKey: POLICY_KEYS.vocabulary,
    queryFn: () => policyApi.vocabulary().then((response) => response.data),
    // Scopes are an enum and permissions are constants; neither appears mid-edit.
    staleTime: 5 * 60_000,
  })

  const parse = useMutation<PolicyExchangeView, unknown, string>({
    mutationFn: (text) => policyApi.parse(text).then((response) => response.data),
  })

  const write = useMutation<PolicyExchangeView, unknown, PolicyDocumentView>({
    mutationFn: (next) => policyApi.write(next).then((response) => response.data),
  })

  const rehearsal = useMutation<PolicyDryRunView, unknown, string>({
    mutationFn: (text) => policyApi.dryRun(text).then((response) => response.data),
  })

  /**
   * ⚠️ **Saving and reverting invalidate everything the control room shows**, not only the editor: a
   * policy save changes what *other people* hold, so Who, What and the three readings are all stale the
   * moment it lands. Leaving them cached would let somebody save a change and then be shown,
   * convincingly, that nothing happened.
   */
  const settled = () => queryClient.invalidateQueries({ queryKey: ["access"] })

  const save = useMutation<PolicyEditorStateView, unknown, { source: string; note: string }>({
    mutationFn: ({ source: text, note: message }) => policyApi.save(text, message).then((response) => response.data),
    onSuccess: settled,
  })

  const revert = useMutation<PolicyEditorStateView, unknown, number>({
    mutationFn: (version) => policyApi.revert(version).then((response) => response.data),
    onSuccess: settled,
  })

  /** Text arrived: the document and the verdict both follow it. */
  function readParsed(exchange: PolicyExchangeView) {
    setDocument(exchange.document)
    setProblems(exchange.checked.problems)
  }

  // ⚠️ The server's copy is the starting point and replaces the local one on a save or a revert —
  // but never while something is unsaved. A screen that re-fetched over somebody's typing loses work
  // silently, which is the one failure nobody can undo.
  useEffect(() => {
    if (state && !dirty) {
      setSource(state.source)
      parse.mutate(state.source, { onSuccess: readParsed })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.version, state?.source])

  function editSource(next: string) {
    setSource(next)
    setDirty(true)
    setDryRun(null)
    parse.mutate(next, { onSuccess: readParsed })
  }

  function editDocument(next: PolicyDocumentView) {
    setDocument(next)
    setDirty(true)
    setDryRun(null)
    write.mutate(next, {
      onSuccess: (exchange) => {
        setSource(exchange.source)
        setProblems(exchange.checked.problems)
      },
    })
  }

  useEffect(() => {
    if (!pendingOverride || !document) {
      return
    }

    const seed = pendingOverride
    const denial = {
      permission: seed.permission,
      scope: seed.scope,
      instance: seed.instance,
      effect: "DENY" as const,
      condition: null,
    }
    const known = document.subjects.some((subject) => subject.id === seed.subjectId)

    setPendingOverride(null)
    editDocument({
      ...document,
      subjects: known
        ? document.subjects.map((subject) =>
            subject.id === seed.subjectId ? { ...subject, grants: [...subject.grants, denial] } : subject,
          )
        : [...document.subjects, { id: seed.subjectId, roles: [], grants: [denial] }],
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOverride, document !== null])

  return {
    loading: isLoading || !state,
    mayWrite: state?.mayWrite ?? false,
    version: state?.version ?? 0,
    dirty,
    source,
    document,
    vocabulary,
    problems,
    history: state?.history ?? [],
    shipped: state?.readOnlySources ?? [],

    editSource,
    editDocument,

    dryRun,
    rehearsing: rehearsal.isPending,
    saving: save.isPending,
    reverting: revert.isPending,
    note,
    setNote,
    rehearse: () => rehearsal.mutate(source, { onSuccess: setDryRun }),
    closeDryRun: () => setDryRun(null),
    confirmSave: () =>
      save.mutate(
        { source, note },
        {
          onSuccess: () => {
            setDirty(false)
            setDryRun(null)
            setNote("")
          },
        },
      ),
    revertTo: (version) =>
      revert.mutate(version, {
        onSuccess: () => {
          setDirty(false)
          setDryRun(null)
        },
      }),

    override: setPendingOverride,
  }
}
