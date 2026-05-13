import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useRepoStore } from "../../store/repoStore";
import { useGitStore } from "../../store/gitStore";
import type { GitFlowBranchKind, RemoteInfo } from "../../domain/entities";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { fetchUseCase, fetchAllUseCase, pushUseCase, pullUseCase, pushForceWithLeaseUseCase, listRemotesUseCase } from "../../usecases/remotes";
import { getDefaultRemoteUseCase } from "../../usecases/config";
import { getStatusUseCase } from "../../usecases/staging";
import { listBranchesUseCase, getRepositoryStateUseCase } from "../../usecases/branches";
import { parseUnknownHost, parseMitmDetected } from "../../usecases/auth";
import { useAuthStore } from "../../store/authStore";
import { useUiStore } from "../../store/uiStore";
import { useSettingsStore } from "../../store/settingsStore";
import { toast } from "../../store/toastStore";
import { IconCode, IconFetch, IconFeedback, IconFolder, IconForcePush, IconPull, IconPullRequest, IconPush, IconRefresh, IconTerminal, IconTools } from "../atoms/icons";
import { ToolbarButton } from "../atoms/ToolbarButton";
import { SplitButton } from "../atoms/SplitButton";
import { DropdownButton } from "../atoms/DropdownButton";
import { PushDialog } from "../molecules/PushDialog";
import { PushAllTagsResultPanel } from "../molecules/PushAllTagsResultPanel";
import { FeedbackDialog } from "../molecules/FeedbackDialog";
import { pushAllTagsUseCase } from "../../usecases/tags";
import type { TagPushResult } from "../../domain/entities";
import { getAppVersion } from "../../usecases/app";
import { openTerminal, openInEditor, openFolder } from "../../services/systemService";

type Op = "refresh" | "fetch" | "fetch-all" | "pull" | "push" | "force-push" | null;

