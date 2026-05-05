import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Toolbar } from "./Toolbar";
import { EasySidebar } from "./easy/EasySidebar";
import { EasyToolbar } from "./easy/EasyToolbar";
import { TabBar } from "./TabBar";
import { LogPanel } from "../organisms/LogPanel";
import { ProgressBar } from "../atoms/ProgressBar";
import { useSettingsStore } from "../../store/settingsStore";

interface AppShellProps {
  children: ReactNode;
  onNewTab: () => void;
}

export function AppShell({ children, onNewTab }: AppShellProps) {
  const { easyMode } = useSettingsStore();

  return (
    <div className="flex flex-col h-screen bg-surface-base text-text-primary overflow-hidden">
      <TabBar onNewTab={onNewTab} />
      {easyMode ? <EasyToolbar /> : <Toolbar />}
      <ProgressBar />
      <div className="flex flex-1 overflow-hidden min-h-0">
        {easyMode ? <EasySidebar /> : <Sidebar />}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
      <LogPanel />
    </div>
  );
}
