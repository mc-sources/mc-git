import { useEffect, useCallback, useMemo, useRef, useState, startTransition } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "../../store/toastStore";
import { useGitStore } from "../../store/gitStore";
import { useUiStore } from "../../store/uiStore";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { useRepoStore } from "../../store/repoStore";
import { getLogUseCase, getCommitDetailUseCase, getGraphLogUseCase } from "../../usecases/history";
import { getRepoInfoUseCase } from "../../usecases/repository";
import type { CommitFilters } from "../../usecases/history";
import { listTagsUseCase } from "../../usecases/tags";
import { listBranchesUseCase } from "../../usecases/branches";
import { listRemotesUseCase } from "../../usecases/remotes";
import { computeGraphLayout } from "../../usecases/graph";
import type { CommitSummary, BranchInfo, TagInfo, RemoteInfo } from "../../domain/entities";
import type { GraphEntry } from "../../usecases/graph";
import { CommitRow } from "../molecules/CommitRow";
import { GraphCell } from "../atoms/GraphCell";

const PAGE_SIZE = 50;
const GRAPH_LIMIT = 500;
const SEARCH_MAX = 200;
const DEBOUNCE_MS = 300;
const ROW_H = 58;
const MIN_LABEL_WIDTH = 200;
const OVERSCAN = 5;

