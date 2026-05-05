import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRepoStore } from "../../store/repoStore";
import { useSettingsStore } from "../../store/settingsStore";
import { readFileUseCase, writeFileUseCase } from "../../usecases/fileEditor";
import { highlightLines, type TokenSpan } from "../../utils/highlight";
import { toast } from "../../store/toastStore";

interface Props {
  filePath: string;
  onClose: () => void;
  onSaved?: () => void;
}

export function FileEditor({ filePath, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const { currentRepo } = useRepoStore();
  const { theme } = useSettingsStore();
  const isDark = theme !== "light";

  const [content, setContent] = useState<string | null>(null);
  const [original, setOriginal] = useState("");
  const [tokens, setTokens] = useState<TokenSpan[][] | null>(null);
  const [saving, setSaving] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const isDirty = content !== null && content !== original;

  // Load file on mount
  useEffect(() => {
    if (!currentRepo) return;
    readFileUseCase(currentRepo.path, filePath)
      .then((text) => {
        setContent(text);
        setOriginal(text);
      })
      .catch((e) => {
        toast.error(String(e));
        onClose();
      });
  }, [currentRepo, filePath]);

  // Debounced Shiki highlighting
  useEffect(() => {
    if (content === null) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      const lines = content.split("\n");
      highlightLines(lines, filePath, isDark).then((result) => {
        if (!cancelled) setTokens(result);
      });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [content, filePath, isDark]);

  // Keep the pre layer visually aligned with the textarea scroll position.
  // Using CSS transform instead of syncing scrollTop avoids scrollHeight
  // mismatches that accumulate over many lines.
  const syncPreTransform = useCallback(() => {
    if (textareaRef.current && preRef.current) {
      const top = textareaRef.current.scrollTop;
      const left = textareaRef.current.scrollLeft;
      preRef.current.style.transform = `translate(${-left}px, ${-top}px)`;
    }
  }, []);

  // Re-sync after Shiki re-renders (token update can happen while scrolled)
  useEffect(() => {
    syncPreTransform();
  }, [tokens, syncPreTransform]);

  const handleSave = async () => {
    if (!currentRepo || content === null) return;
    setSaving(true);
    try {
      await writeFileUseCase(currentRepo.path, filePath, content);
      setOriginal(content);
      toast.success(t("fileEditor.saved"));
      onSaved?.();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => setContent(original);

  if (content === null) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-xs">
        {t("fileEditor.loading")}
      </div>
    );
  }

  const caretColor = isDark ? "#d4d4d4" : "#24292e";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-surface-border bg-surface-elevated shrink-0">
        <span className="font-mono text-xs text-text-muted truncate flex-1">{filePath}</span>
        {isDirty && <span className="text-[10px] text-orange-400 shrink-0">●</span>}
        <button
          onClick={handleCancel}
          disabled={!isDirty || saving}
          className="text-xs px-2 py-0.5 text-text-muted hover:text-text-primary border border-surface-border rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {t("fileEditor.cancel")}
        </button>
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="text-xs px-2 py-0.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded transition-colors shrink-0"
        >
          {saving ? "…" : t("fileEditor.save")}
        </button>
        <button
          onClick={onClose}
          title={t("common.close")}
          className="text-text-muted hover:text-text-primary transition-colors text-sm px-1 ml-1 shrink-0"
        >
          ✕
        </button>
      </div>

      {/* Editor */}
      <div className="relative flex-1 overflow-hidden">
        {/* Shiki highlight layer (behind, translated to match textarea scroll) */}
        <pre
          ref={preRef}
          aria-hidden
          className="absolute top-0 left-0 m-0 p-3 font-mono text-xs leading-5 pointer-events-none whitespace-pre select-none"
          style={{ tabSize: 2 }}
        >
          {tokens
            ? tokens.map((line, i) => (
                <span key={i}>
                  {line.map((span, j) => (
                    <span key={j} style={{ color: span.color }}>{span.content}</span>
                  ))}
                  {"\n"}
                </span>
              ))
            : <span className="text-text-primary">{content}</span>
          }
        </pre>

        {/* Editable textarea (on top, transparent) */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onScroll={syncPreTransform}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          className="absolute inset-0 w-full h-full p-3 font-mono text-xs leading-5 bg-transparent resize-none outline-none border-none"
          style={{ color: "transparent", caretColor, tabSize: 2, whiteSpace: "pre" }}
        />
      </div>
    </div>
  );
}
