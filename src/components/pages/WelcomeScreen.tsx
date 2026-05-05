import { useState, useEffect, useCallback } from "react";
import icon from "../../assets/icon.png";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { useRepoStore } from "../../store/repoStore";
import { useGitStore } from "../../store/gitStore";
import { useUiStore } from "../../store/uiStore";
import { useTabStore } from "../../store/tabStore";
import { toast } from "../../store/toastStore";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { useSettingsStore, type Theme, type Lang } from "../../store/settingsStore";
import { openRepositoryUseCase, initRepositoryUseCase } from "../../usecases/repository";
import { listBranchesUseCase } from "../../usecases/branches";
import { CloneDialog } from "../clone/CloneDialog";
import {
  listSshKeysUseCase,
  listSavedHostsUseCase,
  saveCredentialsUseCase,
  clearCredentialsUseCase,
} from "../../usecases/auth";
import type { SshKeyInfo, IGitRepository } from "../../domain/ports/IGitRepository";
import type { RepoInfo, BranchInfo } from "../../domain/entities";

type WelcomeSettingsTab = "app" | "auth";

const THEME_VALUES: Theme[] = ["dark", "light", "system"];
const LANG_OPTIONS: { value: Lang; labelKey: string }[] = [
  { value: "fr", labelKey: "settings.language.fr" },
  { value: "en", labelKey: "settings.language.en" },
  { value: "es", labelKey: "settings.language.es" },
];

async function loadRepo(
  repo: IGitRepository,
  repoInfo: RepoInfo,
  tabId: string,
  setCurrentRepo: (r: RepoInfo | null) => void,
  addRecentRepo: (r: RepoInfo) => void,
  setBranches: (b: BranchInfo[]) => void,
  addTab: (tab: { id: string; repoInfo: RepoInfo }) => void
) {
  useUiStore.getState().reset();
  useGitStore.getState().resetAll();
  addRecentRepo(repoInfo);
  setCurrentRepo(repoInfo);
  addTab({ id: tabId, repoInfo });
  try {
    setBranches(await listBranchesUseCase(repo, "all"));
  } catch {
    // non-fatal
  }
}

interface Props {
  /** When provided, this is a "add tab" dialog — rendered inline. */
  onClose?: () => void;
}