/** Build a PR creation URL for GitHub, GitLab, Bitbucket or Gitea from a remote URL and branch name. */
function buildPrUrl(remoteUrl: string, branch: string): string | null {
  try {
    // Normalize SSH → HTTPS (git@github.com:user/repo.git → https://github.com/user/repo)
    let url = remoteUrl.trim();
    if (url.startsWith("git@")) {
      url = url.replace(/^git@([^:]+):/, "https://$1/");
    }
    url = url.replace(/\.git$/, "");
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.replace(/^\//, "");
    const encodedBranch = encodeURIComponent(branch);
    if (host === "github.com" || host.endsWith(".github.com")) {
      return `https://github.com/${path}/compare/${encodedBranch}?expand=1`;
    }
    if (host === "gitlab.com" || host.includes("gitlab")) {
      return `https://${host}/${path}/-/merge_requests/new?merge_request[source_branch]=${encodedBranch}`;
    }
    if (host === "bitbucket.org") {
      return `https://bitbucket.org/${path}/pull-requests/new?source=${encodedBranch}`;
    }
    // Gitea / Forgejo — generic fallback
    if (host.includes("gitea") || host.includes("forgejo") || host.includes("codeberg")) {
      return `https://${host}/${path}/compare/${encodedBranch}`;
    }
  } catch {
    // URL parse failed
  }
  return null;
}

export function Toolbar() {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const { currentRepo } = useRepoStore();
  const { branches, setStatus, setBranches, bumpLogVersion, setRemoteTagPresenceForRemote, remoteTagPresence } = useGitStore();
  const { setRepositoryState } = useUiStore();
  const [loading, setLoading] = useState<Op>(null);
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [pushDialogRemotes, setPushDialogRemotes] = useState<RemoteInfo[]>([]);
  const [pushDialogInitialForce, setPushDialogInitialForce] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [pushAllTagsPanel, setPushAllTagsPanel] = useState<{
    remote: string;
    results: TagPushResult[];
  } | null>(null);
  const [appVersion, setAppVersion] = useState("");
  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [defaultRemote, setDefaultRemote] = useState("origin");
  const { editorCommand } = useSettingsStore();
  const { showTofuModal } = useAuthStore();

  useEffect(() => {
    getAppVersion().then(setAppVersion).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentRepo) return;
    Promise.all([
      listRemotesUseCase(repo),
      getDefaultRemoteUseCase(repo),
    ]).then(([list, def]) => {
      setRemotes(list);
      setDefaultRemote(def);
    }).catch(() => {});
  }, [currentRepo, repo]);

  const headBranch = branches.find((b) => b.isHead);
  const currentBranch = headBranch?.name ?? currentRepo?.headBranch ?? "HEAD";
  const ahead = headBranch?.ahead ?? null;
  const behind = headBranch?.behind ?? null;
  const remoteName = headBranch?.upstream?.split("/")[0] ?? defaultRemote;
  const gitflowKind = detectGitflowKind(currentBranch);

  // Build PR URL from the first remote that resolves to a known forge
  const prUrl = useMemo(() => {
    for (const remote of remotes) {
      const url = buildPrUrl(remote.url, currentBranch);
      if (url) return url;
    }
    return null;
  }, [remotes, currentBranch]);

  const handleOpenPr = async () => {
    if (!prUrl) return;
    try {
      await openUrl(prUrl);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const run = async (op: Op, fn: () => Promise<void>, successMsg: string) => {
    setLoading(op);
    try {
      await fn();
      toast.success(successMsg);
    } catch (e) {
      const errStr = String(e);
      const unknownHost = parseUnknownHost(errStr);
      const mitm = parseMitmDetected(errStr);
      if (unknownHost) {
        showTofuModal(unknownHost.host, unknownHost.fingerprint, () =>
          run(op, fn, successMsg)
        );
      } else if (mitm) {
        toast.error(t("sshTofu.mitmWarning", { host: mitm.host, fingerprint: mitm.fingerprint }));
      } else {
        toast.error(errStr);
      }
    } finally {
      setLoading(null);
    }
  };

  const handleRefresh = async () => {
    await run("refresh", async () => {
      const [status, branchList] = await Promise.all([
        getStatusUseCase(repo),
        listBranchesUseCase(repo, "all"),
      ]);
      setStatus(status);
      setBranches(branchList);
    }, t("toolbar.statusRefreshed"));
  };

  const handleOpenTerminal = useCallback(async () => {
    if (!currentRepo) return;
    try {
      await openTerminal(currentRepo.path);
    } catch (e) {
      toast.error(String(e));
    }
  }, [currentRepo]);

  const handleOpenInEditor = async () => {
    if (!currentRepo) return;
    if (!editorCommand.trim()) {
      toast.error(t("toolbar.noEditorConfigured"));
      return;
    }
    try {
      await openInEditor(currentRepo.path, editorCommand.trim());
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleOpenFolder = async () => {
    if (!currentRepo) return;
    try {
      await openFolder(currentRepo.path);
    } catch (e) {
      toast.error(String(e));
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === "Backquote") {
        e.preventDefault();
        handleOpenTerminal();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleOpenTerminal]);

  const openPushDialog = async (force: boolean) => {
    try {
      const remotes = await listRemotesUseCase(repo);
      setPushDialogRemotes(remotes);
      setPushDialogInitialForce(force);
      setShowPushDialog(true);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handlePushAllTags = async (remote: string) => {
    try {
      const results = await pushAllTagsUseCase(repo, remote);
      // Update cache : for each success, add to the remote tag presence set.
      const existing = remoteTagPresence.get(remote) ?? new Set<string>();
      const next = new Set(existing);
      for (const r of results) {
        if (r.success) next.add(r.tagName);
      }
      setRemoteTagPresenceForRemote(remote, Array.from(next));
      setPushAllTagsPanel({ remote, results });
    } catch (e) {
      const err = String(e);
      const unknownHost = parseUnknownHost(err);
      const mitm = parseMitmDetected(err);
      if (unknownHost) {
        showTofuModal(unknownHost.host, unknownHost.fingerprint, () =>
          handlePushAllTags(remote),
        );
      } else if (mitm) {
        toast.error(t("sshTofu.mitmWarning", { host: mitm.host, fingerprint: mitm.fingerprint }));
      } else {
        toast.error(err);
      }
    }
  };

  const handlePush = async (
    remote: string,
    branchNames: string[],
    force: boolean,
    pushAllTags: boolean = false,
  ) => {
    setShowPushDialog(false);
    const op: Op = force ? "force-push" : "push";
    const msg = force ? t("toolbar.forcePushDone") : t("toolbar.pushDone");
    setLoading(op);
    try {
      for (const branch of branchNames) {
        if (force) {
          await pushForceWithLeaseUseCase(repo, remote, branch);
        } else {
          await pushUseCase(repo, remote, branch);
        }
      }
      toast.success(msg);
      const branchList = await listBranchesUseCase(repo, "all");
      setBranches(branchList);
      if (pushAllTags) {
        await handlePushAllTags(remote);
      }
    } catch (e) {
      const err = String(e);
      const unknownHost = parseUnknownHost(err);
      const mitm = parseMitmDetected(err);
      if (unknownHost) {
        showTofuModal(unknownHost.host, unknownHost.fingerprint, () =>
          handlePush(remote, branchNames, force, pushAllTags)
        );
      } else if (mitm) {
        toast.error(t("sshTofu.mitmWarning", { host: mitm.host, fingerprint: mitm.fingerprint }));
      } else if (err.includes("NotFastForward") || err.includes("non-fastforwardable")) {
        toast.error(t("pushDialog.notFastForward"));
        setPushDialogRemotes(await listRemotesUseCase(repo).catch(() => pushDialogRemotes));
        setPushDialogInitialForce(false);
        setShowPushDialog(true);
      } else {
        toast.error(err);
      }
    } finally {
      setLoading(null);
    }
  };

  const handleFetchAll = async () => {
    setLoading("fetch-all");
    try {
      const results = await fetchAllUseCase(repo);
      const failures = results.filter((r) => !r.ok);
      const successes = results.filter((r) => r.ok);
      const tofuResult = failures.find((r) => r.error?.includes("UNKNOWN_HOST:"));
      const mitmResult = failures.find((r) => r.error?.includes("MITM_DETECTED:"));
      if (tofuResult && tofuResult.error) {
        const unknownHost = parseUnknownHost(tofuResult.error);
        if (unknownHost) {
          showTofuModal(unknownHost.host, unknownHost.fingerprint, async () => {
            setLoading("fetch-all");
            try {
              const retryResults = await fetchAllUseCase(repo);
              retryResults.filter((r) => !r.ok).forEach((r) => toast.error(t("toolbar.fetchAllRemoteFailed", { remote: r.remote, error: r.error })));
              if (retryResults.some((r) => r.ok)) {
                toast.success(t("toolbar.fetchAllDone"));
                setBranches(await listBranchesUseCase(repo, "all"));
              }
            } finally {
              setLoading(null);
            }
          });
          return;
        }
      }
      if (mitmResult && mitmResult.error) {
        const mitm = parseMitmDetected(mitmResult.error);
        if (mitm) toast.error(t("sshTofu.mitmWarning", { host: mitm.host, fingerprint: mitm.fingerprint }));
      }
      failures
        .filter((r) => !r.error?.includes("UNKNOWN_HOST:") && !r.error?.includes("MITM_DETECTED:"))
        .forEach((r) => toast.error(t("toolbar.fetchAllRemoteFailed", { remote: r.remote, error: r.error })));
      if (successes.length > 0 && failures.length === 0) {
        toast.success(t("toolbar.fetchAllDone"));
      } else if (successes.length > 0) {
        toast.success(t("toolbar.fetchAllPartial", { count: successes.length }));
      }
      if (successes.length > 0) {
        setBranches(await listBranchesUseCase(repo, "all"));
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(null);
    }
  };

  const handlePull = async () => {
    setLoading("pull");
    try {
      await pullUseCase(repo, remoteName, currentBranch);
      toast.success(t("toolbar.pullDone"));
    } catch (e) {
      const errStr = String(e);
      const unknownHost = parseUnknownHost(errStr);
      const mitm = parseMitmDetected(errStr);
      if (unknownHost) {
        showTofuModal(unknownHost.host, unknownHost.fingerprint, async () => {
          await pullUseCase(repo, remoteName, currentBranch);
          toast.success(t("toolbar.pullDone"));
        });
      } else if (mitm) {
        toast.error(t("sshTofu.mitmWarning", { host: mitm.host, fingerprint: mitm.fingerprint }));
      } else {
        toast.error(errStr);
      }
    } finally {
      setLoading(null);
      // Toujours rafraîchir statut + état dépôt (conflit ou non)
      const [status, branchList, repoState] = await Promise.all([
        getStatusUseCase(repo),
        listBranchesUseCase(repo, "all"),
        getRepositoryStateUseCase(repo),
      ]);
      setStatus(status);
      setBranches(branchList);
      setRepositoryState(repoState);
      bumpLogVersion();
    }
  };

  if (!currentRepo) {
    return (
      <header className="flex items-center px-4 py-2 bg-surface-elevated border-b border-surface-border shrink-0 h-11">
        <span className="text-sm font-bold text-text-primary">Mc-Git</span>
      </header>
    );
  }

  return (
    <>
      <header className="flex items-center gap-2 px-4 py-2 bg-surface-elevated border-b border-surface-border shrink-0 h-11">
        <span className="text-sm font-bold text-text-primary mr-1 shrink-0">Mc-Git</span>
        <div className="flex items-center gap-2 flex-1 overflow-x-auto py-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          <ToolbarButton
            icon={IconRefresh}
            label={t("toolbar.refresh")}
            loading={loading === "refresh"}
            disabled={loading !== null}
            onClick={handleRefresh}
          />
          <SplitButton
            icon={IconFetch}
            label={t("toolbar.fetch")}
            loading={loading === "fetch"}
            dropdownLoading={loading === "fetch-all"}
            disabled={loading !== null}
            onClick={() => run("fetch", async () => {
              await fetchUseCase(repo, remoteName);
              setBranches(await listBranchesUseCase(repo, "all"));
            }, t("toolbar.fetchDone"))}
            items={[{
              icon: IconFetch,
              label: t("toolbar.fetchAll"),
              onClick: handleFetchAll,
            }]}
          />
          <ToolbarButton
            icon={IconPull}
            label={t("toolbar.pull")}
            badge={behind}
            loading={loading === "pull"}
            disabled={loading !== null}
            onClick={handlePull}
          />
          <SplitButton
            icon={IconPush}
            label={t("toolbar.push")}
            badge={ahead}
            loading={loading === "push"}
            dropdownLoading={loading === "force-push"}
            disabled={loading !== null}
            onClick={() => openPushDialog(false)}
            items={[{
              icon: IconForcePush,
              label: t("toolbar.forcePush"),
              onClick: () => openPushDialog(true),
              className: "text-orange-400 hover:text-orange-300",
            }]}
          />
          <div className="w-px h-4 bg-surface-border mx-1 shrink-0" />
          <DropdownButton
            icon={IconTools}
            label={t("toolbar.tools")}
            items={[
              { icon: IconTerminal, label: t("toolbar.terminal"), onClick: handleOpenTerminal },
              { icon: IconFolder, label: t("toolbar.openFolder"), onClick: handleOpenFolder },
              { icon: IconCode, label: t("toolbar.openInEditor"), onClick: handleOpenInEditor },
              { icon: IconFeedback, label: t("toolbar.feedback"), onClick: () => setShowFeedbackDialog(true) },
              ...(prUrl ? [{ icon: IconPullRequest, label: t("toolbar.createPr"), onClick: handleOpenPr }] : []),
            ]}
          />
        </div>

        {/* Branch pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-overlay border border-surface-border text-xs text-text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <span className="font-mono max-w-[160px] truncate">{currentBranch}</span>
          {gitflowKind && (
            <span className={`text-[9px] font-bold uppercase tracking-wide px-1 py-0.5 rounded ${gitflowBadgeColor(gitflowKind)}`}>
              {gitflowKind}
            </span>
          )}
        </div>
      </header>

      {/* Feedback dialog */}
      {showFeedbackDialog && (
        <FeedbackDialog
          version={appVersion}
          onClose={() => setShowFeedbackDialog(false)}
        />
      )}

      {/* Push dialog */}
      {showPushDialog && (
        <PushDialog
          remotes={pushDialogRemotes}
          branches={branches}
          defaultRemote={remoteName}
          defaultBranches={[currentBranch]}
          initialForce={pushDialogInitialForce}
          loading={loading === "push" || loading === "force-push"}
          onClose={() => setShowPushDialog(false)}
          onConfirm={handlePush}
        />
      )}

      {pushAllTagsPanel && (
        <PushAllTagsResultPanel
          remote={pushAllTagsPanel.remote}
          results={pushAllTagsPanel.results}
          onClose={() => setPushAllTagsPanel(null)}
          onRetryFailed={async () => {
            await handlePushAllTags(pushAllTagsPanel.remote);
          }}
        />
      )}
    </>
  );
}

const GITFLOW_PREFIXES: [string, GitFlowBranchKind][] = [
  ["feature/", "feature"],
  ["release/", "release"],
  ["hotfix/", "hotfix"],
  ["support/", "support"],
];

function detectGitflowKind(branch: string): GitFlowBranchKind | null {
  for (const [prefix, kind] of GITFLOW_PREFIXES) {
    if (branch.startsWith(prefix)) return kind;
  }
  return null;
}

function gitflowBadgeColor(kind: GitFlowBranchKind) {
  switch (kind) {
    case "feature": return "bg-blue-500/30 text-blue-700 dark:text-blue-300";
    case "release": return "bg-green-500/30 text-green-700 dark:text-green-300";
    case "hotfix":  return "bg-red-500/30 text-red-700 dark:text-red-300";
    case "support": return "bg-purple-500/30 text-purple-700 dark:text-purple-300";
  }
}
