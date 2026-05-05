import { useEffect, useState, useRef, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { useUiStore } from "../../store/uiStore";
import { useGitStore } from "../../store/gitStore";
import { getInteractiveRebaseCommitsUseCase, applyInteractiveRebaseUseCase, listBranchesUseCase } from "../../usecases/branches";
import { toast } from "../../store/toastStore";
import type { RebaseEntry, RebaseAction, RebaseStep } from "../../domain/entities";

const ACTIONS: RebaseAction[] = ["pick", "reword", "squash", "fixup", "drop"];

const ACTION_COLORS: Record<RebaseAction, string> = {
  pick:   "text-text-primary",
  reword: "text-blue-400",
  squash: "text-violet-400",
  fixup:  "text-amber-400",
  drop:   "text-red-400",
};

// ─── Custom dropdown (native <select> ignores CSS in WebKit/Tauri) ────────────

function ActionSelect({
  value,
  onChange,
  disabled,
  labels,
  descs,
}: {
  value: RebaseAction;
  onChange: (v: RebaseAction) => void;
  disabled: boolean;
  labels: Record<string, string>;
  descs: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const menu = document.getElementById(`action-menu-${id}`);
      if (buttonRef.current?.contains(target) || menu?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, id]);

  const handleOpen = () => {
    if (disabled) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuStyle({ position: "fixed", top: rect.bottom + 2, left: rect.left, minWidth: rect.width, zIndex: 9999 });
    }
    setOpen((o) => !o);
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleOpen}
        title={descs[value]}
        className={[
          "text-[10px] font-mono bg-surface-overlay border border-surface-border rounded px-1.5 py-1",
          "focus:outline-none focus:border-blue-500 flex items-center gap-1",
          ACTION_COLORS[value],
        ].join(" ")}
      >
        {labels[value]}
        <span className="text-text-muted text-[8px]">▾</span>
      </button>
      {open && createPortal(
        <div
          id={`action-menu-${id}`}
          style={menuStyle}
          className="bg-surface-elevated border border-surface-border rounded shadow-lg py-0.5"
        >
          {ACTIONS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => { onChange(a); setOpen(false); }}
              className={[
                "w-full text-left px-2.5 py-1.5 hover:bg-surface-hover flex flex-col gap-0.5",
                a === value ? "bg-surface-overlay" : "",
              ].join(" ")}
            >
              <span className={`text-[10px] font-mono ${ACTION_COLORS[a]}`}>{labels[a]}</span>
              <span className="text-[9px] text-text-muted leading-tight">{descs[a]}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

interface Row {
  entry: RebaseEntry;
  action: RebaseAction;
  rewordMsg: string; // only used when action === "reword"
}

// ─── Reword inline editor ─────────────────────────────────────────────────────

function RewordInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <input
      ref={ref}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t("interactiveRebase.rewordPlaceholder")}
      className="flex-1 min-w-0 bg-surface-overlay border border-blue-500 text-text-primary text-xs rounded px-2 py-1 focus:outline-none"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InteractiveRebaseEditor({
  upstreamOid,
  onClose,
  onApplied,
}: {
  upstreamOid: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const { setRepositoryState, setActiveView } = useUiStore();
  const { setBranches, bumpLogVersion } = useGitStore();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  // Drag-and-drop state
  const dragIndexRef = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  useEffect(() => {
    getInteractiveRebaseCommitsUseCase(repo, upstreamOid)
      .then((entries) => {
        setRows(entries.map((e) => ({ entry: e, action: "pick", rewordMsg: e.summary })));
        setLoading(false);
      })
      .catch((err) => {
        toast.error(String(err));
        onClose();
      });
  }, [upstreamOid, repo, onClose]);

  const setAction = useCallback((idx: number, action: RebaseAction) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx
          ? { ...r, action, rewordMsg: action === "reword" ? r.rewordMsg || r.entry.summary : r.rewordMsg }
          : r
      )
    );
  }, []);

  const setRewordMsg = useCallback((idx: number, msg: string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, rewordMsg: msg } : r)));
  }, []);

  // ── Drag and drop ──
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    dragIndexRef.current = idx;
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(idx);
  };

  const handleDrop = (e: React.DragEvent, targetDisplayIdx: number) => {
    e.preventDefault();
    const fromDisplay = dragIndexRef.current;
    if (fromDisplay === null || fromDisplay === targetDisplayIdx) { setDragOver(null); return; }
    const from = toRowIdx(fromDisplay);
    const to = toRowIdx(targetDisplayIdx);
    setRows((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    dragIndexRef.current = null;
    setDragOver(null);
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDragOver(null);
  };

  // Display order: newest first (same as history tree). rows is stored oldest-first (git order).
  const displayRows = [...rows].reverse();

  // Translate a display index to a rows index
  const toRowIdx = (displayIdx: number) => rows.length - 1 - displayIdx;

  // ── Apply ──
  const handleApply = async () => {
    setApplying(true);
    try {
      const steps: RebaseStep[] = rows.map((r) => ({
        oid: r.entry.oid,
        action: r.action,
        message: r.action === "reword" ? (r.rewordMsg.trim() || r.entry.summary) : undefined,
      }));
      const result = await applyInteractiveRebaseUseCase(repo, upstreamOid, steps);
      if (result.hasConflicts) {
        setRepositoryState("rebase");
        setActiveView("changes");
        toast.success(
          t("interactiveRebase.conflicts", { count: result.conflictCount })
        );
        onClose();
      } else {
        const branches = await listBranchesUseCase(repo, "all");
        setBranches(branches);
        bumpLogVersion();
        toast.success(t("interactiveRebase.success"));
        onApplied();
        onClose();
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setApplying(false);
    }
  };

  const activeCount = rows.filter((r) => r.action !== "drop").length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border shrink-0">
          <div>
            <span className="text-sm font-semibold text-text-primary">
              {t("interactiveRebase.title")}
            </span>
            <p className="text-xs text-text-muted mt-0.5">
              {t("interactiveRebase.description")}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={applying}
            className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none ml-4"
          >
            ✕
          </button>
        </div>

        {/* Commit list */}
        <div className="flex-1 overflow-y-auto min-h-0 py-2">
          {loading ? (
            <div className="flex items-center justify-center h-20 text-sm text-text-muted">
              {t("common.loading")}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-sm text-text-muted">
              {t("interactiveRebase.empty")}
            </div>
          ) : (
            displayRows.map((row, displayIdx) => {
              const rowIdx = toRowIdx(displayIdx);
              return (
                <div
                  key={row.entry.oid}
                  draggable
                  onDragStart={(e) => handleDragStart(e, displayIdx)}
                  onDragOver={(e) => handleDragOver(e, displayIdx)}
                  onDrop={(e) => handleDrop(e, displayIdx)}
                  onDragEnd={handleDragEnd}
                  className={[
                    "flex items-center gap-2 px-4 py-2 border-b border-surface-border/50 transition-colors",
                    dragOver === displayIdx ? "bg-blue-500/10" : "hover:bg-surface-hover",
                    row.action === "drop" ? "opacity-40" : "",
                  ].join(" ")}
                >
                  {/* Drag handle */}
                  <span className="text-text-muted cursor-grab active:cursor-grabbing shrink-0 select-none">
                    ⠿
                  </span>

                  {/* Action selector */}
                  <ActionSelect
                    value={row.action}
                    onChange={(a) => setAction(rowIdx, a)}
                    disabled={applying}
                    labels={Object.fromEntries(ACTIONS.map((a) => [a, t(`interactiveRebase.action.${a}`)]))}
                    descs={Object.fromEntries(ACTIONS.map((a) => [a, t(`interactiveRebase.actionDesc.${a}`)]))}
                  />

                  {/* Commit info / reword input */}
                  <span className="font-mono text-xs text-text-muted shrink-0">
                    {row.entry.shortOid}
                  </span>

                  {row.action === "reword" ? (
                    <RewordInput
                      value={row.rewordMsg}
                      onChange={(v) => setRewordMsg(rowIdx, v)}
                    />
                  ) : (
                    <span className="text-xs text-text-primary truncate flex-1 min-w-0">
                      {row.entry.summary}
                    </span>
                  )}

                  <span className="text-[10px] text-text-muted shrink-0 hidden sm:block">
                    {row.entry.authorName}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-surface-border shrink-0 gap-3">
          <p className="text-xs text-text-muted">
            {t("interactiveRebase.hint")}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              disabled={applying}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleApply}
              disabled={applying || loading || activeCount === 0}
              className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-surface-elevated disabled:text-text-muted text-white rounded-md transition-colors flex items-center gap-1.5"
            >
              {applying && (
                <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              )}
              {applying
                ? t("interactiveRebase.applying")
                : t("interactiveRebase.apply")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
