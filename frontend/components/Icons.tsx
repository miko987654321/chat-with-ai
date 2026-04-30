type IconProps = React.SVGProps<SVGSVGElement>;

const baseProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function PlusIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function TrashIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function PencilIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

export function SendIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

export function StopIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export function MessageIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function SparkleIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <path d="M12 2v6" />
      <path d="M12 16v6" />
      <path d="M2 12h6" />
      <path d="M16 12h6" />
      <path d="M5 5l4 4" />
      <path d="M15 15l4 4" />
      <path d="M5 19l4-4" />
      <path d="M15 9l4-4" />
    </svg>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function XIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function MenuIcon(p: IconProps) {
  return (
    <svg {...baseProps} {...p}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
