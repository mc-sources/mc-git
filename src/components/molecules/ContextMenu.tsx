import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface MenuItem {
  id: string;
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { offsetWidth: w, offsetHeight: h } = el;
    const maxX = window.innerWidth - w - 4;
    const maxY = window.innerHeight - h - 4;
    setPos({
      left: Math.max(4, Math.min(x, maxX)),
      top: Math.max(4, Math.min(y, maxY)),
    });
  }, [x, y, items]);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleResize = () => onClose();
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleResize);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      style={{ left: pos.left, top: pos.top }}
      className="fixed z-50 min-w-[200px] py-1 bg-surface-elevated border border-surface-border rounded-md shadow-2xl"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.id}
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return;
            item.onClick();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left text-text-primary hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
        >
          {item.icon && <span className="shrink-0 w-4 text-center text-text-muted">{item.icon}</span>}
          <span className="flex-1 truncate">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
