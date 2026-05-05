import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { useGitStore } from "../../store/gitStore";
import { useRepoStore } from "../../store/repoStore";
import { listBranchesUseCase } from "../../usecases/branches";
import {
  getGitflowConfigUseCase,
  initGitflowUseCase,
  startGitflowBranchUseCase,
  finishGitflowBranchUseCase,
} from "../../usecases/gitflow";
import { toast } from "../../store/toastStore";
import type { GitFlowBranchKind, GitFlowConfig } from "../../domain/entities";

const DEFAULT_CONFIG: GitFlowConfig = {
  master: "main",
  develop: "develop",
  featurePrefix: "feature/",
  releasePrefix: "release/",
  hotfixPrefix: "hotfix/",
  supportPrefix: "support/",
  versionTagPrefix: "",
};

const KINDS: GitFlowBranchKind[] = ["feature", "release", "hotfix", "support"];

export function GitFlowPanel() {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const { branches, setBranches } = useGitStore();
  const { currentRepo } = useRepoStore();

  const localBranchNames = new Set(branches.filter((b) => !b.isRemote).map((b) => b.name));

  const [config, setConfig] = useState<GitFlowConfig | null | undefined>(undefined);
  const [showInit, setShowInit] = useState(false);
  const [initConfig, setInitConfig] = useState<GitFlowConfig>(DEFAULT_CONFIG);
  const [initing, setIniting] = useState(false);

  const [startDialog, setStartDialog] = useState<{ kind: GitFlowBranchKind } | null>(null);
  const [startName, setStartName] = useState("");
  const [starting, setStarting] = useState(false);

  const [finishDialog, setFinishDialog] = useState<{ kind: GitFlowBranchKind; name: string } | null>(null);
  const [finishing, setFinishing] = useState(false);

  const loadConfig = async () => {
    try {
      const cfg = await getGitflowConfigUseCase(repo);
      setConfig(cfg);
    } catch {
      setConfig(null);
    }
  };

  useEffect(() => {
    setConfig(undefined);
    loadConfig();
  }, [currentRepo?.path]);

  const handleInit = async () => {
    setIniting(true);
    try {
      await initGitflowUseCase(repo, initConfig);
      await loadConfig();
      setShowInit(false);
      toast.success(t("gitflow.initDone"));
    } catch (e) {
      toast.error(t("gitflow.initFailed", { error: String(e) }));
    } finally {
      setIniting(false);
    }
  };

  const handleStart = async () => {
    if (!startDialog || !startName.trim()) return;
    setStarting(true);
    try {
      await startGitflowBranchUseCase(repo, startDialog.kind, startName.trim());
      const updated = await listBranchesUseCase(repo, "all");
      setBranches(updated);
      toast.success(t("gitflow.startDone", { kind: startDialog.kind, name: startName.trim() }));
      setStartDialog(null);
      setStartName("");
    } catch (e) {
      toast.error(t("gitflow.startFailed", { error: String(e) }));
    } finally {
      setStarting(false);
    }
  };

  const handleFinish = async () => {
    if (!finishDialog) return;
    setFinishing(true);
    try {
      await finishGitflowBranchUseCase(repo, finishDialog.kind, finishDialog.name);
      const updated = await listBranchesUseCase(repo, "all");
      setBranches(updated);
      toast.success(t("gitflow.finishDone", { kind: finishDialog.kind, name: finishDialog.name }));
      setFinishDialog(null);
    } catch (e) {
      toast.error(t("gitflow.finishFailed", { error: String(e) }));
    } finally {
      setFinishing(false);
    }
  };

  // Detect git-flow branches from the branch list
  const gitflowBranches: { kind: GitFlowBranchKind; name: string; fullName: string }[] = [];
  if (config) {
    for (const b of branches.filter((br) => !br.isRemote)) {
      const prefixMap: Record<GitFlowBranchKind, string> = {
        feature: config.featurePrefix,
        release: config.releasePrefix,
        hotfix: config.hotfixPrefix,
        support: config.supportPrefix,
      };
      for (const kind of KINDS) {
        const prefix = prefixMap[kind];
        if (prefix && b.name.startsWith(prefix)) {
          gitflowBranches.push({ kind, name: b.name.slice(prefix.length), fullName: b.name });
          break;
        }
      }
    }
  }

  if (config === undefined) return null;

  return (
    <div className="border-t border-surface-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] text-text-muted uppercase tracking-widest font-medium">
          Git Flow
        </span>
        {config && (
          <button
            onClick={() => { setInitConfig(config!); setShowInit(true); }}
            className="text-[10px] text-text-muted hover:text-text-primary transition-colors"
            title={t("gitflow.reconfigure")}
          >
            ⚙
          </button>
        )}
      </div>

      {!config ? (
        /* Not initialized */
        <div className="px-3 pb-3 flex flex-col gap-2">
          <p className="text-xs text-text-muted">{t("gitflow.notInitialized")}</p>
          <button
            onClick={() => { setInitConfig(DEFAULT_CONFIG); setShowInit(true); }}
            className="self-start px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
          >
            {t("gitflow.init")}
          </button>
        </div>
      ) : (
        /* Initialized */
        <div className="px-3 pb-3 flex flex-col gap-2">
          {/* Start buttons */}
          <div className="flex gap-1.5 flex-wrap">
            {KINDS.map((kind) => (
              <button
                key={kind}
                onClick={() => { setStartDialog({ kind }); setStartName(""); }}
                className={[
                  "px-2 py-1 text-[11px] rounded border transition-colors font-mono",
                  kindColor(kind),
                ].join(" ")}
              >
                + {kind}
              </button>
            ))}
          </div>

          {/* Active git-flow branches */}
          {gitflowBranches.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              {gitflowBranches.map(({ kind, name, fullName }) => (
                <div
                  key={fullName}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-surface-overlay border border-surface-border"
                >
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${kindBadgeColor(kind)}`}>
                    {kind}
                  </span>
                  <span className="text-xs text-text-primary font-mono flex-1 truncate">{name}</span>
                  <button
                    onClick={() => setFinishDialog({ kind, name })}
                    className="text-[10px] text-emerald-700 hover:text-emerald-600 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors font-medium"
                  >
                    {t("gitflow.finish")}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Init dialog */}
      {showInit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4">
            <p className="text-sm font-semibold text-text-primary">{t("gitflow.initTitle")}</p>
            <div className="flex flex-col gap-3">
              <InitField
                label={t("gitflow.field.master")}
                value={initConfig.master}
                onChange={(v) => setInitConfig((c) => ({ ...c, master: v }))}
                warning={
                  initConfig.master.trim() && !localBranchNames.has(initConfig.master.trim())
                    ? t("gitflow.branchNotFound", { branch: initConfig.master.trim() })
                    : undefined
                }
              />
              <InitField
                label={t("gitflow.field.develop")}
                value={initConfig.develop}
                onChange={(v) => setInitConfig((c) => ({ ...c, develop: v }))}
                hint={
                  initConfig.develop.trim() && !localBranchNames.has(initConfig.develop.trim())
                    ? t("gitflow.branchWillBeCreated")
                    : undefined
                }
              />
              <InitField label={t("gitflow.field.featurePrefix")} value={initConfig.featurePrefix} onChange={(v) => setInitConfig((c) => ({ ...c, featurePrefix: v }))} />
              <InitField label={t("gitflow.field.releasePrefix")} value={initConfig.releasePrefix} onChange={(v) => setInitConfig((c) => ({ ...c, releasePrefix: v }))} />
              <InitField label={t("gitflow.field.hotfixPrefix")} value={initConfig.hotfixPrefix} onChange={(v) => setInitConfig((c) => ({ ...c, hotfixPrefix: v }))} />
              <InitField label={t("gitflow.field.supportPrefix")} value={initConfig.supportPrefix} onChange={(v) => setInitConfig((c) => ({ ...c, supportPrefix: v }))} />
              <InitField label={t("gitflow.field.versionTagPrefix")} value={initConfig.versionTagPrefix} onChange={(v) => setInitConfig((c) => ({ ...c, versionTagPrefix: v }))} placeholder={t("gitflow.field.versionTagPrefixPlaceholder")} />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setInitConfig(config ?? DEFAULT_CONFIG); setShowInit(false); }}
                disabled={initing}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleInit}
                disabled={
                  initing ||
                  !initConfig.master.trim() ||
                  !initConfig.develop.trim() ||
                  (localBranchNames.size > 0 && !localBranchNames.has(initConfig.master.trim()))
                }
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {initing && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {t("gitflow.init")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start branch dialog */}
      {startDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {t("gitflow.startTitle", { kind: startDialog.kind })}
              </p>
              <p className="text-xs text-text-muted mt-0.5 font-mono">
                {kindPrefix(startDialog.kind, config!)}
                <span className="text-text-secondary">{startName || "…"}</span>
              </p>
            </div>
            {config && !localBranchNames.has(baseBranchFor(startDialog.kind, config)) && (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
                {t("gitflow.baseBranchMissing", { base: baseBranchFor(startDialog.kind, config) })}
              </p>
            )}
            <input
              value={startName}
              onChange={(e) => setStartName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleStart(); if (e.key === "Escape") setStartDialog(null); }}
              autoFocus
              placeholder={t("gitflow.namePlaceholder")}
              className="bg-surface-overlay text-text-primary text-sm rounded-md px-3 py-2 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted font-mono"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setStartDialog(null)}
                disabled={starting}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleStart}
                disabled={starting || !startName.trim()}
                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {starting && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {t("gitflow.startButton")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Finish branch dialog */}
      {finishDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-sm mx-4 p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {t("gitflow.finishTitle", { kind: finishDialog.kind })}
              </p>
              <p className="text-xs text-text-muted mt-0.5 font-mono">
                {kindPrefix(finishDialog.kind, config!)}
                {finishDialog.name}
              </p>
            </div>
            <p className="text-xs text-text-secondary">
              {t(`gitflow.finishDescription.${finishDialog.kind}`, {
                name: finishDialog.name,
                master: config!.master,
                develop: config!.develop,
              })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setFinishDialog(null)}
                disabled={finishing}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleFinish}
                disabled={finishing}
                className="px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {finishing && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                {t("gitflow.finishButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InitField({
  label,
  value,
  onChange,
  placeholder,
  warning,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  warning?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        <label className="text-xs text-text-secondary w-28 shrink-0">{label}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? label}
          className={[
            "flex-1 text-text-primary text-xs rounded px-2 py-1.5 border focus:outline-none placeholder:text-text-muted font-mono",
            warning
              ? "bg-surface-overlay border-amber-500/60 focus:border-amber-400"
              : "bg-surface-overlay border-surface-border focus:border-blue-500",
          ].join(" ")}
        />
      </div>
      {warning && (
        <p className="text-[10px] text-amber-400 pl-[7.5rem]">{warning}</p>
      )}
      {!warning && hint && (
        <p className="text-[10px] text-text-muted pl-[7.5rem]">{hint}</p>
      )}
    </div>
  );
}

function kindColor(kind: GitFlowBranchKind) {
  switch (kind) {
    case "feature": return "border-blue-500/50 text-blue-400 hover:border-blue-400 hover:bg-blue-500/10";
    case "release": return "border-green-500/50 text-green-400 hover:border-green-400 hover:bg-green-500/10";
    case "hotfix":  return "border-red-500/50 text-red-400 hover:border-red-400 hover:bg-red-500/10";
    case "support": return "border-purple-500/50 text-purple-400 hover:border-purple-400 hover:bg-purple-500/10";
  }
}

function kindBadgeColor(kind: GitFlowBranchKind) {
  switch (kind) {
    case "feature": return "bg-blue-500/20 text-blue-700 dark:text-blue-300";
    case "release": return "bg-green-500/20 text-green-700 dark:text-green-300";
    case "hotfix":  return "bg-red-500/20 text-red-700 dark:text-red-300";
    case "support": return "bg-purple-500/20 text-purple-700 dark:text-purple-300";
  }
}

function baseBranchFor(kind: GitFlowBranchKind, config: GitFlowConfig): string {
  return kind === "feature" || kind === "release" ? config.develop : config.master;
}

function kindPrefix(kind: GitFlowBranchKind, config: GitFlowConfig): string {
  switch (kind) {
    case "feature": return config.featurePrefix;
    case "release": return config.releasePrefix;
    case "hotfix":  return config.hotfixPrefix;
    case "support": return config.supportPrefix;
  }
}
