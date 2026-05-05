import { useState, useEffect } from "react";
import { highlightLines, type TokenSpan } from "../utils/highlight";
import { useSettingsStore } from "../store/settingsStore";

/** Returns syntax-highlighted token lines, or null while loading / unsupported language. */
export function useHighlight(lines: string[], filename: string): TokenSpan[][] | null {
  const { theme } = useSettingsStore();
  const isDark = theme !== "light";
  const [tokens, setTokens] = useState<TokenSpan[][] | null>(null);

  // Recompute when lines, filename, or theme changes
  const key = filename + "|" + isDark + "|" + lines.length + "|" + (lines[0] ?? "");

  useEffect(() => {
    if (!filename || lines.length === 0) { setTokens(null); return; }
    let cancelled = false;
    setTokens(null);
    highlightLines(lines, filename, isDark)
      .then((result) => {
        if (!cancelled) setTokens(result);
      })
      .catch(() => {
        if (!cancelled) setTokens(null);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return tokens;
}
