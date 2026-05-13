import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "../../store/toastStore";
import { useGitStore } from "../../store/gitStore";
import { useUiStore } from "../../store/uiStore";
import { useAuthStore } from "../../store/authStore";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { useRepoStore } from "../../store/repoStore";
import {
  listTagsUseCase,
  createTagUseCase,
  pushTagUseCase,
  deleteTagUseCase,
} from "../../usecases/tags";
import { validateTagName } from "../../usecases/tags/validation";
import { parseTagRemoteDivergent } from "../../usecases/tags/errors";
import { listRemotesUseCase } from "../../usecases/remotes";
import { getDefaultRemoteUseCase } from "../../usecases/config";
import { parseAuthRequired, parseUnknownHost, parseMitmDetected } from "../../usecases/auth";
import { TargetRefPicker } from "../molecules/TargetRefPicker";
import { TagForcePushDialog } from "../molecules/TagForcePushDialog";
import { TagDeleteDialog } from "../molecules/TagDeleteDialog";
import type { TagInfo, RemoteInfo } from "../../domain/entities";

const HEAD_VALUE = "HEAD";

interface PendingCreate {
  name: string;
  targetOid: string;
  message: string | null;
}

interface PushMenuState {
  tag: TagInfo;
  x: number;
  y: number;
}

interface ForcePushDialogState {
  tag: string;
  remote: string;
  remoteOid: string;
  localOid: string;
}

interface ContextMenuState {
  tag: TagInfo;
  x: number;
  y: number;
}

