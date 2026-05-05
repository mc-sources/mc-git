import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "../../store/uiStore";
import { CommitList } from "../organisms/CommitList";
import { CommitDetailPanel } from "../organisms/CommitDetailPanel";
import { InteractiveRebaseEditor } from "../organisms/InteractiveRebaseEditor";

export function HistoryView() {
  const { t } = useTranslation();
  const { currentCommitDetail, setCurrentCommitDetail, interactiveRebaseFromOid, setInteractiveRebaseFromOid } = useUiStore();

  const [detailWidth, setDetailWidth] = useState<number>(() => {
    try { return parseInt(localStorage.getItem("historyDetailWidth") ?? "480"); } catch { return 480; }
  });
  const resizeRef = useRef({ dragging: false, startX: 0, startW: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizeRef.current.dragging) return;
      const next = Math.min(900, Math.max(280, resizeRef.current.startW - (e.clientX - resizeRef.current.startX)));
      setDetailWidth(next);
      localStorage.setItem("historyDetailWidth", String(next));
    };
    const onUp = () => {
      resizeRef.current.dragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const handleResizeDown = (e: React.MouseEvent) => {
    resizeRef.current = { dragging: true, startX: e.clientX, startW: detailWidth };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div className="relative h-full overflow-hidden">
      <CommitList />

      {interactiveRebaseFromOid && (
        <InteractiveRebaseEditor
          upstreamOid={interactiveRebaseFromOid}
          onClose={() => setInteractiveRebaseFromOid(null)}
          onApplied={() => setInteractiveRebaseFromOid(null)}
        />
      )}

      {currentCommitDetail && (
        <div
          className="absolute right-0 top-0 bottom-0 bg-surface-base border-l border-surface-border shadow-2xl flex flex-col z-20"
          style={{ width: detailWidth }}
        >
          {/* Left resize handle */}
          <div
            onMouseDown={handleResizeDown}
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/40 active:bg-blue-500 transition-colors z-10"
          />

          {/* Header with close button */}
          <div className="flex items-center justify-end px-3 py-1.5 border-b border-surface-border shrink-0">
            <button
              onClick={() => setCurrentCommitDetail(null)}
              title={t("common.close")}
              className="text-text-muted hover:text-text-primary transition-colors text-sm px-1"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            <CommitDetailPanel />
          </div>
        </div>
      )}
    </div>
  );
}
