import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAppVersion } from "../../../usecases/app";
import { TermsView } from "./TermsView";
import { PrivacyView } from "./PrivacyView";
import { ThirdPartyNoticesView } from "./ThirdPartyNoticesView";

interface Props {
  /** Optional anchor to scroll into view on mount (e.g. "privacy"). */
  scrollAnchor?: string;
}

export function AboutView({ scrollAnchor }: Props) {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    getAppVersion().then(setVersion).catch(() => setVersion(null));
  }, []);

  useEffect(() => {
    if (!scrollAnchor) return;
    // Defer to next paint so the DOM is available
    const handle = requestAnimationFrame(() => {
      const el = document.getElementById(`about-section-${scrollAnchor}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        // Open <details> elements on the anchor path so the section is visible
        const details = el.querySelector("details");
        if (details && !details.open) details.open = true;
      }
    });
    return () => cancelAnimationFrame(handle);
  }, [scrollAnchor]);

  return (
    <div className="max-w-2xl flex flex-col gap-5">
      {/* Section 1 — Version info */}
      <section id="about-section-version" className="flex flex-col gap-1.5">
        <h3 className="text-xs text-text-secondary uppercase tracking-wide">
          {t("about.version.title")}
        </h3>
        <div className="border border-surface-border rounded-md bg-surface-base p-3 flex flex-col gap-1 text-sm">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-text-primary">Mc-Git</span>
            <span className="text-text-muted">v{version ?? "—"}</span>
          </div>
          <p className="text-xs text-text-secondary">
            {t("about.version.description")}
          </p>
          <p className="text-xs text-text-muted">
            {t("about.version.license")}
          </p>
        </div>
      </section>

      {/* Section 2 — Terms */}
      <section id="about-section-terms" className="flex flex-col gap-1.5">
        <h3 className="text-xs text-text-secondary uppercase tracking-wide">
          {t("about.terms.title")}
        </h3>
        <details open className="border border-surface-border rounded-md bg-surface-base">
          <summary className="cursor-pointer px-3 py-2 text-sm text-text-primary hover:bg-surface-elevated">
            {t("about.terms.summary")}
          </summary>
          <div className="px-4 py-3 border-t border-surface-border">
            <TermsView />
          </div>
        </details>
      </section>

      {/* Section 3 — Privacy */}
      <section id="about-section-privacy" className="flex flex-col gap-1.5">
        <h3 className="text-xs text-text-secondary uppercase tracking-wide">
          {t("about.privacy.title")}
        </h3>
        <details open className="border border-surface-border rounded-md bg-surface-base">
          <summary className="cursor-pointer px-3 py-2 text-sm text-text-primary hover:bg-surface-elevated">
            {t("about.privacy.summary")}
          </summary>
          <div className="px-4 py-3 border-t border-surface-border">
            <PrivacyView />
          </div>
        </details>
      </section>

      {/* Section 4 — Third-party notices (collapsed by default) */}
      <section id="about-section-notices" className="flex flex-col gap-1.5">
        <h3 className="text-xs text-text-secondary uppercase tracking-wide">
          {t("about.notices.title")}
        </h3>
        <details className="border border-surface-border rounded-md bg-surface-base">
          <summary className="cursor-pointer px-3 py-2 text-sm text-text-primary hover:bg-surface-elevated">
            {t("about.notices.summary")}
          </summary>
          <div className="px-4 py-3 border-t border-surface-border">
            <ThirdPartyNoticesView />
          </div>
        </details>
      </section>
    </div>
  );
}
