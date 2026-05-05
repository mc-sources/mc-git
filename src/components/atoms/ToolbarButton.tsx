export function ToolbarButton({
  icon: Icon,
  label,
  badge,
  loading,
  disabled,
  onClick,
  className = "",
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  badge?: number | null;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs bg-surface-overlay hover:bg-surface-active disabled:opacity-40 rounded-md text-text-primary hover:text-text-primary transition-all duration-100 border border-surface-border shrink-0 ${className}`}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-text-secondary border-t-transparent animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5" />
      )}
      <span className="whitespace-nowrap">{label}</span>
      {badge != null && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold bg-blue-500 text-white rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5">
          {badge}
        </span>
      )}
    </button>
  );
}
