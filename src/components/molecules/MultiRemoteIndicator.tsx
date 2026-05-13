import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGitStore } from "../../store/gitStore";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { refreshRemoteTagPresence } from "../../usecases/remotes";
import type { RemoteInfo } from "../../domain/entities";

type RemoteStatus = "present" | "absent" | "unknown";

const SYNTHESIS_THRESHOLD = 4;
const SYNTHESIS_NAME_LIMIT = 3;

interface MultiRemoteIndicatorProps {
  tagName: string;
  remotes: RemoteInfo[];
  onPushToRemote: (remoteName: string) => Promise<void>;
}

interface RemoteSlot {
  name: string;
  status: RemoteStatus;
}

const STATUS_GLYPH: Record<RemoteStatus, string> = {
  present: "✓",
  absent: "⬆",
  unknown: "?",
};

const STATUS_COLOR: Record<RemoteStatus, string> = {
  present: "text-emerald-400",
  absent: "text-orange-400",
  unknown: "text-zinc-500",
};

export function MultiRemoteIndicator({
  tagName,
  remotes,
  onPushToRemote,
}: MultiRemoteIndicatorProps) {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const { remoteTagPresence } = useGitStore();

  const [popover, setPopover] = useState<{ x: number; y: number } | null>(null);
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!popover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPopover(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popover]);

  if (remotes.length === 0) return null;

  const slots: RemoteSlot[] = remotes.map((r) => {
    const set = remoteTagPresence.get(r.name);
    if (!set) return { name: r.name, status: "unknown" };
    return { name: r.name, status: set.has(tagName) ? "present" : "absent" };
  });

  const absentRemotes = slots.filter((s) => s.status === "absent").map((s) => s.name);
  const unknownRemotes = slots.filter((s) => s.status === "unknown").map((s) => s.name);

  const handleRefresh = async (remoteName: string) => {
    setRefreshing((prev) => new Set(prev).add(remoteName));
    try {
      await refreshRemoteTagPresence(repo, remoteName);
    } finally {
      setRefreshing((prev) => {
        const next = new Set(prev);
        next.delete(remoteName);
        return next;
      });
    }
  };

  const handlePushToRemote = async (remoteName: string) => {
    setPushing((prev) => new Set(prev).add(remoteName));
    try {
      await onPushToRemote(remoteName);
    } finally {
      setPushing((prev) => {
        const next = new Set(prev);
        next.delete(remoteName);
        return next;
      });
    }
  };

  const handlePushAllMissing = async () => {
    for (const remoteName of absentRemotes) {
      await handlePushToRemote(remoteName);
    }
  };

  const openPopover = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({ x: rect.right, y: rect.bottom });
  };

  const renderInline = () => (
    <button
      onClick={openPopover}
      className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded hover:bg-surface-hover transition-colors shrink-0"
    >
      {slots.map((s) => (
        <span key={s.name} className={STATUS_COLOR[s.status]}>
          {STATUS_GLYPH[s.status]}
          {s.name}
        </span>
      ))}
    </button>
  );

  const renderSynthesis = () => {
    let glyph: string;
    let color: string;
    let label: string;

    if (absentRemotes.length === 0 && unknownRemotes.length === 0) {
      glyph = STATUS_GLYPH.present;
      color = STATUS_COLOR.present;
      label = t("tags.indicator.synthesisAll");
    } else if (absentRemotes.length > 0) {
      glyph = STATUS_GLYPH.absent;
      color = STATUS_COLOR.absent;
      const shown = absentRemotes.slice(0, SYNTHESIS_NAME_LIMIT).join(", ");
      label =
        absentRemotes.length > SYNTHESIS_NAME_LIMIT ? `${shown}, …` : shown;
    } else {
      glyph = STATUS_GLYPH.unknown;
      color = STATUS_COLOR.unknown;
      const shown = unknownRemotes.slice(0, SYNTHESIS_NAME_LIMIT).join(", ");
      label =
        unknownRemotes.length > SYNTHESIS_NAME_LIMIT ? `${shown}, …` : shown;
    }

    return (
      <button
        onClick={openPopover}
        className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded hover:bg-surface-hover transition-colors shrink-0"
      >
        <span className={color}>
          {glyph} {label}
        </span>
      </button>
    );
  };

  return (
    <>
      {remotes.length >= SYNTHESIS_THRESHOLD ? renderSynthesis() : renderInline()}

      {popover && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPopover(null)} />
          <div
            style={{
              top: popover.y + 4,
              left: Math.max(8, popover.x - 260),
            }}
            className="fixed z-50 bg-surface-elevated border border-surface-border rounded-lg shadow-2xl py-2 min-w-64 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] text-text-muted uppercase tracking-widest px-3 py-1 font-medium">
              {t("tags.indicator.popoverTitle", { name: tagName })}
            </p>
            <div className="border-t border-surface-border my-1" />
            {slots.map((s) => {
              const isRefreshing = refreshing.has(s.name);
              const isPushing = pushing.has(s.name);
              const statusLabel = t(
                s.status === "present"
                  ? "tags.indicator.statusPresent"
                  : s.status === "absent"
                    ? "tags.indicator.statusAbsent"
                    : "tags.indicator.statusUnknown",
              );
              return (
                <div
                  key={s.name}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs"
                >
                  <span className={`${STATUS_COLOR[s.status]} font-mono w-3`}>
                    {STATUS_GLYPH[s.status]}
                  </span>
                  <span className="text-text-primary font-mono flex-1 truncate">
                    {s.name}
                  </span>
                  <span className="text-text-muted text-[10px]">{statusLabel}</span>
                  {s.status === "unknown" && (
                    <button
                      title={t("tags.indicator.verifyRemote")}
                      onClick={() => handleRefresh(s.name)}
                      disabled={isRefreshing}
                      className="p-0.5 rounded text-text-muted hover:text-blue-400 disabled:opacity-50"
                    >
                      {isRefreshing ? (
                        <span className="w-3 h-3 rounded-full border-2 border-blue-400/40 border-t-blue-400 animate-spin inline-block" />
                      ) : (
                        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                          <path d="M8 2a6 6 0 1 0 5.66 4M14 2v4h-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  )}
                  {s.status === "absent" && (
                    <button
                      title={t("tags.menu.pushTo")}
                      onClick={() => handlePushToRemote(s.name)}
                      disabled={isPushing}
                      className="p-0.5 rounded text-text-muted hover:text-blue-400 disabled:opacity-50"
                    >
                      {isPushing ? (
                        <span className="w-3 h-3 rounded-full border-2 border-blue-400/40 border-t-blue-400 animate-spin inline-block" />
                      ) : (
                        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                          <path d="M8 4v8M5 7l3-3 3 3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M3 13h10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
            {absentRemotes.length > 0 && (
              <>
                <div className="border-t border-surface-border my-1" />
                <button
                  onClick={handlePushAllMissing}
                  disabled={pushing.size > 0}
                  className="w-full text-left px-3 py-2 text-sm text-blue-300 hover:bg-surface-hover transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {pushing.size > 0 && (
                    <span className="w-3 h-3 rounded-full border-2 border-blue-400/40 border-t-blue-400 animate-spin inline-block" />
                  )}
                  {t("tags.indicator.pushMissing", { count: absentRemotes.length })}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
