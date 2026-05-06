import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { useTranslation } from "react-i18next";
import { useLegalDocuments } from "../../../infrastructure/LegalDocumentsContext";
import { getThirdPartyNoticesUseCase } from "../../../usecases/legal";
import type { ThirdPartyNoticesTarget } from "../../../domain/ports/ILegalDocuments";

interface NoticeEntry {
  name: string;
  version: string;
  license: string;
  body: string;
}

function parseNotices(content: string): { intro: string; entries: NoticeEntry[] } {
  // Split on lines that contain only "---". The first split part is the intro.
  const parts = content.split(/\n---\n/);
  const intro = parts[0]?.trim() ?? "";
  const entries: NoticeEntry[] = [];

  for (const raw of parts.slice(1)) {
    const block = raw.trim();
    if (!block) continue;

    const headerMatch = block.match(/^##\s+(.+?)\s+v([^\s\n]+)/);
    const name = headerMatch?.[1] ?? block.split("\n")[0].replace(/^##\s*/, "");
    const version = headerMatch?.[2] ?? "";
    const licenseMatch = block.match(/\*\*License\*\*\s*:\s*([^\n]+)/);
    const license = licenseMatch?.[1]?.trim() ?? "";

    entries.push({ name, version, license, body: block });
  }

  return { intro, entries };
}

function NoticesPanel({ target }: { target: ThirdPartyNoticesTarget }) {
  const legal = useLegalDocuments();
  const { t } = useTranslation();
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getThirdPartyNoticesUseCase(legal, target)
      .then(setContent)
      .catch((e) => setError(String(e)));
  }, [legal, target]);

  if (error) {
    return <p className="text-sm text-red-400">{t("about.error", { error })}</p>;
  }
  if (content === null) {
    return <p className="text-sm text-text-muted">{t("common.loading")}</p>;
  }

  const { intro, entries } = parseNotices(content);

  return (
    <div className="flex flex-col gap-3">
      {intro && (
        <div className="prose prose-invert prose-sm max-w-none">
          <Markdown>{intro}</Markdown>
        </div>
      )}
      {entries.length === 0 ? (
        <p className="text-xs text-text-muted">{t("about.notices.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entries.map((entry, i) => (
            <li key={`${entry.name}-${i}`}>
              <details className="border border-surface-border rounded-md bg-surface-base">
                <summary className="cursor-pointer px-3 py-2 text-sm flex items-center justify-between gap-3 hover:bg-surface-elevated">
                  <span className="text-text-primary font-medium truncate">
                    {entry.name}
                    {entry.version && (
                      <span className="text-text-muted font-normal"> v{entry.version}</span>
                    )}
                  </span>
                  {entry.license && (
                    <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated text-text-secondary border border-surface-border shrink-0">
                      {entry.license}
                    </span>
                  )}
                </summary>
                <div className="px-3 py-2 border-t border-surface-border prose prose-invert prose-sm max-w-none">
                  <Markdown>{entry.body}</Markdown>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ThirdPartyNoticesView() {
  const { t } = useTranslation();
  const [target, setTarget] = useState<ThirdPartyNoticesTarget>("rust");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 border-b border-surface-border">
        {(["rust", "npm"] as ThirdPartyNoticesTarget[]).map((value) => (
          <button
            key={value}
            onClick={() => setTarget(value)}
            className={[
              "px-3 py-1.5 text-xs border-b-2 transition-colors -mb-px",
              target === value
                ? "border-blue-500 text-text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            {t(`about.notices.target.${value}`)}
          </button>
        ))}
      </div>
      <NoticesPanel target={target} />
    </div>
  );
}
