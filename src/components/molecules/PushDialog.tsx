import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { BranchInfo, RemoteInfo } from "../../domain/entities";

interface Props {
  remotes: RemoteInfo[];
  branches: BranchInfo[];
  defaultRemote: string;
  defaultBranches: string[];
  initialForce: boolean;
  loading: boolean;
  showAllTagsOption?: boolean;
  onClose: () => void;
  onConfirm: (
    remote: string,
    branches: string[],
    force: boolean,
    pushAllTags: boolean,
  ) => void;
}

export function PushDialog({
  remotes,
  branches,
  defaultRemote,
  defaultBranches,
  initialForce,
  loading,
  showAllTagsOption = true,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const [remote, setRemote] = useState(
    remotes.find((r) => r.name === defaultRemote) ? defaultRemote : (remotes[0]?.name ?? "")
  );
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(
    () => new Set(defaultBranches)
  );
  const [force, setForce] = useState(initialForce);
  const [pushAllTags, setPushAllTags] = useState(false);

  const localBranches = branches.filter((b) => !b.isRemote);

  const toggleBranch = (name: string) => {
    setSelectedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const canConfirm = remote.trim() !== "" && selectedBranches.size > 0 && remotes.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h2 className="text-sm font-semibold text-text-primary">{t("pushDialog.title")}</h2>
          {!loading && (
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none"
            >
              ✕
            </button>
          )}
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Remote selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-secondary">{t("pushDialog.remote")}</label>
            {remotes.length === 0 ? (
              <p className="text-xs text-red-400">{t("pushDialog.noRemotes")}</p>
            ) : (
              <div className="relative">
                <select
                  value={remote}
                  onChange={(e) => setRemote(e.target.value)}
                  disabled={loading}
                  className="w-full appearance-none bg-surface-base text-text-primary text-sm rounded-md px-3 py-2 pr-8 border border-surface-border focus:outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  {remotes.map((r) => (
                    <option key={r.name} value={r.name} className="bg-zinc-900 text-zinc-100">
                      {r.name} — {r.url}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted text-xs">▾</span>
              </div>
            )}
          </div>

          {/* Branch checkboxes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-text-secondary">{t("pushDialog.branches")}</label>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto border border-surface-border rounded-md p-2">
              {localBranches.map((b) => (
                <label
                  key={b.name}
                  className="flex items-center gap-2 cursor-pointer py-0.5"
                >
                  <input
                    type="checkbox"
                    checked={selectedBranches.has(b.name)}
                    onChange={() => toggleBranch(b.name)}
                    disabled={loading}
                    className="w-3.5 h-3.5 accent-blue-500 shrink-0"
                  />
                  <span className="text-sm font-mono text-text-primary truncate">{b.name}</span>
                  {b.isHead && (
                    <span className="text-[10px] text-emerald-400 shrink-0">HEAD</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Force push */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              disabled={loading}
              className="w-3.5 h-3.5 accent-orange-500"
            />
            <span className={`text-sm ${force ? "text-orange-400" : "text-text-primary"}`}>
              {t("pushDialog.forcePush")}
            </span>
          </label>
          {force && (
            <p className="text-xs text-orange-400 bg-orange-500/10 rounded-md px-3 py-2">
              {t("toolbar.forcePushWarning")}
            </p>
          )}

          {/* Push all tags */}
          {showAllTagsOption && (
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pushAllTags}
                  onChange={(e) => setPushAllTags(e.target.checked)}
                  disabled={loading}
                  className="w-3.5 h-3.5 accent-blue-500"
                />
                <span className="text-sm text-text-primary">
                  {t("pushDialog.allTags")}
                </span>
              </label>
              <p className="text-xs text-text-muted pl-6">
                {t("pushDialog.allTagsHelp")}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-surface-border">
          {!loading && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              {t("common.cancel")}
            </button>
          )}
          <button
            onClick={() =>
              onConfirm(remote, Array.from(selectedBranches), force, pushAllTags)
            }
            disabled={!canConfirm || loading}
            className={`px-5 py-2 text-sm font-medium disabled:opacity-40 text-white rounded-md transition-colors flex items-center gap-2 ${
              force ? "bg-orange-600 hover:bg-orange-500" : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {loading && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            )}
            {loading ? t("common.loading") : t("pushDialog.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
