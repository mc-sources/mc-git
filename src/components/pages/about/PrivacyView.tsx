import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import { useTranslation } from "react-i18next";
import { useLegalDocuments } from "../../../infrastructure/LegalDocumentsContext";
import { getLegalDocumentUseCase } from "../../../usecases/legal";

export function PrivacyView() {
  const legal = useLegalDocuments();
  const { t } = useTranslation();
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLegalDocumentUseCase(legal, "privacy-policy")
      .then(setContent)
      .catch((e) => setError(String(e)));
  }, [legal]);

  if (error) {
    return <p className="text-sm text-red-400">{t("about.error", { error })}</p>;
  }
  if (content === null) {
    return <p className="text-sm text-text-muted">{t("common.loading")}</p>;
  }

  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <Markdown>{content}</Markdown>
    </div>
  );
}
