import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconChevronDown } from "./icons";

export interface DropdownButtonItem {
  icon: React.FC<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function DropdownButton({
  icon: Icon,
  label,
  items,
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  items: DropdownButtonItem[];
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLButtonElement>(null);
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
    <>
      <button
        ref={containerRef}
        onClick={toggleDropdown}
        title={label}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs bg-surface-overlay hover:bg-surface-active rounded-md text-text-primary transition-all duration-100 border border-surface-border shrink-0 ${open ? "bg-surface-active" : ""}`}
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="whitespace-nowrap">{label}</span>
        <IconChevronDown className="w-3 h-3 text-text-secondary" />
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
    </>
  );
}
