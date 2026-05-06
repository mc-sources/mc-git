import React, { useState, useEffect, useCallback } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { useRepoStore } from "../../store/repoStore";
import { useGitStore } from "../../store/gitStore";
import { useUiStore } from "../../store/uiStore";
import { useSettingsStore, type Theme, type Lang, type GitBackend } from "../../store/settingsStore";
import { useLogStore } from "../../store/logStore";
import { getGitConfigUseCase, setGitConfigUseCase } from "../../usecases/config";
import type { GpgKeyInfo } from "../../domain/entities";
import { closeRepositoryUseCase } from "../../usecases/repository";
import { getAppVersion } from "../../usecases/app";
import {
  listSshKeysUseCase,
  listSavedHostsUseCase,
  saveCredentialsUseCase,
  clearCredentialsUseCase,
} from "../../usecases/auth";
import type { SshKeyInfo } from "../../domain/ports/IGitRepository";
import { toast } from "../../store/toastStore";
import { useTranslation } from "react-i18next";
import { copyToClipboard, saveReport, listGpgKeys } from "../../services/systemService";
import { AboutView } from "./about/AboutView";

type Tab = "repo" | "app" | "auth" | "shortcuts" | "about";

const THEME_VALUES: Theme[] = ["dark", "light", "system"];
const LANG_OPTIONS: { value: Lang; labelKey: string }[] = [
  { value: "fr", labelKey: "settings.language.fr" },
  { value: "en", labelKey: "settings.language.en" },
  { value: "es", labelKey: "settings.language.es" },
];