export function CommitList() {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const { currentRepo, setCurrentRepo, setAllBranchesForRepo } = useRepoStore();
  const { tags, branches, graphCommits, setTags, setBranches, setGraphCommits, logVersion } = useGitStore();
  const { selectedCommitOid, setSelectedCommit, setCurrentCommitDetail, highlightedOid, setHighlightedOid } = useUiStore();

  // Search state
  const [searchText, setSearchText] = useState("");
  const [searchPath, setSearchPath] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchResults, setSearchResults] = useState<CommitSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [graphColWidth, setGraphColWidth] = useState(28);
  // Deep-load state (commit beyond GRAPH_LIMIT)
  const [confirmDeepLoad, setConfirmDeepLoad] = useState(false);
  const [deepLoading, setDeepLoading] = useState(false);
  const [deepLoadedCount, setDeepLoadedCount] = useState(0);
  const deepAbortRef = useRef(false);
  // Tracks the oid already being handled to avoid re-triggering load/dialog on re-renders
  const handlingOidRef = useRef<string | null>(null);
  // Remote branches toggle
  const [showAll, setShowAll] = useState(false);
  const [localOids, setLocalOids] = useState<Set<string>>(new Set());
  // Whether more graph commits exist beyond the loaded limit
  const [graphHasMore, setGraphHasMore] = useState(false);
  // Remotes (for inline tag indicator) — loaded once on mount, refreshed on logVersion change
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  // Scroll position for virtual windowing
  const [scrollTop, setScrollTop] = useState(0);

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const sinceValid = dateRe.test(since);
  const untilValid = dateRe.test(until);
  const hasFilters = searchText.trim() !== "" || searchPath.trim() !== "" || sinceValid || untilValid;

  const clearFilters = () => {
    setSearchText("");
    setSearchPath("");
    setSince("");
    setUntil("");
    setSearchResults(null);
  };

  const refreshTags = useCallback(async () => {
    try {
      setTags(await listTagsUseCase(repo));
    } catch {
      // non-fatal
    }
  }, [repo, setTags]);

  const refreshBranches = useCallback(async () => {
    try {
      setBranches(await listBranchesUseCase(repo, "all"));
    } catch {
      // non-fatal
    }
  }, [repo, setBranches]);

  const refreshRemotes = useCallback(async () => {
    try {
      setRemotes(await listRemotesUseCase(repo));
    } catch {
      // non-fatal — l'indicateur compact se masque tout seul si remotes est vide
    }
  }, [repo]);

  useEffect(() => {
    refreshRemotes();
  }, [refreshRemotes]);

  const loadInitial = useCallback(async () => {
    const path = currentRepo?.path;
    const savedShowAll = path
      ? (useRepoStore.getState().allBranchesPerRepo[path] ?? false)
      : false;
    setShowAll(savedShowAll);
    setLocalOids(new Set());
    try {
      if (savedShowAll) {
        // Load local commits first (for visual distinction), then all commits
        const [localRaw, allRaw, freshInfo] = await Promise.all([
          getGraphLogUseCase(repo, GRAPH_LIMIT, false),
          getGraphLogUseCase(repo, GRAPH_LIMIT, true),
          getRepoInfoUseCase(repo),
          refreshTags(),
        ]);
        setLocalOids(new Set(localRaw.map((c) => c.oid)));
        setGraphCommits(allRaw);
        setGraphHasMore(allRaw.length >= GRAPH_LIMIT);
        setCurrentRepo(freshInfo);
      } else {
        const [graphRaw, freshInfo] = await Promise.all([
          getGraphLogUseCase(repo, GRAPH_LIMIT, false),
          getRepoInfoUseCase(repo),
          refreshTags(),
        ]);
        setGraphCommits(graphRaw);
        setGraphHasMore(graphRaw.length >= GRAPH_LIMIT);
        setCurrentRepo(freshInfo);
      }
    } catch (e) {
      toast.error(String(e));
    }
  }, [repo, currentRepo?.path, setGraphCommits, setCurrentRepo, refreshTags, logVersion]);

  useEffect(() => {
    clearFilters();
    loadInitial();
  }, [loadInitial]);

  // Debounced search: triggers whenever search fields change
  useEffect(() => {
    if (!hasFilters) {
      setSearchResults(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const filters: CommitFilters = {};
      if (searchText.trim()) filters.search = searchText.trim();
      if (searchPath.trim()) filters.path = searchPath.trim();
      if (sinceValid) filters.since = Math.floor(new Date(since + "T00:00:00").getTime() / 1000);
      if (untilValid) filters.until = Math.floor(new Date(until + "T23:59:59").getTime() / 1000);

      setSearching(true);
      try {
        const results = await getLogUseCase(repo, SEARCH_MAX, 0, undefined, filters);
        startTransition(() => setSearchResults(results));
      } catch (e) {
        toast.error(String(e));
      } finally {
        startTransition(() => setSearching(false));
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchText, searchPath, since, until, repo]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !graphHasMore) return;
    setLoadingMore(true);
    try {
      const newLimit = graphCommits.length + PAGE_SIZE;
      const extended = await getGraphLogUseCase(repo, newLimit, showAll);
      setGraphCommits(extended);
      setGraphHasMore(extended.length >= newLimit);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, graphHasMore, graphCommits.length, repo, showAll, setGraphCommits]);

  // Auto-load on scroll: observe sentinel element
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleSelect = async (commit: CommitSummary) => {
    setHighlightedOid(null);
    setSelectedCommit(commit.oid);
    try {
      setCurrentCommitDetail(await getCommitDetailUseCase(repo, commit.oid));
    } catch (e) {
      toast.error(String(e));
    }
  };

  const [togglingAll, setTogglingAll] = useState(false);

  const handleToggleAll = useCallback(async () => {
    const newVal = !showAll;
    setShowAll(newVal);
    if (currentRepo) setAllBranchesForRepo(currentRepo.path, newVal);
    if (newVal) {
      setLocalOids(new Set(graphCommits.map((c) => c.oid)));
    } else {
      setLocalOids(new Set());
    }
    setTogglingAll(true);
    try {
      const graphRaw = await getGraphLogUseCase(repo, GRAPH_LIMIT, newVal);
      setGraphCommits(graphRaw);
      setGraphHasMore(graphRaw.length >= GRAPH_LIMIT);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setTogglingAll(false);
    }
  }, [showAll, graphCommits, repo, setGraphCommits, currentRepo, setAllBranchesForRepo]);

  // Index branch headOid → BranchInfo[] for O(1) lookup per commit row
  const branchIndex = useMemo<Map<string, BranchInfo[]>>(() => {
    const map = new Map<string, BranchInfo[]>();
    for (const branch of branches) {
      if (!branch.headOid) continue;
      const list = map.get(branch.headOid) ?? [];
      list.push(branch);
      map.set(branch.headOid, list);
    }
    return map;
  }, [branches]);

  // Remote branches that have no local tracking branch (REQ-REMOTE-HIST-005)
  const remoteOnlyBranchNames = useMemo<Set<string>>(() => {
    const trackedRemotes = new Set(
      branches.filter((b) => !b.isRemote && b.upstream != null).map((b) => b.upstream!)
    );
    return new Set(
      branches.filter((b) => b.isRemote && !trackedRemotes.has(b.name)).map((b) => b.name)
    );
  }, [branches]);

  // Compute graph layout once whenever graphCommits changes
  const graphLayout = useMemo<Map<string, GraphEntry>>(() => {
    if (graphCommits.length === 0) return new Map();
    const entries = computeGraphLayout(graphCommits);
    return new Map(entries.map((e) => [e.oid, e]));
  }, [graphCommits]);

  const displayCommits = searchResults ?? graphCommits;

  // Scroll to highlighted commit when highlightedOid changes.
  // Strategy:
  //   1. Already in displayCommits → scroll immediately.
  //   2. In graphCommits (all-refs) → load that many HEAD commits. If the
  //      commit is not in HEAD's history (side/unmerged branch), show a toast.
  //   3. Beyond GRAPH_LIMIT → confirm dialog, then extend graphCommits in
  //      batches (not log) until found or exhausted.
  // handlingOidRef prevents re-triggering for the same oid while a load is
  // in progress (graphCommits/displayCommits updates fire the effect again).
  useEffect(() => {
    if (!highlightedOid) {
      handlingOidRef.current = null;
      return;
    }
    const idx = displayCommits.findIndex((c) => c.oid === highlightedOid);
    if (idx !== -1) {
      listRef.current?.scrollTo({ top: idx * ROW_H, behavior: "smooth" });
      return;
    }
    if (handlingOidRef.current === highlightedOid) return;
    handlingOidRef.current = highlightedOid;
    // Beyond currently loaded graphCommits — ask confirmation before extending
    setConfirmDeepLoad(true);
  }, [highlightedOid, displayCommits]);

  // Deep load: extend graphCommits (all-refs) in batches until the commit is
  // found, then let the effect handle loading it into log. This avoids loading
  // thousands of HEAD-only commits for a commit on a side branch.
  const handleConfirmDeepLoad = async () => {
    setConfirmDeepLoad(false);
    setDeepLoading(true);
    setDeepLoadedCount(0);
    deepAbortRef.current = false;
    const oid = highlightedOid;
    if (!oid) { setDeepLoading(false); return; }
    const BATCH = 500;
    let limit = graphCommits.length + BATCH;
    try {
      while (true) {
        if (deepAbortRef.current) break;
        const extended = await getGraphLogUseCase(repo, limit, showAll);
        setDeepLoadedCount(extended.length);
        if (extended.some((c) => c.oid === oid)) {
          setGraphCommits(extended);
          setGraphHasMore(extended.length >= limit);
          handlingOidRef.current = null;
          return;
        }
        if (extended.length < limit) {
          // Exhausted all commits — not found anywhere
          toast.error(t("history.commitNotFound"));
          setHighlightedOid(null);
          handlingOidRef.current = null;
          return;
        }
        limit += BATCH;
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setDeepLoading(false);
      setDeepLoadedCount(0);
      deepAbortRef.current = false;
    }
  };

  // Index tag targetOid → TagInfo[] for O(1) lookup per commit row
  const tagIndex = useMemo<Map<string, TagInfo[]>>(() => {
    const map = new Map<string, TagInfo[]>();
    for (const tag of tags) {
      const list = map.get(tag.targetOid) ?? [];
      list.push(tag);
      map.set(tag.targetOid, list);
    }
    return map;
  }, [tags]);

  // Virtual window: only render rows visible in the viewport (+ OVERSCAN)
  const { virtualFirst, virtualLast, paddingTop, paddingBottom } = useMemo(() => {
    const el = listRef.current;
    const h = el?.clientHeight ?? 600;
    const total = displayCommits.length;
    if (total === 0) return { virtualFirst: 0, virtualLast: -1, paddingTop: 0, paddingBottom: 0 };
    const first = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
    const last = Math.min(total - 1, Math.ceil((scrollTop + h) / ROW_H) + OVERSCAN);
    return {
      virtualFirst: first,
      virtualLast: last,
      paddingTop: first * ROW_H,
      paddingBottom: Math.max(0, (total - last - 1) * ROW_H),
    };
  }, [scrollTop, displayCommits.length]);

  // Handle scroll: update virtual window position + graph column width
  const handleScroll = useCallback(() => {
    const container = listRef.current;
    if (!container) return;
    setScrollTop(container.scrollTop);
    if (displayCommits.length === 0) return;
    const { scrollTop: st, clientHeight, clientWidth } = container;
    const firstIdx = Math.max(0, Math.floor(st / ROW_H));
    const lastIdx = Math.min(displayCommits.length - 1, Math.ceil((st + clientHeight) / ROW_H));
    let maxLanes = 1;
    for (let i = firstIdx; i <= lastIdx; i++) {
      const entry = graphLayout.get(displayCommits[i].oid);
      if (entry && entry.maxLanes > maxLanes) maxLanes = entry.maxLanes;
    }
    const natural = maxLanes * 14;
    const maxAllowed = Math.max(28, clientWidth - MIN_LABEL_WIDTH);
    setGraphColWidth(Math.min(natural, maxAllowed));
  }, [displayCommits, graphLayout]);

  useEffect(() => { handleScroll(); }, [handleScroll]);

  // Reset scroll when switching repos
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [currentRepo?.path]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Search bar ─────────────────────────────────────────────── */}
      <div className="shrink-0 px-2 py-2 border-b border-surface-border flex flex-col gap-1.5">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder={t("history.searchPlaceholder")}
            className="flex-1 bg-surface-elevated text-text-primary text-xs rounded px-2 py-1.5 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted"
          />
          <button
            onClick={handleToggleAll}
            disabled={togglingAll}
            title={showAll ? t("history.showAllActive") : t("history.showAll")}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${showAll ? "border-blue-500 text-blue-400" : "border-surface-border text-text-muted hover:text-text-primary"}`}
          >
            {togglingAll
              ? <span className="w-2.5 h-2.5 rounded-full border-2 border-current/30 border-t-current animate-spin" />
              : "⎇"}
          </button>
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            title={t("history.advancedFilters")}
            className={`text-xs px-2 py-1 rounded border transition-colors ${showAdvanced ? "border-blue-500 text-blue-400" : "border-surface-border text-text-muted hover:text-text-primary"}`}
          >
            ⚙
          </button>
          {hasFilters && (
            <button
              onClick={clearFilters}
              title={t("history.clearFilters")}
              className="text-xs px-2 py-1 rounded border border-surface-border text-text-muted hover:text-red-400 hover:border-red-500/40 transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {showAdvanced && (
          <div className="flex flex-col gap-1.5">
            <input
              type="text"
              value={searchPath}
              onChange={(e) => setSearchPath(e.target.value)}
              placeholder={t("history.filePathPlaceholder")}
              className="w-full bg-surface-elevated text-text-primary text-xs rounded px-2 py-1.5 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted"
            />
            <div className="flex gap-1.5 items-center">
              <span className="text-[10px] text-text-muted shrink-0">{t("history.from")}</span>
              <input
                type="text"
                value={since}
                onChange={(e) => setSince(e.target.value)}
                placeholder={t("history.datePlaceholder")}
                maxLength={10}
                className={`flex-1 bg-surface-elevated text-text-primary text-xs rounded px-2 py-1 border focus:outline-none placeholder:text-text-muted ${since && !/^\d{4}-\d{2}-\d{2}$/.test(since) ? "border-red-500/60" : "border-surface-border focus:border-blue-500"}`}
              />
              <span className="text-[10px] text-text-muted shrink-0">{t("history.to")}</span>
              <input
                type="text"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                placeholder={t("history.datePlaceholder")}
                maxLength={10}
                className={`flex-1 bg-surface-elevated text-text-primary text-xs rounded px-2 py-1 border focus:outline-none placeholder:text-text-muted ${until && !/^\d{4}-\d{2}-\d{2}$/.test(until) ? "border-red-500/60" : "border-surface-border focus:border-blue-500"}`}
              />
            </div>
          </div>
        )}

        {/* Search status */}
        {hasFilters && (
          <div className="flex items-center gap-1.5">
            {searching && (
              <span className="w-2.5 h-2.5 rounded-full border-2 border-blue-400/40 border-t-blue-400 animate-spin shrink-0" />
            )}
            {!searching && searchResults !== null && (
              <span className="text-[10px] text-text-muted">
                {searchResults.length === SEARCH_MAX
                  ? t("history.resultLimit", { max: SEARCH_MAX })
                  : t("history.resultCount", { count: searchResults.length })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Commit list ────────────────────────────────────────────── */}
      <div ref={listRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {/* Top spacer — keeps scroll height correct for rows above the virtual window */}
        <div style={{ height: paddingTop }} />
        {displayCommits.slice(virtualFirst, virtualLast + 1).map((commit) => {
          const entry = graphLayout.get(commit.oid);
          const isHighlighted = highlightedOid === commit.oid;
          const isRemoteOnly = showAll && localOids.size > 0 && !localOids.has(commit.oid);
          const isHead = commit.oid === currentRepo?.headOid;
          return (
            <div
              key={commit.oid}
              className={`flex h-[58px] border-b ${isHighlighted ? "border-amber-500/60 bg-amber-500/10" : "border-surface-border"} ${isRemoteOnly ? "opacity-50" : ""} ${isHead ? "shadow-[inset_2px_0_0_#8b5cf6]" : ""}`}
            >
              {/* Graph column — clipped to graphColWidth */}
              <div className="shrink-0 overflow-hidden" style={{ width: graphColWidth }}>
                {entry && <GraphCell entry={entry} totalLanes={entry.maxLanes} />}
              </div>
              {/* Commit info */}
              <div className="flex-1 overflow-hidden border-l border-surface-border/40">
                <CommitRow
                  commit={commit}
                  commitTags={tagIndex.get(commit.oid) ?? []}
                  commitBranches={branchIndex.get(commit.oid) ?? []}
                  remoteOnlyBranchNames={remoteOnlyBranchNames}
                  remotes={remotes}
                  isSelected={selectedCommitOid === commit.oid}
                  onSelect={() => handleSelect(commit)}
                  onTagsChanged={refreshTags}
                  onBranchesChanged={refreshBranches}
                  onLogRefresh={loadInitial}
                />
              </div>
            </div>
          );
        })}
        {/* Bottom spacer — keeps scroll height correct for rows below the virtual window */}
        <div style={{ height: paddingBottom }} />
        {!hasFilters && graphHasMore && (
          <div ref={sentinelRef} className="flex items-center justify-center py-3">
            {loadingMore && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-text-muted/30 border-t-text-muted animate-spin" />
            )}
          </div>
        )}
        {displayCommits.length === 0 && !searching && (
          <p className="text-xs text-text-muted px-3 py-4">
            {hasFilters ? t("history.noMatch") : t("history.noCommits")}
          </p>
        )}
      </div>

      {/* ── Confirmation deep load ──────────────────────────────────── */}
      {confirmDeepLoad && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">{t("history.deepLoad.title")}</p>
              <p className="text-xs text-text-secondary mt-1">{t("history.deepLoad.message", { limit: GRAPH_LIMIT })}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setConfirmDeepLoad(false); setHighlightedOid(null); handlingOidRef.current = null; }}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleConfirmDeepLoad}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
              >
                {t("history.deepLoad.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Deep load progress ──────────────────────────────────────── */}
      {deepLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4">
            <p className="text-sm font-semibold text-text-primary">{t("history.deepLoad.loading")}</p>
            <div className="flex flex-col gap-2">
              {/* Indeterminate animated bar */}
              <div className="w-full h-1.5 bg-surface-overlay rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
              <p className="text-xs text-text-muted">{t("history.deepLoad.progress", { count: deepLoadedCount })}</p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => { deepAbortRef.current = true; handlingOidRef.current = null; }}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
