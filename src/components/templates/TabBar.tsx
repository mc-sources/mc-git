import { useTranslation } from "react-i18next";
import { useTabStore } from "../../store/tabStore";
import { useGitStore } from "../../store/gitStore";
import { useUiStore } from "../../store/uiStore";
import { useRepoStore } from "../../store/repoStore";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { switchActiveTabUseCase, closeTabUseCase } from "../../usecases/repository";
import { toast } from "../../store/toastStore";

interface Props {
  onNewTab: () => void;
}

export function TabBar({ onNewTab }: Props) {
  const { t } = useTranslation();
  const { tabs, activeTabId, setActiveTab, removeTab } = useTabStore();
  const { resetAll } = useGitStore();
  const { reset, saveTabPosition, resetAndRestore, clearTabPosition } = useUiStore();
  const { setCurrentRepo } = useRepoStore();
  const repo = useGitRepository();

  const handleSwitch = async (tabId: string) => {
    if (tabId === activeTabId) return;
    // Save position of the tab we're leaving (REQ-UX-035)
    if (activeTabId) saveTabPosition(activeTabId);
    try {
      await switchActiveTabUseCase(repo, tabId);
      setActiveTab(tabId);
      resetAll();
      // Restore saved position for the tab we're switching to (REQ-UX-036)
      resetAndRestore(tabId);
      const tab = tabs.find((t) => t.id === tabId);
      if (tab) setCurrentRepo(tab.repoInfo);
    } catch (e) {
      toast.error(t("tabBar.switchFailed", { error: e }));
    }
  };

  const handleClose = async (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    try {
      await closeTabUseCase(repo, tabId);
    } catch {
      // non-fatal — remove from UI regardless
    }
    clearTabPosition(tabId);
    removeTab(tabId);

    // If we just closed the active tab, activate the next one from the store
    // (removeTab already updated activeTabId via the store's own logic)
    const { tabs: remaining, activeTabId: nextId } = useTabStore.getState();
    if (nextId && nextId !== tabId) {
      try {
        await switchActiveTabUseCase(repo, nextId);
        resetAll();
        resetAndRestore(nextId);
        const next = remaining.find((t) => t.id === nextId);
        if (next) setCurrentRepo(next.repoInfo);
      } catch {
        // non-fatal
      }
    } else if (!nextId) {
      resetAll();
      reset();
      setCurrentRepo(null);
    }
  };

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-stretch h-8 bg-surface-base border-b border-surface-border overflow-x-auto shrink-0 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <button
            key={tab.id}
            onClick={() => handleSwitch(tab.id)}
            className={[
              "flex items-center gap-1.5 px-3 text-xs border-r border-surface-border shrink-0 max-w-[180px] group transition-colors",
              isActive
                ? "bg-surface-elevated text-text-primary border-b-2 border-b-blue-500 -mb-px"
                : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
            ].join(" ")}
          >
            <span className="truncate flex-1 min-w-0 text-left">{tab.repoInfo.name}</span>
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => handleClose(e, tab.id)}
              onKeyDown={(e) => e.key === "Enter" && handleClose(e as unknown as React.MouseEvent, tab.id)}
              className={[
                "shrink-0 w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-surface-active leading-none transition-opacity",
                isActive ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-60 hover:!opacity-100",
              ].join(" ")}
            >
              ×
            </span>
          </button>
        );
      })}

      {/* New tab button */}
      <button
        onClick={onNewTab}
        className="px-3 text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors text-sm shrink-0"
        title={t("tabBar.openRepo")}
      >
        +
      </button>
    </div>
  );
}
