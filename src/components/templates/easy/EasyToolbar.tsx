import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useRepoStore } from "../../../store/repoStore";
import { useGitStore } from "../../../store/gitStore";
import type { RemoteInfo } from "../../../domain/entities";
import { useGitRepository } from "../../../infrastructure/GitRepositoryContext";
import { fetchUseCase, fetchAllUseCase, pushUseCase, pullUseCase, listRemotesUseCase } from "../../../usecases/remotes";
import { getDefaultRemoteUseCase } from "../../../usecases/config";
import { getStatusUseCase } from "../../../usecases/staging";
import { listBranchesUseCase, getRepositoryStateUseCase } from "../../../usecases/branches";
import { parseUnknownHost, parseMitmDetected } from "../../../usecases/auth";
import { useAuthStore } from "../../../store/authStore";
import { useUiStore } from "../../../store/uiStore";
import { useSettingsStore } from "../../../store/settingsStore";
import { toast } from "../../../store/toastStore";
import { IconCode, IconFetch, IconFeedback, IconFolder, IconPull, IconPullRequest, IconPush, IconRefresh, IconTools } from "../../atoms/icons";
import { ToolbarButton } from "../../atoms/ToolbarButton";
import { SplitButton } from "../../atoms/SplitButton";
import { DropdownButton } from "../../atoms/DropdownButton";
import { PushDialog } from "../../molecules/PushDialog";
import { FeedbackDialog } from "../../molecules/FeedbackDialog";
import { getAppVersion } from "../../../usecases/app";
import { openInEditor, openFolder } from "../../../services/systemService";

type Op = "refresh" | "fetch" | "fetch-all" | "pull" | "push" | null;

function buildPrUrl(remoteUrl: string, branch: string): string | null {
  try {
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
    if (host.includes("gitea") || host.includes("forgejo") || host.includes("codeberg")) {
      return `https://${host}/${path}/compare/${encodedBranch}`;
    }
  } catch {
    // URL parse failed
  }
  return null;
}

export function EasyToolbar() {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const { currentRepo } = useRepoStore();
  const { branches, setStatus, setBranches, bumpLogVersion } = useGitStore();
  const { setRepositoryState } = useUiStore();
  const [loading, setLoading] = useState<Op>(null);
  const [showPushDialog, setShowPushDialog] = useState(false);
  const [pushDialogRemotes, setPushDialogRemotes] = useState<RemoteInfo[]>([]);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
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
        showTofuModal(unknownHost.host, unknownHost.fingerprint, () => run(op, fn, successMsg));
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

  const handleOpenInEditor = useCallback(async () => {
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
  }, [currentRepo, editorCommand, t]);

  const handleOpenFolder = async () => {
    if (!currentRepo) return;
    try {
      await openFolder(currentRepo.path);
    } catch (e) {
      toast.error(String(e));
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
      if (tofuResult?.error) {
        const unknownHost = parseUnknownHost(tofuResult.error);
        if (unknownHost) {
          showTofuModal(unknownHost.host, unknownHost.fingerprint, async () => {
            setLoading("fetch-all");
            try {
              const retryResults = await fetchAllUseCase(repo);
              retryResults.filter((r) => !r.ok).forEach((r) =>
                toast.error(t("toolbar.fetchAllRemoteFailed", { remote: r.remote, error: r.error }))
              );
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
      if (mitmResult?.error) {
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

  const openPushDialog = async () => {
    try {
      const list = await listRemotesUseCase(repo);
      setPushDialogRemotes(list);
      setShowPushDialog(true);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handlePush = async (remote: string, branchNames: string[], force: boolean) => {
    setShowPushDialog(false);
    setLoading("push");
    try {
      for (const branch of branchNames) {
        await pushUseCase(repo, remote, branch);
      }
      toast.success(t("toolbar.pushDone"));
      setBranches(await listBranchesUseCase(repo, "all"));
    } catch (e) {
      const err = String(e);
      const unknownHost = parseUnknownHost(err);
      const mitm = parseMitmDetected(err);
      if (unknownHost) {
        showTofuModal(unknownHost.host, unknownHost.fingerprint, () => handlePush(remote, branchNames, force));
      } else if (mitm) {
        toast.error(t("sshTofu.mitmWarning", { host: mitm.host, fingerprint: mitm.fingerprint }));
      } else if (err.includes("NotFastForward") || err.includes("non-fastforwardable")) {
        toast.error(t("pushDialog.notFastForward"));
        setPushDialogRemotes(await listRemotesUseCase(repo).catch(() => pushDialogRemotes));
        setShowPushDialog(true);
      } else {
        toast.error(err);
      }
    } finally {
      setLoading(null);
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
            label={t("easy.toolbar.fetch")}
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
            label={t("easy.toolbar.pull")}
            badge={behind}
            loading={loading === "pull"}
            disabled={loading !== null}
            onClick={handlePull}
          />
          <ToolbarButton
            icon={IconPush}
            label={t("easy.toolbar.push")}
            badge={ahead}
            loading={loading === "push"}
            disabled={loading !== null}
            onClick={openPushDialog}
          />
          <div className="w-px h-4 bg-surface-border mx-1 shrink-0" />
          <DropdownButton
            icon={IconTools}
            label={t("toolbar.tools")}
            items={[
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
        </div>
      </header>

      {showFeedbackDialog && (
        <FeedbackDialog
          version={appVersion}
          onClose={() => setShowFeedbackDialog(false)}
        />
      )}

      {showPushDialog && (
        <PushDialog
          remotes={pushDialogRemotes}
          branches={branches}
          defaultRemote={remoteName}
          defaultBranches={[currentBranch]}
          initialForce={false}
          loading={loading === "push"}
          onClose={() => setShowPushDialog(false)}
          onConfirm={handlePush}
        />
      )}
    </>
  );
}
