import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronDown } from "./icons";

export interface SplitButtonItem {
  icon: React.FC<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function SplitButton({
  icon: Icon,
  label,
  badge,
  loading = false,
  dropdownLoading = false,
  disabled = false,
  onClick,
  items,
  className = "",
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  badge?: number | null;
  loading?: boolean;
  dropdownLoading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  items: SplitButtonItem[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => {
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex shrink-0">
      {badge != null && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold bg-blue-500 text-white rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5 z-10 pointer-events-none">
          {badge}
        </span>
      )}
      {/* Main button */}
      <button
        onClick={onClick}
        disabled={disabled}
        title={label}
        className={`flex items-center gap-1.5 pl-3 pr-2.5 py-1.5 text-xs bg-surface-overlay hover:bg-surface-active disabled:opacity-40 rounded-l-md text-text-primary transition-all duration-100 border border-r-0 border-surface-border ${className}`}
      >
        {loading ? (
          <span className="w-3.5 h-3.5 rounded-full border-2 border-text-secondary border-t-transparent animate-spin" />
        ) : (
          <Icon className="w-3.5 h-3.5" />
        )}
        <span className="whitespace-nowrap">{label}</span>
      </button>
      {/* Dropdown arrow */}
      <button
        onClick={toggleDropdown}
        disabled={disabled || dropdownLoading}
        aria-label="More options"
        className={`flex items-center justify-center px-1 py-1.5 bg-surface-overlay hover:bg-surface-active disabled:opacity-40 rounded-r-md text-text-secondary hover:text-text-primary transition-all duration-100 border border-surface-border ${open ? "bg-surface-active text-text-primary" : ""}`}
      >
        {dropdownLoading ? (
          <span className="w-3 h-3 rounded-full border border-text-secondary border-t-transparent animate-spin" />
        ) : (
          <IconChevronDown className="w-3 h-3" />
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 200 }}
            className="bg-surface-elevated border border-surface-border rounded-md shadow-lg overflow-hidden min-w-max"
          >
            {items.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
                disabled={item.disabled}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-text-primary hover:bg-surface-hover disabled:opacity-40 transition-colors whitespace-nowrap ${item.className ?? ""}`}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