export function SettingsView() {
  const repo = useGitRepository();
  const { currentRepo, setCurrentRepo } = useRepoStore();
  const { setStatus, setBranches, setLog, setGraphCommits } = useGitStore();
  const { setActiveView, setSelectedFile, setCurrentDiff, setCurrentCommitDetail, settingsRequest, setSettingsRequest } = useUiStore();
  const { t } = useTranslation();
  const { theme, setTheme, lang, setLang, editorCommand, setEditorCommand, diffToolCommand, setDiffToolCommand, backend, setBackend, easyMode, setEasyMode, autoFetch, setAutoFetch, autoFetchIntervalMinutes, setAutoFetchIntervalMinutes } = useSettingsStore();
  const { entries: logEntries } = useLogStore();

  const [tab, setTab] = useState<Tab>("repo");
  const [aboutAnchor, setAboutAnchor] = useState<string | undefined>(undefined);

  // Honor a deep-link request to open Settings on a specific tab/anchor.
  useEffect(() => {
    if (!settingsRequest) return;
    const requested = settingsRequest.tab as Tab;
    if (["repo", "app", "auth", "shortcuts", "about"].includes(requested)) {
      setTab(requested);
      setAboutAnchor(settingsRequest.anchor);
    }
    setSettingsRequest(null);
  }, [settingsRequest, setSettingsRequest]);
  const [gitBinaryInfo, setGitBinaryInfo] = useState<{ path: string; version: string } | null>(null);
  const [gitBinaryError, setGitBinaryError] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [editor, setEditor] = useState("");
  const [global, setGlobal] = useState(false);
  const [saving, setSaving] = useState(false);

  // GPG state (repo tab)
  const [gpgKeys, setGpgKeys] = useState<GpgKeyInfo[]>([]);
  const [gpgLoading, setGpgLoading] = useState(false);
  const [gpgError, setGpgError] = useState<string | null>(null);
  const [savingGpg, setSavingGpg] = useState(false);

  // Auth tab state
  const [sshKeys, setSshKeys] = useState<SshKeyInfo[]>([]);
  const [savedHosts, setSavedHosts] = useState<string[]>([]);
  const [httpsHost, setHttpsHost] = useState("");
  const [httpsUsername, setHttpsUsername] = useState("");
  const [httpsToken, setHttpsToken] = useState("");
  const [savingCred, setSavingCred] = useState(false);

  const handleBackendChange = async (newBackend: GitBackend) => {
    setBackend(newBackend);
    if (newBackend === "cli") {
      try {
        const info = await repo.detectGitBinary();
        setGitBinaryInfo(info);
        setGitBinaryError(false);
      } catch {
        setGitBinaryInfo(null);
        setGitBinaryError(true);
      }
    }
  };

  const loadConfig = useCallback(async () => {
    try {
      const [n, e, ed] = await Promise.all([
        getGitConfigUseCase(repo, "user.name", global),
        getGitConfigUseCase(repo, "user.email", global),
        getGitConfigUseCase(repo, "core.editor", global),
      ]);
      setName(n ?? "");
      setEmail(e ?? "");
      setEditor(ed ?? "");
    } catch {
      // Config may not exist yet — start empty
    }
  }, [repo, global]);

  const loadGpgKeys = async () => {
    setGpgLoading(true);
    setGpgError(null);
    try {
      const keys = await listGpgKeys();
      setGpgKeys(keys);
    } catch (e) {
      setGpgError(String(e));
    } finally {
      setGpgLoading(false);
    }
  };

  const handleSelectGpgKey = async (keyId: string) => {
    setSavingGpg(true);
    try {
      await setGitConfigUseCase(repo, "user.signingkey", keyId, global);
      await setGitConfigUseCase(repo, "commit.gpgsign", "true", global);
      toast.success(t("settings.gpg.keySet", { keyId }));
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSavingGpg(false);
    }
  };

  const handleDisableGpgSign = async () => {
    setSavingGpg(true);
    try {
      await setGitConfigUseCase(repo, "commit.gpgsign", "false", global);
      toast.success(t("settings.gpg.disabled"));
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSavingGpg(false);
    }
  };

  const loadAuthData = useCallback(async () => {
    try {
      const [keys, hosts] = await Promise.all([
        listSshKeysUseCase(repo),
        listSavedHostsUseCase(repo),
      ]);
      setSshKeys(keys);
      setSavedHosts(hosts);
    } catch {
      // Ignore
    }
  }, [repo]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (tab === "auth") {
      loadAuthData();
    }
  }, [tab, loadAuthData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const tasks: Promise<void>[] = [];
      if (name.trim()) tasks.push(setGitConfigUseCase(repo, "user.name", name.trim(), global));
      if (email.trim()) tasks.push(setGitConfigUseCase(repo, "user.email", email.trim(), global));
      if (editor.trim()) tasks.push(setGitConfigUseCase(repo, "core.editor", editor.trim(), global));
      await Promise.all(tasks);
      toast.success(t("settings.saved"));
    } catch (e) {
      toast.error(t("settings.configError", { error: String(e) }));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!httpsHost.trim() || !httpsUsername.trim() || !httpsToken.trim()) {
      toast.error(t("settings.credentialRequired"));
      return;
    }
    setSavingCred(true);
    try {
      await saveCredentialsUseCase(repo, httpsHost.trim(), httpsUsername.trim(), httpsToken.trim());
      toast.success(t("settings.credentialSaved", { host: httpsHost.trim() }));
      setHttpsHost("");
      setHttpsUsername("");
      setHttpsToken("");
      await loadAuthData();
    } catch (e) {
      toast.error(t("settings.credentialError", { error: String(e) }));
    } finally {
      setSavingCred(false);
    }
  };

  const handleClearCredentials = async (host: string) => {
    try {
      await clearCredentialsUseCase(repo, host);
      toast.success(t("settings.credentialDeleted", { host }));
      await loadAuthData();
    } catch (e) {
      toast.error(t("settings.credentialError", { error: String(e) }));
    }
  };

  const buildReport = async (): Promise<string> => {
    const version = await getAppVersion();
    const lines: string[] = [
      "=== Mc-Git Error Report ===",
      `Date      : ${new Date().toISOString()}`,
      `Version   : ${version}`,
      `Platform  : ${navigator.userAgent}`,
      `Repository: ${currentRepo ? `${currentRepo.path} (${currentRepo.name})` : "none"}`,
      "",
      `=== Recent Logs (last ${Math.min(logEntries.length, 100)}) ===`,
    ];
    for (const e of logEntries.slice(-100)) {
      const ts = new Date(e.timestamp).toISOString().slice(11, 19);
      lines.push(`[${e.level.toUpperCase()}] ${ts} ${e.command}${e.message ? ` — ${e.message}` : ""}`);
    }
    return lines.join("\n");
  };

  const handleCopyReport = async () => {
    try {
      const report = await buildReport();
      await copyToClipboard(report);
      toast.success(t("settings.reportCopied"));
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleSaveReport = async () => {
    try {
      const path = await saveDialog({
        defaultPath: `mcgit-report-${new Date().toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "-")}.txt`,
        filters: [{ name: "Text", extensions: ["txt"] }],
      });
      if (!path) return;
      const report = await buildReport();
      await saveReport(path, report);
      toast.success(t("settings.reportSaved"));
    } catch (e) {
      toast.error(t("settings.reportSaveFailed", { error: String(e) }));
    }
  };

  const handleClose = async () => {
    try {
      await closeRepositoryUseCase(repo);
    } catch {
      // Best-effort close
    }
    setCurrentRepo(null);
    setStatus([]);
    setBranches([]);
    setLog([], false);
    setGraphCommits([]);
    setSelectedFile(null);
    setCurrentDiff(null);
    setCurrentCommitDetail(null);
    setActiveView("changes");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-surface-border px-4 shrink-0">
        {(["repo", "app", "auth", "shortcuts", "about"] as Tab[]).map((tabId) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={[
              "px-4 py-3 text-sm border-b-2 transition-colors",
              tab === tabId
                ? "border-blue-500 text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            {t(`settings.tab.${tabId}`)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "repo" && (
          <div className="max-w-lg flex flex-col gap-6">
            {/* Local / Global toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-text-secondary">{t("settings.scope")}</span>
              <button
                onClick={() => setGlobal(false)}
                className={[
                  "px-3 py-1 text-xs rounded-md border transition-colors",
                  !global
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "border-surface-border text-text-secondary hover:text-text-primary",
                ].join(" ")}
              >
                {t("settings.scope.local")}
              </button>
              <button
                onClick={() => setGlobal(true)}
                className={[
                  "px-3 py-1 text-xs rounded-md border transition-colors",
                  global
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "border-surface-border text-text-secondary hover:text-text-primary",
                ].join(" ")}
              >
                {t("settings.scope.global")}
              </button>
            </div>

            {/* Fields */}
            <Field label={t("settings.field.name")} value={name} onChange={setName} placeholder={t("settings.field.namePlaceholder")} />
            <Field label={t("settings.field.email")} value={email} onChange={setEmail} placeholder={t("settings.field.emailPlaceholder")} type="email" />
            <Field label={t("settings.field.editor")} value={editor} onChange={setEditor} placeholder={t("settings.field.editorPlaceholder")} />

            <button
              onClick={handleSave}
              disabled={saving}
              className="self-start px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-surface-overlay disabled:text-text-muted text-white rounded-md transition-colors"
            >
              {saving ? t("common.saving") : t("common.save")}
            </button>

            {/* GPG signing */}
            <div className="border-t border-surface-border pt-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs text-text-secondary uppercase tracking-wide">{t("settings.gpg.title")}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={loadGpgKeys}
                    disabled={gpgLoading}
                    className="text-xs px-2 py-0.5 rounded border border-surface-border text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {gpgLoading ? t("common.loading") : t("settings.gpg.listKeys")}
                  </button>
                  <button
                    onClick={handleDisableGpgSign}
                    disabled={savingGpg}
                    className="text-xs px-2 py-0.5 rounded border border-surface-border text-text-secondary hover:text-red-400 transition-colors"
                  >
                    {t("settings.gpg.disable")}
                  </button>
                </div>
              </div>
              {gpgError && (
                <p className="text-xs text-red-400">{gpgError}</p>
              )}
              {gpgKeys.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {gpgKeys.map((key) => (
                    <li key={key.keyId} className="flex items-center gap-3 px-3 py-2 bg-surface-overlay rounded-md border border-surface-border">
                      <span className="text-xs font-mono text-text-muted flex-shrink-0">{key.keyId.slice(-8)}</span>
                      <span className="text-xs text-text-primary flex-1 truncate">{key.uid}</span>
                      <button
                        onClick={() => handleSelectGpgKey(key.keyId)}
                        disabled={savingGpg}
                        className="text-xs px-2 py-0.5 rounded border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 transition-colors shrink-0"
                      >
                        {t("settings.gpg.use")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-text-muted">{t("settings.gpg.note")}</p>
            </div>

            {/* Danger zone */}
            <div className="border-t border-surface-border pt-6">
              <h3 className="text-xs text-text-secondary uppercase tracking-wide mb-4">{t("settings.section.repo")}</h3>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm text-red-400 border border-red-900/50 rounded-md hover:bg-red-900/20 transition-colors"
              >
                {t("settings.closeRepo")}
              </button>
            </div>
          </div>
        )}

        {tab === "app" && (
          <div className="max-w-lg flex flex-col gap-6">
            <div>
              <label className="block text-sm text-text-secondary mb-3">{t("settings.diffTool")}</label>
              <input
                type="text"
                value={diffToolCommand}
                onChange={(e) => setDiffToolCommand(e.target.value)}
                placeholder={t("settings.diffToolPlaceholder")}
                className="w-full bg-surface-elevated text-text-primary text-sm rounded-md px-3 py-2 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted transition-colors font-mono"
              />
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs text-text-muted">{t("settings.editorPresets")}</span>
                {["vimdiff", "meld", "kdiff3", "code --diff", "bcompare"].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setDiffToolCommand(preset)}
                    className="text-xs px-2 py-0.5 rounded border border-surface-border text-text-secondary hover:text-text-primary hover:border-blue-500 transition-colors font-mono"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-3">{t("settings.editorCommand")}</label>
              <input
                type="text"
                value={editorCommand}
                onChange={(e) => setEditorCommand(e.target.value)}
                placeholder={t("settings.editorCommandPlaceholder")}
                className="w-full bg-surface-elevated text-text-primary text-sm rounded-md px-3 py-2 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted transition-colors font-mono"
              />
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs text-text-muted">{t("settings.editorPresets")}</span>
                {["code", "zed", "hx", "subl", "cursor", "webstorm"].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setEditorCommand(preset)}
                    className="text-xs px-2 py-0.5 rounded border border-surface-border text-text-secondary hover:text-text-primary hover:border-blue-500 transition-colors font-mono"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-3">{t("settings.theme")}</label>
              <div className="flex gap-2">
                {THEME_VALUES.map((value) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={[
                      "px-4 py-2 text-sm rounded-md border transition-colors",
                      theme === value
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "border-surface-border text-text-secondary hover:text-text-primary",
                    ].join(" ")}
                  >
                    {t(`settings.theme.${value}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-3">{t("settings.language")}</label>
              <div className="flex gap-2">
                {LANG_OPTIONS.map(({ value, labelKey }) => (
                  <button
                    key={value}
                    onClick={() => setLang(value)}
                    className={[
                      "px-4 py-2 text-sm rounded-md border transition-colors",
                      lang === value
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "border-surface-border text-text-secondary hover:text-text-primary",
                    ].join(" ")}
                  >
                    {t(labelKey)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-3">{t("easy.settings.toggle")}</label>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setEasyMode(!easyMode)}
                  className={[
                    "relative w-10 h-6 rounded-full transition-colors cursor-pointer",
                    easyMode ? "bg-blue-600" : "bg-surface-border",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                      easyMode ? "translate-x-5" : "translate-x-1",
                    ].join(" ")}
                  />
                </div>
                <span className="text-sm text-text-secondary">{t("easy.settings.description")}</span>
              </label>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-3">{t("settings.autoFetch.label")}</label>
              <label className="flex items-center gap-3 cursor-pointer select-none mb-2">
                <div
                  onClick={() => setAutoFetch(!autoFetch)}
                  className={[
                    "relative w-10 h-6 rounded-full transition-colors cursor-pointer",
                    autoFetch ? "bg-blue-600" : "bg-surface-border",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform",
                      autoFetch ? "translate-x-5" : "translate-x-1",
                    ].join(" ")}
                  />
                </div>
                <span className="text-sm text-text-secondary">{t("settings.autoFetch.description")}</span>
              </label>
              {autoFetch && (
                <div className="flex items-center gap-3 mt-2">
                  <label className="text-xs text-text-muted shrink-0">{t("settings.autoFetch.interval")}</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={autoFetchIntervalMinutes}
                    onChange={(e) => setAutoFetchIntervalMinutes(Math.max(1, Math.min(60, Number(e.target.value))))}
                    className="w-16 bg-surface-elevated text-text-primary text-sm rounded-md px-3 py-1.5 border border-surface-border focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <span className="text-xs text-text-muted">{t("settings.autoFetch.intervalUnit")}</span>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-3">{t("settings.backend.title")}</label>
              <div className="flex gap-2 mb-2">
                {(["git2", "cli"] as GitBackend[]).map((value) => (
                  <button
                    key={value}
                    onClick={() => handleBackendChange(value)}
                    className={[
                      "px-4 py-2 text-sm rounded-md border transition-colors",
                      backend === value
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "border-surface-border text-text-secondary hover:text-text-primary",
                    ].join(" ")}
                  >
                    {t(`settings.backend.${value}`)}
                  </button>
                ))}
              </div>
              {backend === "cli" && gitBinaryInfo && (
                <p className="text-xs text-green-400 font-mono mt-1">
                  {gitBinaryInfo.path} — {gitBinaryInfo.version}
                </p>
              )}
              {backend === "cli" && gitBinaryError && (
                <p className="text-xs text-red-400 mt-1">{t("settings.backend.cliNotFound")}</p>
              )}
              <p className="text-xs text-text-muted mt-2">{t("settings.backend.changeNote")}</p>
            </div>

            <div className="border-t border-surface-border pt-6">
              <h3 className="text-xs text-text-secondary uppercase tracking-wide mb-1">{t("settings.report")}</h3>
              <p className="text-xs text-text-muted mb-3">{t("settings.reportDescription")}</p>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyReport}
                  className="px-4 py-2 text-sm border border-surface-border text-text-secondary hover:text-text-primary hover:border-blue-500 rounded-md transition-colors"
                >
                  {t("settings.reportCopy")}
                </button>
                <button
                  onClick={handleSaveReport}
                  className="px-4 py-2 text-sm border border-surface-border text-text-secondary hover:text-text-primary hover:border-blue-500 rounded-md transition-colors"
                >
                  {t("settings.reportSave")}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "shortcuts" && (
          <div className="max-w-lg flex flex-col gap-8">
            <ShortcutGroup title={t("settings.shortcuts.global")}>
              <Shortcut keys={[t("settings.shortcuts.key.ctrl"), "`"]}  label={t("settings.shortcuts.openTerminal")} />
            </ShortcutGroup>
            <ShortcutGroup title={t("settings.shortcuts.changes")}>
              <Shortcut keys={[t("settings.shortcuts.key.ctrl"), t("settings.shortcuts.key.enter")]} label={t("settings.shortcuts.commit")} />
              <Shortcut keys={[t("settings.shortcuts.key.enter")]} label={t("settings.shortcuts.focusBody")} note={t("settings.shortcuts.focusBodyNote")} />
            </ShortcutGroup>
            <ShortcutGroup title={t("settings.shortcuts.dialogs")}>
              <Shortcut keys={[t("settings.shortcuts.key.enter")]} label={t("settings.shortcuts.confirm")} />
              <Shortcut keys={[t("settings.shortcuts.key.escape")]} label={t("settings.shortcuts.cancel")} />
            </ShortcutGroup>
            <ShortcutGroup title={t("settings.shortcuts.history")}>
              <Shortcut keys={[t("settings.shortcuts.key.escape")]} label={t("settings.shortcuts.closeMenu")} />
            </ShortcutGroup>
          </div>
        )}

        {tab === "about" && (
          <AboutView scrollAnchor={aboutAnchor} />
        )}

        {tab === "auth" && (
          <div className="max-w-lg flex flex-col gap-8">
            {/* SSH Keys */}
            <section className="flex flex-col gap-3">
              <h3 className="text-xs text-text-secondary uppercase tracking-wide">{t("settings.sshDetected")}</h3>
              {sshKeys.length === 0 ? (
                <p className="text-sm text-text-muted">
                  {t("settings.sshNone")}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {sshKeys.map((key) => (
                    <li
                      key={key.name}
                      className="flex items-center gap-3 px-3 py-2 bg-surface-overlay rounded-md border border-surface-border"
                    >
                      <span className="text-xs font-mono text-green-400 bg-green-900/20 px-2 py-0.5 rounded">
                        {key.algorithm}
                      </span>
                      <span className="text-sm text-text-primary font-mono flex-1">{key.name}</span>
                      <span className="text-xs text-text-muted">{t("settings.sshActive")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* HTTPS Credentials */}
            <section className="flex flex-col gap-4">
              <h3 className="text-xs text-text-secondary uppercase tracking-wide">{t("settings.httpsCredentials")}</h3>

              {/* Saved hosts */}
              {savedHosts.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {savedHosts.map((host) => (
                    <li
                      key={host}
                      className="flex items-center justify-between px-3 py-2 bg-surface-overlay rounded-md border border-surface-border"
                    >
                      <span className="text-sm text-text-primary font-mono">{host}</span>
                      <button
                        onClick={() => handleClearCredentials(host)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        {t("common.delete")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Add new credentials */}
              <div className="flex flex-col gap-3 p-4 bg-surface-overlay rounded-md border border-surface-border">
                <h4 className="text-xs text-text-secondary">{t("settings.addHost")}</h4>
                <Field
                  label={t("settings.field.host")}
                  value={httpsHost}
                  onChange={setHttpsHost}
                  placeholder={t("settings.hostPlaceholder")}
                />
                <Field
                  label={t("settings.field.username")}
                  value={httpsUsername}
                  onChange={setHttpsUsername}
                  placeholder={t("settings.usernamePlaceholder")}
                />
                <Field
                  label={t("settings.field.pat")}
                  value={httpsToken}
                  onChange={setHttpsToken}
                  placeholder={t("settings.patPlaceholder")}
                  type="password"
                />
                <button
                  onClick={handleSaveCredentials}
                  disabled={savingCred}
                  className="self-start px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-surface-overlay disabled:text-text-muted text-white rounded-md transition-colors"
                >
                  {savingCred ? t("settings.registerSaving") : t("settings.register")}
                </button>
              </div>

              <p className="text-xs text-text-muted">
                {t("settings.credentialInfo")}
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-text-secondary">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-surface-elevated text-text-primary text-sm rounded-md px-3 py-2 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted transition-colors"
      />
    </div>
  );
}

function ShortcutGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs text-text-secondary uppercase tracking-wide">{title}</h3>
      <div className="flex flex-col gap-1 rounded-md border border-surface-border overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function Shortcut({ keys, label, note }: { keys: string[]; label: string; note?: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 bg-surface-overlay even:bg-surface-base">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-text-primary">{label}</span>
        {note && <span className="text-xs text-text-muted">{note}</span>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            <kbd className="px-2 py-0.5 text-xs font-mono bg-surface-elevated border border-surface-border rounded text-text-secondary">
              {k}
            </kbd>
            {i < keys.length - 1 && <span className="text-text-muted text-xs">+</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
