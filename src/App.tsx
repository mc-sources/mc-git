import { useState } from "react";
import { useRepoStore } from "./store/repoStore";
import { useUiStore } from "./store/uiStore";
import { useSettingsStore } from "./store/settingsStore";
import { useGitLog } from "./infrastructure/events/useGitLog";
import { useTheme } from "./hooks/useTheme";
import { useAutoFetch } from "./hooks/useAutoFetch";
import { useProgress } from "./infrastructure/events/useProgress";
import { GitRepositoryProvider } from "./infrastructure/GitRepositoryContext";
import { LegalDocumentsProvider } from "./infrastructure/LegalDocumentsContext";
import { AppShell } from "./components/templates/AppShell";
import { LogPanel } from "./components/organisms/LogPanel";
import { Toaster } from "./components/organisms/Toaster";
import { BranchList } from "./components/organisms/BranchList";
import { RemotePanel } from "./components/organisms/RemotePanel";
import { SubmodulePanel } from "./components/organisms/SubmodulePanel";
import { WelcomeScreen } from "./components/pages/WelcomeScreen";
import { ChangesView } from "./components/pages/ChangesView";
import { HistoryView } from "./components/pages/HistoryView";
import { EasyChangesView } from "./components/pages/easy/EasyChangesView";
import { EasyHistoryView } from "./components/pages/easy/EasyHistoryView";
import { SettingsView } from "./components/pages/SettingsView";
import { BlameView } from "./components/organisms/BlameView";
import { ReflogView } from "./components/pages/ReflogView";
import { AuthModal } from "./components/organisms/AuthModal";
import { SshTofuModal } from "./components/organisms/SshTofuModal";

function MainContent() {
  const { activeView } = useUiStore();
  const { easyMode } = useSettingsStore();

  switch (activeView) {
    case "changes":    return easyMode ? <EasyChangesView /> : <ChangesView />;
    case "history":    return easyMode ? <EasyHistoryView /> : <HistoryView />;
    case "branches":   return <BranchList />;
    case "remotes":    return <RemotePanel />;
    case "submodules": return <SubmodulePanel />;
    case "settings":   return <SettingsView />;
    case "blame":      return <BlameView />;
    case "reflog":     return <ReflogView />;
  }
}

function App() {
  const { currentRepo } = useRepoStore();
  const [showNewTab, setShowNewTab] = useState(false);

  useGitLog();
  useTheme();
  useProgress();
  useAutoFetch();

  if (!currentRepo) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <div className="flex-1 min-h-0">
          <WelcomeScreen />
        </div>
        <LogPanel />
        <Toaster />
      </div>
    );
  }

  return (
    <>
      <AppShell onNewTab={() => setShowNewTab(true)}>
        <MainContent />
      </AppShell>
      <Toaster />
      <AuthModal />
      <SshTofuModal />

      {/* "New tab" overlay — WelcomeScreen used as a repo picker */}
      {showNewTab && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewTab(false); }}
        >
          <div className="relative bg-surface-elevated border border-surface-border rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-surface-border shrink-0">
              <span className="text-sm font-semibold text-text-primary">Ouvrir dans un nouvel onglet</span>
              <button
                onClick={() => setShowNewTab(false)}
                className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              <WelcomeScreen onClose={() => setShowNewTab(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AppWithProviders() {
  return (
    <GitRepositoryProvider>
      <LegalDocumentsProvider>
        <App />
      </LegalDocumentsProvider>
    </GitRepositoryProvider>
  );
}

export default AppWithProviders;
