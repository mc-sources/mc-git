import { useTranslation } from "react-i18next";
import { useRepoStore } from "../../store/repoStore";
import { useUiStore, type ActiveView } from "../../store/uiStore";
import { useGitStore } from "../../store/gitStore";
import { IconChanges, IconHistory, IconBranch, IconRemote, IconGit, IconSettings, IconReflog, IconSubmodule } from "../atoms/icons";
import { AppVersion } from "../atoms/AppVersion";

const NAV_IDS: { id: ActiveView; key: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: "changes",  key: "sidebar.changes",  Icon: IconChanges },
  { id: "history",  key: "sidebar.history",  Icon: IconHistory },
  { id: "branches", key: "sidebar.branches", Icon: IconBranch  },
  { id: "remotes",      key: "sidebar.remotes",     Icon: IconRemote    },
  { id: "submodules",  key: "sidebar.submodules",  Icon: IconSubmodule },
  { id: "reflog",      key: "sidebar.reflog",      Icon: IconReflog    },
];

export function Sidebar() {
  const { t } = useTranslation();
  const { currentRepo } = useRepoStore();
  const { activeView, setActiveView } = useUiStore();
  const { branches, status } = useGitStore();

  const currentBranch = branches.find((b) => b.isHead);
  const pendingCount = status.filter((e) =>
    ["added", "modified", "deleted", "renamed", "untracked", "conflicted"].includes(e.unstaged) ||
    ["added", "modified", "deleted", "renamed"].includes(e.staged)
  ).length;

  return (
    <aside className="flex flex-col w-52 bg-surface-base border-r border-surface-border select-none shrink-0">
      {/* Repo header */}
      <div className="flex items-center gap-2.5 px-3 py-3.5 border-b border-surface-border">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-orange-500/20 text-orange-400 shrink-0">
          <IconGit className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate leading-tight">
            {currentRepo?.name ?? "—"}
          </p>
          {currentBranch && (
            <div className="flex items-center gap-1 mt-0.5">
              <IconBranch className="w-3 h-3 text-text-muted shrink-0" />
              <p className="text-xs text-text-secondary truncate">{currentBranch.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2">
        {NAV_IDS.map(({ id, key, Icon }) => {
          const label = t(key);
          const isActive = activeView === id;
          const badge = id === "changes" && pendingCount > 0 ? pendingCount : null;

          return (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={[
                "w-full text-left px-2.5 py-2 rounded-md text-sm flex items-center gap-2.5 transition-all duration-100 mb-0.5",
                isActive
                  ? "bg-surface-overlay text-text-primary shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-hover",
              ].join(" ")}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-text-primary" : "text-text-muted"}`} />
              <span className="flex-1">{label}</span>
              {badge !== null && (
                <span className="text-[10px] font-bold bg-blue-600 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Settings button */}
      <div className="px-2 py-2 border-t border-surface-border">
        <button
          onClick={() => setActiveView("settings")}
          className={[
            "w-full text-left px-2.5 py-2 rounded-md text-sm flex items-center gap-2.5 transition-all duration-100",
            activeView === "settings"
              ? "bg-surface-overlay text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-surface-hover",
          ].join(" ")}
        >
          <IconSettings className={`w-4 h-4 shrink-0 ${activeView === "settings" ? "text-text-primary" : "text-text-muted"}`} />
          <span>{t("sidebar.settings")}</span>
        </button>
        <AppVersion />
      </div>
    </aside>
  );
}
