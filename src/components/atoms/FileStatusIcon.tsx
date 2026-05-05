import type { FileStatusKind } from "../../domain/entities";

const KIND_STYLES: Record<FileStatusKind, { label: string; className: string }> = {
  clean: { label: " ", className: "text-text-muted" },
  added: { label: "A", className: "text-green-400" },
  modified: { label: "M", className: "text-yellow-400" },
  deleted: { label: "D", className: "text-red-400" },
  renamed: { label: "R", className: "text-blue-400" },
  untracked: { label: "?", className: "text-text-secondary" },
  conflicted: { label: "!", className: "text-orange-400" },
  ignored: { label: "I", className: "text-text-muted" },
};

export function FileStatusIcon({ kind }: { kind: FileStatusKind }) {
  const { label, className } = KIND_STYLES[kind] ?? KIND_STYLES.modified;
  return (
    <span className={`font-mono text-xs font-bold w-4 text-center ${className}`}>
      {label}
    </span>
  );
}