export function WelcomeScreen({ onClose }: Props) {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const { recentRepos, setCurrentRepo, addRecentRepo } = useRepoStore();
  const { setBranches } = useGitStore();
  const { addTab } = useTabStore();
  const [showClone, setShowClone] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<WelcomeSettingsTab>("app");
  const { theme, setTheme, lang, setLang, backend } = useSettingsStore();

  // Auth tab state
  const [sshKeys, setSshKeys] = useState<SshKeyInfo[]>([]);
  const [savedHosts, setSavedHosts] = useState<string[]>([]);
  const [httpsHost, setHttpsHost] = useState("");
  const [httpsUsername, setHttpsUsername] = useState("");
  const [httpsToken, setHttpsToken] = useState("");
  const [savingCred, setSavingCred] = useState(false);

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
    if (settingsTab === "auth") {
      loadAuthData();
    }
  }, [settingsTab, loadAuthData]);

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

  const open_ = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || typeof selected !== "string") return;
    const tabId = crypto.randomUUID();
    try {
      const repoInfo = await openRepositoryUseCase(repo, selected, tabId, backend);
      await loadRepo(repo, repoInfo, tabId, setCurrentRepo, addRecentRepo, setBranches, addTab);
      onClose?.();
    } catch (e) {
      toast.error(t("welcome.openError", { error: String(e) }));
    }
  };

  const handleInit = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || typeof selected !== "string") return;
    const tabId = crypto.randomUUID();
    try {
      const repoInfo = await initRepositoryUseCase(repo, selected, tabId, backend);
      await loadRepo(repo, repoInfo, tabId, setCurrentRepo, addRecentRepo, setBranches, addTab);
      onClose?.();
    } catch (e) {
      toast.error(t("welcome.initError", { error: String(e) }));
    }
  };

  const handleRecent = async (recentRepo: RepoInfo) => {
    const tabId = crypto.randomUUID();
    try {
      const repoInfo = await openRepositoryUseCase(repo, recentRepo.path, tabId, backend);
      await loadRepo(repo, repoInfo, tabId, setCurrentRepo, addRecentRepo, setBranches, addTab);
      onClose?.();
    } catch (e) {
      toast.error(t("welcome.openError", { error: String(e) }));
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center h-full gap-8 bg-surface-base">
      <div className="text-center">
        <img src={icon} alt="Mc-Git" className="w-20 h-20 mx-auto mb-3" />
        <p className="text-text-secondary text-sm">{t("welcome.subtitle")}</p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={open_}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md font-medium transition-colors"
        >
          {t("welcome.openRepo")}
        </button>
        <button
          onClick={() => setShowClone(true)}
          className="px-5 py-2.5 bg-surface-overlay hover:bg-surface-active text-text-primary text-sm rounded-md font-medium transition-colors border border-surface-border"
        >
          {t("welcome.cloneRepo")}
        </button>
        <button
          onClick={handleInit}
          className="px-5 py-2.5 bg-surface-overlay hover:bg-surface-active text-text-primary text-sm rounded-md font-medium transition-colors"
        >
          {t("welcome.initRepo")}
        </button>
      </div>

      {showClone && (
        <CloneDialog
          onClose={() => setShowClone(false)}
          onSuccess={async (repoInfo, tabId) => {
            setShowClone(false);
            await loadRepo(repo, repoInfo, tabId, setCurrentRepo, addRecentRepo, setBranches, addTab);
            onClose?.();
          }}
        />
      )}

      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
        >
          <div className="bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border shrink-0">
              <h2 className="text-sm font-semibold text-text-primary">{t("sidebar.settings")}</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            {/* Tab bar */}
            <div className="flex border-b border-surface-border px-4 shrink-0">
              {(["app", "auth"] as WelcomeSettingsTab[]).map((tabId) => (
                <button
                  key={tabId}
                  onClick={() => setSettingsTab(tabId)}
                  className={[
                    "px-4 py-3 text-sm border-b-2 transition-colors",
                    settingsTab === tabId
                      ? "border-blue-500 text-text-primary"
                      : "border-transparent text-text-secondary hover:text-text-primary",
                  ].join(" ")}
                >
                  {t(`settings.tab.${tabId}`)}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto p-5">
              {settingsTab === "app" && (
                <div className="flex flex-col gap-6">
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
                </div>
              )}
              {settingsTab === "auth" && (
                <div className="flex flex-col gap-8">
                  {/* SSH Keys */}
                  <section className="flex flex-col gap-3">
                    <h3 className="text-xs text-text-secondary uppercase tracking-wide">{t("settings.sshDetected")}</h3>
                    {sshKeys.length === 0 ? (
                      <p className="text-sm text-text-muted">{t("settings.sshNone")}</p>
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
                    <div className="flex flex-col gap-3 p-4 bg-surface-overlay rounded-md border border-surface-border">
                      <h4 className="text-xs text-text-secondary">{t("settings.addHost")}</h4>
                      <WelcomeField label={t("settings.field.host")} value={httpsHost} onChange={setHttpsHost} placeholder={t("settings.hostPlaceholder")} />
                      <WelcomeField label={t("settings.field.username")} value={httpsUsername} onChange={setHttpsUsername} placeholder={t("settings.usernamePlaceholder")} />
                      <WelcomeField label={t("settings.field.pat")} value={httpsToken} onChange={setHttpsToken} placeholder={t("settings.patPlaceholder")} type="password" />
                      <button
                        onClick={handleSaveCredentials}
                        disabled={savingCred}
                        className="self-start px-5 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-surface-overlay disabled:text-text-muted text-white rounded-md transition-colors"
                      >
                        {savingCred ? t("settings.registerSaving") : t("settings.register")}
                      </button>
                    </div>
                    <p className="text-xs text-text-muted">{t("settings.credentialInfo")}</p>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings button */}
      <button
        onClick={() => setShowSettings(true)}
        title={t("sidebar.settings")}
        className="absolute bottom-4 right-4 w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-md transition-colors text-base"
      >
        ⚙
      </button>

      {recentRepos.length > 0 && (
        <div className="w-full max-w-md">
          <div className="relative flex items-center mb-3">
            <div className="flex-1 border-t border-dashed border-surface-border" />
            <span className="px-3 text-xs text-text-secondary">{t("welcome.recentRepos")}</span>
            <div className="flex-1 border-t border-dashed border-surface-border" />
          </div>
          <ul className="divide-y divide-surface-border border border-surface-border rounded-md overflow-hidden">
            {recentRepos.map((recentRepo) => (
              <li key={recentRepo.path}>
                <button
                  onClick={() => handleRecent(recentRepo)}
                  className="w-full text-left px-4 py-2.5 hover:bg-surface-hover transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-text-primary font-medium shrink-0">{recentRepo.name}</span>
                    <span className="text-xs text-text-secondary truncate text-right min-w-0">{recentRepo.path}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function WelcomeField({
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
