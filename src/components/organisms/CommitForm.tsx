import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useGitStore } from "../../store/gitStore";
import { useUiStore } from "../../store/uiStore";
import { toast } from "../../store/toastStore";
import { useGitRepository } from "../../infrastructure/GitRepositoryContext";
import { createCommitUseCase, amendCommitUseCase } from "../../usecases/commit";
import { getStatusUseCase } from "../../usecases/staging";
import { getRepositoryStateUseCase, listBranchesUseCase } from "../../usecases/branches";
import { CommitMessage, SUBJECT_MAX_LENGTH } from "../../domain/value-objects/CommitMessage";

export function CommitForm() {
  const { t } = useTranslation();
  const repo = useGitRepository();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [amend, setAmend] = useState(false);
  const [loading, setLoading] = useState(false);
  const { status, setStatus, setBranches, bumpLogVersion } = useGitStore();
  const { setCurrentDiff, setSelectedFile, setRepositoryState } = useUiStore();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const commitMessage = CommitMessage.create(subject, body);
  const hasStagedChanges = status.some((e) =>
    ["added", "modified", "deleted", "renamed"].includes(e.staged)
  );
  const subjectLen = subject.length;
  const subjectOver = commitMessage.isSubjectTooLong;
  const canCommit = (hasStagedChanges || amend) && (subject.trim() || amend);

  const handleSubmit = async () => {
    if (!canCommit || loading) return;
    setLoading(true);
    try {
      const message = commitMessage.toString() || "amend";
      if (amend) {
        await amendCommitUseCase(repo, message);
      } else {
        await createCommitUseCase(repo, message);
      }
      toast.success(amend ? t("commit.amended") : t("commit.created"));
      setSubject("");
      setBody("");
      setAmend(false);
      setCurrentDiff(null);
      setSelectedFile(null);
      const [newStatus, repoState, branchList] = await Promise.all([
        getStatusUseCase(repo),
        getRepositoryStateUseCase(repo),
        listBranchesUseCase(repo, "all"),
      ]);
      setStatus(newStatus);
      setRepositoryState(repoState);
      setBranches(branchList);
      bumpLogVersion();
    } catch (err) {
      toast.error(t("commit.failed", { error: String(err) }));
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      bodyRef.current?.focus();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3 border-t border-surface-border bg-surface-base">
      {/* Subject */}
      <div className="relative">
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onKeyDown={handleSubjectKeyDown}
          placeholder={t("commit.summaryPlaceholder")}
          className={[
            "w-full bg-surface-elevated text-text-primary text-sm rounded-md px-3 py-2 border focus:outline-none placeholder:text-text-muted transition-colors",
            subjectOver
              ? "border-red-500 focus:border-red-400"
              : "border-surface-border focus:border-blue-500",
          ].join(" ")}
        />
        <span
          className={[
            "absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono tabular-nums",
            subjectOver ? "text-red-400" : "text-text-muted",
          ].join(" ")}
        >
          {subjectLen}/{SUBJECT_MAX_LENGTH}
        </span>
      </div>

      {/* Body */}
      <textarea
        ref={bodyRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleBodyKeyDown}
        placeholder={t("commit.bodyPlaceholder")}
        rows={2}
        className="w-full bg-surface-elevated text-text-primary text-sm rounded-md px-3 py-2 resize-none border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted transition-colors"
      />

      {/* Footer */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer hover:text-text-primary transition-colors select-none">
          <input
            type="checkbox"
            checked={amend}
            onChange={(e) => setAmend(e.target.checked)}
            className="accent-blue-500 w-3 h-3"
          />
          {t("commit.amend")}
        </label>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted select-none">⌃↵</span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !canCommit}
            className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-surface-elevated disabled:text-text-muted text-white rounded-md transition-all duration-100 flex items-center gap-1.5"
          >
            {loading && (
              <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            )}
            {amend ? t("commit.amend") : t("commit.button")}
          </button>
        </div>
      </div>
    </div>
  );
}
