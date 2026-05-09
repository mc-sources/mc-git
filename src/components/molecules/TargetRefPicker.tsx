import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGitStore } from "../../store/gitStore";

interface Props {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const HEAD_VALUE = "HEAD";
const CUSTOM_SENTINEL = "__CUSTOM__";

export function TargetRefPicker({ value, onChange, disabled = false }: Props) {
  const { t } = useTranslation();
  const { branches } = useGitStore();
  const localBranches = branches.filter((b) => !b.isRemote);
  const remoteBranches = branches.filter((b) => b.isRemote && !b.name.endsWith("/HEAD"));

  const isKnown = (v: string) => v === HEAD_VALUE || branches.some((b) => b.name === v);
  const [customMode, setCustomMode] = useState(!isKnown(value) && value !== "");

  useEffect(() => {
    if (!isKnown(value) && value !== "") setCustomMode(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, branches]);

  if (customMode) {
    return (
      <div className="flex gap-1.5 items-stretch flex-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setCustomMode(false);
            onChange(HEAD_VALUE);
          }}
          title={t("targetRefPicker.back")}
          className="text-xs px-2 py-1 rounded border border-surface-border text-text-muted hover:text-text-primary hover:border-text-muted/40 transition-colors disabled:opacity-50 shrink-0"
        >
          ←
        </button>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={40}
          disabled={disabled}
          placeholder="OID"
          className="flex-1 bg-surface-elevated text-text-primary text-xs rounded px-2 py-1 border border-surface-border focus:outline-none focus:border-blue-500 placeholder:text-text-muted font-mono disabled:opacity-50"
        />
      </div>
    );
  }

  return (
    <div className="relative flex-1">
      <select
        value={value}
        onChange={(e) => {
          if (e.target.value === CUSTOM_SENTINEL) {
            setCustomMode(true);
            onChange("");
          } else {
            onChange(e.target.value);
          }
        }}
        disabled={disabled}
        className="w-full appearance-none bg-surface-elevated text-text-primary text-xs rounded-md px-2 py-1 pr-6 border border-surface-border focus:outline-none focus:border-blue-500 disabled:opacity-50"
      >
        <option value={HEAD_VALUE} className="bg-zinc-900 text-zinc-100">
          {t("targetRefPicker.head")}
        </option>
        {localBranches.length > 0 && (
          <optgroup label={t("targetRefPicker.branchLocal")}>
            {localBranches.map((b) => (
              <option key={b.name} value={b.name} className="bg-zinc-900 text-zinc-100">
                {b.name}
              </option>
            ))}
          </optgroup>
        )}
        {remoteBranches.length > 0 && (
          <optgroup label={t("targetRefPicker.branchRemote")}>
            {remoteBranches.map((b) => (
              <option key={b.name} value={b.name} className="bg-zinc-900 text-zinc-100">
                {b.name}
              </option>
            ))}
          </optgroup>
        )}
        <option value={CUSTOM_SENTINEL} className="bg-zinc-900 text-zinc-100">
          {t("targetRefPicker.customOid")}
        </option>
      </select>
      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted text-[10px]">▾</span>
    </div>
  );
}
