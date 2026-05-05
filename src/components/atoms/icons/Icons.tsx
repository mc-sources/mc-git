interface IconProps {
  className?: string;
}

const base = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  width: 16,
  height: 16,
  style: { display: "block", flexShrink: 0 } as React.CSSProperties,
};

export function IconChanges({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2 4h8M2 8h6M2 12h4" />
      <circle cx="12" cy="10" r="2.5" />
      <path d="M12 5v2.5" />
    </svg>
  );
}

export function IconHistory({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3.5l2 2" />
    </svg>
  );
}

export function IconBranch({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="4" cy="3.5" r="1.5" />
      <circle cx="4" cy="12.5" r="1.5" />
      <circle cx="12" cy="3.5" r="1.5" />
      <path d="M4 5v5.5M4 5C4 8 12 7 12 5" />
    </svg>
  );
}

export function IconRemote({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 2C6 4 5 6 5 8s1 4 3 6M8 2c2 2 3 4 3 6s-1 4-3 6M2 8h12" />
    </svg>
  );
}

export function IconGit({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      width={16}
      height={16}
      style={{ display: "block", flexShrink: 0 }}
    >
      <path d="M15.698 7.287L8.712.302a1.03 1.03 0 00-1.457 0L5.7 1.857l1.845 1.845a1.223 1.223 0 011.55 1.56l1.777 1.777a1.224 1.224 0 11-.734.734L8.31 6.047v4.51a1.224 1.224 0 11-1.001-.009V5.997a1.224 1.224 0 01-.664-1.607L4.81 2.545 .302 7.053a1.03 1.03 0 000 1.457l6.986 6.985a1.03 1.03 0 001.457 0l6.953-6.953a1.031 1.031 0 000-1.255z" />
    </svg>
  );
}

export function IconSettings({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 2v1M8 13v1M2 8H1M15 8h-1M3.5 3.5l.7.7M11.8 11.8l.7.7M3.5 12.5l.7-.7M11.8 4.2l.7-.7" />
    </svg>
  );
}

export function IconTag({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2 2h6l6 6-6 6-6-6V2z" />
      <circle cx="5" cy="5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconFolder({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M1.5 3.5h4l1.5 2h7.5v8H1.5V3.5z" />
    </svg>
  );
}

export function IconFetch({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 2v8M5 7l3 3 3-3" />
      <path d="M3 13h10" />
    </svg>
  );
}

export function IconPull({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 12V4M5 9l3 3 3-3" />
      <circle cx="4" cy="3" r="1.5" />
      <circle cx="12" cy="3" r="1.5" />
      <path d="M4 4.5v3C4 9 6 10 8 10s4-1 4-2.5v-3" />
    </svg>
  );
}

export function IconPush({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 4v8M5 7l3-3 3 3" />
      <circle cx="4" cy="13" r="1.5" />
      <circle cx="12" cy="13" r="1.5" />
      <path d="M4 11.5v-3C4 7 6 6 8 6s4 1 4 2.5v3" />
    </svg>
  );
}

export function IconTerminal({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
      <path d="M4 6.5l2.5 2L4 10.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 10.5h3" strokeLinecap="round" />
    </svg>
  );
}

export function IconRefresh({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M13.5 8a5.5 5.5 0 1 1-1.1-3.3" />
      <path d="M13.5 2.5v3h-3" />
    </svg>
  );
}

export function IconForcePush({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 3v9M5 6l3-3 3 3" strokeWidth="2.2" />
      <path d="M4 14h8" strokeWidth="1.5" strokeDasharray="2 1.5" />
    </svg>
  );
}

export function IconCode({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5.5 5.5L2 8l3.5 2.5M10.5 5.5L14 8l-3.5 2.5M9 4l-2 8" />
    </svg>
  );
}

export function IconChevronRight({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

export function IconChevronDown({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export function IconReflog({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-4.95" />
    </svg>
  );
}

export function IconSubmodule({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
      <path d="M7 4.5h2a1 1 0 0 1 1 1v3" />
    </svg>
  );
}

export function IconPullRequest({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="4" cy="3.5" r="1.5" />
      <circle cx="4" cy="12.5" r="1.5" />
      <circle cx="12" cy="3.5" r="1.5" />
      <path d="M4 5v5.5M12 5v1.5a3 3 0 0 1-3 3H7" />
      <path d="M5.5 10.5 4 12l1.5 1.5" />
    </svg>
  );
}

export function IconExternalDiff({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2 4h5M2 8h3M2 12h5" />
      <path d="M10 4h4M10 8h4M10 12h4" />
      <path d="M7.5 8h1" strokeWidth="1" />
      <path d="M12 2v4M10 3l2-2 2 2" />
      <path d="M12 14v-4M14 13l-2 2-2-2" />
    </svg>
  );
}

export function IconFeedback({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M13 2H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2v3l3-3h5a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z" />
      <path d="M8 6v.01M5.5 6v.01M10.5 6v.01" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconTools({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </svg>
  );
}
