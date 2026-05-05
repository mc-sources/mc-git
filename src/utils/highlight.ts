import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import type { BundledLanguage } from "shiki";

export interface TokenSpan {
  content: string;
  color: string;
}

// Singleton highlighter — created once, languages loaded lazily
let _highlighter: HighlighterCore | null = null;
let _loading: Promise<HighlighterCore> | null = null;

async function getHighlighter(): Promise<HighlighterCore | null> {
  if (_highlighter) return _highlighter;
  if (!_loading) {
    _loading = createHighlighterCore({
      themes: [
        import("@shikijs/themes/github-dark"),
        import("@shikijs/themes/github-light"),
      ],
      langs: [],
      engine: createOnigurumaEngine(import("shiki/wasm")),
    })
      .then((h) => {
        _highlighter = h;
        return h;
      })
      .catch(() => {
        _loading = null;
        return null as unknown as HighlighterCore;
      });
  }
  return _loading;
}

type LangLoader = () => Promise<unknown>;

const LANG_LOADERS: Partial<Record<BundledLanguage, LangLoader>> = {
  typescript: () => import("@shikijs/langs/typescript"),
  tsx:        () => import("@shikijs/langs/tsx"),
  javascript: () => import("@shikijs/langs/javascript"),
  jsx:        () => import("@shikijs/langs/jsx"),
  rust:       () => import("@shikijs/langs/rust"),
  python:     () => import("@shikijs/langs/python"),
  go:         () => import("@shikijs/langs/go"),
  java:       () => import("@shikijs/langs/java"),
  csharp:     () => import("@shikijs/langs/csharp"),
  cpp:        () => import("@shikijs/langs/cpp"),
  c:          () => import("@shikijs/langs/c"),
  css:        () => import("@shikijs/langs/css"),
  scss:       () => import("@shikijs/langs/scss"),
  html:       () => import("@shikijs/langs/html"),
  xml:        () => import("@shikijs/langs/xml"),
  json:       () => import("@shikijs/langs/json"),
  yaml:       () => import("@shikijs/langs/yaml"),
  markdown:   () => import("@shikijs/langs/markdown"),
  bash:       () => import("@shikijs/langs/bash"),
  toml:       () => import("@shikijs/langs/toml"),
  sql:        () => import("@shikijs/langs/sql"),
  kotlin:     () => import("@shikijs/langs/kotlin"),
  swift:      () => import("@shikijs/langs/swift"),
  ruby:       () => import("@shikijs/langs/ruby"),
  php:        () => import("@shikijs/langs/php"),
  vue:        () => import("@shikijs/langs/vue"),
  svelte:     () => import("@shikijs/langs/svelte"),
};

const EXT_LANG: Record<string, BundledLanguage> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
  rs: "rust", py: "python", go: "go", java: "java",
  cs: "csharp", cpp: "cpp", cc: "cpp", cxx: "cpp", c: "c", h: "c",
  css: "css", scss: "scss", html: "html", xml: "xml",
  json: "json", yaml: "yaml", yml: "yaml",
  md: "markdown", sh: "bash", bash: "bash",
  toml: "toml", sql: "sql", kt: "kotlin", swift: "swift",
  rb: "ruby", php: "php", vue: "vue", svelte: "svelte",
};

export function langFromFilename(filename: string): BundledLanguage | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return EXT_LANG[ext] ?? null;
}

/** Highlight lines of code. Returns null if language is unsupported. */
export async function highlightLines(
  lines: string[],
  filename: string,
  isDark: boolean,
): Promise<TokenSpan[][] | null> {
  const lang = langFromFilename(filename);
  if (!lang) return null;

  const loader = LANG_LOADERS[lang];
  if (!loader) return null;

  try {
    const h = await getHighlighter();
    if (!h) return null;
    if (!h.getLoadedLanguages().includes(lang)) {
      await h.loadLanguage(loader as Parameters<typeof h.loadLanguage>[0]);
    }

    const theme = isDark ? "github-dark" : "github-light";
    const fallbackColor = isDark ? "#d4d4d4" : "#24292e";
    const result = h.codeToTokens(lines.join("\n"), { lang, theme });

    return result.tokens.map((lineTokens) =>
      lineTokens.map((t) => ({ content: t.content, color: t.color ?? fallbackColor }))
    );
  } catch {
    return null;
  }
}