export function TagList() {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const { currentRepo } = useRepoStore();
  const { tags, setTags, branches, remoteTagPresence, setRemoteTagPresenceForRemote, bumpLogVersion } =
    useGitStore();
  const { setActiveView, setHighlightedOid, highlightedTagName, setHighlightedTagName } = useUiStore();
  const { showAuthModal, showTofuModal } = useAuthStore();

  const [filter, setFilter] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const highlightedRowRef = useRef<HTMLDivElement | null>(null);

  const [name, setName] = useState("");
  const [target, setTarget] = useState(HEAD_VALUE);
  const [annotated, setAnnotated] = useState(true);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [detachedDialog, setDetachedDialog] = useState<PendingCreate | null>(null);

  const [remotes, setRemotes] = useState<RemoteInfo[]>([]);
  const [defaultRemote, setDefaultRemote] = useState<string | null>(null);
  const [pushMenu, setPushMenu] = useState<PushMenuState | null>(null);
  const [pushing, setPushing] = useState<{ tag: string; remote: string } | null>(null);
  const [forcePushDialog, setForcePushDialog] = useState<ForcePushDialogState | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<TagInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!contextMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [contextMenu]);

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

  const refreshRemotes = async () => {
    try {
      setRemotes(await listRemotesUseCase(repo));
    } catch {
      // non-fatal — la TagList reste utilisable même sans remotes
    }
    try {
      setDefaultRemote(await getDefaultRemoteUseCase(repo));
    } catch {
      setDefaultRemote(null);
    }
  };

  useEffect(() => {
    refresh();
    refreshRemotes();
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

  const headBranch = branches.find((b) => !b.isRemote && b.isHead) ?? null;
  const isDetachedHead = headBranch === null;

  const resolveTargetOid = (value: string): string | null => {
    if (value === HEAD_VALUE) return headBranch?.headOid ?? null;
    const branch = branches.find((b) => b.name === value);
    if (branch && branch.headOid) return branch.headOid;
    return /^[0-9a-fA-F]{40}$/.test(value) ? value : null;
  };

  const nameValidation = validateTagName(name);
  const messageValid = !annotated || message.trim().length > 0;
  const canCreate = nameValidation.ok && messageValid && !creating && target.length > 0;

  const resetForm = () => {
    setName("");
    setMessage("");
    setTarget(HEAD_VALUE);
  };

  const performCreate = async (pending: PendingCreate) => {
    setCreating(true);
    try {
      await createTagUseCase(repo, pending.name, pending.targetOid, pending.message);
      toast.success(t("tags.create.done", { name: pending.name }));
      resetForm();
      await refresh();
      bumpLogVersion();
    } catch (err) {
      const errStr = String(err);
      if (
        errStr.includes("TagAlreadyExistsLocal") ||
        errStr.toLowerCase().includes("already exists")
      ) {
        toast.error(t("tags.create.alreadyExists", { name: pending.name }));
      } else {
        toast.error(t("tags.create.failed", { error: errStr }));
      }
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    const oid = resolveTargetOid(target);
    if (!oid) {
      toast.error(t("tags.create.failed", { error: t("tags.create.invalidTarget") }));
      return;
    }
    const pending: PendingCreate = {
      name: name.trim(),
      targetOid: oid,
      message: annotated ? message.trim() : null,
    };
    if (isDetachedHead && target === HEAD_VALUE) {
      setDetachedDialog(pending);
      return;
    }
    await performCreate(pending);
  };

  const presentOnRemotesFor = (tagName: string): string[] => {
    const remotesList: string[] = [];
    remoteTagPresence.forEach((set, remoteName) => {
      if (set.has(tagName)) remotesList.push(remoteName);
    });
    return remotesList.sort();
  };

  const performDelete = async (tag: TagInfo) => {
    setDeleting(true);
    try {
      await deleteTagUseCase(repo, tag.name);
      toast.success(t("tags.delete.done", { name: tag.name }));
      setDeleteDialog(null);
      await refresh();
      bumpLogVersion();
    } catch (err) {
      const errStr = String(err);
      if (
        errStr.toLowerCase().includes("not found") ||
        errStr.includes("TagNotFoundLocal")
      ) {
        toast.info(t("tags.delete.alreadyGone", { name: tag.name }));
        setDeleteDialog(null);
        await refresh();
      } else {
        toast.error(t("tags.delete.failed", { name: tag.name, error: errStr }));
      }
    } finally {
      setDeleting(false);
    }
  };

  const updateRemoteTagCache = (remoteName: string, tagName: string) => {
    const current = remoteTagPresence.get(remoteName);
    const next = new Set(current ?? []);
    next.add(tagName);
    setRemoteTagPresenceForRemote(remoteName, Array.from(next));
  };

  const performPush = async (tagName: string, remoteName: string, force: boolean) => {
    setPushing({ tag: tagName, remote: remoteName });
    try {
      await pushTagUseCase(repo, remoteName, tagName, force);
      toast.success(
        t(force ? "tags.push.forceDone" : "tags.push.done", {
          tag: tagName,
          remote: remoteName,
        }),
      );
      updateRemoteTagCache(remoteName, tagName);
      setForcePushDialog(null);
    } catch (err) {
      const errStr = String(err);
      const divergent = parseTagRemoteDivergent(errStr);
      if (divergent) {
        setForcePushDialog({
          tag: divergent.tag,
          remote: divergent.remote,
          remoteOid: divergent.remoteOid,
          localOid: divergent.localOid,
        });
        return;
      }
      const authHost = parseAuthRequired(errStr);
      const unknownHost = parseUnknownHost(errStr);
      const mitm = parseMitmDetected(errStr);
      if (authHost) {
        showAuthModal(authHost);
      } else if (unknownHost) {
        showTofuModal(unknownHost.host, unknownHost.fingerprint, () =>
          performPush(tagName, remoteName, force),
        );
      } else if (mitm) {
        toast.error(t("sshTofu.mitmWarning", { host: mitm.host, fingerprint: mitm.fingerprint }));
      } else {
        toast.error(t("tags.push.failed", { tag: tagName, remote: remoteName, error: errStr }));
      }
    } finally {
      setPushing(null);
    }
  };

  const filterLower = filter.toLowerCase();
  const localTags = tags.filter(
    (tag) => filterLower === "" || tag.name.toLowerCase().includes(filterLower),
  );

  const remoteTagsHasData = remoteTagPresence.size > 0;
  const remoteTagNames = remoteTagsHasData
    ? Array.from(
        new Set(Array.from(remoteTagPresence.values()).flatMap((set) => Array.from(set))),
      )
        .filter((tagName) => filterLower === "" || tagName.toLowerCase().includes(filterLower))
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
    const isPushingThis = pushing?.tag === tag.name;

    return (
      <div
        key={tag.name}
        ref={isHighlighted ? highlightedRowRef : undefined}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ tag, x: e.clientX, y: e.clientY });
        }}
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
          title={
            remotes.length === 0
              ? t("tags.push.noRemote")
              : t("tags.menu.pushTo")
          }
          disabled={remotes.length === 0 || isPushingThis}
          onClick={(e) => {
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
            setPushMenu({ tag, x: rect.right, y: rect.bottom });
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-text-muted hover:text-blue-400 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isPushingThis ? (
            <span className="w-3 h-3 rounded-full border-2 border-blue-400/40 border-t-blue-400 animate-spin inline-block" />
          ) : (
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path d="M8 4v8M5 7l3-3 3 3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 13h10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          )}
        </button>
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

  const showInvalidName = name.length > 0 && !nameValidation.ok;

  return (
    <div className="flex flex-col h-full overflow-hidden" onClick={() => setPushMenu(null)}>
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-3 border-b border-surface-border">
        <div className="flex gap-2 items-stretch">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={creating}
            placeholder={t("tags.create.namePlaceholder")}
            className="flex-1 bg-surface-elevated text-text-primary text-sm rounded-md px-3 py-1.5 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted disabled:opacity-50"
          />
          <TargetRefPicker value={target} onChange={setTarget} disabled={creating} />
          <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={annotated}
              onChange={(e) => setAnnotated(e.target.checked)}
              disabled={creating}
              className="w-3.5 h-3.5 accent-blue-500"
            />
            <span className="text-xs text-text-secondary">{t("tags.create.annotated")}</span>
          </label>
          <button
            type="submit"
            disabled={!canCreate}
            className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-surface-elevated disabled:text-text-muted text-white rounded-md transition-colors shrink-0"
          >
            {creating ? t("tags.create.creating") : t("tags.create.button")}
          </button>
        </div>
        {showInvalidName && (
          <p className="text-xs text-red-400">
            {t(`tags.create.invalidName.${nameValidation.reason}`)}
          </p>
        )}
        {annotated && (
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={creating}
            rows={3}
            placeholder={t("tags.create.messagePlaceholder")}
            className="bg-surface-elevated text-text-primary text-xs rounded-md px-3 py-2 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted resize-none disabled:opacity-50"
          />
        )}
      </form>

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

      {pushMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPushMenu(null)} />
          <div
            style={{ top: pushMenu.y + 4, left: Math.max(8, pushMenu.x - 200) }}
            className="fixed z-50 bg-surface-elevated border border-surface-border rounded-lg shadow-2xl py-1 min-w-52 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[10px] text-text-muted uppercase tracking-widest px-3 py-1.5 font-medium">
              {t("tags.menu.pushTo")}
            </p>
            {remotes.map((r) => {
              const isDefault = r.name === defaultRemote;
              return (
                <button
                  key={r.name}
                  onClick={() => {
                    const tagName = pushMenu.tag.name;
                    setPushMenu(null);
                    performPush(tagName, r.name, false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors flex items-center gap-2"
                >
                  <span className="flex-1">{r.name}</span>
                  {isDefault && (
                    <span className="text-[9px] uppercase tracking-wide text-blue-400 font-semibold">
                      {t("tags.push.default")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {detachedDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-5 flex flex-col gap-4">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {t("tags.create.detachedHead.title")}
              </p>
              <p className="text-xs text-text-muted mt-0.5 font-mono">
                {detachedDialog.targetOid.slice(0, 7)}
              </p>
            </div>
            <p className="text-xs text-text-secondary whitespace-pre-line">
              {t("tags.create.detachedHead.body")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDetachedDialog(null);
                  resetForm();
                }}
                disabled={creating}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={async () => {
                  const pending = detachedDialog;
                  setDetachedDialog(null);
                  await performCreate(pending);
                }}
                disabled={creating}
                className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white rounded-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {creating && (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                )}
                {t("tags.create.detachedHead.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {forcePushDialog && (
        <TagForcePushDialog
          tag={forcePushDialog.tag}
          remote={forcePushDialog.remote}
          remoteOid={forcePushDialog.remoteOid}
          localOid={forcePushDialog.localOid}
          loading={pushing?.tag === forcePushDialog.tag && pushing?.remote === forcePushDialog.remote}
          onClose={() => setForcePushDialog(null)}
          onConfirm={() => performPush(forcePushDialog.tag, forcePushDialog.remote, true)}
        />
      )}

      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-50 bg-surface-elevated border border-surface-border rounded-lg shadow-2xl py-1 min-w-44 overflow-hidden"
          >
            <button
              onClick={() => {
                handleNavigateToCommit(contextMenu.tag.targetOid);
                setContextMenu(null);
              }}
              className="w-full text-left px-4 py-2 text-sm text-text-primary hover:bg-surface-hover transition-colors"
            >
              {t("tags.menu.viewInHistory")}
            </button>
            <div className="border-t border-surface-border my-1" />
            <button
              onClick={() => {
                setDeleteDialog(contextMenu.tag);
                setContextMenu(null);
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-surface-hover transition-colors"
            >
              {t("tags.menu.deleteLocal")}
            </button>
          </div>
        </>
      )}

      {deleteDialog && (
        <TagDeleteDialog
          mode="local"
          tag={deleteDialog}
          presentOnRemotes={presentOnRemotesFor(deleteDialog.name)}
          loading={deleting}
          onClose={() => setDeleteDialog(null)}
          onConfirm={() => performDelete(deleteDialog)}
        />
      )}
    </div>
  );
}
