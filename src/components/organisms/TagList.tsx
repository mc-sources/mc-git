import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "../../store/toastStore";
import { useGitStore } from "../../store/gitStore";
import { useUiStore } from "../../store/uiStore";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { useRepoStore } from "../../store/repoStore";
import { listTagsUseCase } from "../../usecases/tags";
import type { TagInfo } from "../../domain/entities";

export function TagList() {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const { currentRepo } = useRepoStore();
  const { tags, setTags, remoteTagPresence } = useGitStore();
  const { setActiveView, setHighlightedOid, highlightedTagName, setHighlightedTagName } = useUiStore();

  const [filter, setFilter] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const highlightedRowRef = useRef<HTMLDivElement | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setTags(await listTagsUseCase(repo));
    } catch (e) {
      toast.error(String(e));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRepo?.path]);

  useEffect(() => {
    if (!highlightedTagName) return;
    if (highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ block: "nearest" });
    }
    const timer = setTimeout(() => setHighlightedTagName(null), 3000);
    return () => clearTimeout(timer);
  }, [highlightedTagName, setHighlightedTagName]);

  const filterLower = filter.toLowerCase();
  const localTags = tags.filter(
    (tag) => filterLower === "" || tag.name.toLowerCase().includes(filterLower)
  );

  const remoteTagsHasData = remoteTagPresence.size > 0;
  const remoteTagNames = remoteTagsHasData
    ? Array.from(
        new Set(Array.from(remoteTagPresence.values()).flatMap((set) => Array.from(set))),
      )
        .filter((name) => filterLower === "" || name.toLowerCase().includes(filterLower))
        .sort()
    : [];

  const handleNavigateToCommit = (oid: string) => {
    setHighlightedOid(oid);
    setActiveView("history");
  };

  const renderTagLeaf = (tag: TagInfo) => {
    const isHighlighted = highlightedTagName === tag.name;
    const taggerTooltip =
      tag.isAnnotated && tag.tagger
        ? `${tag.tagger.name} — ${new Date(tag.tagger.when * 1000).toLocaleString()}`
        : undefined;

    return (
      <div
        key={tag.name}
        ref={isHighlighted ? highlightedRowRef : undefined}
        className={[
          "group flex items-center gap-2.5 px-2.5 py-2 rounded-md transition-colors",
          isHighlighted
            ? "bg-blue-600/20 border border-blue-500/30"
            : "hover:bg-surface-hover border border-transparent",
        ].join(" ")}
      >
        <span className="text-sm text-text-primary truncate font-medium" title={tag.name}>
          {tag.name}
        </span>
        <span className="text-[10px] text-text-secondary font-mono shrink-0">
          {tag.targetOid.slice(0, 7)}
        </span>
        {tag.isAnnotated ? (
          <span
            title={taggerTooltip}
            className="text-[9px] uppercase tracking-wide bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded px-1.5 py-0.5 font-medium shrink-0"
          >
            {t("tags.annotated")}
          </span>
        ) : (
          <span className="text-[9px] uppercase tracking-wide bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded px-1.5 py-0.5 font-medium shrink-0">
            {t("tags.lightweight")}
          </span>
        )}
        <span className="flex-1" />
        <button
          title={t("tags.showInHistory")}
          onClick={() => handleNavigateToCommit(tag.targetOid)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-text-muted hover:text-blue-400"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path d="M2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8Zm6-1.5a.75.75 0 0 0 0 1.5h1.69l-.72.72a.75.75 0 1 0 1.06 1.06l2-2a.75.75 0 0 0 0-1.06l-2-2a.75.75 0 0 0-1.06 1.06l.72.72H8Z" />
          </svg>
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border shrink-0">
        <h2 className="text-sm font-semibold text-text-primary flex-1">{t("tags.title")}</h2>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="text-xs px-2 py-1 rounded border border-surface-border text-text-muted hover:text-text-primary hover:border-text-muted/40 transition-colors disabled:opacity-50"
        >
          {refreshing ? "…" : t("tags.refresh")}
        </button>
      </div>

      <div className="flex gap-1.5 px-2 pt-2 pb-1.5 border-b border-surface-border">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t("tags.filterPlaceholder")}
          className="flex-1 bg-surface-elevated text-text-primary text-xs rounded px-2 py-1.5 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted"
        />
        {filter && (
          <button
            onClick={() => setFilter("")}
            className="text-xs px-2 py-1 rounded border border-surface-border text-text-muted hover:text-red-400 hover:border-red-500/40 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-0.5">
        <p className="text-[10px] text-text-muted uppercase tracking-widest px-2 py-1.5 font-medium">
          {t("tags.local", { count: localTags.length })}
        </p>
        {localTags.length === 0 ? (
          <p className="text-xs text-text-muted px-3 py-3 text-center">{t("tags.empty")}</p>
        ) : (
          localTags.map(renderTagLeaf)
        )}

        {remoteTagsHasData && (
          <p className="text-[10px] text-text-muted uppercase tracking-widest px-2 py-1.5 font-medium mt-2">
            {t("tags.remote", { count: remoteTagNames.length })}
          </p>
        )}
      </div>
    </div>
  );
}
